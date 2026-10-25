import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfileActivity, getProfileConnections, getProfileFavorites, setProfileFollowing, type ProfileConnectionKind } from '../../api/user';
import { useUser } from '../../contexts/UserContext';
import { getCatalogScope } from '../../lib/catalogSession';

export const publicProfileKey = (slug: string) => ['userProfile', getCatalogScope(), slug] as const;

export const profileActivityQuery = (slug: string, month: string) => ({
  queryKey: [...publicProfileKey(slug), 'activity', month],
  queryFn: ({ signal }: { signal: AbortSignal }) => getProfileActivity(slug, month, signal),
  gcTime: 0,
});

export function useProfileActivity(slug: string, month: string) {
  const { isLoading } = useUser();
  return useQuery({ ...profileActivityQuery(slug, month), enabled: !isLoading });
}

export function useProfileFavorites(slug: string) {
  const { isLoading } = useUser();
  return useQuery({
    queryKey: [...publicProfileKey(slug), 'favorites'],
    queryFn: ({ signal }) => getProfileFavorites(slug, signal),
    enabled: !isLoading, gcTime: 0,
  });
}

export function useProfileConnections(slug: string, kind: ProfileConnectionKind) {
  const { isLoading } = useUser();
  return useInfiniteQuery({
    queryKey: [...publicProfileKey(slug), 'connections', kind], initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => getProfileConnections(slug, kind, pageParam, signal),
    getNextPageParam: page => page.items.length && page.page * page.pageSize < page.totalCount ? page.page + 1 : undefined,
    enabled: !isLoading, gcTime: 0,
  });
}

export function useProfileFollow(slug: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (following: boolean) => setProfileFollowing(slug, following),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['publicAddress', 'users'] }),
        client.invalidateQueries({ queryKey: publicProfileKey(slug) }),
      ]);
    },
  });
}
