import { useEffect, useState, useSyncExternalStore } from 'react';
import { httpClient, TokenManager } from '../api/core/httpClient';
import { getPhotoSession, subscribePhotoSession } from '../lib/photoSession';
import { ProtectedPhotoCache, PHOTO_PERMISSION_MS } from '../lib/photoCache';
import { parseJWT } from '../utils/jwt';

function credentialExpiry() {
  const token = TokenManager.getAccessToken();
  if (!token) return Infinity; // Anonymous public requests still require server authorization.
  const exp = parseJWT(token)?.exp;
  return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : 0;
}

const photos = new ProtectedPhotoCache((url, signal, etag) => httpClient.getPhotoResponse(url, signal, etag), {
  session: getPhotoSession, credentialExpiry,
});
subscribePhotoSession(() => photos.clear());

/** Each display owns its URL; the bounded cache owns only encoded bytes and validators. */
export function useProtectedPhoto(url: string | undefined, enabled: boolean, cacheBinding?: string) {
  const session = useSyncExternalStore(subscribePhotoSession, getPhotoSession, getPhotoSession);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ url: string; binding?: string; session: number; src?: string; failed?: boolean }>();
  useEffect(() => {
    if (!url || !enabled || document.visibilityState === 'hidden') { setResult(undefined); return; }
    let disposed = false;
    let objectUrl: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const lease = photos.acquire(url, session, cacheBinding);
    const revoke = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = undefined;
    };
    const unsubscribe = subscribePhotoSession(() => { revoke(); lease.release(); });
    setResult(undefined);
    const fail = () => {
      clearTimeout(timer);
      revoke();
      lease.release();
      if (!disposed) setResult({ url, binding: cacheBinding, session, failed: true });
    };
    timer = setTimeout(fail, Math.max(0, Math.min(PHOTO_PERMISSION_MS, credentialExpiry() - Date.now())));
    void lease.promise.then(permission => {
      if (disposed || session !== getPhotoSession()) return;
      const remaining = Math.min(permission.displayUntil - performance.now(), permission.displayExpiresAt - Date.now(), permission.credentialExpiresAt - Date.now(), credentialExpiry() - Date.now());
      if (remaining <= 0) throw new Error('Photo permission expired during download');
      objectUrl = URL.createObjectURL(permission.blob);
      setResult({ url, binding: cacheBinding, session, src: objectUrl });
      clearTimeout(timer);
      const checkPermission = () => {
        if (disposed) return;
        const left = Math.min(permission.displayUntil - performance.now(), permission.displayExpiresAt - Date.now(), permission.credentialExpiresAt - Date.now(), credentialExpiry() - Date.now());
        if (left <= 0) { revoke(); setResult(undefined); setAttempt(value => value + 1); return; }
        // Also catch wall-clock jumps / suspend while the tab stays visible.
        timer = setTimeout(checkPermission, Math.min(left, 1_000));
      };
      checkPermission();
    }).catch(fail);
    return () => { disposed = true; unsubscribe(); lease.release(); clearTimeout(timer); revoke(); };
  }, [url, cacheBinding, enabled, session, attempt]);
  const current = enabled && result && result.url === url && result.binding === cacheBinding && result.session === session ? result : undefined;
  return { src: current?.src, failed: current?.failed, retry: () => setAttempt(value => value + 1) };
}
