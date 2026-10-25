import { ProtectedPhotoCache } from '../src/lib/photoCache';
import type { PhotoResponse } from '../src/lib/photoResponse';

const BASE = Date.UTC(2026, 9, 18, 12);
const url = (id = 'one', source = 'source', recipe = 1) => `/api/v1/check-ins/check/photos/${id}/variants/${source}/${recipe}/feed.webp`;
const binding = (target = url(), source = 'source', recipe = 1) => JSON.stringify([source, recipe, 'feed', 'webp', target]);

function setup(options: { maxBytes?: number; maxEntries?: number } = {}) {
  let wall = BASE, mono = 0, scope = 1, expiry = Infinity;
  const load = jest.fn<Promise<PhotoResponse>, [string, AbortSignal, string?]>();
  const response = (headers: Record<string, string> = {}, status = 200, requestMono = mono): PhotoResponse => ({
    status, blob: status === 200 ? new Blob(['photo']) : undefined,
    headers: new Headers({ 'Cache-Control': 'private, max-age=20, must-revalidate', ETag: '"v1"', Date: new Date(wall).toUTCString(), ...headers }),
    requestMono, responseMono: mono, responseWall: wall,
  });
  load.mockImplementation(async () => response());
  const cache = new ProtectedPhotoCache(load, { session: () => scope, credentialExpiry: () => expiry,
    clock: { wall: () => wall, mono: () => mono }, ...options });
  const get = (target = url(), key: string | undefined = binding(target)) => cache.acquire(target, scope, key);
  return { cache, get, load, response, advance: (ms: number) => { wall += ms; mono += ms; },
    wall: (value: number) => { wall = value; }, session: () => { scope++; cache.clear(); }, expiry: (value: number) => { expiry = value; } };
}

test('fresh ready bytes are reused without extending authorization, then revalidated with exact ETag', async () => {
  const f = setup();
  const first = await f.get().promise;
  f.advance(5_000);
  const fresh = await f.get().promise;
  expect(fresh.blob).toBe(first.blob);
  expect(fresh.displayUntil).toBe(first.displayUntil);
  expect(f.load).toHaveBeenCalledTimes(1);
  f.advance(15_001);
  f.load.mockResolvedValueOnce(f.response({}, 304));
  const validated = await f.get().promise;
  expect(validated.blob).toBe(first.blob);
  expect(validated.displayUntil).toBe(40_000); // HTTP Date has whole-second precision.
  expect(f.load.mock.calls[1][2]).toBe('"v1"');
});

test('proactive renewal validates fresh bytes online instead of returning the old deadline', async () => {
  const f = setup();
  const first = await f.get().promise;
  f.advance(15_000);
  f.load.mockResolvedValueOnce(f.response({}, 304));
  const renewed = await f.cache.acquire(url(), 1, binding(), true).promise;
  expect(f.load).toHaveBeenCalledTimes(2);
  expect(f.load.mock.calls[1][2]).toBe('"v1"');
  expect(renewed.blob).toBe(first.blob);
  expect(renewed.displayUntil).toBe(35_000);
});

test.each([
  ['private, no-store', {}],
  ['private, max-age=0, must-revalidate', {}],
  ['private, max-age=20, no-cache', {}],
  ['private, max-age=20', { Date: '' }],
  ['private, max-age=20', { Date: 'unreadable' }],
  ['private, max-age=20', { Age: '-1' }],
  ['private, max-age=20', { Age: '1.5' }],
  ['private, max-age=20', { Age: '999999999999999999999999' }],
  ['private, max-age=20, max-age=40', {}],
  ['private, max-age=oops', {}],
  ['private, max-age=20', { Vary: '*' }],
])('policy %s with metadata %j never authorizes a fresh next-display hit', async (policy, headers) => {
  const f = setup();
  f.load.mockImplementation(async () => f.response({ 'Cache-Control': policy, ...headers }));
  await f.get().promise;
  await f.get().promise;
  expect(f.load).toHaveBeenCalledTimes(2);
});

test.each([
  [{ Age: '7' }, 0, 13_000],
  [{ Date: new Date(BASE - 12_000).toUTCString() }, 0, 8_000],
  [{ Age: '3' }, 4_000, 17_000],
  [{ Date: new Date(BASE + 60_000).toUTCString() }, 4_000, 20_000],
])('Date/Age/transfer delay %j limits the deadline even across another display', async (headers, delay, deadline) => {
  const f = setup();
  f.load.mockImplementationOnce(async () => { f.advance(delay); return f.response(headers, 200, 0); });
  const result = await f.get().promise;
  expect(result.displayUntil).toBe(deadline);
  f.advance(Math.max(0, deadline - delay - 1));
  await f.get().promise;
  expect(f.load).toHaveBeenCalledTimes(1);
  f.advance(1);
  await f.get().promise;
  expect(f.load).toHaveBeenCalledTimes(2);
});

