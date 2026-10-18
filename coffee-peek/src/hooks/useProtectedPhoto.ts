import { useEffect, useState, useSyncExternalStore } from 'react';
import { httpClient } from '../api/core/httpClient';
import { getPhotoSession, subscribePhotoSession } from '../lib/photoSession';
import { PhotoRequests } from '../lib/photoRequests';

const requests = new PhotoRequests((url, signal) => httpClient.getBlob(url, signal));
const DISPLAY_WINDOW_MS = 20_000;

/** Conservative P4: no HTTP/disk/bitmap reuse; a new display always authorizes again. */
export function useProtectedPhoto(url: string | undefined, enabled: boolean) {
  const session = useSyncExternalStore(subscribePhotoSession, getPhotoSession, getPhotoSession);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ url: string; session: number; src?: string; failed?: boolean }>();
  useEffect(() => {
    if (!url || !enabled || document.visibilityState === 'hidden') { setResult(undefined); return; }
    let disposed = false;
    let objectUrl: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const began = performance.now();
    const lease = requests.acquire(url, session);
    setResult(undefined);
    timer = setTimeout(() => { lease.release(); setResult({ url, session, failed: true }); }, DISPLAY_WINDOW_MS);
    void lease.promise.then(blob => {
      if (disposed) return;
      const remaining = DISPLAY_WINDOW_MS - (performance.now() - began);
      if (remaining <= 0) throw new Error('Photo permission expired during download');
      objectUrl = URL.createObjectURL(blob);
      setResult({ url, session, src: objectUrl });
      clearTimeout(timer);
      timer = setTimeout(() => { setResult(undefined); setAttempt(value => value + 1); }, remaining);
    }).catch(() => { if (!disposed) setResult({ url, session, failed: true }); });
    return () => { disposed = true; lease.release(); clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, enabled, session, attempt]);
  const current = enabled && result && result.url === url && result.session === session ? result : undefined;
  return { src: current?.src, failed: current?.failed, retry: () => setAttempt(value => value + 1) };
}
