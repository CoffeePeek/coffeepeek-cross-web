import { useQueries, type QueryFunctionContext } from '@tanstack/react-query';
import { getModerationCheckIns, getModerationShops, getShopIssueReports } from '../api/admin';
import { getCheckInReports } from '../api/checkInReports';
import { getModerationRoasters } from '../api/roasters';
import { getShopChangeRequests } from '../api/shopChangeRequests';
import { moderationQueueRefresh } from '../lib/queryClient';

const firstItem = { page: 1, pageSize: 1 };
const pending = { ...firstItem, status: 'Pending' } as const;

// Keep the same key prefixes as the lists so moderation decisions refresh both.
const queues: {
  path: string;
  key: string[];
  adminOnly?: boolean;
  queryFn: (context: QueryFunctionContext) => Promise<number>;
}[] = [
  {
    path: '/shops',
    key: ['admin', 'moderation', 'shops'],
    queryFn: ({ signal }) => getModerationShops(pending, signal).then(({ data }) => data.totalCount),
  },
  {
    path: '/shop-change-requests',
    key: ['admin', 'shop-change-requests'],
    queryFn: ({ signal }) => getShopChangeRequests(pending, signal).then(({ data }) => data.totalItems),
  },
  {
    path: '/roasters',
    key: ['admin', 'moderation', 'roasters'],
    queryFn: ({ signal }) => getModerationRoasters(pending, signal).then(({ data }) => data.totalCount),
  },
  {
    path: '/check-ins',
    key: ['admin', 'moderation', 'checkIns'],
    queryFn: ({ signal }) => getModerationCheckIns(pending, signal).then(({ data }) => data.totalCount),
  },
  {
    path: '/check-in-reports',
    key: ['admin', 'check-in-reports'],
    adminOnly: true,
    queryFn: ({ signal }) => getCheckInReports('Pending', firstItem.page, { pageSize: firstItem.pageSize, signal })
      .then(({ data }) => data.totalCount),
  },
  {
    path: '/shop-reports',
    key: ['admin', 'shop-reports'],
    queryFn: ({ signal }) => getShopIssueReports({ ...firstItem, status: 'Submitted' }, signal)
      .then(({ data }) => data.totalItems),
  },
];

export function useModerationBadges(isAdmin: boolean, isModerator: boolean): Record<string, number> {
  const results = useQueries({
    queries: queues.map(({ key, queryFn, adminOnly }) => ({
      ...moderationQueueRefresh,
      queryKey: [...key, 'pending-count'],
      queryFn,
      enabled: adminOnly ? isAdmin : isModerator,
    })),
  });

  return Object.fromEntries(queues.map(({ path }, index) => [path, results[index].data ?? 0]));
}
