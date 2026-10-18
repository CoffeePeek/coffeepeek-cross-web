import { selectCheckInPhoto } from '../src/utils/checkInPhotoVariants';
import type { CheckInPhotoVariant } from '../src/api/coffeeshop';
import { PhotoRequests } from '../src/lib/photoRequests';
import { getPhotoSession, invalidateProtectedPhotos, subscribePhotoSession } from '../src/lib/photoSession';

const variant = (purpose: string, contentType = 'image/webp', width = 960): CheckInPhotoVariant => ({
  purpose, contentType, width, height: width, sizeBytes: 1000, format: contentType.split('/')[1],
  sourceVersion: 'source', recipeVersion: 1, url: `/variant/${purpose}/${contentType}/${width}`,
});

test('selects ready feed/detail/thumb, keeps original unchanged and handles legacy API', () => {
  const photo = { url: '/original', variants: [variant('feed'), variant('thumb'), variant('detail')] };
  expect(selectCheckInPhoto(photo, 'feed')?.url).toBe(photo.variants[0].url);
  expect(selectCheckInPhoto(photo, 'thumb')?.url).toBe(photo.variants[1].url);
  expect(selectCheckInPhoto(photo, 'detail')?.url).toBe(photo.variants[2].url);
  expect(photo.url).toBe('/original');
  expect(selectCheckInPhoto({ url: '/legacy' }, 'feed')).toEqual({ url: '/legacy' });
});

test('pending, unknown or invalid variants never trigger an original download', () => {
  for (const variants of [[], [variant('unknown')], [{ ...variant('feed'), width: 0 }], [variant('feed', 'image/avif')]]) {
    expect(selectCheckInPhoto({ url: '/original', variants }, 'feed')).toBeNull();
  }
});

test('format fallback preserves alpha and size selection uses physical pixels', () => {
  const small = variant('feed', 'image/webp', 320);
  const large = variant('feed');
  expect(selectCheckInPhoto({ url: '', variants: [large, small] }, 'feed', 300)?.width).toBe(320);
  expect(selectCheckInPhoto({ url: '', variants: [large, small] }, 'feed', 800)?.width).toBe(960);
  expect(selectCheckInPhoto({ url: '', variants: [variant('thumb', 'image/png')] }, 'thumb')?.url).toContain('image/png');
});

test('deduplicates in-flight downloads within a session and releases the last subscriber', async () => {
  const load = jest.fn((_url: string, signal: AbortSignal) => new Promise<Blob>((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')));
  }));
  const pool = new PhotoRequests(load);
  const one = pool.acquire('/photo', 1);
  const two = pool.acquire('/photo', 1);
  const other = pool.acquire('/photo', 2);
  expect(load).toHaveBeenCalledTimes(2);
  one.release();
  expect(load.mock.calls[0][1].aborted).toBe(false);
  two.release(); other.release();
  await expect(one.promise).rejects.toMatchObject({ name: 'AbortError' });
  await expect(other.promise).rejects.toMatchObject({ name: 'AbortError' });
});

test('bounds simultaneous transfers and cancels queued requests before starting them', async () => {
  let complete!: (value: Blob) => void;
  const load = jest.fn(() => new Promise<Blob>(resolve => { complete = resolve; }));
  const pool = new PhotoRequests(load, 1);
  const one = pool.acquire('/first', 1);
  const queued = pool.acquire('/queued', 1);
  queued.release();
  await expect(queued.promise).rejects.toMatchObject({ name: 'AbortError' });
  complete(new Blob(['photo']));
  await one.promise;
  expect(load).toHaveBeenCalledTimes(1);
  one.release();
  const again = pool.acquire('/first', 1);
  expect(load).toHaveBeenCalledTimes(2); // No bytes cache after settlement.
  complete(new Blob(['photo'])); await again.promise; again.release();
});

test('logout, account change and local mutations synchronously invalidate display permission', () => {
  const previous = getPhotoSession();
  const listener = jest.fn();
  const unsubscribe = subscribePhotoSession(listener);
  invalidateProtectedPhotos();
  expect(getPhotoSession()).toBe(previous + 1);
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
});

test('cancelling just after a queue wake passes the available slot to the next subscriber', async () => {
  let complete!: (value: Blob) => void;
  const load = jest.fn((url: string) => url === '/active'
    ? new Promise<Blob>(resolve => { complete = resolve; }) : Promise.resolve(new Blob([url])));
  const pool = new PhotoRequests(load, 1);
  const active = pool.acquire('/active', 1);
  const cancelled = pool.acquire('/cancelled', 1);
  const next = pool.acquire('/next', 1);
  const rejected = expect(cancelled.promise).rejects.toMatchObject({ name: 'AbortError' });
  complete(new Blob(['active']));
  queueMicrotask(() => cancelled.release());
  await active.promise;
  await rejected;
  await next.promise;
  expect(load.mock.calls.map(call => call[0])).toEqual(['/active', '/next']);
  active.release(); next.release();
});
