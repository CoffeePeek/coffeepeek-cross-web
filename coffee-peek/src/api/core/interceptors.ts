/**
 * Интерцепторы для HTTP запросов
 * Обрабатывают токены, ошибки и логирование
 */

import type { ApiError } from './types';
import { type ApiErrorResponse, ApiRequestError } from './apiError';
import { getErrorMessageByStatus } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { isTokenExpired } from '../../utils/jwt';
import { normalizeReviewDto } from './reviewNormalize';
import { normalizeCheckInDto } from './checkInNormalize';
import { normalizeDayOfWeek } from '../../utils/shopUtils';

/**
 * Token Manager для работы с токенами аутентификации
 */
export class TokenManager {
  private static accessToken: string | null = null;
  private static revision = 0;
  static getRevision(): number { return this.revision; }

  static getAccessToken(): string | null {
    return this.accessToken;
  }

  static setAccessToken(accessToken: string): void {
    this.revision++;
    this.accessToken = accessToken;
    sessionAbsent = false;
  }

  static clearTokens(): void {
    this.revision++;
    this.accessToken = null;
  }

  static isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}

// Remove credentials persisted by older builds. Browser auth now keeps the
// short-lived access token in memory and the refresh token in an HttpOnly cookie.
try {
  globalThis.localStorage?.removeItem('accessToken');
  globalThis.localStorage?.removeItem('refreshToken');
} catch {
  // Storage can be unavailable in private/restricted browser contexts.
}

const TOKEN_PATH = '/api/tokens';

export const LOGGED_OUT_KEY = 'coffeepeek:logged-out';

/** ok — новый токен; rejected — сервер отверг refresh (сессии нет); error — сеть/5xx/429, сессия может быть жива. */
export type RefreshResult = 'ok' | 'rejected' | 'error';

let refreshInFlight: Promise<RefreshResult> | null = null;
// Сервер уже сказал, что refresh-cookie нет — не дёргаем PUT /api/tokens перед каждым запросом анонима.
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

export function pickAuthTokens(payload: unknown): { accessToken?: string; refreshToken?: string } {
  if (!payload || typeof payload !== 'object') return {};
  const data = payload as Record<string, unknown>;
  const accessToken =
    (typeof data.accessToken === 'string' && data.accessToken) ||
    (typeof data.AccessToken === 'string' && data.AccessToken) ||
    undefined;
  const refreshToken =
    (typeof data.refreshToken === 'string' && data.refreshToken) ||
    (typeof data.RefreshToken === 'string' && data.RefreshToken) ||
    undefined;
  return { accessToken, refreshToken };
}

