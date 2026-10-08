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
    options: RequestOptions & { _retry?: boolean; raw?: boolean; binary?: boolean } = {}
  ): Promise<ApiResponse<T>> {
    const { params, requiresAuth = true, skipAuthHeader, _retry, raw, binary, ...fetchOptions } = options;
    const scope = getCatalogScope();
    const checkSession = () => { if (scope !== getCatalogScope() || fetchOptions.signal?.aborted) throw new DOMException('Session changed or request cancelled', 'AbortError'); };

    // Строим URL с параметрами
    const urlWithParams = buildUrlWithParams(endpoint, params);
    const fullUrl = `${this.baseURL}${urlWithParams}`;

    if (!_retry && !skipAuthHeader && !isAuthTokenEndpoint(endpoint)) {
      await ensureFreshAccessToken(this.baseURL);
    }
    checkSession();

    // Применяем request interceptor
    const requestOptions = requestInterceptor(
      fullUrl,
      { ...fetchOptions, skipAuthHeader },
      requiresAuth
    );

    try {
      // Выполняем запрос
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
          return this.request<T>(endpoint, { ...options, _retry: true });
        }
        // Сеть/5xx/429 при refresh — сессия может быть жива, не разлогиниваем.
        if (hadSession && refreshed === 'rejected') {
          TokenManager.clearTokens();
          emitSessionInvalidated('session_revoked');
        }
      }

      if (binary && response.ok) {
        const blob = await response.blob();
        checkSession();
        return { success: true, message: '', data: blob as T };
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
    // Only gateway URLs may receive our bearer token; route absolute gateway URLs through the dev proxy.
    const base = new URL(this.baseURL, globalThis.location?.origin || this.baseURL);
    const target = new URL(url, base);
    const configuredOrigin = API_GATEWAY_URL ? new URL(API_GATEWAY_URL, base).origin : base.origin;
    if (target.origin !== base.origin && target.origin !== configuredOrigin) throw new Error('Недоступный адрес фотографии');
    const endpoint = target.pathname.startsWith('/backend/') ? target.pathname.slice(8) : target.pathname;
    return (await this.request<Blob>(`${endpoint}${target.search}`, {
      method: 'GET', binary: true, cache: 'no-store', signal,
    })).data;
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
      signal: config?.signal, headers: config?.headers,
    })).data;
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
