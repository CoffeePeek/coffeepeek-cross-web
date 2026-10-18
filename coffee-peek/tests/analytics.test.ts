import type { BeforeSendFn, CaptureResult } from 'posthog-js';

type AnalyticsModule = typeof import('../src/lib/analytics');
type AnalyticsContext = Parameters<AnalyticsModule['syncAnalytics']>[0];

describe('product analytics', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const context: AnalyticsContext = {
    apiKey: 'phc_test_project', apiHost: 'https://eu.i.posthog.com',
    enabled: true, userId: null, pathname: '/shops',
  };
  let consent: 'accepted' | 'declined' | null;
  let analytics: AnalyticsModule;
  let currentUser: string | undefined;
  let optedOut: boolean;
  let sdk: {
    init: jest.Mock;
    capture: jest.Mock;
    identify: jest.Mock;
    reset: jest.Mock;
    get_property: jest.Mock;
    has_opted_out_capturing: jest.Mock;
    opt_in_capturing: jest.Mock;
    opt_out_capturing: jest.Mock;
  };

  beforeEach(() => {
    jest.resetModules();
    consent = 'accepted';
    currentUser = undefined;
    optedOut = true;
    sdk = {
      init: jest.fn(() => sdk),
      capture: jest.fn(),
      identify: jest.fn((userId: string) => { currentUser = userId; }),
      reset: jest.fn(() => { currentUser = undefined; optedOut = true; }),
      get_property: jest.fn((key: string) => key === '$user_id' ? currentUser : undefined),
      has_opted_out_capturing: jest.fn(() => optedOut),
      opt_in_capturing: jest.fn(() => { optedOut = false; }),
      opt_out_capturing: jest.fn(() => { optedOut = true; }),
    };
    jest.doMock('posthog-js', () => ({ __esModule: true, default: sdk }));
    jest.doMock('../src/lib/analyticsConsent', () => ({ getAnalyticsConsent: () => consent }));
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { origin: 'https://coffeepeek.by' } },
    });
    analytics = require('../src/lib/analytics');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });

  test.each([null, 'declined'] as const)('never initializes or captures with consent %s', async choice => {
    consent = choice;
    await analytics.syncAnalytics(context);
    analytics.captureAnalyticsEvent('sign_up_completed', { method: 'password' });
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.capture).not.toHaveBeenCalled();
    expect(sdk.identify).not.toHaveBeenCalled();
  });

  test.each<Partial<AnalyticsContext>>([
    { apiKey: undefined }, { apiKey: '  ' }, { apiHost: undefined }, { apiHost: '  ' }, { enabled: false },
  ])('never initializes or captures when configuration is unavailable: %j', async override => {
    await analytics.syncAnalytics({ ...context, ...override });
    analytics.captureAnalyticsEvent('app_download_clicked', { channel: 'google-play' });
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.capture).not.toHaveBeenCalled();
  });

  test('repeated and concurrent synchronization sends one initial pageview and one per route change', async () => {
    await Promise.all([analytics.syncAnalytics(context), analytics.syncAnalytics(context)]);
    await analytics.syncAnalytics(context);
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.capture).toHaveBeenCalledTimes(1);
    expect(sdk.capture).toHaveBeenLastCalledWith('$pageview', expect.objectContaining({
      $current_url: 'https://coffeepeek.by/shops', $pathname: '/shops',
    }));

    await analytics.syncAnalytics({ ...context, pathname: '/map?lat=53.9&lng=27.5#my-location' });
    await analytics.syncAnalytics({ ...context, pathname: '/map?lat=1&lng=2#another-location' });
    expect(sdk.capture).toHaveBeenCalledTimes(2);
    expect(sdk.capture).toHaveBeenLastCalledWith('$pageview', expect.objectContaining({
      $current_url: 'https://coffeepeek.by/map', $pathname: '/map',
    }));
  });

  test('the latest route wins when multiple effects run while the SDK loads', async () => {
    await Promise.all([
      analytics.syncAnalytics(context),
      analytics.syncAnalytics({ ...context, pathname: '/feed' }),
    ]);
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.capture).toHaveBeenCalledTimes(1);
    expect(sdk.capture).toHaveBeenCalledWith('$pageview', expect.objectContaining({
      $current_url: 'https://coffeepeek.by/feed', $pathname: '/feed',
    }));
  });

  test('only identifies by internal user ID and resets identity on switching accounts and logout', async () => {
    await analytics.syncAnalytics({ ...context, userId: 'user-123' });
    await analytics.syncAnalytics({ ...context, userId: 'user-123' });
    expect(sdk.identify.mock.calls).toEqual([['user-123']]);
    expect(sdk.reset).not.toHaveBeenCalled();

    await analytics.syncAnalytics({ ...context, userId: 'user-456' });
    expect(sdk.reset).toHaveBeenCalledTimes(1);
    expect(sdk.reset).toHaveBeenLastCalledWith(true);
    expect(sdk.identify.mock.calls).toEqual([['user-123'], ['user-456']]);
    expect(sdk.opt_in_capturing).toHaveBeenCalledTimes(2);
    expect(sdk.reset.mock.invocationCallOrder[0]).toBeLessThan(sdk.identify.mock.invocationCallOrder[1]);
    expect(sdk.opt_in_capturing.mock.invocationCallOrder[1]).toBeLessThan(sdk.identify.mock.invocationCallOrder[1]);

    await analytics.syncAnalytics(context);
    expect(sdk.reset).toHaveBeenCalledTimes(2);
    expect(sdk.identify).toHaveBeenCalledTimes(2);
    expect(currentUser).toBeUndefined();
    expect(sdk.capture).toHaveBeenCalledTimes(3);
  });

  test('sanitizes nested person and session URL properties without altering SDK timestamps', async () => {
    await analytics.syncAnalytics(context);
    const beforeSend = sdk.init.mock.calls[0][1].before_send as BeforeSendFn;
    const timestamp = new Date('2026-10-15T12:00:00Z');
    const event: CaptureResult = {
      uuid: 'event-1', event: '$pageview', timestamp,
      properties: {
        $current_url: 'https://coffeepeek.by/reset-password?token=secret#email',
        $pathname: '/reset-password?token=secret#email',
        $referrer: 'https://example.com/?q=private#section',
        $session_entry_utm_term: 'private search text',
        $session_entry_ph_keyword: 'private referrer query',
        $initial_gclid: 'private campaign identifier',
        $set: { $initial_current_url: 'https://coffeepeek.by/?invite=private#invite' },
        $session_props: {
          $session_entry_url: 'https://coffeepeek.by/map?lat=53.9#location',
          $session_entry_pathname: '/map?lat=53.9#location',
          $session_entry_referrer: 'https://example.com/?q=private#section',
        },
        entries: [{ href: '/shops?search=private#results', count: 2 }],
      },
      $set: { $current_url: 'https://coffeepeek.by/profile?tab=private#details' },
      $set_once: { $initial_current_url: 'https://coffeepeek.by/?token=secret#entry' },
    };
    const sanitized = beforeSend(event);
    expect(sanitized).toEqual({
      uuid: 'event-1', event: '$pageview', timestamp,
      properties: {
        $current_url: 'https://coffeepeek.by/reset-password',
        $pathname: '/reset-password',
        $referrer: 'https://example.com/',
        $set: { $initial_current_url: 'https://coffeepeek.by/' },
        $session_props: {
          $session_entry_url: 'https://coffeepeek.by/map',
          $session_entry_pathname: '/map',
          $session_entry_referrer: 'https://example.com/',
        },
        entries: [{ href: '/shops', count: 2 }],
      },
      $set: { $current_url: 'https://coffeepeek.by/profile' },
      $set_once: { $initial_current_url: 'https://coffeepeek.by/' },
    });
    expect(sanitized?.timestamp).toBe(timestamp);
    expect(event.properties.$current_url).toContain('?token=secret');
  });

  test('revoking consent stops business events and rejects further SDK captures', async () => {
    await analytics.syncAnalytics({ ...context, userId: 'user-123' });
    const beforeSend = sdk.init.mock.calls[0][1].before_send as BeforeSendFn;
    const queued: CaptureResult = { uuid: 'queued', event: '$pageview', properties: {} };
    sdk.capture.mockClear();

    consent = 'declined';
    analytics.captureAnalyticsEvent('favorite_changed', { entity_type: 'coffee_shop', is_favorite: true });
    expect(beforeSend(queued)).toBeNull();
    await analytics.syncAnalytics(context);
    analytics.captureAnalyticsEvent('app_download_clicked', { channel: 'apk' });
    expect(sdk.capture).not.toHaveBeenCalled();
    expect(sdk.reset).toHaveBeenCalledWith(true);
    expect(sdk.opt_out_capturing).toHaveBeenCalledTimes(1);
    expect(currentUser).toBeUndefined();
  });

  test('consent revoked during lazy SDK loading prevents initialization and can be granted later', async () => {
    const pending = analytics.syncAnalytics(context);
    consent = 'declined';
    await analytics.syncAnalytics(context);
    await pending;
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.capture).not.toHaveBeenCalled();

    consent = 'accepted';
    await analytics.syncAnalytics(context);
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.capture).toHaveBeenCalledTimes(1);
  });

  test('SDK initialization failure is harmless and a later synchronization retries', async () => {
    sdk.init.mockImplementationOnce(() => { throw new Error('SDK unavailable'); });
    await expect(analytics.syncAnalytics(context)).resolves.toBeUndefined();
    expect(() => analytics.captureAnalyticsEvent('sign_up_completed', { method: 'password' })).not.toThrow();
    expect(sdk.capture).not.toHaveBeenCalled();

    await analytics.syncAnalytics(context);
    expect(sdk.init).toHaveBeenCalledTimes(2);
    expect(sdk.capture).toHaveBeenCalledTimes(1);
  });

  test('SDK capture failures never throw through business events or navigation', async () => {
    await analytics.syncAnalytics(context);
    sdk.capture.mockImplementation(() => { throw new Error('Capture unavailable'); });
    expect(() => analytics.captureAnalyticsEvent('check_in_created', {
      kind: 'visit', visibility: 'Private', has_photos: false,
    })).not.toThrow();
    await expect(analytics.syncAnalytics({ ...context, pathname: '/feed' })).resolves.toBeUndefined();
  });

  test('captures safe shared context and queues events only during consented SDK startup', async () => {
    expect(analytics.captureAnalyticsEvent('feature_exposed', { feature: 'map', placement: 'discovery' })).toBe(false);
    const pending = analytics.syncAnalytics({ ...context, userId: 'internal-user', appVersion: 'build-123', environment: 'production' });
    expect(analytics.isAnalyticsReady()).toBe(false);
    expect(analytics.captureAnalyticsEvent('app_download_clicked', { channel: 'apk' })).toBe(true);
    await pending;
    expect(analytics.isAnalyticsReady()).toBe(true);
    expect(sdk.capture).toHaveBeenCalledWith('app_download_clicked', expect.objectContaining({
      app: 'coffee-peek', app_version: 'build-123', environment: 'production', auth_state: 'signed_in', page_type: 'shops',
    }));
  });

  test('bounded startup queue is discarded across account changes and consent revocation', async () => {
    const first = analytics.syncAnalytics({ ...context, userId: 'A' });
    for (let i = 0; i < 50; i++) expect(analytics.captureAnalyticsEvent('app_download_clicked', { channel: 'old-account' })).toBe(true);
    expect(analytics.captureAnalyticsEvent('app_download_clicked', { channel: 'overflow' })).toBe(false);
    const second = analytics.syncAnalytics({ ...context, userId: 'B' });
    await Promise.all([first, second]);
    expect(sdk.capture.mock.calls.filter(([event]) => event === 'app_download_clicked')).toHaveLength(0);
    const third = analytics.syncAnalytics(context);
    analytics.captureAnalyticsEvent('app_download_clicked', { channel: 'revoked' });
    consent = 'declined'; await analytics.syncAnalytics(context); await third;
    consent = 'accepted'; await analytics.syncAnalytics(context);
    expect(sdk.capture.mock.calls.filter(([event]) => event === 'app_download_clicked')).toHaveLength(0);
  });
});
