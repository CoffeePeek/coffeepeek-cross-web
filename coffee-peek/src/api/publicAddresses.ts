import { httpClient } from './core/httpClient';
export const addressPrefixes = {
  shops: '/api/CoffeeShops', roasters: '/api/Roasters', users: '/api/Users',
  cities: '/api/Catalogs/cities', zones: '/api/Catalogs/coffee-zones',
} as const;
export type AddressKind = keyof typeof addressPrefixes;
export interface PublicAddress {
  slug: string; canonicalPath: string; revision: number; isAlias: boolean;
}
export type PublicAddressMetadata = PublicAddress;
export interface PublicAddressEnvelope<T> { data: T; address: PublicAddress }
export async function getBySlug<T>(kind: AddressKind, slug: string, signal?: AbortSignal): Promise<PublicAddressEnvelope<T>> {
  const body = await httpClient.getRaw<any>(`${addressPrefixes[kind]}/by-slug/${encodeURIComponent(slug)}`, { signal });
  const data = kind === 'cities' || kind === 'zones' ? body : body.data;
  const address = kind === 'users' ? body.address : data?.address;
  if (body.isSuccess === false || !data || !address) throw Object.assign(new Error(body.message || 'Public address unavailable'), { status: 503 });
  return { data, address };
}
