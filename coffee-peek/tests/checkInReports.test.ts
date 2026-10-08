jest.mock('../src/api/core/httpClient', () => ({ httpClient: { post: jest.fn() } }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: { CHECK_IN: { BY_ID: (id: string) => `/api/v1/check-ins/${encodeURIComponent(id)}` } } }));
jest.mock('../../coffee-peek-admin/src/api/core/httpClient', () => ({ httpClient: { get: jest.fn(), put: jest.fn() } }));
import { reportCheckIn } from '../src/api/checkInReports';
import { httpClient } from '../src/api/core/httpClient';
import { getCheckInReports, getCheckInReport, resolveCheckInReport, normalizeCheckInReportStatus } from '../../coffee-peek-admin/src/api/checkInReports';
import { httpClient as adminClient } from '../../coffee-peek-admin/src/api/core/httpClient';

beforeEach(() => jest.clearAllMocks());
test('report trims text, validates boundaries and requires authentication', () => {
  reportCheckIn('id/1', '  Оскорбления  ');
  expect(httpClient.post).toHaveBeenCalledWith('/api/v1/check-ins/id%2F1/reports', { text: 'Оскорбления' }, { requiresAuth: true });
  for (const text of ['', ' \n ', 'a'.repeat(2001)]) expect(() => reportCheckIn('id', text)).toThrow();
  expect(httpClient.post).toHaveBeenCalledTimes(1);
  reportCheckIn('id', 'a');
  reportCheckIn('id', 'a'.repeat(2000));
  expect(httpClient.post).toHaveBeenCalledTimes(3);
});
test('admin preserves empty status, disables HTTP caching and sends both explicit resolutions', async () => {
  (adminClient.get as jest.Mock).mockResolvedValueOnce({ data: { items: [{ status: 'Pending' }] } });
  expect((await getCheckInReports('Pending', 2)).data.items[0].status).toBe(0);
  expect(adminClient.get).toHaveBeenCalledWith('/api/admin/check-in-reports', { params: { status: 'Pending', page: 2, pageSize: 20 }, cache: 'no-store' });
  (adminClient.get as jest.Mock).mockResolvedValueOnce({ data: { report: { status: '0' }, checkIn: null } });
  expect((await getCheckInReport('id/1')).data.report.status).toBe(0);
  expect(adminClient.get).toHaveBeenLastCalledWith('/api/admin/check-in-reports/id%2F1', { cache: 'no-store' });
  for (const deleteCheckIn of [false, true]) {
    (adminClient.put as jest.Mock).mockResolvedValueOnce({ data: { status: deleteCheckIn ? 'CheckInDeleted' : 'Dismissed' } });
    expect((await resolveCheckInReport('id/1', deleteCheckIn)).data.status).toBe(deleteCheckIn ? 2 : 1);
    expect(adminClient.put).toHaveBeenLastCalledWith('/api/admin/check-in-reports/id%2F1/resolution', { deleteCheckIn });
  }
});
test('report statuses accept named and numeric formats without treating unknown values as pending', () => {
  for (const [value, expected] of [[0, 0], ['0', 0], ['Pending', 0], [1, 1], ['1', 1], ['Dismissed', 1], [2, 2], ['2', 2], ['CheckInDeleted', 2]]) {
    expect(normalizeCheckInReportStatus(value)).toBe(expected);
  }
  for (const value of [undefined, null, '', 'Approved', 3]) expect(() => normalizeCheckInReportStatus(value)).toThrow();
});