async function performRefresh(baseURL: string): Promise<RefreshResult> {
  const revision = TokenManager.getRevision();
  try {
    const response = await fetch(`${baseURL}${TOKEN_PATH}`, {
      method: 'PUT',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (revision !== TokenManager.getRevision()) return 'error';
    if (response.status === 401 || response.status === 403) {
      sessionAbsent = true;
      return 'rejected';
    }
    if (!response.ok) return 'error';

    const json = await response.json();
    if (revision !== TokenManager.getRevision()) return 'error';
    const payload = json?.data ?? json;
    const tokens = pickAuthTokens(payload);
    if (!tokens.accessToken) return 'error';

    TokenManager.setAccessToken(tokens.accessToken);
    return 'ok';
  } catch (err) {
    logger.error('[Auth] Refresh failed', err);
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

export async function ensureFreshAccessToken(baseURL: string): Promise<boolean> {
  const access = TokenManager.getAccessToken();
  if (access && !isTokenExpired(access)) return true;
  // Нет токена в памяти и сессии заведомо нет (явный выход или refresh уже отвергнут) — не восстанавливаем её молча.
  if (!access && (sessionAbsent || isLoggedOutFlagSet())) return false;
  return (await tryRefreshAccessToken(baseURL)) === 'ok';
}

export function requestInterceptor(
  url: string,
  options: RequestInit & { skipAuthHeader?: boolean },
  _requiresAuth: boolean = true
): RequestInit {
  const headers = new Headers(options.headers);

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !(options.body instanceof URLSearchParams)
  ) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  // Добавляем Authorization заголовок если токен доступен
  // Даже для публичных эндпоинтов токен нужен для персонализации (isVisited и т.д.)
  const token = TokenManager.getAccessToken();
  if (token && !options.skipAuthHeader) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  logger.log(`[API Request] ${options.method || 'GET'} ${url}`, {
    headers: Object.fromEntries(headers.entries()),
    body: options.body,
  });

  const { skipAuthHeader: _skipAuthHeader, ...fetchOptions } = options;
  return {
    ...fetchOptions,
    credentials: fetchOptions.credentials ?? 'include',
    headers,
  };
}

export async function responseInterceptor<T>(
  response: Response,
  url: string
): Promise<T> {
  if (response.status === 204) return {} as T;
  const contentType = response.headers.get('content-type');

  logger.log(`[API Response] ${response.status} ${url}`, {
    ok: response.ok,
    contentType,
  });

  if (!contentType?.includes('application/json')) {
    if (response.ok) {
      return {} as T;
    }

    if (response.status >= 500 && response.status < 600) {
      handleServerError();
    }

    throw createApiError(response.status, getErrorMessageByStatus(response.status));
  }

  const data = await response.json();

  if (!response.ok) {
    if (response.status >= 500 && response.status < 600) {
      handleServerError();
    }

    const errorBody: ApiErrorResponse = {
      isSuccess: false,
      message: data.message || getErrorMessageByStatus(response.status),
      errorCode: data.errorCode,
      errors: data.errors,
    };

    throw new ApiRequestError(response.status, errorBody);
  }

  const isSuccess =
    data.success !== false &&
    (data.isSuccess === true || data.success === true);

  if (!isSuccess) {
    const errorBody: ApiErrorResponse = {
      isSuccess: false,
      message: data.message || getErrorMessageByStatus(response.status) || 'Запрос не выполнен',
      errorCode: data.errorCode,
      errors: data.errors,
    };

    throw new ApiRequestError(response.status, errorBody);
  }

  return data;
}

export function normalizeResponseData<T>(data: any): T {
  if (!data || typeof data !== 'object') {
    return data;
  }

  data = normalizePublicDto(data);
  if ('coffeeShops' in data && Array.isArray(data.coffeeShops)) {
    return { ...data, coffeeShops: data.coffeeShops.map(normalizeCoffeeShopData) } as T;
  }
  if ('name' in data && ('shopContact' in data || 'schedules' in data || 'beans' in data || 'reviews' in data || 'userCheckIns' in data)) {
    return normalizeCoffeeShopData(data) as T;
  }
  return data;
}

/** UI keys named id are slugs for public entities; service IDs remain unchanged. */
export function normalizePublicDto(data: any): any {
  if (Array.isArray(data)) return data.map(normalizePublicDto);
  if (!data || typeof data !== 'object' || ('slug' in data && 'canonicalPath' in data)) return data;
  const result: any = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, normalizePublicDto(value)]));
  const address = data.address && typeof data.address === 'object' ? data.address : null;
  if (address?.slug) {
    result.publicAddress = address;
    result.id ??= address.slug;
    result.canonicalPath = address.canonicalPath;
  } else if (typeof data.slug === 'string') result.id ??= data.slug;
  if (data.coverPhoto && typeof data.coverPhoto === 'object') result.photoUrl ??= data.coverPhoto.urls?.card ?? data.coverPhoto.fullUrl;
  if ('city' in data) result.cityId = data.city?.slug ?? '';
  if ('shop' in data && typeof data.shop !== 'string') {
    result.shopId = data.shop?.slug ?? '';
    result.coffeeShopId = result.shopId;
  }
  if ('author' in data) result.userId = data.author?.slug ?? '';
  if ('primaryZone' in data) result.primaryZoneId = data.primaryZone?.slug ?? null;
  return result;
}

/**
 * Интерфейсы для нормализации данных API
 */
interface BackendSchedule {
  dayOfWeek: number | string;
  isClosed?: boolean;
  intervals?: Array<{
    openTime: string;
    closeTime: string;
  }>;
  openTime?: string;
  closeTime?: string;
}

interface BackendShopContact {
  phoneNumber?: string;
  phone?: string;
  email?: string;
  siteLink?: string;
  website?: string;
  instagramLink?: string;
  instagram?: string;
}

interface BackendShopData {
  id?: string;
  name?: string;
  address?: string;
  Address?: string;
  notValidatedAddress?: string;
  coffeeBeans?: unknown[];
  shopContact?: BackendShopContact | null;
  schedules?: BackendSchedule[];
  [key: string]: unknown;
}

/**
 * Нормализует данные кофейни из формата API в формат, ожидаемый фронтендом
 */
