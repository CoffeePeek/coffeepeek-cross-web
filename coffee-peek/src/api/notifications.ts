import { httpClient } from './core/httpClient';

export interface NotificationPreferences { moderation: boolean; inactivity: boolean; custom: boolean }
export const getNotificationPreferences = () => httpClient.get<NotificationPreferences>('/api/v1/me/notifications/preferences');
export const updateNotificationPreferences = (value: NotificationPreferences) => httpClient.put<void>('/api/v1/me/notifications/preferences', value);
export const recordNotificationActivity = (signal?: AbortSignal) => httpClient.post<void>('/api/v1/me/notifications/activity', undefined, { signal });
