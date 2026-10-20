import { httpClient } from './core/httpClient';

export type TemplateCategory = 'Moderation' | 'Inactivity';
export interface NotificationMessage { title: string; body: string }
export interface NotificationTemplate extends NotificationMessage { category: TemplateCategory; updatedAtUtc: string | null }

export const getNotificationTemplates = () => httpClient.get<NotificationTemplate[]>('/api/admin/notifications/templates');
export const saveNotificationTemplate = (category: TemplateCategory, message: NotificationMessage) =>
  httpClient.put<void>(`/api/admin/notifications/templates/${category}`, message);
export const sendNotification = (id: string, userId: string, message: NotificationMessage) =>
  httpClient.put<{ notificationId: string }>(`/api/admin/notifications/${id}`, { userId, ...message });
