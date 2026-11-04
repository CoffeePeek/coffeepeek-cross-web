import { httpClient } from './core/httpClient';
import { API_GATEWAY_URL } from './core/apiConfig';

export interface PublicShelfItem { id: string; name: string; roasterName: string | null; coffeeSlug: string | null; photoUrl: string | null }
export interface PublicShelf { items: PublicShelfItem[]; totalCount: number }
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export async function getProfileShelf(slug: string, signal?: AbortSignal): Promise<PublicShelf | null> {
  const { data } = await httpClient.get<PublicShelf | null>(`/api/v1/profiles/${encodeURIComponent(slug)}/shelf`, {
    requiresAuth: false, signal, cache: 'no-store',
  });
  if (data === null) return null;
  if (!data || !Array.isArray(data.items) || data.totalCount !== data.items.length) throw new Error('Invalid shelf');
  return { totalCount: data.items.length, items: data.items.map(item => {
    if (!item || !uuid.test(item.id) || typeof item.name !== 'string') throw new Error('Invalid shelf card');
    return { id: item.id, name: item.name, roasterName: typeof item.roasterName === 'string' ? item.roasterName : null,
      coffeeSlug: safeCoffeeSlug(item.coffeeSlug), photoUrl: publicShelfPhotoUrl(slug, item.id, item.photoUrl) };
  }) };
}

export function publicShelfPhotoUrl(slug: string, bagId: string, value: string | null): string | null {
  try {
    if (!value || !uuid.test(bagId)) return null;
    const base = new URL(API_GATEWAY_URL);
    const url = new URL(value, base);
    const prefix = `/api/v1/profiles/${encodeURIComponent(slug)}/shelf/bags/${bagId}/photos/`;
    if (url.protocol !== 'https:' || url.origin !== base.origin || url.username || url.password || url.search || url.hash
      || !url.pathname.startsWith(prefix) || !uuid.test(url.pathname.slice(prefix.length))) return null;
    return url.href;
  } catch { return null; }
}

export function safeCoffeeSlug(value: unknown): string | null {
  return typeof value === 'string' && value.trim() && !/[\\/\u0000-\u001f]/.test(value) && !['.', '..'].includes(value) ? value : null;
}
