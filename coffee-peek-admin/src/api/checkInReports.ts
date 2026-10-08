import { httpClient } from './core/httpClient';

export type CheckInReportStatus = 0 | 1 | 2;
export function normalizeCheckInReportStatus(status: unknown): CheckInReportStatus {
  if (status === 0 || status === '0' || status === 'Pending') return 0;
  if (status === 1 || status === '1' || status === 'Dismissed') return 1;
  if (status === 2 || status === '2' || status === 'CheckInDeleted') return 2;
  throw new Error('Неизвестный статус жалобы. Обновите данные.');
}
const normalizeReport = (report: CheckInReport): CheckInReport => ({ ...report, status: normalizeCheckInReportStatus(report.status) });
export interface CheckInReport {
  id: string;
  checkInId: string | null;
  reportedByUserId: string;
  text: string;
  status: CheckInReportStatus;
  createdAtUtc: string;
  resolvedByAdminId: string | null;
  resolvedAtUtc: string | null;
}
export interface ReportedCheckIn {
  id: string;
  shopId: string;
  userId: string;
  username: string;
  text: string;
  visitedAt: string;
  ratingPlace: number;
  ratingService: number;
  ratingCoffee: number;
  deletedAtUtc: string | null;
  isPubliclyVisible: boolean;
}
const base = '/api/admin/check-in-reports';
export const getCheckInReports = async (status: string, page: number) => {
  const response = await httpClient.get<{ items: CheckInReport[]; totalCount: number; page: number; pageSize: number }>(base, { params: { status, page, pageSize: 20 }, cache: 'no-store' });
  return { ...response, data: { ...response.data, items: response.data.items.map(normalizeReport) } };
};
export const getCheckInReport = async (id: string) => {
  const response = await httpClient.get<{ report: CheckInReport; checkIn: ReportedCheckIn | null }>(`${base}/${encodeURIComponent(id)}`, { cache: 'no-store' });
  return { ...response, data: { ...response.data, report: normalizeReport(response.data.report) } };
};
export const resolveCheckInReport = async (id: string, deleteCheckIn: boolean) => {
  const response = await httpClient.put<CheckInReport>(`${base}/${encodeURIComponent(id)}/resolution`, { deleteCheckIn });
  return { ...response, data: normalizeReport(response.data) };
};
