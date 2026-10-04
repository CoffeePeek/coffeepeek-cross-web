export const USER_LOCATION_TTL_MS = 5 * 60_000;

export function getLocationLifetime(timestamp: number, now: number = Date.now()): number {
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, USER_LOCATION_TTL_MS - Math.max(0, now - timestamp));
}

export interface DeviceLocation {
  coords: { latitude: number; longitude: number };
  timestamp: number;
}

interface DeviceLocationOptions extends PositionOptions {
  requestPermission?: boolean;
}

const LOCATION_CACHE_KEY = 'coffeepeek:device-location';
let cachedLocation: DeviceLocation | null = null;
let pendingLocation: Promise<DeviceLocation | null> | null = null;

function clearCachedLocation(): void {
  cachedLocation = null;
  try { globalThis.sessionStorage?.removeItem(LOCATION_CACHE_KEY); } catch { /* Storage may be disabled. */ }
}

function readCachedLocation(): DeviceLocation | null {
  try {
    cachedLocation ??= JSON.parse(globalThis.sessionStorage?.getItem(LOCATION_CACHE_KEY) ?? 'null');
  } catch { /* An unavailable or invalid cache must not prevent locating. */ }
  const location = cachedLocation;
  if (location && Number.isFinite(location.coords?.latitude) && Math.abs(location.coords.latitude) <= 90
    && Number.isFinite(location.coords?.longitude) && Math.abs(location.coords.longitude) <= 180
    && getLocationLifetime(location.timestamp) > 0) return location;
  clearCachedLocation();
  return null;
}

/** Automatic reads never prompt; only an explicit user action may request browser permission. */
export async function getDeviceLocation({
  requestPermission = false,
  maximumAge = USER_LOCATION_TTL_MS,
  timeout = 8000,
  enableHighAccuracy = false,
}: DeviceLocationOptions = {}): Promise<DeviceLocation | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  const cached = readCachedLocation();
  if (cached && Date.now() - cached.timestamp <= maximumAge) return cached;

  if (!requestPermission) {
    try {
      // Safari and restricted contexts may not expose geolocation in Permissions API.
      // Without a confirmed grant, leave the request to the location button.
      if (!navigator.permissions?.query) return null;
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (permission.state !== 'granted') return null;
    } catch { return null; }
  }

  if (pendingLocation) return pendingLocation;
  pendingLocation = new Promise<DeviceLocation | null>(resolve => {
    const fail = () => {
      clearCachedLocation();
      resolve(null);
    };
    try {
      navigator.geolocation.getCurrentPosition(position => {
        if (getLocationLifetime(position.timestamp) === 0) return fail();
        cachedLocation = {
          coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
          timestamp: position.timestamp,
        };
        try { globalThis.sessionStorage?.setItem(LOCATION_CACHE_KEY, JSON.stringify(cachedLocation)); } catch { /* Keep the in-memory cache. */ }
        resolve(cachedLocation);
      }, fail, { enableHighAccuracy, timeout, maximumAge });
    } catch { fail(); }
  });
  try { return await pendingLocation; } finally { pendingLocation = null; }
}
