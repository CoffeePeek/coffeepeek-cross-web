import { PHOTO_PERMISSION_MS } from './photoCache';
import type { PhotoPermission } from './photoResponse';

type Lease = { promise: Promise<PhotoPermission>; release: () => void };
export type PhotoDisplayState = { src?: string; failed?: boolean };
type Options = {
  acquire: (revalidate: boolean) => Lease;
  credentialExpiry: () => number;
  isCurrent: () => boolean;
  isVisible: () => boolean;
  onChange: (state: PhotoDisplayState) => void;
};

/** Renew before expiry, retaining only still-authorized pixels during the request. */
export function createPhotoDisplay(options: Options) {
  let stopped = false;
  let failed = false;
  let pending: Lease | undefined;
  let permission: PhotoPermission | undefined;
  let src: string | undefined;
  let renewAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let requestTimer: ReturnType<typeof setTimeout> | undefined;

  const remaining = (value: PhotoPermission) => Math.min(value.displayUntil - performance.now(),
    value.displayExpiresAt - Date.now(), value.credentialExpiresAt - Date.now(), options.credentialExpiry() - Date.now());
  const revoke = () => {
    if (src) URL.revokeObjectURL(src);
    src = undefined;
    permission = undefined;
  };
  const release = () => {
    pending?.release();
    pending = undefined;
    clearTimeout(requestTimer);
  };
  const fail = () => {
    if (stopped) return;
    failed = true;
    clearTimeout(timer);
    release();
    revoke();
    options.onChange({ failed: true });
  };
  const load = (revalidate: boolean) => {
    const lease = options.acquire(revalidate);
    pending = lease;
    requestTimer = setTimeout(fail, Math.max(0, Math.min(PHOTO_PERMISSION_MS, options.credentialExpiry() - Date.now())));
    void lease.promise.then(next => {
      if (stopped || pending !== lease) return;
      if (!options.isCurrent() || remaining(next) <= 0) { fail(); return; }
      // A 304 reuses the same Blob and object URL, so the image never blinks.
      if (!src || permission?.blob !== next.blob) {
        const previous = src;
        src = URL.createObjectURL(next.blob);
        options.onChange({ src });
        if (previous) URL.revokeObjectURL(previous);
      }
      permission = next;
      const left = remaining(next);
      renewAt = performance.now() + left - Math.min(5_000, left / 4);
      release();
      check();
    }).catch(() => { if (!stopped && pending === lease) fail(); });
  };
  function check() {
    clearTimeout(timer);
    if (stopped || failed) return;
    if (!options.isCurrent() || options.credentialExpiry() <= Date.now()) { fail(); return; }
    if (permission && remaining(permission) <= 0) {
      revoke();
      options.onChange({});
    }
    if (options.isVisible() && !pending && (!permission || performance.now() >= renewAt)) load(!!permission);
    // Deadline checks also catch wall-clock changes and device suspension.
    if (permission) timer = setTimeout(check, Math.max(0, Math.min(1_000, remaining(permission))));
  }
  check();
  return {
    resume: check,
    stop: () => { stopped = true; clearTimeout(timer); release(); revoke(); },
  };
}
