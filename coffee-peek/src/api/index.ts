/**
 * Публичный API - централизованный экспорт всех API модулей
 */

// Core
export { httpClient, TokenManager } from './core/httpClient';
export { API_ENDPOINTS, API_BASE_URL, buildUrlWithParams } from './core/apiConfig';
export {
  ApiRequestError,
  isApiRequestError,
  ShopModerationErrorCodes,
  CommonErrorCodes,
} from './core/apiError';
export type { ApiErrorResponse, SendShopSuccessResponse } from './core/apiError';
export type { 
  ApiResponse, 
  ApiConfig, 
  PaginationParams, 
  PaginatedResponse, 
  ApiError,
  HttpMethod,
  RequestOptions 
} from './core/types';

// Auth
export * from './auth';

// Coffee Shop
export * from './coffeeshop';

// Moderation
export * from './moderation';

// User
export * from './user';

// Public
export * from './public';
export * from './shopChangeRequests';

export type { PublicAddress } from './publicAddresses';
