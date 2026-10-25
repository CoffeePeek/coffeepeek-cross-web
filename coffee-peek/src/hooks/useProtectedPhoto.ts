import { useEffect, useState, useSyncExternalStore } from 'react';
import { httpClient, TokenManager } from '../api/core/httpClient';
import { getPhotoSession, subscribePhotoSession } from '../lib/photoSession';
import { ProtectedPhotoCache } from '../lib/photoCache';
import { createPhotoDisplay } from '../lib/photoDisplay';
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
    setResult(undefined);
    if (!url || !enabled) return;
    const display = createPhotoDisplay({
      acquire: revalidate => photos.acquire(url, session, cacheBinding, revalidate),
      credentialExpiry,
      isCurrent: () => session === getPhotoSession(),
      isVisible: () => document.visibilityState !== 'hidden',
      onChange: state => setResult({ url, binding: cacheBinding, session, ...state }),
    });
    const unsubscribe = subscribePhotoSession(display.stop);
    document.addEventListener('visibilitychange', display.resume);
    window.addEventListener('focus', display.resume);
    return () => {
      unsubscribe();
      display.stop();
      document.removeEventListener('visibilitychange', display.resume);
      window.removeEventListener('focus', display.resume);
    };
  }, [url, cacheBinding, enabled, session, attempt]);
  const current = enabled && result && result.url === url && result.binding === cacheBinding && result.session === session ? result : undefined;
  return { src: current?.src, failed: current?.failed, retry: () => setAttempt(value => value + 1) };
}
