import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsGeneration, captureAnalyticsEvent } from '../lib/analytics';
import { detailAnalyticsContext, type EngagementAnalyticsEvents } from '../lib/engagementAnalytics';

/** Data must have loaded. Refetches and canonical redirects are not new detail views. */
export function useEntityDetailAnalytics(entityType: EngagementAnalyticsEvents['entity_detail_viewed']['entity_type'], identity: string | undefined) {
  const { state } = useLocation();
  const lastViewed = useRef<string | undefined>(undefined);
  const pendingContext = useRef<{ identity: string; context: ReturnType<typeof detailAnalyticsContext> } | null>(null);
  useEffect(() => {
    // A canonical redirect may clear router state before the SDK finishes loading.
    if (identity && pendingContext.current?.identity !== identity) pendingContext.current = { identity, context: detailAnalyticsContext(state) };
    const captureView = () => {
      if (!identity) return;
      const visit = `${analyticsGeneration()}:${entityType}:${identity}`;
      if (lastViewed.current === visit) return;
      if (captureAnalyticsEvent('entity_detail_viewed', { entity_type: entityType, ...pendingContext.current!.context })) lastViewed.current = visit;
    };
    captureView();
    window.addEventListener('coffeepeek:analytics-ready', captureView);
    return () => window.removeEventListener('coffeepeek:analytics-ready', captureView);
  }, [entityType, identity, state]);
}
