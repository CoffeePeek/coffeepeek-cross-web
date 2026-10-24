jest.mock('../src/api/core/apiConfig', () => ({
  API_BASE_URL: 'https://api.example.test', API_GATEWAY_URL: 'https://api.example.test',
  API_ENDPOINTS: { AUTH: { LOGIN: '/api/tokens', GOOGLE_LOGIN: '/api/tokens/google/login' }, TOKEN: { BASE: '/api/tokens' } },
  buildUrlWithParams: (endpoint: string) => endpoint,
}));

import { googleLogin } from '../src/api/auth';
import { TokenManager } from '../src/api/core/httpClient';

const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();
const accessToken = ['e30', Buffer.from(JSON.stringify({ roles: ['Admin'], exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'fixture'].join('.');

beforeEach(() => {
  jest.clearAllMocks();
  TokenManager.clearTokens();
  globalThis.fetch = mockFetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  TokenManager.clearTokens();
});

test('Google ID token is posted without a Bearer token or refresh; the app access token stays in memory', async () => {
  TokenManager.setAccessToken(accessToken);
  mockFetch.mockResolvedValue(new Response(JSON.stringify({ data: { AccessToken: accessToken }, isSuccess: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }));
  const response = await googleLogin('google-id-token');
  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [url, options] = mockFetch.mock.calls[0];
  expect(url).toBe('https://api.example.test/api/tokens/google/login');
  expect(options.method).toBe('POST');
  expect(JSON.parse(options.body)).toEqual({ idToken: 'google-id-token' });
  expect(options.credentials).toBe('include');
  expect(options.headers.get('Authorization')).toBeNull();
  expect(response.data.accessToken).toBe(accessToken);
  expect(TokenManager.getAccessToken()).toBe(accessToken);
});

test('rejected Google credentials preserve the HTTP error and do not trigger token refresh', async () => {
  mockFetch.mockResolvedValue(new Response(JSON.stringify({ message: 'Invalid token' }), {
    status: 401, headers: { 'Content-Type': 'application/json' },
  }));
  await expect(googleLogin('invalid-google-token')).rejects.toMatchObject({ status: 401, message: 'Invalid token' });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(TokenManager.getAccessToken()).toBeNull();
});

test.each([
  { data: {}, isSuccess: true },
  { data: { accessToken }, isSuccess: false, message: 'Google login failed' },
])('an unsuccessful or tokenless response never authenticates the browser', async body => {
  mockFetch.mockResolvedValue(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  await expect(googleLogin('google-id-token')).rejects.toThrow();
  expect(TokenManager.getAccessToken()).toBeNull();
});