function normalizeCoffeeShopData(shop: BackendShopData | unknown): Record<string, unknown> {
  if (!shop || typeof shop !== 'object') {
    return shop as Record<string, unknown>;
  }

  const shopData = shop as BackendShopData;
  const normalized: Record<string, unknown> = { ...shopData };
  if (shopData.address && typeof shopData.address === 'object') {
    normalized.publicAddress = shopData.address;
    normalized.address = (shopData.location as { address?: string } | undefined)?.address;
  }

  if (normalized.menu === undefined && 'Menu' in shopData) {
    normalized.menu = shopData.Menu;
  }

  // Flatten location.address → address for list cards / legacy fields
  const loc = (shopData as { location?: { address?: string } }).location;
  if (loc?.address && !normalized.address) {
    normalized.address = loc.address;
  }

  // Нормализуем адрес: на бэкенде может быть "address" или "Address", на фронтенде для модерации используется "notValidatedAddress"
  if (typeof normalized.address === 'string' && !('notValidatedAddress' in shop)) {
    normalized.notValidatedAddress = normalized.address;
  } else if ('Address' in shop && !('notValidatedAddress' in shop)) {
    normalized.notValidatedAddress = shop.Address;
  }

  // Переименовываем coffeeBeans в beans
  if ('coffeeBeans' in shop && Array.isArray(shop.coffeeBeans)) {
    normalized.beans = shop.coffeeBeans;
    delete normalized.coffeeBeans;
  }

  // Нормализуем shopContact
  if ('shopContact' in shopData && shopData.shopContact) {
    const contact = shopData.shopContact as BackendShopContact;
    normalized.shopContact = {
      phone: contact.phoneNumber || contact.phone,
      email: contact.email,
      website: contact.siteLink || contact.website,
      instagram: contact.instagramLink || contact.instagram,
    };
  }

  // Нормализуем schedules
  if ('schedules' in shopData && Array.isArray(shopData.schedules)) {
    normalized.schedules = shopData.schedules
      .filter((schedule: BackendSchedule) => {
        // Пропускаем закрытые дни
        if (schedule.isClosed === true) return false;
        // Проверяем наличие интервалов
        if (schedule.intervals && Array.isArray(schedule.intervals) && schedule.intervals.length > 0) {
          return true;
        }
        // Поддерживаем старый формат с прямыми полями
        return schedule.openTime && schedule.closeTime;
      })
      .map((schedule: BackendSchedule) => {
        const dayOfWeek = normalizeDayOfWeek(schedule.dayOfWeek);
        if (dayOfWeek === null) return null;
        if (schedule.intervals && Array.isArray(schedule.intervals) && schedule.intervals.length > 0) {
          // Новый формат с intervals
          const interval = schedule.intervals[0];
          // Преобразуем "HH:mm:ss" в "HH:mm" для фронтенда
          const openTime = interval.openTime ? interval.openTime.substring(0, 5) : '';
          const closeTime = interval.closeTime ? interval.closeTime.substring(0, 5) : '';
          return {
            dayOfWeek,
            openTime,
            closeTime,
          };
        } else {
          // Старый формат с прямыми полями
          const openTime = schedule.openTime ? schedule.openTime.substring(0, 5) : '';
          const closeTime = schedule.closeTime ? schedule.closeTime.substring(0, 5) : '';
          return {
            dayOfWeek,
            openTime,
            closeTime,
          };
        }
      })
      .filter((s): s is { dayOfWeek: number; openTime: string; closeTime: string } => s !== null);
  }

  // Нормализуем reviews если они есть (ReviewDto: rating — объект, дата — createdAtUtc)
  if ('reviews' in shop && Array.isArray(shop.reviews)) {
    normalized.reviews = shop.reviews.map((review: any) => normalizeReviewDto(review));
  }

  const userCheckIns = shopData.userCheckIns ?? shopData.UserCheckIns;
  if (Array.isArray(userCheckIns)) {
    normalized.userCheckIns = userCheckIns.map((checkIn: any) => normalizeCheckInDto(checkIn));
  }

  // Нормализуем photos
  if ('photos' in shop && Array.isArray(shop.photos)) {
    normalized.photos = shop.photos;
    // Также создаем imageUrls для обратной совместимости
    if (!normalized.imageUrls) {
      normalized.imageUrls = shop.photos.map((photo: any) => photo.url || photo.thumbnailUrl || '');
    }
  }

  return normalized;
}

function handleServerError(): void {
  import('../../utils/globalErrorHandler')
    .then(({ showServerErrorNotification }) => {
      showServerErrorNotification();
    })
    .catch((err) => {
      logger.error('[Interceptor] Failed to show server error notification:', err);
    });
}

function createApiError(status: number, message: string): ApiError {
  return {
    status,
    message,
  };
}
