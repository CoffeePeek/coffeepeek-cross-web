import { httpClient } from './core/httpClient';
import type { PublicAddress } from './publicAddresses';

export type FavoriteKind = 'coffee_shop' | 'roaster';
export interface FavoriteItem { kind: FavoriteKind; address: PublicAddress; createdAtUtc: string }
export const getFavorites = async (signal?: AbortSignal): Promise<FavoriteItem[]> =>
  (await httpClient.get<FavoriteItem[]>('/api/v1/favorites', { signal })).data;
export async function setFavorite(kind: FavoriteKind, slug: string, favorite: boolean, signal?: AbortSignal): Promise<void> {
  const path = `/api/v1/favorites/${kind}/${encodeURIComponent(slug)}`;
  if (favorite) await httpClient.put<void>(path, undefined, { signal });
  else await httpClient.delete<void>(path, { signal });
}
export function updateFavoriteList(items: FavoriteItem[], kind: FavoriteKind, address: PublicAddress, favorite: boolean): FavoriteItem[] {
  const rest = items.filter(item => item.kind !== kind || item.address.slug !== address.slug);
  return favorite ? [...rest, items.find(item => item.kind === kind && item.address.slug === address.slug) ?? { kind, address, createdAtUtc: new Date().toISOString() }] : rest;
}
