import type { BeforeSendFn, PostHog } from 'posthog-js';
import { getAnalyticsConsent } from './analyticsConsent';
import { analyticsPageType } from './analyticsContext';
import type { AnalyticsError } from './analyticsError';
import type { DiscoveryAnalyticsEvents } from '../utils/discoveryAnalytics';
import type { EngagementAnalyticsEvents } from './engagementAnalytics';
import type { CheckInAnalyticsEvents } from './checkInAnalytics';

interface AnalyticsContext {
  apiKey?: string;
  apiHost?: string;
  enabled: boolean;
  userId: string | null;
  pathname: string;
  routeKey?: string;
  appVersion?: string;
  environment?: string;
}

interface AnalyticsEvents extends DiscoveryAnalyticsEvents, EngagementAnalyticsEvents, CheckInAnalyticsEvents {
  sign_in_completed: { method: 'password' | 'google'; entry_point: 'login' | 'register' };
  sign_up_completed: { method: 'password' };
  favorite_attempted: { entity_type: 'coffee_shop' | 'roaster'; is_favorite?: boolean };
  favorite_changed: { entity_type: 'coffee_shop' | 'roaster'; is_favorite: boolean; duration_ms?: number; resumed_after_auth?: boolean };
  favorite_failed: { entity_type: 'coffee_shop' | 'roaster'; duration_ms: number } & AnalyticsError;
  favorites_opened: { entry_point: 'profile' };
  auth_gate_shown: { feature: string };
  feature_exposed: { feature: string; placement: string };
  api_request_completed: { category: string; method: string; outcome: 'success' | 'failure'; duration_ms: number; auth_retried: boolean; status_code?: number; error_category?: AnalyticsError['error_category'] };
  check_in_created: { kind: 'visit' | 'home'; visibility: string; has_photos: boolean; flow_id?: string; source?: string; duration_ms?: number };
  app_download_clicked: { channel: string };
}

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;
let active = false;
let revision = 0;
let lastPage: string | null = null;
let ready = false;
let currentContext: AnalyticsContext | null = null;
let generation = 0;
const pending: Array<{ event: string; properties: Record<string, unknown> }> = [];
export const ANALYTICS_READY_EVENT = 'coffeepeek:analytics-ready';

export function isAnalyticsReady(): boolean {
  return active && ready && !!client && getAnalyticsConsent() === 'accepted';
}

export function analyticsGeneration(): number { return generation; }
export function analyticsPageKey(): string { return currentContext?.routeKey ?? currentContext?.pathname ?? ''; }

function commonProperties() {
  return {
    app: 'coffee-peek', event_schema_version: 1,
    app_version: currentContext?.appVersion ?? 'unknown',
    environment: currentContext?.environment ?? 'unknown',
    auth_state: currentContext?.userId ? 'signed_in' : 'guest',
    page_type: analyticsPageType(typeof window !== 'undefined' ? window.location.pathname ?? currentContext?.pathname ?? '' : ''),
  };
}

export function analyticsUrl(value: string): string {
  return value.split(/[?#]/, 1)[0];
}

// The SDK adds entry URLs and person properties as well as the explicit page URL.
// Strip query/hash from all of them: auth links contain tokens; search URLs can contain coordinates.
function sanitizeProperties(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeProperties);
  if (!value || typeof value !== 'object') return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(?:utm_|ph_keyword|(?:^|_)(?:gclid|fbclid|msclkid|dclid|gbraid|wbraid)$)/i.test(key))
    .map(([key, item]) => [
      key,
      typeof item === 'string' && /(?:url|referrer|pathname|href)$/i.test(key)
        ? analyticsUrl(item)
        : sanitizeProperties(item),
    ]));
}

export const sanitizeAnalyticsEvent: BeforeSendFn = event => {
  if (!event) return null;
  return sanitizeProperties(event) as typeof event;
};

function stopAnalytics() {
  active = false;
  ready = false;
  pending.length = 0;
  generation += 1;
  lastPage = null;
  if (client) {
    client.reset(true);
    client.opt_out_capturing();
  }
}

