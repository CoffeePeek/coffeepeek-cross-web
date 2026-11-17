import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { API_ENDPOINTS } from '../api/core/apiConfig';
import { httpClient } from '../api/core/httpClient';
import type { ApiConfig } from '../api/core/types';
import { SHOP_SEARCH_PATH } from '../api/discovery';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  classifyServerChecks,
  getInitialServerAvailability,
  getServerAvailability,
  setServerAvailability,
  subscribeToServerAvailability,
} from '../lib/serverAvailability';
import Button from './Button';
import Mascot from './Mascot';

const RECHECK_INTERVAL_MS = 30_000;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function ServiceUnavailablePage({ checking, onRetry }: { checking: boolean; onRetry: () => void }) {
  const title = 'Мы восстанавливаем CoffeePeek';
  usePageTitle(title);
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION).matches);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia(REDUCED_MOTION);
    const sync = () => setReduceMotion(preference.matches);
    preference.addEventListener('change', sync);
    sync();
    return () => preference.removeEventListener('change', sync);
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-[#FAFAF9] px-6 py-12 text-[#1C1917] dark:bg-[#1A1412] dark:text-white">
      <div className="flex w-full max-w-lg flex-col items-center gap-5 text-center">
        {reduceMotion || videoFailed ? <Mascot pose="laptop" size={144} eager /> : (
          <video src="/server-recovery.mp4" width={784} height={470}
            className="h-auto w-full max-w-xs rounded-3xl"
            autoPlay muted loop playsInline aria-hidden="true"
            onError={() => setVideoFailed(true)} />
        )}
        <div role="alert">
          <h1 className="font-extended text-3xl font-bold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 text-base text-stone-600 dark:text-[#A39E93]">Попробуйте зайти чуть позже.</p>
        </div>
        <Button variant="secondary" className="min-h-11" disabled={checking} onClick={onRetry}>
          {checking ? 'Проверяем…' : 'Проверить снова'}
        </Button>
      </div>
    </main>
  );
}

export default function ServerAvailabilityGate({ children }: { children: ReactNode }) {
  const availability = useSyncExternalStore(subscribeToServerAvailability, getServerAvailability, getInitialServerAvailability);
  const request = useRef<AbortController | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    setChecking(true);
    try {
      const options: ApiConfig = {
        requiresAuth: false, skipAuthHeader: true, credentials: 'omit', cache: 'no-store',
        signal: controller.signal, skipServerStatusCheck: true,
      };
      const results = await Promise.allSettled([
        httpClient.get(API_ENDPOINTS.CATALOGS.CITIES, options),
        httpClient.post(SHOP_SEARCH_PATH, { filters: {}, page: 1, pageSize: 1 }, options),
        httpClient.get(API_ENDPOINTS.FEED, { ...options, params: { pageSize: 1 } }),
      ]);
      if (request.current !== controller) return;
      const result = classifyServerChecks(results);
      if (result === 'unavailable') {
        setServerAvailability('unavailable');
      } else if (result === 'available' || getServerAvailability() === 'checking') {
        setServerAvailability('idle');
      }
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setChecking(false);
      }
    }
  }, []);

  useEffect(() => () => {
    request.current?.abort();
    request.current = null;
  }, []);

  useEffect(() => {
    if (availability === 'checking') void check();
    if (availability !== 'unavailable') return;
    const timer = window.setInterval(() => { if (!document.hidden) void check(); }, RECHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [availability, check]);

  return availability === 'unavailable'
    ? <ServiceUnavailablePage checking={checking} onRetry={() => void check()} />
    : children;
}
