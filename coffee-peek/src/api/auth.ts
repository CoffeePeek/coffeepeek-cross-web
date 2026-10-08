import { queryClient } from '../lib/queryClient';
import { getCatalogScope } from '../lib/catalogSession';
import type { PublicAddress } from './publicAddresses';
/**
 * API модуль для аутентификации и профиля пользователя
 */

import { httpClient, TokenManager } from './core/httpClient';
import { API_BASE_URL, API_ENDPOINTS } from './core/apiConfig';
import type { ApiResponse } from './core/types';
import { ensureFreshAccessToken, pickAuthTokens } from './core/interceptors';

// ==================== Request/Response Types ====================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  userName?: string;
}

/**
 * Данные авторизации
 */
export interface AuthData {
  accessToken: string;
  accessTokenExpiresAt?: string;
}

export interface AuthResponse extends ApiResponse<AuthData> {}

export interface RegistrationResponse {
  isSuccess: boolean;
  message: string;
  data?: any;
}

export interface CheckExistsData {
  exists: boolean;
}

export interface CheckExistsResponse extends ApiResponse<CheckExistsData> {}

// UserProfile interfaces
export interface UserProfile {
  address: PublicAddress | null;
  id?: string;
  userCredentialId: string;
  userName: string;
  email: string;
  about?: string;
  createdAtUtc: string;
  avatarUrl?: string;
  checkInCount?: number;
  addedShopsCount?: number;
  roles?: string[];
}

export interface UpdateAboutRequest {
  about: string;
}

export interface UpdateEmailRequest {
  email: string;
}

export interface UpdateUsernameRequest {
  username: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface UploadedPhotoDto {
  fileName: string;
  contentType: string;
  storageKey: string;
  size: number; // long
}

export interface UpdateAvatarRequest {
  uploadedPhoto: UploadedPhotoDto;
}

// ==================== API Functions ====================

/**
 * Проверяет, существует ли пользователь с указанным email.
 * Бэкенд отвечает 200 и `data: true | false`. Старый контракт 404 = нет пользователя тоже поддерживается.
 */
function parseEmailExists(data: unknown): boolean {
  if (typeof data === 'boolean') return data;
  if (data && typeof data === 'object' && 'exists' in data) {
    return Boolean((data as CheckExistsData).exists);
  }
  return false;
}

export async function checkEmailExists(email: string): Promise<CheckExistsResponse> {
  try {
    const response = await httpClient.get<boolean | CheckExistsData>(API_ENDPOINTS.USER.EMAIL_EXISTS, {
      params: { email },
      requiresAuth: false,
    });
    return {
      ...response,
      data: { exists: parseEmailExists(response.data) },
    };
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: number }).status)
      : undefined;
    if (status === 404) {
      return {
        success: true,
        isSuccess: true,
        message: 'Пользователь не найден',
        data: { exists: false },
      };
    }
    throw error;
  }
}

/**
 * Логин пользователя
 */
export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  const response = await httpClient.post<AuthData>(
    API_ENDPOINTS.AUTH.LOGIN,
    credentials,
    { requiresAuth: false, skipAuthHeader: true }
  );

  const tokens = pickAuthTokens(response.data);
  if (response.success && tokens.accessToken) {
    TokenManager.setAccessToken(tokens.accessToken);
    if (response.data) {
      response.data.accessToken = tokens.accessToken;
    }
  }

  return response;
}

/**
 * Регистрация нового пользователя
 * Возвращает RegistrationResponse с isSuccess и message
 */
export async function register(userData: RegisterRequest): Promise<RegistrationResponse> {
  const response = await httpClient.post<any>(
    API_ENDPOINTS.AUTH.REGISTER,
    userData,
    { requiresAuth: false, skipAuthHeader: true }
  );

  return {
    isSuccess: response.data?.isSuccess !== false,
    message: response.message || 'Регистрация успешна',
    data: response.data,
  };
}

/**
 * Google OAuth логин. Бэкенд ждёт Google ID token: { idToken }.
 */
