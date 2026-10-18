export interface AnalyticsError {
  error_category: 'validation' | 'authentication' | 'permission' | 'not_found' | 'rate_limited' | 'server' | 'network' | 'cancelled' | 'unknown';
  status_code?: number;
}

/** Never forward exception messages, response bodies, submitted values or URLs. */
export function getAnalyticsError(error: unknown): AnalyticsError {
  const candidate = error as { status?: unknown; name?: unknown } | null;
  const status = typeof candidate?.status === 'number' && Number.isInteger(candidate.status)
    && candidate.status >= 100 && candidate.status <= 599 ? candidate.status : undefined;
  const category = candidate?.name === 'AbortError' ? 'cancelled'
    : status === 401 ? 'authentication' : status === 403 ? 'permission'
    : status === 404 ? 'not_found' : status === 429 ? 'rate_limited'
    : status && status >= 500 ? 'server' : status && status >= 400 ? 'validation'
    : error instanceof TypeError ? 'network' : 'unknown';
  return { error_category: category, ...(status ? { status_code: status } : {}) };
}
