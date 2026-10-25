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
  return () => { listeners.delete(listener); };
}
