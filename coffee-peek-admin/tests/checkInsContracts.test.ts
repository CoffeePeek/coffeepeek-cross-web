jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn(), put: jest.fn() } }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: { MODERATION: { CHECK_INS: '/api/v1/moderation/check-ins' } } }));
import { httpClient } from '../src/api/core/httpClient';
import { getModerationCheckIns, approveCheckIn, rejectCheckIn } from '../src/api/admin';
import { getCheckInReport, resolveCheckInReport } from '../src/api/checkInReports';

beforeEach(() => jest.clearAllMocks());

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
