import { getPhotoSession, invalidateProtectedPhotos, subscribePhotoSession } from '../src/lib/photoSession';

test('focus and visibility keep the session; explicit invalidation still notifies synchronously', () => {
  const originals = ['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const browser = new EventTarget();
  const page = new EventTarget();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: page });
  const listener = jest.fn();
  const unsubscribe = subscribePhotoSession(listener);
  try {
    const before = getPhotoSession();
    browser.dispatchEvent(new Event('focus'));
    page.dispatchEvent(new Event('visibilitychange'));
    expect(getPhotoSession()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    invalidateProtectedPhotos();
    expect(getPhotoSession()).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    invalidateProtectedPhotos();
    expect(listener).toHaveBeenCalledTimes(1);
  } finally {
    unsubscribe();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
