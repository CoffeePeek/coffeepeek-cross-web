export interface ApiResponse<T> {
  success?: boolean;
  isSuccess?: boolean;
  message: string;
  statusCode?: string | number;
  data: T;
  /** From X-Total-Count / X-Total-Pages or body TotalItems/TotalPages */
  pagination?: {
    totalItems?: number;
    totalPages?: number;
    page?: number;
    pageSize?: number;
  };
}

export interface ApiConfig {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  requiresAuth?: boolean;
  /** Do not attach the stored access token (e.g. Google ID-token login). */
  skipAuthHeader?: boolean;
  /** Fetch credential policy; anonymous shared pages omit browser cookies. */
  credentials?: RequestCredentials;
  signal?: AbortSignal;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  status?: number;
  errorCode?: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
  requiresAuth?: boolean;
  skipAuthHeader?: boolean;
}
