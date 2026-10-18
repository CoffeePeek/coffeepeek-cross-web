// A generation, never a token, identifies permission to display protected bytes.
let generation = 0;
const listeners = new Set<() => void>();
export const getPhotoSession = () => generation;
export function invalidateProtectedPhotos() {
  generation++;
  listeners.forEach(listener => listener());
}
export function subscribePhotoSession(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', invalidateProtectedPhotos);
    window.addEventListener('focus', invalidateProtectedPhotos);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', invalidateProtectedPhotos);
      window.removeEventListener('focus', invalidateProtectedPhotos);
    }
  };
}