export async function googleLogin(idToken: string): Promise<AuthResponse> {
  const response = await httpClient.post<AuthData>(
    API_ENDPOINTS.AUTH.GOOGLE_LOGIN,
    { idToken },
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

/**
 * Выход из системы
 */
export async function logout(): Promise<void> {
  const scope = getCatalogScope();
  try {
    // DELETE /api/tokens requires an access token. Refresh it first so logout
    // still invalidates the HttpOnly refresh cookie after the access token expires.
    await ensureFreshAccessToken(API_BASE_URL);
    if (scope !== getCatalogScope()) return;
    await httpClient.delete<void>(API_ENDPOINTS.TOKEN.BASE, {
      requiresAuth: true,
    });
  } finally {
    if (scope === getCatalogScope()) TokenManager.clearTokens();
  }
}

/**
 * Получает профиль текущего пользователя
 */
export async function getProfile(): Promise<ApiResponse<UserProfile>> {
  return httpClient.get<UserProfile>(API_ENDPOINTS.USER.PROFILE, {
    requiresAuth: true,
  });
}

/**
 * Обновляет информацию "о себе" пользователя
 */
export async function updateAbout(
  data: UpdateAboutRequest
): Promise<ApiResponse<string>> {
  return httpClient.patch<string>(API_ENDPOINTS.USER.UPDATE_ABOUT, data, {
    requiresAuth: true,
  });
}

/**
 * Обновляет email пользователя
 */
export async function updateEmail(
  data: UpdateEmailRequest
): Promise<ApiResponse<string>> {
  return httpClient.patch<string>(API_ENDPOINTS.USER.UPDATE_EMAIL, data, {
    requiresAuth: true,
  });
}

/**
 * Обновляет username пользователя
 */
export async function updateUsername(
  data: UpdateUsernameRequest
): Promise<ApiResponse<{ username: string; address: PublicAddress | null }>> {
  const response = await httpClient.patch<{ username: string; address: PublicAddress | null }>(API_ENDPOINTS.USER.UPDATE_USERNAME, data, {
    requiresAuth: true,
  });
  if (response.success) queryClient.removeQueries({ queryKey: ['publicAddress', 'users'] });
  return response;
}

/**
 * Обновляет аватар пользователя
 */
export async function updateAvatar(
  data: UpdateAvatarRequest
): Promise<ApiResponse<any>> {
  return httpClient.patch<any>(API_ENDPOINTS.USER.UPDATE_AVATAR, data, {
    requiresAuth: true,
  });
}

export type AccountDeletionReason =
  | 'PrivacyConcerns'
  | 'NoLongerUsing'
  | 'DuplicateAccount'
  | 'UnsatisfactoryExperience'
  | 'Other';

export interface AccountDeletionRequest {
  requestId: string;
  status: string;
  expiresAtUtc: string;
  resendAvailableAtUtc: string;
}

/**
 * Запрашивает удаление аккаунта (202 + PendingConfirmation).
 * Письмо со ссылкой подтверждения; повтор в cooldown тоже 202 без нового письма.
 */
export async function deleteUser(): Promise<ApiResponse<AccountDeletionRequest>> {
  return httpClient.delete<AccountDeletionRequest>(API_ENDPOINTS.USER.DELETE, {
    requiresAuth: true,
  });
}

/**
 * Подтверждает удаление по токену из письма (form-urlencoded).
 */
export async function confirmAccountDeletion(params: {
  token: string;
  reason: AccountDeletionReason;
  otherReason?: string;
}): Promise<ApiResponse<unknown>> {
  const body = new URLSearchParams();
  body.set('token', params.token);
  body.set('reason', params.reason);
  if (params.reason === 'Other' && params.otherReason?.trim()) {
    body.set('otherReason', params.otherReason.trim().slice(0, 500));
  }

  return httpClient.post<unknown>(API_ENDPOINTS.USER.DELETION_CONFIRMATION, body, {
    requiresAuth: false,
  });
}

/**
 * Отменяет запрос на удаление до подтверждения.
 */
export async function cancelAccountDeletionRequest(
  token: string
): Promise<ApiResponse<unknown>> {
  return httpClient.delete<unknown>(API_ENDPOINTS.USER.DELETION_REQUEST, {
    params: { token },
    requiresAuth: false,
  });
}

/**
 * Повторно отправляет подтверждение email по адресу (публичный, без авторизации)
 */
export async function resendEmailConfirmationByEmail(email: string): Promise<ApiResponse<void>> {
  return httpClient.post<void>(API_ENDPOINTS.USER.EMAIL_CONFIRMATION_RESEND, { email }, {
    requiresAuth: false,
  });
}

/**
 * Подтверждает email по токену
 */
export async function confirmEmail(token: string): Promise<ApiResponse<void>> {
  return httpClient.put<void>(
    API_ENDPOINTS.USER.EMAIL_CONFIRMATION,
    undefined,
    {
      params: { token },
      requiresAuth: false,
    }
  );
}

/**
 * Запрос сброса пароля. API всегда отвечает успехом (письмо — если аккаунт с паролем).
 */
export async function forgotPassword(
  data: ForgotPasswordRequest
): Promise<ApiResponse<void>> {
  return httpClient.post<void>(API_ENDPOINTS.USER.PASSWORD_FORGOT, data, {
    requiresAuth: false,
  });
}

/**
 * Сброс пароля по токену из письма (.../reset-password?token=).
 * После успеха все сессии сбрасываются — нужен повторный логин.
 */
export async function resetPassword(
  data: ResetPasswordRequest
): Promise<ApiResponse<void>> {
  return httpClient.post<void>(API_ENDPOINTS.USER.PASSWORD_RESET, data, {
    requiresAuth: false,
  });
}


// Экспортируем ApiResponse для обратной совместимости
export type { ApiResponse };
