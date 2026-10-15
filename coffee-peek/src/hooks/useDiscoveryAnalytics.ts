import { useEffect, useMemo, useState } from 'react';
import { analyticsGeneration, captureAnalyticsEvent, isAnalyticsReady } from '../lib/analytics';
import type { CatalogKind, SearchState } from '../utils/catalogSearch';
import { discoveryCriteriaKey, discoverySearchProperties, DiscoverySearchSession, type DiscoverySearchProperties } from '../utils/discoveryAnalytics';

let nextSearch = 0;

export function useDiscoveryAnalytics({ catalog, state, enabled, ready, resultCount, error, source = 'list', citySlug }: {
  catalog: CatalogKind;
  state: Pick<SearchState, 'q' | 'filters' | 'sort'>;
  enabled: boolean;
  ready: boolean;
  resultCount: number;
  error?: unknown;
  source?: DiscoverySearchProperties['source'];
  citySlug?: string;
}) {
  const [revision, setRevision] = useState(0);
  const criteria = discoveryCriteriaKey(catalog, state, source);
  const generation = analyticsGeneration();
  const session = useMemo(() => new DiscoverySearchSession(discoverySearchProperties(catalog, state, source,
    `search-${Date.now().toString(36)}-${(++nextSearch).toString(36)}`, citySlug), performance.now()), [criteria, generation]);
  const timing = useMemo(() => ({ settledAt: null as number | null }), [session]);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('coffeepeek:analytics-ready', refresh);
    return () => window.removeEventListener('coffeepeek:analytics-ready', refresh);
  }, []);
  useEffect(() => {
    if (enabled && (error || ready)) timing.settledAt ??= performance.now();
    if (!enabled || !isAnalyticsReady()) return;
    const started = session.start();
    if (started) captureAnalyticsEvent('catalog_search_started', started);
    if (error) {
      const failed = session.failure(error, timing.settledAt ?? performance.now());
      if (failed) captureAnalyticsEvent('catalog_search_failed', failed);
    } else if (ready) {
      const results = session.results(resultCount, timing.settledAt ?? performance.now());
      if (results) captureAnalyticsEvent('catalog_results_viewed', results);
    }
  }, [session, timing, enabled, ready, resultCount, error, revision]);
  return { source, search_id: session.properties.search_id };
}
