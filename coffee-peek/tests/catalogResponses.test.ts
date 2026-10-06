jest.mock('../src/utils/logger', () => ({ logger: { log: jest.fn(), error: jest.fn() } }));
jest.mock('../src/utils/errorHandler', () => ({ getErrorMessageByStatus: (status: number) => `HTTP ${status}` }));
import { responseInterceptor, TokenManager, tryRefreshAccessToken } from '../src/api/core/interceptors';
const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; TokenManager.clearTokens(); });
test('favorite PUT/DELETE 204 does not try to parse an empty JSON body', async () => {
  const response = new Response(null, { status: 204, headers: { 'content-type': 'application/json' } });
  const json = jest.spyOn(response, 'json');
  await expect(responseInterceptor(response, '/api/v1/favorites/roaster/sample')).resolves.toEqual({});
  expect(json).not.toHaveBeenCalled();
});
test('slow refresh from A cannot overwrite token for B', async () => {
  TokenManager.setAccessToken('A');
  let finish!: (r: Response) => void;
  globalThis.fetch = jest.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
  const pending = tryRefreshAccessToken('https://api.example');
  TokenManager.setAccessToken('B');
  finish(new Response(JSON.stringify({ data: { accessToken: 'late-A' } })));
  expect(await pending).toBe('error'); expect(TokenManager.getAccessToken()).toBe('B');
});
