import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../contexts/UserContext';
import { getCatalogScope } from '../../lib/catalogSession';
import {
  createCheckIn, getCheckIns, getCheckInsByDateRange, getCheckInById, getPublicCheckIns, getFeed,
  updateCheckIn, changeCheckInVisibility, deleteCheckIn, setCheckInHelpful,
  type PublicCheckInFilters, type UpdateCheckInRequest, type CheckInVisibility,
} from '../../api/coffeeshop';

export const checkInKeys = { all: ['checkIns'] as const };

export function useCheckIns(page = 1, pageSize = 10, enabled = true) {
  const { user, isLoading } = useUser();
  return useQuery({ queryKey: [...checkInKeys.all, 'mine', getCatalogScope(), { page, pageSize }],
    queryFn: () => getCheckIns(page, pageSize).then(r => r.data), enabled: enabled && !isLoading && !!user });
}

export function useCheckIn(id?: string) {
  const { isLoading } = useUser();
  return useQuery({ queryKey: [...checkInKeys.all, 'detail', getCatalogScope(), id],
    queryFn: () => getCheckInById(id!).then(r => r.data), enabled: !!id && !isLoading });
}

export function usePublicCheckIns(filters: Omit<PublicCheckInFilters, 'cursor'>, enabled = true) {
  const { isLoading } = useUser();
  return useInfiniteQuery({ queryKey: [...checkInKeys.all, 'public', getCatalogScope(), filters], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getPublicCheckIns({ ...filters, cursor: pageParam }).then(r => r.data),
    getNextPageParam: page => page.nextCursor ?? undefined, gcTime: 0, enabled: enabled && !isLoading });
}

export function useFeed(filters: Omit<PublicCheckInFilters, 'cursor'> = {}) {
  const { isLoading } = useUser();
  return useInfiniteQuery({ queryKey: [...checkInKeys.all, 'feed', getCatalogScope(), filters], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getFeed({ ...filters, cursor: pageParam }).then(r => r.data),
    getNextPageParam: page => page.nextCursor ?? undefined, gcTime: 0, enabled: !isLoading });
}

export function useCheckInsByDateRange(from: string, to: string, enabled = true) {
  const { user, isLoading } = useUser();
  return useQuery({ queryKey: [...checkInKeys.all, 'calendar', getCatalogScope(), { from, to }],
    queryFn: () => getCheckInsByDateRange({ from, to }), enabled: enabled && !isLoading && !!user && !!(from && to) });
}

export function useInvalidateCheckIns() {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: checkInKeys.all }),
    client.invalidateQueries({ queryKey: ['coffeeShops'] }),
    client.invalidateQueries({ queryKey: ['publicAddress'] }),
    client.invalidateQueries({ queryKey: ['publicStats'] }),
    client.invalidateQueries({ queryKey: ['userProfile'] }),
  ]);
}

export function useCreateCheckIn() {
  const invalidate = useInvalidateCheckIns();
  return useMutation({ mutationFn: createCheckIn, onSuccess: invalidate });
}

export function useUpdateCheckIn() {
  const invalidate = useInvalidateCheckIns();
  return useMutation({ mutationFn: ({ id, request }: { id: string; request: UpdateCheckInRequest }) => updateCheckIn(id, request), onSuccess: invalidate });
}

export function useCheckInVisibility() {
  const invalidate = useInvalidateCheckIns();
  return useMutation({ mutationFn: ({ id, visibility }: { id: string; visibility: CheckInVisibility }) => changeCheckInVisibility(id, visibility), onSuccess: invalidate });
}

export function useDeleteCheckIn() {
  const invalidate = useInvalidateCheckIns();
  return useMutation({ mutationFn: deleteCheckIn, onSuccess: invalidate });
}

export function useCheckInHelpful() {
  const invalidate = useInvalidateCheckIns();
  return useMutation({ mutationFn: ({ id, helpful }: { id: string; helpful: boolean }) => setCheckInHelpful(id, helpful), onSuccess: invalidate });
}
