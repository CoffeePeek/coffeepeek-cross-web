import { httpClient } from './core/httpClient';

export type TemplateCategory = 'Moderation' | 'Inactivity' | 'NewShop';
export interface NotificationMessage { title: string; body: string }
export interface NotificationTemplate extends NotificationMessage { category: TemplateCategory; updatedAtUtc: string | null }

export interface NotificationAudience { users: number; pushUsers: number }
export interface NotificationBroadcast extends NotificationMessage {
  id: string;
  createdAtUtc: string;
  expiresAtUtc: string;
  completedAtUtc: string | null;
  totalUsers: number;
  queuedUsers: number;
}

export const getNotificationAudience = () =>
  httpClient.get<NotificationAudience>('/api/admin/notifications/broadcasts/audience', { cache: 'no-store' });
export const getNotificationBroadcasts = () =>
  httpClient.get<NotificationBroadcast[]>('/api/admin/notifications/broadcasts', { cache: 'no-store' });
export const sendNotificationBroadcast = (id: string, message: NotificationMessage) =>
  httpClient.put<NotificationBroadcast>('/api/admin/notifications/broadcasts/' + id, message);

export const getNotificationTemplates = () => httpClient.get<NotificationTemplate[]>('/api/admin/notifications/templates');
export const saveNotificationTemplate = (category: TemplateCategory, message: NotificationMessage) =>
  httpClient.put<void>(`/api/admin/notifications/templates/${category}`, message);
export const sendNotification = (id: string, userId: string, message: NotificationMessage) =>
  httpClient.put<{ notificationId: string }>(`/api/admin/notifications/${id}`, { userId, ...message });
