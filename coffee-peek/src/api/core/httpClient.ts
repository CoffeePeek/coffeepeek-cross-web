/**
 * Централизованный HTTP клиент для всех API запросов
 * Обеспечивает единый интерфейс для работы с API
 */


import type { ApiResponse, ApiConfig, RequestOptions } from './types';
import { API_BASE_URL, API_GATEWAY_URL, buildUrlWithParams } from './apiConfig';
import {
  requestInterceptor,
  responseInterceptor,
  normalizeResponseData,
  TokenManager,
  isAuthTokenEndpoint,
  tryRefreshAccessToken,
  ensureFreshAccessToken,
} from './interceptors';
import { ApiRequestError } from './apiError';
import { emitSessionInvalidated } from '../../realtime/forceLogout';
import { getCatalogScope } from '../../lib/catalogSession';
import { captureAnalyticsEvent } from '../../lib/analytics';
import { analyticsApiCategory } from '../../lib/analyticsContext';
import { getAnalyticsError } from '../../lib/analyticsError';
import { getPhotoSession } from '../../lib/photoSession';
import type { PhotoResponse } from '../../lib/photoResponse';
import { parseJWT } from '../../utils/jwt';

type InternalRequestOptions = RequestOptions & { _retry?: boolean; raw?: boolean; binary?: boolean; photoMetadata?: boolean };

/**
 * Базовый HTTP клиент
 */
class HttpClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * Читает пагинацию из заголовков и/или тела ответа.
   * Не использовать длину массива страницы как total.
   */
  private extractPaginationMeta(
    response: Response,
    body: any
  ): ApiResponse<unknown>['pagination'] | undefined {
    const headerTotal = response.headers.get('X-Total-Count') ?? response.headers.get('x-total-count');
    const headerPages = response.headers.get('X-Total-Pages') ?? response.headers.get('x-total-pages');
    const headerPage = response.headers.get('X-Current-Page') ?? response.headers.get('X-Page-Number');
    const headerPageSize = response.headers.get('X-Page-Size') ?? response.headers.get('x-page-size');

    const payload = body?.data && typeof body.data === 'object' ? body.data : body;
    const bodyTotal =
      payload?.totalItems ?? payload?.TotalItems ?? payload?.totalCount ?? payload?.TotalCount;
    const bodyPages = payload?.totalPages ?? payload?.TotalPages;
    const bodyPage = payload?.currentPage ?? payload?.page ?? payload?.Page;
    const bodyPageSize = payload?.pageSize ?? payload?.PageSize;

    const totalItems = headerTotal != null ? Number(headerTotal) : bodyTotal != null ? Number(bodyTotal) : undefined;
    const totalPages = headerPages != null ? Number(headerPages) : bodyPages != null ? Number(bodyPages) : undefined;
    const page = headerPage != null ? Number(headerPage) : bodyPage != null ? Number(bodyPage) : undefined;
    const pageSize = headerPageSize != null ? Number(headerPageSize) : bodyPageSize != null ? Number(bodyPageSize) : undefined;

    if (
      totalItems === undefined &&
      totalPages === undefined &&
      page === undefined &&
      pageSize === undefined
    ) {
      return undefined;
    }

    return {
      ...(Number.isFinite(totalItems) ? { totalItems } : {}),
      ...(Number.isFinite(totalPages) ? { totalPages } : {}),
      ...(Number.isFinite(page) ? { page } : {}),
      ...(Number.isFinite(pageSize) ? { pageSize } : {}),
    };
  }

  /**
   * Выполняет HTTP запрос
   */
  private async request<T>(
    endpoint: string,
    options: InternalRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const startedAt = Date.now();
    const scope = getCatalogScope();
    const trace = { authRetried: false };
    const base = { category: analyticsApiCategory(endpoint), method: options.method ?? 'GET' };
    try {
      const response = await this.executeRequest<T>(endpoint, options, trace);
      if (scope === getCatalogScope()) captureAnalyticsEvent('api_request_completed', {
        ...base, outcome: 'success', duration_ms: Date.now() - startedAt,
        auth_retried: trace.authRetried, status_code: typeof response.statusCode === 'number' ? response.statusCode : undefined,
      });
      return response;
    } catch (error) {
      const diagnostic = getAnalyticsError(error);
      if (scope === getCatalogScope() && diagnostic.error_category !== 'cancelled') captureAnalyticsEvent('api_request_completed', {
        ...base, outcome: 'failure', duration_ms: Date.now() - startedAt,
        auth_retried: trace.authRetried, ...diagnostic,
      });
      throw error;
    }
  }

  private async executeRequest<T>(
    endpoint: string,
    options: InternalRequestOptions,
    trace: { authRetried: boolean },
  ): Promise<ApiResponse<T>> {
    const { params, requiresAuth = true, skipAuthHeader, _retry, raw, binary, photoMetadata, ...fetchOptions } = options;
    const scope = getCatalogScope();
    const photoSession = getPhotoSession();
    const checkSession = () => { if (scope !== getCatalogScope() || fetchOptions.signal?.aborted || photoMetadata && photoSession !== getPhotoSession()) throw new DOMException('Session changed or request cancelled', 'AbortError'); };

    // Строим URL с параметрами
    const urlWithParams = buildUrlWithParams(endpoint, params);
    const fullUrl = `${this.baseURL}${urlWithParams}`;

    if (!_retry && !skipAuthHeader && !isAuthTokenEndpoint(endpoint)) {
      await ensureFreshAccessToken(this.baseURL);
    }
    checkSession();
    if (photoMetadata) {
      const token = TokenManager.getAccessToken();
      const exp = token ? parseJWT(token)?.exp : undefined;
      if (token && (typeof exp !== 'number' || !Number.isFinite(exp) || exp * 1000 <= Date.now())) throw new Error('Photo credentials expired');
    }

    // Применяем request interceptor
    const requestOptions = requestInterceptor(
      fullUrl,
      { ...fetchOptions, skipAuthHeader },
      requiresAuth
    );

    try {
      // Выполняем запрос
      const requestMono = performance.now();
      const response = await fetch(fullUrl, requestOptions);
      checkSession();

      const canRefresh =
        response.status === 401 &&
        !_retry &&
        !skipAuthHeader &&
        !isAuthTokenEndpoint(endpoint);

      if (canRefresh) {
        const hadSession = !!TokenManager.getAccessToken();
        const refreshed = await tryRefreshAccessToken(this.baseURL);
        checkSession();
        if (refreshed === 'ok') {
          trace.authRetried = true;
          return this.executeRequest<T>(endpoint, { ...options, _retry: true }, trace);
        }
        // Сеть/5xx/429 при refresh — сессия может быть жива, не разлогиниваем.
        if (hadSession && refreshed === 'rejected') {
          TokenManager.clearTokens();
          emitSessionInvalidated('session_revoked');
        }
      }

      if (photoMetadata && (response.status === 200 || response.status === 304)) {
        const blob = response.status === 200 ? await response.blob() : undefined;
        checkSession();
        const data: PhotoResponse = { status: response.status, blob, headers: response.headers, requestMono, responseMono: performance.now(), responseWall: Date.now() };
        return { success: true, message: '', data: data as T, statusCode: response.status };
      }

      if (binary && response.ok) {
        const blob = await response.blob();
        checkSession();
        return { success: true, message: '', data: blob as T, statusCode: response.status };
      }

      // Применяем response interceptor
      if (raw) {
        const body = await response.text();
        checkSession();
        let parsed: any;
        try { parsed = body ? JSON.parse(body) : null; } catch { parsed = null; }
        if (!response.ok) {
          const error = new ApiRequestError(response.status, {
            isSuccess: false, message: parsed?.message || parsed?.title || `HTTP ${response.status}`,
            errorCode: parsed?.errorCode, errors: parsed?.errors,
          });
          Object.assign(error, { retryAfter: response.headers.get('Retry-After') });
          throw error;
        }
        if (parsed === null) throw new Error('Invalid JSON response');
        return { success: true, message: '', data: parsed, statusCode: response.status };
      }

      const data = await responseInterceptor<any>(response, fullUrl);
      checkSession();

      // Нормализуем данные
      const normalizedData = normalizeResponseData<T>('data' in data ? data.data : data);

      const pagination = this.extractPaginationMeta(response, data);

      // Возвращаем унифицированный ответ
      return {
        success: true,
        isSuccess: true,
        message: data.message || '',
        statusCode: data.statusCode ?? response.status,
        data: normalizedData,
        ...(pagination ? { pagination } : {}),
      };
    } catch (error) {
      // Пробрасываем ошибку дальше для обработки в компонентах
      throw error;
    }
  }

  /**
   * GET запрос
   */
  async getBlob(url: string, signal?: AbortSignal): Promise<Blob> {
    return (await this.request<Blob>(this.photoEndpoint(url), {
      method: 'GET', binary: true, cache: 'no-store', redirect: 'error', signal,
    })).data;
  }

  /** Conditional photo responses stay inside token refresh, origin and session checks. */
  async getPhotoResponse(url: string, signal?: AbortSignal, etag?: string): Promise<PhotoResponse> {
    return (await this.request<PhotoResponse>(this.photoEndpoint(url), {
      method: 'GET', photoMetadata: true, cache: 'no-store', redirect: 'error', signal,
      headers: etag ? { 'If-None-Match': etag } : undefined,
    })).data;
  }

  private photoEndpoint(url: string): string {
    // Only gateway URLs may receive our bearer token; route absolute gateway URLs through the dev proxy.
    const base = new URL(this.baseURL, globalThis.location?.origin || this.baseURL);
    const target = new URL(url, base);
    const configuredOrigin = API_GATEWAY_URL ? new URL(API_GATEWAY_URL, base).origin : base.origin;
    if (target.origin !== base.origin && target.origin !== configuredOrigin) throw new Error('Недоступный адрес фотографии');
    const endpoint = target.pathname.startsWith('/backend/') ? target.pathname.slice(8) : target.pathname;
    return `${endpoint}${target.search}`;
  }

  async get<T>(endpoint: string, config?: ApiConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
      params: config?.params,
      headers: config?.headers,
      requiresAuth: config?.requiresAuth,
      signal: config?.signal,
    });
  }

  /** Читает JSON без распаковки старой ApiResponse оболочки. */
  async getRaw<T>(endpoint: string, config?: ApiConfig): Promise<T> {
    return (await this.request<T>(endpoint, {
      method: 'GET', raw: true, cache: 'no-store', requiresAuth: false,
      signal: config?.signal, headers: config?.headers, params: config?.params,
    })).data;
  }

  /** Social endpoints return JSON directly, without the ApiResponse envelope. */
  async putRaw<T>(endpoint: string): Promise<T> {
    return (await this.request<T>(endpoint, { method: 'PUT', raw: true, cache: 'no-store' })).data;
  }

  async deleteRaw<T>(endpoint: string): Promise<T> {
    return (await this.request<T>(endpoint, { method: 'DELETE', raw: true, cache: 'no-store' })).data;
  }

  private serializeBody(data?: unknown): BodyInit | undefined {
    if (data === undefined) {
      return undefined;
    }

    if (data instanceof FormData || data instanceof URLSearchParams) {
      return data;
    }

    return JSON.stringify(data);
  }

  async post<T>(
    endpoint: string,
    data?: any,
    config?: ApiConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: this.serializeBody(data),
      params: config?.params,
      headers: config?.headers,
      requiresAuth: config?.requiresAuth,
      skipAuthHeader: config?.skipAuthHeader,
      signal: config?.signal,
    });
  }

  /**
   * PUT запрос
   */
  async put<T>(
    endpoint: string,
    data?: any,
    config?: ApiConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: this.serializeBody(data),
      params: config?.params,
      headers: config?.headers,
      requiresAuth: config?.requiresAuth,
      skipAuthHeader: config?.skipAuthHeader,
      signal: config?.signal,
    });
  }

  /**
   * DELETE запрос
   */
  async delete<T>(endpoint: string, config?: ApiConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      params: config?.params,
      headers: config?.headers,
      requiresAuth: config?.requiresAuth,
      signal: config?.signal,
    });
  }

  /**
   * PATCH запрос
   */
  async patch<T>(
    endpoint: string,
    data?: any,
    config?: ApiConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: this.serializeBody(data),
      params: config?.params,
      headers: config?.headers,
      requiresAuth: config?.requiresAuth,
      signal: config?.signal,
    });
  }
}

// Экспортируем singleton instance
export const httpClient = new HttpClient(API_BASE_URL);

// Экспортируем TokenManager для использования в других модулях
export { TokenManager };

// Экспортируем класс для тестирования или создания дополнительных инстансов
export default HttpClient;
