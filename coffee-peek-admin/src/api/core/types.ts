export interface PaginatedMeta {
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface ApiResponse<T> {
  success?: boolean;
  isSuccess?: boolean;
  message: string;
  data: T;
  oldEntity?: unknown;
  meta?: PaginatedMeta;
}

export interface ApiConfig {
  cache?: RequestCache;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  requiresAuth?: boolean;
  skipAuthHeader?: boolean;
  signal?: AbortSignal;
  /** JSON body for DELETE (photoIds, etc.). */
  data?: unknown;
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

/** Ошибка HTTP-запроса: наследник Error, но с полями ApiError для существующих обработчиков. */
export class ApiRequestError extends Error implements ApiError {
  readonly status: number;
  readonly errors?: Record<string, string[]>;
  readonly errorCode?: string;

  constructor(status: number, message: string, errors?: Record<string, string[]>, errorCode?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.errors = errors;
    this.errorCode = errorCode;
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
  requiresAuth?: boolean;
  skipAuthHeader?: boolean;
}