test('positive authorization already stale at body completion fails closed', async () => {
  const f = setup();
  f.load.mockImplementationOnce(async () => { f.advance(19_000); return f.response({ Age: '2' }, 200, 0); });
  await expect(f.get().promise).rejects.toThrow('expired during download');
  await f.get().promise;
  expect(f.load.mock.calls[1][2]).toBeUndefined();
});

test('no-store 200 grants only the current online display and discards bytes and validator', async () => {
  const f = setup();
  f.load.mockResolvedValueOnce(f.response({ 'Cache-Control': 'private, no-store' }));
  expect((await f.get().promise).displayUntil).toBe(20_000);
  await f.get().promise;
  expect(f.load.mock.calls[1][2]).toBeUndefined();
});

test('zero TTL retains encoded bytes solely for authenticated online validation', async () => {
  const f = setup();
  f.load.mockResolvedValueOnce(f.response({ 'Cache-Control': 'private, max-age=0, must-revalidate' }));
  const first = await f.get().promise;
  f.advance(1_000);
  f.load.mockResolvedValueOnce(f.response({ 'Cache-Control': 'private, max-age=0, must-revalidate' }, 304));
  const second = await f.get().promise;
  expect(second.blob).toBe(first.blob);
  expect(second.displayUntil).toBe(21_000);
  expect(f.load.mock.calls[1][2]).toBe('"v1"');
});

test.each([
  { 'Cache-Control': 'private, no-store' }, { ETag: '"different"' }, { ETag: '' }, { 'Cache-Control': '' },
])('unsafe 304 %j evicts and retries unconditionally once', async headers => {
  const f = setup();
  const first = await f.get().promise;
  f.advance(20_000);
  f.load.mockResolvedValueOnce(f.response(headers, 304));
  f.load.mockResolvedValueOnce(f.response({ ETag: '"new"' }));
  expect((await f.get().promise).blob).not.toBe(first.blob);
  expect(f.load.mock.calls.map(call => call[2])).toEqual([undefined, '"v1"', undefined]);
});

test('a bare 304 without retained bytes never restores any image', async () => {
  const f = setup();
  f.load.mockImplementation(async () => f.response({}, 304));
  await expect(f.get().promise).rejects.toThrow('did not authorize');
  expect(f.load).toHaveBeenCalledTimes(2);
});

test('304 with missing Date allows only current online display, never a sliding freshness window', async () => {
  const f = setup();
  await f.get().promise;
  f.advance(20_000);
  f.load.mockImplementation(async () => f.response({ Date: '' }, 304));
  await f.get().promise;
  await f.get().promise;
  expect(f.load).toHaveBeenCalledTimes(3);
});

test('304 with the old server observation cannot restart an expired positive TTL', async () => {
  const f = setup();
  await f.get().promise;
  f.advance(20_000);
  f.load.mockResolvedValueOnce(f.response({ Date: new Date(BASE).toUTCString() }, 304));
  await expect(f.get().promise).rejects.toThrow('expired during download');
});

test('original/private/home/moderation and missing manifest binding never retain bytes despite permissive headers', async () => {
  const f = setup();
  for (const target of ['/api/v1/check-ins/check/photos/original', '/api/home/photos/private', '/api/moderation/photos/one', url()]) {
    const key = target === url() ? undefined : binding(target);
    await f.cache.acquire(target, 1, key).promise;
    await f.cache.acquire(target, 1, key).promise;
  }
  expect(f.load).toHaveBeenCalledTimes(8);
  expect(f.load.mock.calls.every(call => call[2] === undefined)).toBe(true);
});

test('full URL, source and recipe bindings cannot borrow another version or session validator', async () => {
  const f = setup();
  await f.get().promise;
  for (const target of [url('one', 'new'), url('one', 'source', 2), `${url()}?download=1`]) {
    await f.get(target).promise;
  }
  await f.cache.acquire(url(), 1, binding(url(), 'wrong')).promise;
  f.session();
  await f.get().promise;
  expect(f.load).toHaveBeenCalledTimes(6);
  expect(f.load.mock.calls.every(call => call[2] === undefined)).toBe(true);
});

