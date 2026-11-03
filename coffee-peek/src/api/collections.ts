import { httpClient } from './core/httpClient';
import type { PublicAddress } from './publicAddresses';

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
  return { ...result.data, items: orderCollectionPlaces(result.data.items) };
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
