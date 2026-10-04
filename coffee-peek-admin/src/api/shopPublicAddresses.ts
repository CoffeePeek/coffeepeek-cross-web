import { API_ENDPOINTS } from './core/apiConfig';
import { httpClient } from './core/httpClient';

/** Protected identity metadata: public slugs and administrative UUIDs stay separate. */
export interface AdminShopPublicAddress {
  entityId: string;
  slug: string;
  canonicalPath: string;
  revision: number;
  isAlias: boolean;
}

export function getShopPublicAddressById(id: string) {
  return httpClient.get<AdminShopPublicAddress>(API_ENDPOINTS.ADMIN.SHOP_PUBLIC_ADDRESS_BY_ID(id));
}

export function getShopPublicAddressBySlug(slug: string) {
  return httpClient.get<AdminShopPublicAddress>(API_ENDPOINTS.ADMIN.SHOP_PUBLIC_ADDRESS_BY_SLUG(slug));
}
