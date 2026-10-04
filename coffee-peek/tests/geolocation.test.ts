import { getLocationLifetime, USER_LOCATION_TTL_MS } from '../src/utils/geolocation';

test('location expires five minutes after it was measured', () => {
  const now = 1_000_000;
  expect(getLocationLifetime(now, now)).toBe(USER_LOCATION_TTL_MS);
  expect(getLocationLifetime(now - USER_LOCATION_TTL_MS + 1, now)).toBe(1);
  expect(getLocationLifetime(now - USER_LOCATION_TTL_MS, now)).toBe(0);
});

describe('shared device location', () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  let location: typeof import('../src/utils/geolocation');
  let now: number;
  let permissionState: PermissionState;
  let query: jest.Mock;
  let getCurrentPosition: jest.Mock<void, [PositionCallback, PositionErrorCallback?, PositionOptions?]>;
  let stored: Map<string, string>;

  beforeEach(() => {
    jest.resetModules();
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    permissionState = 'prompt';
    query = jest.fn(async () => ({ state: permissionState }));
    getCurrentPosition = jest.fn(success => success({
      coords: { latitude: 53.9, longitude: 27.56 }, timestamp: now,
    } as GeolocationPosition));
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { geolocation: { getCurrentPosition }, permissions: { query } },
    });
    stored = new Map();
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => stored.set(key, value),
        removeItem: (key: string) => stored.delete(key),
      },
    });
    location = require('../src/utils/geolocation');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  });

  test.each<PermissionState>(['prompt', 'denied'])('automatic reads never request permission when state is %s', async state => {
    permissionState = state;
    expect(await location.getDeviceLocation()).toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  test('a browser without Permissions API waits for an explicit user action', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: { geolocation: { getCurrentPosition } } });
    expect(await location.getDeviceLocation()).toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(await location.getDeviceLocation({ requestPermission: true })).not.toBeNull();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  test('unsupported geolocation permission queries never trigger a prompt', async () => {
    query.mockRejectedValue(new TypeError('Unsupported permission'));
    expect(await location.getDeviceLocation()).toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  test('a granted permission reuses coordinates across page reads', async () => {
    permissionState = 'granted';
    const first = await location.getDeviceLocation();
    now += 1000;
    expect(await location.getDeviceLocation()).toEqual(first);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  test('a reload restores recent coordinates even when temporary permission has expired', async () => {
    const first = await location.getDeviceLocation({ requestPermission: true });
    now += 1000;
    jest.resetModules();
    const reloaded: typeof location = require('../src/utils/geolocation');
    expect(await reloaded.getDeviceLocation()).toEqual(first);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  test('expiring coordinates do not cause an automatic permission prompt', async () => {
    await location.getDeviceLocation({ requestPermission: true });
    now += USER_LOCATION_TTL_MS;
    expect(await location.getDeviceLocation()).toBeNull();
    expect(stored.size).toBe(0);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  test('simultaneous page reads share one device request', async () => {
    permissionState = 'granted';
    let complete: PositionCallback | undefined;
    getCurrentPosition.mockImplementation(success => { complete = success; });
    const first = location.getDeviceLocation();
    const second = location.getDeviceLocation();
    await Promise.resolve();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    complete!({ coords: { latitude: 53.9, longitude: 27.56 }, timestamp: now } as GeolocationPosition);
    expect(await first).toEqual(await second);
  });

  test('an explicit refresh obtains new coordinates instead of using an old sample', async () => {
    await location.getDeviceLocation({ requestPermission: true });
    now += 1000;
    await location.getDeviceLocation({ requestPermission: true, maximumAge: 0 });
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  test('failed requests leave no stored permission or coordinates', async () => {
    getCurrentPosition.mockImplementation((_success, error) => error?.({ code: 1 } as GeolocationPositionError));
    expect(await location.getDeviceLocation({ requestPermission: true })).toBeNull();
    expect(stored.size).toBe(0);
    expect(await location.getDeviceLocation()).toBeNull();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  test('blocked storage still allows the location button to work', async () => {
    Object.defineProperty(globalThis, 'sessionStorage', { get: () => { throw new Error('Storage blocked'); } });
    expect(await location.getDeviceLocation({ requestPermission: true })).not.toBeNull();
  });
});
