import { httpClient } from './core/httpClient';
import { API_ENDPOINTS } from './core/apiConfig';

export interface CheckInReport {
  id: string;
  checkInId: string | null;
  reportedByUserId: string;
  text: string;
  status: 'Pending' | 'Dismissed' | 'CheckInDeleted';
  createdAtUtc: string;
  resolvedByAdminId: string | null;
  resolvedAtUtc: string | null;
}

export function reportCheckIn(checkInId: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 2000) throw new Error('Введите от 1 до 2000 символов');
  return httpClient.post<CheckInReport>(`${API_ENDPOINTS.CHECK_IN.BY_ID(checkInId)}/reports`, { text: trimmed }, { requiresAuth: true });
}
