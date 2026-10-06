let scope = 'guest:0';
let generation = 0;
let identity: string | null = null;
const requests = new Set<AbortController>();

export const getCatalogScope = () => scope;
export function changeCatalogSession(userId: string | null, force = false): string {
  if (identity === userId && !force) return scope;
  identity = userId;
  scope = `${userId ?? 'guest'}:${++generation}`;
  requests.forEach(controller => controller.abort());
  requests.clear();
  return scope;
}
export function catalogMutationSignal() {
  const controller = new AbortController();
  requests.add(controller);
  return { signal: controller.signal, release: () => requests.delete(controller) };
}
