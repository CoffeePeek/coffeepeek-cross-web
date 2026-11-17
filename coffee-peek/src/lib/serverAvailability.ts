type ServerAvailability = 'idle' | 'checking' | 'unavailable';

let availability: ServerAvailability = 'idle';
const listeners = new Set<() => void>();

export const getServerAvailability = () => availability;
export const getInitialServerAvailability = (): ServerAvailability => 'idle';

export function subscribeToServerAvailability(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setServerAvailability(next: ServerAvailability) {
  if (availability === next) return;
  availability = next;
  listeners.forEach(listener => listener());
}

export function reportServerFailure(status: number) {
  if (isServerErrorStatus(status) && availability === 'idle') setServerAvailability('checking');
}

function isServerErrorStatus(status: unknown): boolean {
  return typeof status === 'number' && status >= 500 && status < 600;
}

export function classifyServerChecks(checks: PromiseSettledResult<unknown>[]): 'available' | 'unavailable' | 'unknown' {
  if (checks.some(check => check.status === 'fulfilled')) return 'available';
  if (checks.length > 0 && checks.every(check => check.status === 'rejected' && isServerErrorStatus(check.reason?.status))) {
    return 'unavailable';
  }
  return 'unknown';
}
