import { httpClient } from './core/httpClient';
import type { PublicAddress } from './publicAddresses';
import { API_GATEWAY_URL } from './core/apiConfig';

export interface CollectionCover { id: string; url: string }

export interface CollectionPlace {
  kind: 'coffee_shop' | 'roaster';
  address: PublicAddress;
  name: string;
  coverPhoto?: { fullUrl?: string; urls?: { card?: string } } | null;
  cityName?: string | null;
  streetAddress?: string | null;
  rating?: number | null;
  checkInCount?: number | null;
}

export interface SharedCollection {
  id: string;
  title: string;
  canonicalPath: string;
  createdAtUtc: string;
  items: CollectionPlace[];
  mode?: 'snapshot' | 'list';
  visibility?: 'public' | 'private';
  description?: string | null;
  coverPhoto?: CollectionCover | CollectionPlace['coverPhoto'];
}

export function collectionId(value: string): string {
  if (!/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(value)) throw new Error('Invalid collection address');
  return value.replaceAll('-', '').toLowerCase();
}

export async function getCollection(id: string, signal?: AbortSignal): Promise<SharedCollection> {
  const normalized = collectionId(id);
  const result = await httpClient.get<SharedCollection>(`/api/v1/favorite-collections/${normalized}`, {
    signal, requiresAuth: false, skipAuthHeader: true, credentials: 'omit',
  });
  if (result.data.canonicalPath !== `/collections/${normalized}`) throw new Error('Invalid collection address');
  if (!isPublicCollection(result.data)) throw new Error('Collection unavailable');
  return { ...result.data, items: orderCollectionPlaces(result.data.items) };
}

export function isPublicCollection(collection: SharedCollection): boolean {
  if (collection.mode !== undefined && collection.mode !== 'snapshot' && collection.mode !== 'list') return false;
  if (collection.visibility !== undefined && collection.visibility !== 'public') return false;
  return collection.mode !== 'list' || collection.visibility === 'public';
}

export async function getProfileCollection(slug: string, signal?: AbortSignal): Promise<SharedCollection | null> {
  const { data } = await httpClient.get<SharedCollection | null>(`/api/v1/profiles/${encodeURIComponent(slug)}/collection`, {
    requiresAuth: false, signal,
  });
  if (!data || data.mode !== 'list' || data.visibility !== 'public') return null;
  if (data.canonicalPath !== `/collections/${collectionId(data.id)}`) throw new Error('Invalid collection address');
  return { ...data, items: orderCollectionPlaces(data.items) };
}

export function collectionCoverUrl(photo: SharedCollection['coverPhoto']): string | null {
  try {
    if (!photo) return null;
    const saved = 'url' in photo;
    const value = saved ? photo.url : photo.urls?.card || photo.fullUrl;
    if (!value) return null;
    const api = saved ? new URL(API_GATEWAY_URL) : undefined;
    const url = new URL(value, api);
    if (saved && (url.origin !== api?.origin || !/^\/api\/v1\/favorite-collections\/[^/]+\/cover\/[^/]+$/.test(url.pathname))) return null;
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function orderCollectionPlaces(places: CollectionPlace[]): CollectionPlace[] {
  return [...places].sort((left, right) => Number(left.kind === 'roaster') - Number(right.kind === 'roaster'));
}

export function collectionPlacePath(place: CollectionPlace): string | null {
  if (!place.address?.slug || /[\\/\u0000-\u001f]/.test(place.address.slug) || ['.', '..'].includes(place.address.slug)) return null;
  if (place.kind === 'coffee_shop') return `/coffee-shops/${encodeURIComponent(place.address.slug)}`;
  if (place.kind === 'roaster') return `/roasters/${encodeURIComponent(place.address.slug)}`;
  return null;
}
