import { ApiRequestError, PaginatedMeta } from './types';
import { isTokenExpired } from '../../utils/jwt';

export class TokenManager {
  private static accessToken: string | null = null;

  static getAccessToken(): string | null {
    return this.accessToken;
  }

  static setAccessToken(accessToken: string): void {
    this.accessToken = accessToken;
    sessionAbsent = false;
  }

  static clearTokens(): void {
    this.accessToken = null;
  }

  static isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}

try {
  globalThis.localStorage?.removeItem('admin_accessToken');
  globalThis.localStorage?.removeItem('admin_refreshToken');
} catch {
  // Storage can be unavailable in private/restricted browser contexts.
}

const TOKEN_PATH = '/api/tokens';

export const LOGGED_OUT_KEY = 'coffeepeek-admin:logged-out';

/** ok — новый токен; rejected — сервер отверг refresh (сессии нет); error — сеть/5xx/429, сессия может быть жива. */
export type RefreshResult = 'ok' | 'rejected' | 'error';

let refreshInFlight: Promise<RefreshResult> | null = null;
// Сервер уже сказал, что refresh-cookie нет — не дёргаем PUT /api/tokens перед каждым запросом.
let sessionAbsent = false;

function isLoggedOutFlagSet(): boolean {
  try {
    return globalThis.localStorage?.getItem(LOGGED_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

export function isAuthTokenEndpoint(endpoint: string): boolean {
  return endpoint === TOKEN_PATH || endpoint.startsWith(`${TOKEN_PATH}/`);
}

export function pickAuthTokens(payload: unknown, depth = 0): { accessToken?: string; refreshToken?: string } {
  if (!payload || typeof payload !== 'object' || depth > 3) return {};
  const data = payload as Record<string, unknown>;

  const asTokenString = (value: unknown): string | undefined => {
    if (typeof value === 'string' && value.length > 0) return value;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      for (const key of ['token', 'Token', 'value', 'Value']) {
        if (typeof nested[key] === 'string' && nested[key]) return nested[key] as string;
      }
    }
    return undefined;
  };

  const accessToken =
    asTokenString(data.accessToken) ||
    asTokenString(data.AccessToken) ||
    asTokenString(data.token) ||
    asTokenString(data.Token) ||
    asTokenString(data.jwt);

  const refreshToken =
    asTokenString(data.refreshToken) ||
    asTokenString(data.RefreshToken) ||
    asTokenString(data.refresh_token);

  if (accessToken || refreshToken) {
    return { accessToken, refreshToken };
  }

  for (const key of ['data', 'Data', 'tokens', 'Tokens']) {
    if (data[key] && typeof data[key] === 'object') {
      const nested = pickAuthTokens(data[key], depth + 1);
      if (nested.accessToken || nested.refreshToken) return nested;
    }
  }

  return {};
}

async function performRefresh(baseURL: string): Promise<RefreshResult> {
  try {
    const response = await fetch(`${baseURL}${TOKEN_PATH}`, {
      method: 'PUT',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (response.status === 401 || response.status === 403) {
      sessionAbsent = true;
      return 'rejected';
    }
    if (!response.ok) return 'error';

    const json = await response.json();
    const tokens = pickAuthTokens(json);
    if (!tokens.accessToken) return 'error';

    TokenManager.setAccessToken(tokens.accessToken);
    return 'ok';
  } catch {
    return 'error';
  }
}

export function tryRefreshAccessToken(baseURL: string): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = performRefresh(baseURL).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function ensureFreshAccessTokenResult(baseURL: string): Promise<RefreshResult> {
  const access = TokenManager.getAccessToken();
  if (access && !isTokenExpired(access)) return 'ok';
  // Нет токена в памяти и сессии заведомо нет (явный выход или refresh уже отвергнут) — не восстанавливаем её молча.
  if (!access && (sessionAbsent || isLoggedOutFlagSet())) return 'rejected';
  return tryRefreshAccessToken(baseURL);
}

export async function ensureFreshAccessToken(baseURL: string): Promise<boolean> {
  return (await ensureFreshAccessTokenResult(baseURL)) === 'ok';
}

export interface InterceptedResponse<T> {
  envelope: T;
  pagination?: PaginatedMeta;
}

export function requestInterceptor(
  _url: string,
  options: RequestInit & { skipAuthHeader?: boolean },
  _requiresAuth: boolean = true
): RequestInit {
  const headers = new Headers(options.headers);

  if (options.body && !(options.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const token = TokenManager.getAccessToken();
  if (token && !options.skipAuthHeader) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const { skipAuthHeader: _skipAuthHeader, ...fetchOptions } = options;
  return { ...fetchOptions, credentials: fetchOptions.credentials ?? 'include', headers };
}

export async function responseInterceptor<T>(
  response: Response,
  _url: string
): Promise<InterceptedResponse<T>> {
  if (response.status === 204) return { envelope: {} as T };
  const contentType = response.headers.get('content-type');

  if (!contentType?.includes('application/json')) {
    if (response.ok) return { envelope: {} as T };
    throw createApiError(response.status, getErrorMessageByStatus(response.status));
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      formatErrorMessage(data, response.status),
      data.errors ?? data.Errors,
      data.errorCode ?? data.ErrorCode
    );
  }

  return {
    envelope: data,
    pagination: extractPagination(response.headers, data.data ?? data),
  };
}

export function normalizeResponseData<T>(data: unknown): T {
  if (!data || typeof data !== 'object') {
    return data as T;
  }

  const record = data as Record<string, unknown>;

  if ('moderationShop' in record) {
    const shop = record.moderationShop;
    if (shop && typeof shop === 'object' && !Array.isArray(shop) && record.menu !== undefined) {
      return { ...(shop as Record<string, unknown>), menu: record.menu } as T;
    }
    return shop as T;
  }

  return data as T;
}

function extractPagination(headers: Headers, data: unknown): PaginatedMeta | undefined {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if ('totalItems' in record || 'totalPages' in record) {
      return {
        totalCount: Number(record.totalItems ?? 0),
        totalPages: Number(record.totalPages ?? 1),
        currentPage: Number(record.currentPage ?? 1),
        pageSize: Number(record.pageSize ?? 20),
      };
    }
  }

  const totalCount = headers.get('X-Total-Count');
  if (!totalCount) return undefined;

  return {
    totalCount: parseInt(totalCount, 10),
    totalPages: parseInt(headers.get('X-Total-Pages') ?? '1', 10),
    currentPage: parseInt(headers.get('X-Current-Page') ?? '1', 10),
    pageSize: parseInt(headers.get('X-Page-Size') ?? '20', 10),
  };
}

function getErrorMessageByStatus(status: number): string {
  switch (status) {
    case 400: return 'Неверный запрос';
    case 401: return 'Не авторизован';
    case 403: return 'Доступ запрещён';
    case 404: return 'Не найдено';
    case 409: return 'Конфликт данных';
    case 422: return 'Ошибка валидации';
    case 500: return 'Внутренняя ошибка сервера';
    case 503: return 'Сервис недоступен';
    default: return 'Произошла ошибка';
  }
}

function formatErrorMessage(data: Record<string, unknown>, status: number): string {
  const direct =
    (typeof data.message === 'string' && data.message) ||
    (typeof data.Message === 'string' && data.Message) ||
    (typeof data.title === 'string' && data.title) ||
    (typeof data.Title === 'string' && data.Title) ||
    (typeof data.detail === 'string' && data.detail) ||
    (typeof data.Detail === 'string' && data.Detail) ||
    '';

  const errors = (data.errors ?? data.Errors) as Record<string, string[] | string> | undefined;
  const fromErrors = errors
    ? Object.entries(errors)
        .flatMap(([key, value]) => {
          const texts = Array.isArray(value) ? value : [String(value)];
          return texts.map((text) => (key && key !== '' ? `${key}: ${text}` : text));
        })
        .filter(Boolean)
        .join('; ')
    : '';

  if (direct && fromErrors) return `${direct} — ${fromErrors}`;
  if (direct) return direct;
  if (fromErrors) return fromErrors;
  return getErrorMessageByStatus(status);
}

function createApiError(status: number, message: string): ApiRequestError {
  return new ApiRequestError(status, message);
}
