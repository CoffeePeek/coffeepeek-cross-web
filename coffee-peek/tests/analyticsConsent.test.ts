describe('PostHog analytics consent', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let consent: typeof import('../src/lib/analyticsConsent');
  let stored: Map<string, string>;
  let storage: { getItem: jest.Mock; setItem: jest.Mock };
  let events: EventTarget;

  beforeEach(() => {
    jest.resetModules();
    stored = new Map();
    storage = {
      getItem: jest.fn((key: string) => stored.get(key) ?? null),
      setItem: jest.fn((key: string, value: string) => stored.set(key, value)),
    };
    events = new EventTarget();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: storage, dispatchEvent: events.dispatchEvent.bind(events) },
    });
    consent = require('../src/lib/analyticsConsent');
  });

  afterEach(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });

  test('legacy cookie acceptance does not grant permission for PostHog', () => {
    stored.set('cookieConsent', 'accepted');
    stored.set('cookieConsentDate', new Date().toISOString());
    expect(consent.getAnalyticsConsent()).toBeNull();
  });

  test.each(['accepted', 'declined'] as const)('%s persists across reloads', value => {
    consent.setAnalyticsConsent(value);
    expect(stored.get(consent.ANALYTICS_CONSENT_KEY)).toBe(value);
    jest.resetModules();
    const reloaded: typeof consent = require('../src/lib/analyticsConsent');
    expect(reloaded.getAnalyticsConsent()).toBe(value);
  });

  test('malformed storage never enables analytics', () => {
    stored.set(consent.ANALYTICS_CONSENT_KEY, 'true');
    expect(consent.getAnalyticsConsent()).toBeNull();
  });

  test('choice changes notify consumers after the new value is available', () => {
    const changes: Array<ReturnType<typeof consent.getAnalyticsConsent>> = [];
    events.addEventListener(consent.ANALYTICS_CONSENT_EVENT, () => {
      changes.push(consent.getAnalyticsConsent());
    });
    consent.setAnalyticsConsent('accepted');
    consent.setAnalyticsConsent('declined');
    expect(changes).toEqual(['accepted', 'declined']);
  });

  test('storage changes in another tab and cleared storage are read immediately', () => {
    consent.setAnalyticsConsent('accepted');
    stored.set(consent.ANALYTICS_CONSENT_KEY, 'declined');
    expect(consent.getAnalyticsConsent()).toBe('declined');
    stored.clear();
    expect(consent.getAnalyticsConsent()).toBeNull();
  });

  test('blocked storage does not crash and remembers a choice for this page session', () => {
    Object.defineProperty(window, 'localStorage', {
      get: () => { throw new Error('Storage blocked'); },
    });
    expect(consent.getAnalyticsConsent()).toBeNull();
    expect(() => consent.setAnalyticsConsent('accepted')).not.toThrow();
    expect(consent.getAnalyticsConsent()).toBe('accepted');
    consent.setAnalyticsConsent('declined');
    expect(consent.getAnalyticsConsent()).toBe('declined');
    jest.resetModules();
    const reloaded: typeof consent = require('../src/lib/analyticsConsent');
    expect(reloaded.getAnalyticsConsent()).toBeNull();
  });

  test('failed writes cannot restore an old accepted choice after revocation', () => {
    consent.setAnalyticsConsent('accepted');
    storage.setItem.mockImplementation(() => { throw new Error('Storage quota exceeded'); });
    consent.setAnalyticsConsent('declined');
    expect(stored.get(consent.ANALYTICS_CONSENT_KEY)).toBe('accepted');
    expect(consent.getAnalyticsConsent()).toBe('declined');
  });

  test('server-side rendering does not need browser storage', () => {
    Reflect.deleteProperty(globalThis, 'window');
    expect(consent.getAnalyticsConsent()).toBeNull();
    expect(() => consent.setAnalyticsConsent('accepted')).not.toThrow();
  });
});
