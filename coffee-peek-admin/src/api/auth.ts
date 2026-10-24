import { httpClient, TokenManager } from './core/httpClient';
import { API_BASE_URL, API_ENDPOINTS } from './core/apiConfig';
import { ApiResponse } from './core/types';
import { ensureFreshAccessToken, pickAuthTokens } from './core/interceptors';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthData {
  accessToken: string;
  accessTokenExpiresAt?: string;
}

export async function login(credentials: LoginRequest): Promise<ApiResponse<AuthData>> {
  const response = await httpClient.post<AuthData>(
    API_ENDPOINTS.AUTH.LOGIN,
    credentials,
    { requiresAuth: false, skipAuthHeader: true }
  );

  if (response.success && response.data) {
    const tokens = pickAuthTokens(response.data);
    if (tokens.accessToken) {
      TokenManager.setAccessToken(tokens.accessToken);
      response.data.accessToken = tokens.accessToken;
    }
  }

  return response;
}

export async function googleLogin(idToken: string): Promise<ApiResponse<AuthData>> {
  const response = await httpClient.post<AuthData>(
    API_ENDPOINTS.AUTH.GOOGLE_LOGIN,
    { idToken },
    { requiresAuth: false, skipAuthHeader: true }
  );

  if (response.isSuccess === false || response.success === false) {
    throw new Error(response.message || 'Не удалось войти через Google');
  }
  const { accessToken } = pickAuthTokens(response.data);
  if (!accessToken) throw new Error('Не удалось получить сессию. Попробуйте войти ещё раз.');
  TokenManager.setAccessToken(accessToken);
  response.data.accessToken = accessToken;
  return response;
}

export async function logout(): Promise<void> {
  try {
    await ensureFreshAccessToken(API_BASE_URL);
    await httpClient.delete<void>(API_ENDPOINTS.TOKEN.BASE, { requiresAuth: true });
  } finally {
    TokenManager.clearTokens();
  }
}