async function getClient(apiKey: string, apiHost: string): Promise<PostHog | null> {
  if (client) return client;
  if (!loading) {
    loading = import('posthog-js').then(({ default: posthog }) => {
      // Consent can be withdrawn while the lazy SDK chunk is loading.
      if (!active || getAnalyticsConsent() !== 'accepted') return null;
      client = posthog.init(apiKey, {
        api_host: apiHost,
        defaults: '2026-08-30',
        person_profiles: 'identified_only',
        persistence: 'localStorage',
        opt_out_capturing_by_default: true,
        opt_out_persistence_by_default: true,
        capture_pageview: false,
        capture_pageleave: false,
        autocapture: false,
        capture_dead_clicks: false,
        rageclick: false,
        capture_exceptions: false,
        capture_performance: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_external_dependency_loading: true,
        advanced_disable_flags: true,
        save_campaign_params: false,
        save_referrer: false,
        disable_capture_url_hashes: true,
        mask_personal_data_properties: true,
        custom_personal_data_properties: [
          'token', 'access_token', 'refresh_token', 'id_token', 'code', 'email',
          'q', 'query', 'search', 'filters', 'origin', 'lat', 'lon', 'lng', 'latitude', 'longitude',
        ],
        internal_or_test_user_hostname: null,
        before_send: event => active && getAnalyticsConsent() === 'accepted'
          ? sanitizeAnalyticsEvent(event)
          : null,
      }) ?? null;
      return client;
    }).catch(() => null).finally(() => { loading = null; });
  }
  return loading;
}

/** Called after auth restoration and whenever the route, account or consent changes. */
export async function syncAnalytics(context: AnalyticsContext): Promise<void> {
  const currentRevision = ++revision;
  try {
    const apiKey = context.apiKey?.trim();
    const apiHost = context.apiHost?.trim();
    if (!context.enabled || !apiKey || !apiHost || getAnalyticsConsent() !== 'accepted') {
      if (active) stopAnalytics();
      currentContext = null;
      return;
    }
    if (currentContext && currentContext.userId !== context.userId) {
      pending.length = 0;
      generation += 1;
    }
    currentContext = context;
    ready = false;
    active = true;
    const posthog = await getClient(apiKey, apiHost);
    if (!posthog || currentRevision !== revision || !active || getAnalyticsConsent() !== 'accepted') return;

    const previousUser = posthog.get_property('$user_id');
    if (previousUser && previousUser !== context.userId) {
      posthog.reset(true);
      lastPage = null;
    }
    // reset clears SDK consent in current PostHog versions, so opt in afterwards.
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing({ captureEventName: false });
    if (context.userId && previousUser !== context.userId) posthog.identify(context.userId);

    const pathname = analyticsUrl(context.pathname);
    if (lastPage !== pathname) {
      posthog.capture('$pageview', {
        ...commonProperties(),
        $current_url: `${window.location.origin}${pathname}`,
        $pathname: pathname,
      });
      lastPage = pathname;
    }
    ready = true;
    for (const item of pending.splice(0)) {
      try { posthog.capture(item.event, item.properties); } catch { /* Isolate blocked captures. */ }
    }
    if (typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event(ANALYTICS_READY_EVENT));
  } catch {
    // Analytics must never prevent authentication, navigation or mutations.
  }
}

/** True means accepted for capture, not confirmed delivery by the remote server. */
export function captureAnalyticsEvent<K extends keyof AnalyticsEvents>(event: K, properties: AnalyticsEvents[K]): boolean {
  if (!active || getAnalyticsConsent() !== 'accepted') return false;
  const payload = { ...commonProperties(), ...properties } as Record<string, unknown>;
  if (!ready || !client) {
    if (!client && !loading) return false;
    if (pending.length >= 50) return false;
    pending.push({ event, properties: payload });
    return true;
  }
  try {
    client.capture(event, payload);
    return true;
  } catch {
    // A blocked or unavailable analytics service must not affect the product.
    return false;
  }
}
