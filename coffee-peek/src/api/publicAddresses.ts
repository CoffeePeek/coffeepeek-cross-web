import { httpClient } from './core/httpClient';
export const addressPrefixes = {
  shops: '/api/CoffeeShops', roasters: '/api/Roasters', users: '/api/Users',
} as const;
export type AddressKind = keyof typeof addressPrefixes;
export interface PublicAddress {
  slug: string; canonicalPath: string; revision: number | string; isAlias: boolean;
}
export type PublicAddressMetadata = PublicAddress;
export interface PublicAddressEnvelope<T> { data: T; address: PublicAddress }
export async function getBySlug<T>(kind: AddressKind, slug: string, signal?: AbortSignal): Promise<PublicAddressEnvelope<T>> {
  const body = await httpClient.getRaw<any>(`${addressPrefixes[kind]}/by-slug/${encodeURIComponent(slug)}`, { signal });
  const data = body.data?.shopDto ?? body.data;
  const address = kind === 'users' ? body.address : data?.address;
  if (body.isSuccess === false || !data || !address) throw Object.assign(new Error(body.message || 'Public address unavailable'), { status: 503 });
  return { data, address };
}
