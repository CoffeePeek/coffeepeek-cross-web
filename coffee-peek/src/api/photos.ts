/**
 * API модуль для загрузки фотографий
 */

import { httpClient } from './core/httpClient';
import { API_ENDPOINTS } from './core/apiConfig';
import type { ApiResponse } from './core/types';

// ==================== Types ====================

export interface UploadUrlRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface UploadUrlResponse {
  photoId: string; // Guid
  uploadUrl: string;
  storageKey: string;
}

// ==================== API Functions ====================

/**
 * Получает URL для загрузки аватара пользователя
 * POST /api/photos/avatar
 */
export async function getAvatarUploadUrl(
  request: UploadUrlRequest
): Promise<ApiResponse<UploadUrlResponse>> {
  return httpClient.post<UploadUrlResponse>(
    API_ENDPOINTS.PHOTOS.AVATAR,
    request,
    { requiresAuth: true }
  );
}

/**
 * Получает URLs для загрузки фотографий кофейни
 * POST /api/photos/shop
 */
export async function getShopUploadUrls(
  requests: UploadUrlRequest[]
): Promise<ApiResponse<UploadUrlResponse[]>> {
  return httpClient.post<UploadUrlResponse[]>(
    API_ENDPOINTS.PHOTOS.SHOP,
    requests,
    { requiresAuth: true }
  );
}

/**
 * Presign for check-in photos.
 * POST /api/Photos/check-in
 */
export async function getCheckInUploadUrls(
  requests: UploadUrlRequest[]
): Promise<ApiResponse<UploadUrlResponse[]>> {
  if (requests.length > MAX_CHECKIN_PHOTOS) throw new Error('Можно добавить не больше пяти фотографий');
  if (requests.some(file => !['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/avif'].includes(file.contentType))) {
    throw new Error('Поддерживаются фотографии JPEG, PNG, GIF, WebP, BMP и AVIF');
  }
  return httpClient.post<UploadUrlResponse[]>(
    API_ENDPOINTS.PHOTOS.CHECK_IN,
    requests,
    { requiresAuth: true }
  );
}

/** Content-Type sent at presign; the PUT must repeat it exactly. */
export const photoContentType = (file: File) => file.type || 'image/jpeg';

/**
 * PUT to a presigned MinIO URL from /api/photos/{shop,check-in,menu,roaster}.
 * Both headers are part of the signature — any mismatch → 403 SignatureDoesNotMatch.
 */
export function putPhotoToStorage(uploadUrl: string, file: File): Promise<Response> {
  return fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': photoContentType(file),
      'x-amz-tagging': 'is_permanent=False',
    },
  });
}

/** Server limit for POST /api/v1/check-ins. */
export const MAX_CHECKIN_PHOTOS = 5;

/**
 * Presign for menu photos. Do not use PHOTOS.SHOP for menus.
 * POST /api/Photos/menu
 */
export async function getMenuUploadUrls(
  requests: UploadUrlRequest[]
): Promise<ApiResponse<UploadUrlResponse[]>> {
  return httpClient.post<UploadUrlResponse[]>(
    API_ENDPOINTS.PHOTOS.MENU,
    requests,
    { requiresAuth: true }
  );
}

/**
 * Получает URLs для загрузки фотографий обжарщика
 * POST /api/Photos/roaster
 */
export async function getRoasterUploadUrls(
  requests: UploadUrlRequest[]
): Promise<ApiResponse<UploadUrlResponse[]>> {
  return httpClient.post<UploadUrlResponse[]>(
    API_ENDPOINTS.PHOTOS.ROASTER,
    requests,
    { requiresAuth: true }
  );
}
