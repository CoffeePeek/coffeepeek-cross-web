import { API_ENDPOINTS, buildUrlWithParams } from './core/apiConfig';
import { httpClient } from './core/httpClient';

export interface OperationalLogEntry {
  timestampUtc: string;
  service: string;
  level: string;
  category: string | null;
  eventId: number | null;
  message: string;
  exception: string | null;
  correlationId: string | null;
  traceId: string | null;
}

export interface OperationalLogPage {
  items: OperationalLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OperationalLogSearch {
  service?: string;
  level?: string;
  q?: string;
  from?: string;
  to?: string;
  sort?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export function getOperationalLogs(search: OperationalLogSearch) {
  return httpClient.get<OperationalLogPage>(API_ENDPOINTS.ADMIN.OPERATIONAL_LOGS, {
    params: search,
    cache: 'no-store',
  });
}

export function downloadOperationalLogs(search: OperationalLogSearch, format: 'csv' | 'jsonl') {
  const { page: _page, pageSize: _pageSize, ...filters } = search;
  const url = buildUrlWithParams(API_ENDPOINTS.ADMIN.OPERATIONAL_LOGS_EXPORT, { ...filters, format });
  return httpClient.getBlob(url);
}
