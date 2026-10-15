// Separate from the old cookie banner, which did not describe product analytics.
export const ANALYTICS_CONSENT_KEY = 'coffeepeek.analyticsConsent.v1';
export const ANALYTICS_CONSENT_EVENT = 'coffeepeek:analytics-consent-changed';

export type AnalyticsConsent = 'accepted' | 'declined';

let memoryConsent: AnalyticsConsent | null = null;
let useMemoryConsent = false;

export function getAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === 'undefined') return null;
  if (useMemoryConsent) return memoryConsent;

  try {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    memoryConsent = stored === 'accepted' || stored === 'declined' ? stored : null;
    return memoryConsent;
  } catch {
    return memoryConsent;
  }
}

export function setAnalyticsConsent(value: AnalyticsConsent): void {
  if (typeof window === 'undefined') return;
  memoryConsent = value;

  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
    useMemoryConsent = false;
  } catch {
    // A declined choice must override previously stored acceptance even when a
    // quota or browser restriction prevents the new value from being written.
    useMemoryConsent = true;
  }

  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
}
