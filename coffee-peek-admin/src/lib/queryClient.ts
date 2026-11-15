import { QueryClient } from '@tanstack/react-query';

const RETRY_DELAYS_MS = [1_000, 3_000, 5_000] as const;
const TRANSIENT_STATUSES = new Set([502, 503, 504]);

export const moderationQueueRefresh = {
  staleTime: 0,
  refetchInterval: 15_000,
  refetchOnWindowFocus: true,
};

const isInternalServerError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  error.status === 500;

// fetch бросает TypeError при сетевой ошибке (нет соединения, CORS, DNS).
const isTransientError = (error: unknown): boolean =>
  error instanceof TypeError ||
  (typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    TRANSIENT_STATUSES.has(error.status as number));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 5,
      retry: (failureCount, error) =>
        (isInternalServerError(error) && failureCount < RETRY_DELAYS_MS.length) ||
        (isTransientError(error) && failureCount < 1),
      retryDelay: (attemptIndex) =>
        RETRY_DELAYS_MS[Math.min(attemptIndex, RETRY_DELAYS_MS.length - 1)],
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
