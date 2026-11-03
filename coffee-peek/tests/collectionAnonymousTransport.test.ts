jest.mock('../src/api/core/apiConfig', () => ({
  API_BASE_URL: 'https://api.example', API_GATEWAY_URL: 'https://api.example',
  buildUrlWithParams: (path: string) => path,
}));
jest.mock('../src/utils/logger', () => ({ logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../src/utils/errorHandler', () => ({ getErrorMessageByStatus: () => 'Request failed' }));
jest.mock('../src/realtime/forceLogout', () => ({ emitSessionInvalidated: jest.fn() }));
import { getCollection } from '../src/api/collections';
import { httpClient } from '../src/api/core/httpClient';
import * as auth from '../src/api/core/interceptors';

const id = '123456781234123412341234567890ab';
const data = { id, title: 'Places', canonicalPath: `/collections/${id}`, createdAtUtc: '', items: [] };
const originalFetch = globalThis.fetch;
const response = (status = 200) => new Response(JSON.stringify({ isSuccess: status === 200, data }), {
  status, headers: { 'Content-Type': 'application/json' },
});

beforeEach(() => {
  jest.spyOn(auth.TokenManager, 'getAccessToken').mockReturnValue('expired-test-access-token');
  jest.spyOn(auth.TokenManager, 'clearTokens');
  jest.spyOn(auth, 'ensureFreshAccessToken').mockResolvedValue(true);
  jest.spyOn(auth, 'tryRefreshAccessToken').mockResolvedValue('rejected');
  globalThis.fetch = jest.fn().mockResolvedValue(response());
});
afterEach(() => { globalThis.fetch = originalFetch; jest.restoreAllMocks(); });

test('collection transport omits stored bearer and browser cookies without refreshing an expired session', async () => {
  await expect(getCollection(id)).resolves.toEqual(data);
  expect(auth.ensureFreshAccessToken).not.toHaveBeenCalled();
  const [url, options] = jest.mocked(globalThis.fetch).mock.calls[0];
  expect(url).toBe(`https://api.example/api/v1/favorite-collections/${id}`);
  expect(new Headers(options?.headers).has('Authorization')).toBe(false);
  expect(options?.credentials).toBe('omit');
});

test('ordinary personalized GET retains its existing bearer and cookie policy', async () => {
  await httpClient.get('/api/v1/feed');
  expect(auth.ensureFreshAccessToken).toHaveBeenCalledTimes(1);
  const [, options] = jest.mocked(globalThis.fetch).mock.calls[0];
  expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer expired-test-access-token');
  expect(options?.credentials).toBe('include');
});

test('an anonymous collection failure cannot refresh or clear the viewer session', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(response(401));
  await expect(getCollection(id)).rejects.toMatchObject({ status: 401 });
  expect(auth.ensureFreshAccessToken).not.toHaveBeenCalled();
  expect(auth.tryRefreshAccessToken).not.toHaveBeenCalled();
  expect(auth.TokenManager.clearTokens).not.toHaveBeenCalled();
});
