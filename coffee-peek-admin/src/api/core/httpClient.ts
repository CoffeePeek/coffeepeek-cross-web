import { ApiResponse, ApiConfig, RequestOptions, ApiRequestError } from './types';
import { API_BASE_URL, API_GATEWAY_URL, buildUrlWithParams } from './apiConfig';
import {
  requestInterceptor,
  responseInterceptor,
  normalizeResponseData,
  TokenManager,
  isAuthTokenEndpoint,
  tryRefreshAccessToken,
  ensureFreshAccessTokenResult,
  pickAuthTokens,
} from './interceptors';
import { emitSessionInvalidated } from '../../realtime/forceLogout';

class HttpClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions & { _retry?: boolean; binary?: boolean } = {}
  ): Promise<ApiResponse<T>> {
    const { params, requiresAuth = true, skipAuthHeader, _retry, binary, ...fetchOptions } = options;

    const urlWithParams = buildUrlWithParams(endpoint, params);
    const fullUrl = `${this.baseURL}${urlWithParams}`;

    if (!_retry && !skipAuthHeader && !isAuthTokenEndpoint(endpoint)) {
      const refreshed = await ensureFreshAccessTokenResult(this.baseURL);
      // Разлогиниваем только если сервер отверг refresh; сеть/5xx/429 — сессия может быть жива.
      if (refreshed === 'rejected') {
        if (TokenManager.getAccessToken()) {
          TokenManager.clearTokens();
          emitSessionInvalidated('session_revoked');
        }
        throw new ApiRequestError(401, 'Не авторизован');
      }
    }

    const requestOptions = requestInterceptor(
      fullUrl,
      { ...fetchOptions, skipAuthHeader },
      requiresAuth
    );

    try {
      const response = await fetch(fullUrl, requestOptions);

      const canRefresh =
        response.status === 401 &&
        !_retry &&
        !skipAuthHeader &&
        !isAuthTokenEndpoint(endpoint);

      if (canRefresh) {
        const hadSession = !!TokenManager.getAccessToken();
        const refreshed = await tryRefreshAccessToken(this.baseURL);
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
        return { success: true, message: '', data: await response.blob() as T };
      }

      const { envelope, pagination } = await responseInterceptor<any>(response, fullUrl);
      let payload = 'data' in envelope ? envelope.data : envelope;
      if (isAuthTokenEndpoint(endpoint)) {
        const fromEnvelope = pickAuthTokens(envelope);
        const fromPayload = pickAuthTokens(payload);
        const accessToken = fromPayload.accessToken ?? fromEnvelope.accessToken;
        const refreshToken = fromPayload.refreshToken ?? fromEnvelope.refreshToken;
        if (accessToken && payload && typeof payload === 'object') {
          payload = { ...payload, accessToken, ...(refreshToken ? { refreshToken } : {}) };
        }
      }
      const normalizedData = normalizeResponseData<T>(payload);

      return {
        success: true,
        isSuccess: envelope.isSuccess ?? envelope.success ?? true,
        message: envelope.message || '',
        ...('oldEntity' in envelope ? { oldEntity: envelope.oldEntity } : {}),
        data: normalizedData,
        meta: pagination,
      };
    } catch (error) {
      throw error;
    }
  }

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
      cache: config?.cache,
      params: config?.params,
      headers: config?.headers,
      requiresAuth: config?.requiresAuth,
      signal: config?.signal,
    });
  }

  async post<T>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
      params: config?.params,
      headers: config?.headers,
      requiresAuth: config?.requiresAuth,
      skipAuthHeader: config?.skipAuthHeader,
      signal: config?.signal,
    });
  }

  async put<T>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data instanceof FormData ? data : JSON.stringify(data),
      params: config?.params,
      headers: config?.headers,
      requiresAuth: config?.requiresAuth,
      skipAuthHeader: config?.skipAuthHeader,
      signal: config?.signal,
    });
  }

  async delete<T>(endpoint: string, config?: ApiConfig): Promise<ApiResponse<T>> {
    const hasBody = config?.data !== undefined;
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: hasBody
        ? config!.data instanceof FormData
          ? config!.data
          : JSON.stringify(config!.data)
        : undefined,
      params: config?.params,
      headers: config?.headers,
      requiresAuth: config?.requiresAuth,
      signal: config?.signal,
    });
  }

  async patch<T>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data instanceof FormData ? data : JSON.stringify(data),
      params: config?.params,
      headers: config?.headers,
      requiresAuth: config?.requiresAuth,
      signal: config?.signal,
    });
  }
}

export const httpClient = new HttpClient(API_BASE_URL);
export { TokenManager };
export default HttpClient;
