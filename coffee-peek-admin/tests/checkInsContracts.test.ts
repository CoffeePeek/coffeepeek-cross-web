jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn(), put: jest.fn() } }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: { MODERATION: { CHECK_INS: '/api/v1/moderation/check-ins' }, ADMIN: { AUDIT_MODERATION: '/api/admin/audit/moderation' }, LEADERBOARD: '/api/v1/leaderboard' } }));
import { httpClient } from '../src/api/core/httpClient';
import { getModerationCheckIns, approveCheckIn, rejectCheckIn, setCheckInLeaderboardDecision, getModerationAuditLog, type ModerationCheckIn } from '../src/api/admin';
import { getLeaderboard } from '../src/api/leaderboard';
import { getCheckInReport, resolveCheckInReport } from '../src/api/checkInReports';

beforeEach(() => jest.clearAllMocks());

test.each(['Pending', 'Approved', 'Rejected'] as const)('leaderboard decisions preserve %s publication and rejection reason', async moderationStatus => {
  const checkIn = { id: 'submission', moderationStatus, rejectedReason: moderationStatus === 'Rejected' ? 'Спам' : null } as ModerationCheckIn;
  for (const counted of [true, false]) {
    await setCheckInLeaderboardDecision(checkIn, counted, '  Проверенный визит  ');
    expect(httpClient.put).toHaveBeenLastCalledWith('/api/v1/moderation/check-ins', {
      submissionId: 'submission', moderationStatus, comment: null, rejectReason: checkIn.rejectedReason,
      countsForLeaderboard: counted, leaderboardReason: 'Проверенный визит',
    });
  }
  jest.mocked(httpClient.put).mockClear();
  for (const reason of ['', '   ', 'x'.repeat(1001)]) await expect(setCheckInLeaderboardDecision(checkIn, false, reason)).rejects.toThrow(/1 до 1000/);
  expect(httpClient.put).not.toHaveBeenCalled();
  for (const reason of ['я', 'x'.repeat(1000)]) await setCheckInLeaderboardDecision(checkIn, false, reason);
  expect(httpClient.put).toHaveBeenCalledTimes(2);
});

test.each([[3, 'LeaderboardIncluded'], [4, 'LeaderboardExcluded'], ['LeaderboardIncluded', 'LeaderboardIncluded'], ['LeaderboardExcluded', 'LeaderboardExcluded']])('audit maps %s and preserves actor, timestamp, and full reason', async (action, expected) => {
  const entry = { id: 'audit', entityType: 'Review', entityId: 'submission', entityName: 'visit', action,
    moderatorUserId: 'admin-id', comment: 'Проверенный визит ' + 'x'.repeat(980), createdAtUtc: '2026-10-26T09:00:00Z' };
  jest.mocked(httpClient.get).mockResolvedValue({ data: { items: [entry], totalItems: 42, totalPages: 3, currentPage: 2, pageSize: 20 } } as never);
  const result = await getModerationAuditLog({ page: 2, entityType: 'CheckIn', action: expected as 'LeaderboardIncluded' | 'LeaderboardExcluded' });
  expect(result.data).toMatchObject({ totalCount: 42, totalPages: 3, page: 2, items: [{ ...entry, entityType: 'CheckIn', action: expected }] });
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/admin/audit/moderation', { params: { page: 2, entityType: 'Review', action: expected } });
});

test('leaderboard passes period and paging without recomputing server scores or tied ranks', async () => {
  const data = { period: 'month', startsOn: '2026-10-01', endsOnExclusive: '2026-11-01', timeZone: 'Europe/Minsk',
    items: [{ authorId: 'one', rank: 1, points: 7 }, { authorId: 'two', rank: 1, points: 7 }, { authorId: 'three', rank: 3, points: 2 }],
    totalCount: 23, page: 2, pageSize: 20, me: null };
  jest.mocked(httpClient.get).mockResolvedValue({ data } as never);
  const params = { period: 'month' as const, date: '2026-10-26', page: 2, pageSize: 20 };
  expect((await getLeaderboard(params)).data).toEqual(data);
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/v1/leaderboard', { params, cache: 'no-store' });
});

test('moderation list reads items and body pagination; decision uses submission ID and named status', async () => {
  const item = { id: 'submission', checkInId: 'check-in', contentRevision: 2, text: 'Coffee', moderationStatus: 'Pending' };
  jest.mocked(httpClient.get).mockResolvedValue({ data: { items: [item], totalItems: 31, totalPages: 3, currentPage: 2, pageSize: 15 } } as never);
  expect((await getModerationCheckIns({ status: 'Pending', page: 2, pageSize: 15 })).data).toEqual({ items: [item], totalCount: 31, totalPages: 3, page: 2, pageSize: 15 });
  await approveCheckIn('submission');
  expect(httpClient.put).toHaveBeenLastCalledWith('/api/v1/moderation/check-ins', { submissionId: 'submission', moderationStatus: 'Approved', comment: null, rejectReason: null });
  await rejectCheckIn('submission', { comment: '  Спам  ' });
  expect(httpClient.put).toHaveBeenLastCalledWith('/api/v1/moderation/check-ins', { submissionId: 'submission', moderationStatus: 'Rejected', comment: null, rejectReason: 'Спам' });
  for (const reason of ['', 'x', 'x'.repeat(1001)]) await expect(rejectCheckIn('submission', { comment: reason })).rejects.toThrow(/2 до 1000/);
});

test('historical reports preserve null target, with explicit boolean resolutions', async () => {
  jest.mocked(httpClient.get).mockResolvedValue({ data: { report: { status: 'Pending' }, checkIn: null } } as never);
  expect((await getCheckInReport('id')).data.checkIn).toBeNull();
  for (const deleteCheckIn of [false, true]) {
    jest.mocked(httpClient.put).mockResolvedValue({ data: { status: deleteCheckIn ? 'CheckInDeleted' : 'Dismissed' } } as never);
    await resolveCheckInReport('id', deleteCheckIn);
    expect(httpClient.put).toHaveBeenLastCalledWith('/api/admin/check-in-reports/id/resolution', { deleteCheckIn });
  }
});

test('moderation and report details keep home kind and recipe without a shop', async () => {
  const home = { id: 'home-check-in', kind: 'Home', shopId: null, preparedAtUtc: '2026-10-14T09:00:00Z',
    home: { preparedOn: '2026-10-14', brewMethodCode: 'hario-v60', beanName: 'Руанда', tasteScore: 5 } };
  jest.mocked(httpClient.get).mockResolvedValueOnce({ data: { items: [{ ...home, checkInId: home.id, id: 'submission' }],
    totalItems: 1, totalPages: 1, currentPage: 1, pageSize: 15 } } as never)
    .mockResolvedValueOnce({ data: { report: { status: 'Pending' }, checkIn: home } } as never);
  expect((await getModerationCheckIns({ status: 'Pending' })).data.items[0]).toMatchObject({ kind: 'Home', shopId: null, home: { tasteScore: 5 } });
  expect((await getCheckInReport('report-id')).data.checkIn).toMatchObject({ kind: 'Home', shopId: null, home: { beanName: 'Руанда' } });
});
