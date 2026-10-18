jest.mock('../src/api/core/apiConfig', () => ({ API_BASE_URL: 'https://api.example', API_GATEWAY_URL: '/backend', buildUrlWithParams: (path: string) => path }));
jest.mock('../src/api/core/interceptors', () => ({
  requestInterceptor: (_url: string, options: RequestInit) => options,
  ensureFreshAccessToken: jest.fn(), isAuthTokenEndpoint: () => false,
  responseInterceptor: jest.fn(), normalizeResponseData: (data: unknown) => data,
  TokenManager: { getAccessToken: jest.fn(() => null) },
}));
jest.mock('../src/realtime/forceLogout', () => ({ emitSessionInvalidated: jest.fn() }));
import HttpClient from '../src/api/core/httpClient';
import { responseInterceptor, TokenManager } from '../src/api/core/interceptors';
const client = new HttpClient('https://api.example');
const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; jest.mocked(TokenManager.getAccessToken).mockReturnValue(null); });
test('raw GET preserves envelope, metadata and array and disables fetch caching', async () => {
  for (const body of [{ data: { shopDto: { name: 'Coffee' } }, address: { entityId: 'id' } }, { entityId: 'id' }, []]) {
    globalThis.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify(body)));
    expect(await client.getRaw('/address')).toEqual(body);
    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example/address', expect.objectContaining({ cache: 'no-store', method: 'GET' }));
  }
});
test('raw GET uses HTTP status even for empty or non-JSON gateway errors', async () => {
  for (const body of ['', 'Gateway unavailable', JSON.stringify({ title: 'Hidden' })]) {
    globalThis.fetch = jest.fn().mockResolvedValue(new Response(body, { status: 429, headers: { 'Retry-After': '30' } }));
    await expect(client.getRaw('/address')).rejects.toMatchObject({ status: 429, retryAfter: '30' });
  }
});

test('protected photos use the gateway binary request without parsing a JSON envelope', async () => {
  const bytes = new Uint8Array([137, 80, 78, 71]);
  globalThis.fetch = jest.fn().mockResolvedValue(new Response(bytes, { headers: { 'Content-Type': 'image/png' } }));
  const blob = await client.getBlob('https://api.example/api/v1/check-ins/id/photos/photo?revision=2');
  expect(blob.type).toBe('image/png');
  expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
  expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example/api/v1/check-ins/id/photos/photo?revision=2', expect.objectContaining({ method: 'GET', cache: 'no-store' }));
});

test('relative development gateways route protected photo URLs through the proxy', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { value: { origin: 'https://site.example' }, configurable: true });
  try {
    globalThis.fetch = jest.fn().mockResolvedValue(new Response('photo'));
    await new HttpClient('/backend').getBlob('/api/v1/check-ins/id/photos/photo');
    expect(globalThis.fetch).toHaveBeenCalledWith('/backend/api/v1/check-ins/id/photos/photo', expect.objectContaining({ method: 'GET' }));
  } finally {
    if (previous) Object.defineProperty(globalThis, 'location', previous);
    else Reflect.deleteProperty(globalThis, 'location');
  }
});

test('photo requests never send credentials to a foreign storage host', async () => {
  globalThis.fetch = jest.fn();
  await expect(client.getBlob('https://untrusted.example/private.jpg')).rejects.toThrow('Недоступный адрес фотографии');
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('cancelled photo requests do not expose the downloaded blob', async () => {
  const controller = new AbortController();
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true, status: 200,
    blob: async () => { controller.abort(); return new Blob(['photo']); },
  });
  await expect(client.getBlob('/api/v1/check-ins/id/photos/photo', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
});

test('deleting a check-in preserves null data and uses the HTTP success status', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  jest.mocked(responseInterceptor).mockResolvedValueOnce({ data: null, isSuccess: true, statusCode: null });
  expect(await client.delete('/api/v1/check-ins/id')).toMatchObject({ data: null, statusCode: 200, success: true });
});

test('conditional photo GET preserves 304 metadata without JSON or body parsing and bypasses implicit caches', async () => {
  const headers = new Headers({ ETag: '"variant"', 'Cache-Control': 'private,max-age=20', Date: new Date().toUTCString(), Age: '3' });
  const json = jest.fn(), blob = jest.fn();
  globalThis.fetch = jest.fn().mockResolvedValue({ status: 304, ok: false, headers, json, blob });
  const result = await client.getPhotoResponse('/api/v1/check-ins/id/photos/photo/variants/source/1/feed.webp', undefined, '"variant"');
  expect(result).toMatchObject({ status: 304, headers, blob: undefined });
  expect(result.responseMono).toBeGreaterThanOrEqual(result.requestMono);
  expect(json).not.toHaveBeenCalled(); expect(blob).not.toHaveBeenCalled();
  expect(globalThis.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    cache: 'no-store', redirect: 'error', headers: { 'If-None-Match': '"variant"' },
  }));
});

test('expired or malformed current credentials never fall back to an anonymous photo request', async () => {
  for (const token of ['malformed', `e30.${btoa(JSON.stringify({ exp: 1 }))}.signature`]) {
    jest.mocked(TokenManager.getAccessToken).mockReturnValue(token);
    globalThis.fetch = jest.fn();
    await expect(client.getPhotoResponse('/api/v1/check-ins/id/photos/photo')).rejects.toThrow('credentials expired');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  }
});