test('JWT expiry caps display and fresh hits and cannot be extended by wall-clock rollback', async () => {
  const f = setup();
  f.expiry(BASE + 5_000);
  expect((await f.get().promise).displayUntil).toBe(5_000);
  f.advance(5_001);
  f.wall(BASE - 60_000);
  await expect(f.get().promise).rejects.toThrow('credentials expired');
  expect(f.load).toHaveBeenCalledTimes(1);
});

test('wall clock forward beyond JWT expiry refuses even a fresh byte hit', async () => {
  const f = setup();
  f.expiry(BASE + 60_000);
  await f.get().promise;
  f.wall(BASE + 120_000);
  await expect(f.get().promise).rejects.toThrow('credentials expired');
  expect(f.load).toHaveBeenCalledTimes(1);
});

test('wall clock forward or device suspension exhausts anonymous server authorization even if monotonic time pauses', async () => {
  const f = setup();
  await f.get().promise;
  f.wall(BASE + 60_000);
  await f.get().promise;
  expect(f.load).toHaveBeenCalledTimes(2);
  expect(f.load.mock.calls[1][2]).toBe('"v1"');
});

test('permission cannot expire in the microtask between a fresh acquire and delivery', async () => {
  const f = setup();
  await f.get().promise;
  const pending = f.get();
  f.advance(20_000);
  await expect(pending.promise).rejects.toThrow('permission expired');
});

test('account/local invalidation cancels in-flight and conditional responses even when transport ignores abort', async () => {
  const f = setup();
  await f.get().promise;
  f.advance(20_000);
  let complete!: (value: PhotoResponse) => void;
  f.load.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const pending = f.get();
  f.session();
  complete(f.response({}, 304));
  await expect(pending.promise).rejects.toMatchObject({ name: 'AbortError' });
  await f.get().promise;
  expect(f.load.mock.calls[2][2]).toBeUndefined();
});

test('fresh hits pending in a microtask also reject on session change', async () => {
  const f = setup();
  await f.get().promise;
  const pending = f.get();
  f.session();
  await expect(pending.promise).rejects.toMatchObject({ name: 'AbortError' });
});

test.each(['offline', '403 revoked', '404 deleted'])('failed %s revalidation evicts bytes; a later retry is unconditional', async message => {
  const f = setup();
  await f.get().promise;
  f.advance(20_000);
  f.load.mockRejectedValueOnce(new Error(message));
  await expect(f.get().promise).rejects.toThrow(message);
  await f.get().promise;
  expect(f.load.mock.calls[2][2]).toBeUndefined();
});

test.each([{ maxEntries: 2 }, { maxBytes: 10 }])('LRU retention obeys bounds %j and touches fresh hits', async options => {
  const f = setup(options);
  await f.get(url('one')).promise;
  await f.get(url('two')).promise;
  await f.get(url('one')).promise;
  await f.get(url('three')).promise;
  await f.get(url('one')).promise;
  expect(f.load).toHaveBeenCalledTimes(3);
  await f.get(url('two')).promise;
  expect(f.load).toHaveBeenCalledTimes(4);
  expect(f.load.mock.calls[3][2]).toBeUndefined();
});

test('an oversized Blob may serve the current authorized display but never enters the byte cache', async () => {
  const f = setup({ maxBytes: 4 });
  await f.get().promise;
  await f.get().promise;
  expect(f.load).toHaveBeenCalledTimes(2);
});

test('last-subscriber cancellation prevents an uncancellable transport from retaining downloaded bytes', async () => {
  const f = setup();
  let complete!: (value: PhotoResponse) => void;
  f.load.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const one = f.get(), two = f.get();
  one.release();
  expect(f.load.mock.calls[0][1].aborted).toBe(false);
  two.release();
  complete(f.response());
  await expect(one.promise).rejects.toMatchObject({ name: 'AbortError' });
  await expect(two.promise).rejects.toMatchObject({ name: 'AbortError' });
  await f.get().promise;
  expect(f.load.mock.calls[1][2]).toBeUndefined();
});

test('a late cancelled response cannot evict replacement same-key bytes', async () => {
  const f = setup();
  let complete!: (value: PhotoResponse) => void;
  f.load.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const old = f.get();
  old.release();
  const replacement = await f.get().promise;
  complete(f.response());
  await expect(old.promise).rejects.toMatchObject({ name: 'AbortError' });
  expect((await f.get().promise).blob).toBe(replacement.blob);
  expect(f.load).toHaveBeenCalledTimes(2);
});
