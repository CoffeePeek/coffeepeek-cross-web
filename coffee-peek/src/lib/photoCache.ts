import { PhotoRequests } from './photoRequests';
import type { PhotoPermission, PhotoResponse } from './photoResponse';

export const PHOTO_PERMISSION_MS = 20_000;
type Clock = { wall: () => number; mono: () => number };
type Stored = PhotoPermission & { etag: string; freshUntil: number; freshExpiresAt: number };
type Policy = { store: boolean; maxAge: number; revalidate: boolean };
type Options = {
  session: () => number;
  credentialExpiry: () => number;
  clock?: Clock;
  maxEntries?: number;
  maxBytes?: number;
  concurrency?: number;
};

function policy(headers: Headers): Policy {
  const raw = headers.get('Cache-Control');
  const denied = { store: false, maxAge: 0, revalidate: true };
  if (!raw) return denied;
  const values = new Map<string, string | undefined>();
  for (const part of raw.split(',')) {
    const match = /^\s*([!#$%&'*+.^_`|~\w-]+)(?:\s*=\s*("[^"]*"|[^\s,]+))?\s*$/.exec(part);
    if (!match) return denied;
    const name = match[1].toLowerCase();
    if (values.has(name)) return denied;
    values.set(name, match[2]?.replace(/^"|"$/g, ''));
  }
  const age = values.get('max-age');
  if (values.has('no-store') || !age || !/^\d+$/.test(age) || !Number.isSafeInteger(Number(age))) return denied;
  // These application routes are private to the current opaque session, even for public content.
  if (headers.get('Vary')?.split(',').some(value => value.trim() === '*')) return denied;
  return { store: true, maxAge: Number(age) * 1000, revalidate: values.has('no-cache') };
}

function validator(headers: Headers): string | undefined {
  const value = headers.get('ETag');
  return value && /^(W\/)?"[^"\x00-\x20\x7f]*"$/.test(value) ? value : undefined;
}

/** RFC 9111 age calculation, conservatively including download time in response delay. */
function freshness(response: PhotoResponse, parsed: Policy, nowWall: number): number | undefined {
  const date = response.headers.get('Date');
  const dateMs = date && /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(date) ? Date.parse(date) : NaN;
  const age = response.headers.get('Age');
  if (!Number.isFinite(dateMs) || (age !== null && (!/^\d+$/.test(age) || !Number.isSafeInteger(Number(age))))) return undefined;
  const delay = Math.max(0, response.responseMono - response.requestMono);
  const apparentAge = Math.max(0, Math.max(nowWall, response.responseWall) - dateMs);
  const initialAge = Math.max(apparentAge, Number(age ?? 0) * 1000 + delay);
  return Math.max(0, Math.min(PHOTO_PERMISSION_MS, parsed.maxAge) - initialAge);
}

function eligible(url: string, binding?: string): binding is string {
  if (!binding) return false;
  try {
    const path = new URL(url, 'https://photo.invalid').pathname.replace(/^\/backend\//, '/');
    const match = /^\/api\/v1\/check-ins\/[^/]+\/photos\/[^/]+\/variants\/([^/]+)\/(\d+)\/(thumb|feed|detail)\.(webp|jpeg|jpg|png)$/.exec(path);
    const [source, recipe, purpose, format, boundUrl] = JSON.parse(binding);
    return !!match && decodeURIComponent(match[1]) === source && Number(match[2]) === recipe
      && match[3] === purpose && match[4] === format && boundUrl === url;
  } catch { return false; }
}

/** Encoded bytes only. A retained Blob is never itself permission to display it. */
export class ProtectedPhotoCache {
  private stored = new Map<string, Stored>();
  private bytes = 0;
  private options: Options;
  private clock: Clock;
  private pool: PhotoRequests<PhotoPermission>;
  private wallFloor: number;
  private lastMono: number;

  constructor(load: (url: string, signal: AbortSignal, etag?: string) => Promise<PhotoResponse>, options: Options) {
    this.options = options;
    this.clock = options.clock ?? { wall: () => Date.now(), mono: () => performance.now() };
    this.wallFloor = this.clock.wall();
    this.lastMono = this.clock.mono();
    this.pool = new PhotoRequests(async (key, signal) => {
      const [scope, url, binding] = JSON.parse(key) as [number, string, string | null];
      const check = () => this.check(scope, signal);
      check();
      let previous = binding ? this.stored.get(key) : undefined;
      const began = this.clock.mono();
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          const response = await load(url, signal, previous?.etag);
          check();
          const now = this.now();
          const expiry = this.options.credentialExpiry();
          const parsed = policy(response.headers);
          const remaining = freshness(response, parsed, now.wall);
          const displayUntil = Math.min(began + PHOTO_PERMISSION_MS, now.mono + expiry - now.wall,
            parsed.store && parsed.maxAge > 0 && remaining !== undefined ? now.mono + remaining : Infinity);
          if (displayUntil <= now.mono) throw new Error('Photo permission expired during download');
          const etag = validator(response.headers);
          if (response.status === 304) {
            // Never accept a bare/mismatched 304 or bytes evicted while the request was pending.
            if (!binding || !previous || previous !== this.stored.get(key) || !parsed.store || !etag || etag !== previous.etag) {
              this.evict(key);
              previous = undefined;
              if (attempt === 0) continue;
              throw new Error('Photo validation did not authorize retained bytes');
            }
          } else if (response.status !== 200 || !response.blob) {
            throw new Error('Photo download failed');
          }
          const blob = response.status === 304 ? previous!.blob : response.blob!;
          const displayExpiresAt = Math.min(expiry, now.wall + displayUntil - now.mono);
          const permission = { blob, displayUntil, displayExpiresAt, credentialExpiresAt: expiry };
          this.evict(key);
          if (binding && parsed.store && etag) {
            const freshUntil = parsed.revalidate ? now.mono : Math.min(displayUntil, now.mono + (remaining ?? 0));
            this.store(key, { ...permission, etag, freshUntil, freshExpiresAt: now.wall + freshUntil - now.mono });
          }
          return permission;
        }
        throw new Error('Photo validation failed');
      } catch (error) {
        // A late abort must not evict bytes committed by a replacement same-key request.
        if (!signal.aborted || this.stored.get(key) === previous) this.evict(key);
        throw error;
      }
    }, options.concurrency ?? 4);
  }

  acquire(url: string, scope: number, binding?: string) {
    binding = eligible(url, binding) ? binding : undefined;
    const key = JSON.stringify([scope, url, binding ?? null]);
    try {
      this.check(scope);
      const now = this.now();
      const entry = this.stored.get(key);
      if (entry && now.mono < entry.freshUntil && now.mono < entry.displayUntil && now.wall < entry.freshExpiresAt && now.wall < entry.displayExpiresAt && now.wall < entry.credentialExpiresAt) {
        this.stored.delete(key);
        this.stored.set(key, entry);
        let released = false;
        return { promise: Promise.resolve().then(() => {
          this.check(scope);
          if (released) throw new DOMException('Cancelled', 'AbortError');
          const current = this.now();
          if (current.mono >= entry.freshUntil || current.mono >= entry.displayUntil || current.wall >= entry.freshExpiresAt || current.wall >= entry.displayExpiresAt || current.wall >= entry.credentialExpiresAt) throw new Error('Photo permission expired');
          return entry;
        }), release: () => { released = true; } };
      }
      return this.pool.acquire(key, scope);
    } catch (error) {
      this.evict(key);
      return { promise: Promise.reject<PhotoPermission>(error), release: () => {} };
    }
  }

  clear() {
    this.pool.clear();
    this.stored.clear();
    this.bytes = 0;
  }

  private now() {
    const mono = this.clock.mono();
    // A backward wall-clock adjustment cannot extend JWT or server authorization.
    this.wallFloor = Math.max(this.clock.wall(), this.wallFloor + Math.max(0, mono - this.lastMono));
    this.lastMono = mono;
    return { mono, wall: this.wallFloor };
  }

  private check(scope: number, signal?: AbortSignal) {
    if (scope !== this.options.session() || signal?.aborted) throw new DOMException('Photo session changed', 'AbortError');
    if (this.options.credentialExpiry() <= this.now().wall) throw new Error('Photo credentials expired');
  }

  private evict(key: string) {
    const entry = this.stored.get(key);
    if (entry) this.bytes -= entry.blob.size;
    this.stored.delete(key);
  }

  private store(key: string, entry: Stored) {
    const maxBytes = this.options.maxBytes ?? 24 * 1024 * 1024;
    const maxEntries = this.options.maxEntries ?? 64;
    if (entry.blob.size > maxBytes || maxEntries < 1) return;
    this.stored.set(key, entry);
    this.bytes += entry.blob.size;
    while (this.stored.size > maxEntries || this.bytes > maxBytes) this.evict(this.stored.keys().next().value!);
  }
}
