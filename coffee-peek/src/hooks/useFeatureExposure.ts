import { useCallback, useEffect, useState, type RefCallback } from 'react';
import { analyticsGeneration, analyticsPageKey, captureAnalyticsEvent, isAnalyticsReady } from '../lib/analytics';
import { observeFeatureExposure } from '../lib/featureExposure';

// Shared between repeated cards and responsive copies. Count a feature once per route visit.
const captured = new Set<string>();

export function useFeatureExposure<T extends Element>(feature: string, placement: string, enabled = true): RefCallback<T> {
  const [element, setElement] = useState<T | null>(null);
  const ref = useCallback((node: T | null) => { setElement(node); }, []);
  useEffect(() => {
    if (!enabled || !element) return;
    return observeFeatureExposure(element, () => {
      if (!isAnalyticsReady()) return false;
      const identity = `${analyticsGeneration()}:${analyticsPageKey()}:${feature}:${placement}`;
      if (captured.has(identity)) return true;
      if (!captureAnalyticsEvent('feature_exposed', { feature, placement })) return false;
      if (captured.size >= 1000) captured.delete(captured.values().next().value!);
      captured.add(identity);
      return true;
    });
  }, [element, feature, placement, enabled]);
  return ref;
}
