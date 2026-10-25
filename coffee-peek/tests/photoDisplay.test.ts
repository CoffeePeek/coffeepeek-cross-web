import { createPhotoDisplay } from '../src/lib/photoDisplay';
import type { PhotoPermission } from '../src/lib/photoResponse';

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-25T12:00:00Z') });
  jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:photo');
  jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

function setup() {
  let visible = true, current = true, expiry = Infinity;
  const blob = new Blob(['photo']);
  const permission = (): PhotoPermission => ({ blob, displayUntil: performance.now() + 20_000,
    displayExpiresAt: Date.now() + 20_000, credentialExpiresAt: expiry });
  const load = jest.fn(async () => permission());
  const release = jest.fn();
  const onChange = jest.fn();
  const acquire = jest.fn((_revalidate: boolean) => ({ promise: load(), release }));
  const display = createPhotoDisplay({ acquire, isVisible: () => visible, isCurrent: () => current,
    credentialExpiry: () => expiry, onChange });
  return { display, acquire, load, permission, onChange, release,
    visible: (value: boolean) => { visible = value; }, current: () => { current = false; }, expiry: (value: number) => { expiry = value; } };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

test('focus and short tab switches retain the same photo and do not download again', async () => {
  const f = setup(); await settle();
  f.visible(false); f.display.resume();
  await jest.advanceTimersByTimeAsync(1_000);
  f.visible(true); f.display.resume(); f.display.resume();
  expect(f.acquire).toHaveBeenCalledTimes(1);
  expect(f.onChange.mock.calls).toEqual([[{ src: 'blob:photo' }]]);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  f.display.stop();
});

test('background renewal preserves pixels and a validated identical Blob keeps its object URL', async () => {
  const f = setup(); await settle();
  let complete!: (value: PhotoPermission) => void;
  f.load.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  await jest.advanceTimersByTimeAsync(15_000);
  expect(f.acquire).toHaveBeenLastCalledWith(true);
  expect(f.onChange).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  complete(f.permission()); await settle();
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  expect(f.onChange).toHaveBeenCalledTimes(1);
  f.display.stop();
});

test('a slow renewal removes expired pixels without a loading message, then restores authorized bytes', async () => {
  const f = setup(); await settle();
  let complete!: (value: PhotoPermission) => void;
  f.load.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  await jest.advanceTimersByTimeAsync(20_000);
  expect(f.onChange).toHaveBeenLastCalledWith({});
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
  complete(f.permission()); await settle();
  expect(f.onChange).toHaveBeenLastCalledWith({ src: 'blob:photo' });
  f.display.stop();
});

test('hidden tabs do not renew; an expired photo requests authorization on return', async () => {
  const f = setup(); await settle();
  f.visible(false); f.display.resume();
  await jest.advanceTimersByTimeAsync(25_000);
  expect(f.acquire).toHaveBeenCalledTimes(1);
  expect(f.onChange).toHaveBeenLastCalledWith({});
  f.visible(true); f.display.resume(); await settle();
  expect(f.acquire).toHaveBeenCalledTimes(2);
  expect(f.onChange).toHaveBeenLastCalledWith({ src: 'blob:photo' });
  f.display.stop();
});

test('denied renewal clears the photo immediately and focus does not trigger a retry loop', async () => {
  const f = setup(); await settle();
  f.load.mockRejectedValueOnce(new Error('403'));
  await jest.advanceTimersByTimeAsync(15_000);
  expect(f.onChange).toHaveBeenLastCalledWith({ failed: true });
  expect(URL.revokeObjectURL).toHaveBeenCalled();
  f.display.resume();
  expect(f.acquire).toHaveBeenCalledTimes(2);
  f.display.stop();
});

test('session changes and credential expiry invalidate already displayed pixels', async () => {
  for (const invalidate of ['session', 'credential'] as const) {
    const f = setup(); await settle();
    if (invalidate === 'session') f.current(); else f.expiry(Date.now());
    f.display.resume();
    expect(f.onChange).toHaveBeenLastCalledWith({ failed: true });
    f.display.stop();
  }
});

test('unmount releases an in-flight renewal and ignores its late result', async () => {
  const f = setup(); await settle();
  let complete!: (value: PhotoPermission) => void;
  f.load.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  await jest.advanceTimersByTimeAsync(15_000);
  f.display.stop();
  complete(f.permission()); await settle();
  expect(f.onChange).toHaveBeenCalledTimes(1);
  expect(f.release).toHaveBeenCalledTimes(2);
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});

test('object URL creation failures settle into an error instead of leaving a pending image', async () => {
  jest.mocked(URL.createObjectURL).mockImplementationOnce(() => { throw new Error('Unavailable'); });
  const f = setup(); await settle();
  expect(f.onChange).toHaveBeenLastCalledWith({ failed: true });
  expect(f.release).toHaveBeenCalledTimes(1);
  f.display.stop();
});
