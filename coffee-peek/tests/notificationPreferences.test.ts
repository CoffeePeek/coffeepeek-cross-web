jest.mock('../src/api/core/apiConfig', () => ({ API_BASE_URL: 'https://api.example', API_GATEWAY_URL: 'https://api.example', buildUrlWithParams: (path: string) => path }));
jest.mock('../src/utils/errorHandler', () => ({ getErrorMessageByStatus: () => 'Request failed', getErrorMessage: () => 'Request failed' }));
jest.mock('../src/utils/logger', () => ({ logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../src/lib/analytics', () => ({ captureAnalyticsEvent: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'), useQuery: jest.fn(),
  useMutation: () => ({}), useQueryClient: () => ({ setQueryData: jest.fn() }),
}));

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useQuery } from '@tanstack/react-query';
import * as interceptors from '../src/api/core/interceptors';
import { getNotificationPreferences, updateNotificationPreferences } from '../src/api/notifications';
import NotificationPreferences from '../src/components/NotificationPreferences';

const preferences = { moderation: true, inactivity: false, custom: true };
const originalFetch = globalThis.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(interceptors, 'ensureFreshAccessToken').mockResolvedValue(true);
  jest.spyOn(interceptors, 'tryRefreshAccessToken').mockResolvedValue('error');
  interceptors.TokenManager.setAccessToken('test-access-token');
  globalThis.fetch = jest.fn().mockResolvedValue(Response.json(preferences));
  jest.mocked(useQuery).mockReturnValue({ data: preferences } as never);
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  interceptors.TokenManager.clearTokens();
  jest.restoreAllMocks();
});

test('successful direct preferences JSON loads without an ApiResponse envelope and retains authentication', async () => {
  await expect(getNotificationPreferences()).resolves.toEqual(preferences);
  expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example/api/v1/me/notifications/preferences', expect.objectContaining({ method: 'GET', cache: 'no-store' }));
  const options = jest.mocked(globalThis.fetch).mock.calls[0][1]!;
  expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-access-token');
});

test('settings query keeps the direct DTO and renders all three saved category switches', async () => {
  const html = renderToStaticMarkup(createElement(NotificationPreferences, { userId: 'test-user' }));
  const options = jest.mocked(useQuery).mock.calls.at(-1)![0];
  await expect((options.queryFn as () => Promise<unknown>)()).resolves.toEqual(preferences);
  expect(html.match(/type="checkbox"/g)).toHaveLength(3);
  expect(html.match(/checked=""/g)).toHaveLength(2);
  expect(html).not.toContain('role="alert"');
});

test('saving accepts 204 and preserves the complete category selection', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
  const updated = { ...preferences, inactivity: true };
  await expect(updateNotificationPreferences(updated)).resolves.toMatchObject({ success: true, statusCode: 204 });
  expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example/api/v1/me/notifications/preferences', expect.objectContaining({ method: 'PUT', body: JSON.stringify(updated) }));
});

test.each([401, 500])('HTTP %s remains a failure instead of fabricating preference values', async status => {
  globalThis.fetch = jest.fn().mockResolvedValue(new Response('', { status }));
  await expect(getNotificationPreferences()).rejects.toMatchObject({ status });
});
