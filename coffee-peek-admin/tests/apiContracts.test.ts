jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn() } }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: {
  COFFEE_SHOP: { BASE: '/api/CoffeeShops', BY_SLUG: (slug: string) => `/api/CoffeeShops/${encodeURIComponent(slug)}` },
  MAP: { BASE: '/api/Map' },
  ADMIN: {
    USER_PROFILE: (id: string) => `/api/admin/users/${id}/profile`,
    CATALOG_ROASTER_BY_ID: (id: string) => `/api/admin/roasters/${id}`,
    SHOP_PUBLIC_ADDRESS_BY_ID: (id: string) => `/api/admin/shops/${id}/public-address`,
    SHOP_PUBLIC_ADDRESS_BY_SLUG: (slug: string) => `/api/admin/shops/by-slug/${encodeURIComponent(slug)}/public-address`,
  },
} }));

import { httpClient } from '../src/api/core/httpClient';
import { getBrowseCoffeeShops, getBrowseCoffeeShopBySlug, getCoffeeShopsByMapBounds } from '../src/api/coffeeShops';
import { getUserPublicProfile } from '../src/api/users';
import { getRoasterById } from '../src/api/roasters';
import { getShopPublicAddressById, getShopPublicAddressBySlug } from '../src/api/shopPublicAddresses';

const address = { slug: 'coffee-slug', canonicalPath: '/coffee-shops/canonical-coffee', revision: 2, isAlias: false };
beforeEach(() => jest.clearAllMocks());

test('public list reads slug identity and street address, preserving the canonical path', async () => {
  jest.mocked(httpClient.get).mockResolvedValue({ data: { coffeeShops: [{ address, name: 'Coffee', location: { address: 'Street 1' } }], totalPages: 3 } } as never);
  expect((await getBrowseCoffeeShops()).data).toMatchObject({
    items: [{ id: 'coffee-slug', canonicalPath: address.canonicalPath, address: 'Street 1' }], totalPages: 3,
  });
});

test('public details accept a slug and do not stringify address metadata', async () => {
  jest.mocked(httpClient.get).mockResolvedValue({ data: { address, name: 'Coffee', location: { address: 'Street 1' } } } as never);
  const result = await getBrowseCoffeeShopBySlug('coffee-slug');
  expect(httpClient.get).toHaveBeenCalledWith('/api/CoffeeShops/coffee-slug', { requiresAuth: false });
  expect(result.data.address).toBe('Street 1');
});

test('map requests individual shops and retains valid zero coordinates and canonical paths', async () => {
  jest.mocked(httpClient.get).mockResolvedValue({ data: { shops: [
    { address, latitude: 0, longitude: 27, title: 'Coffee' },
    { address: null, latitude: 53, longitude: 27 },
  ] } } as never);
  const result = await getCoffeeShopsByMapBounds(0, 20, 54, 30);
  expect(result.data.shops).toEqual([{ id: address.slug, canonicalPath: address.canonicalPath, latitude: 0, longitude: 27, title: 'Coffee' }]);
  expect(httpClient.get).toHaveBeenCalledWith('/api/Map', { params: { minLat: 0, minLon: 20, maxLat: 54, maxLon: 30, zoom: 14 }, requiresAuth: false });
});

test('author UUID lookup uses the protected administrative profile contract', async () => {
  await getUserPublicProfile('user-uuid');
  expect(httpClient.get).toHaveBeenCalledWith('/api/admin/users/user-uuid/profile');
});

test('roaster editor uses the administrative UUID route and loads its editable city ID', async () => {
  jest.mocked(httpClient.get).mockResolvedValue({ data: { id: 'roaster-uuid', cityId: 'city-uuid', name: 'Roaster', photos: [] } } as never);
  const result = await getRoasterById('roaster-uuid');
  expect(httpClient.get).toHaveBeenCalledWith('/api/admin/roasters/roaster-uuid', { requiresAuth: true });
  expect(result.data.cityId).toBe('city-uuid');
});

test('administrative identity reads bridge both UUID and slug without changing mutation IDs', async () => {
  const metadata = { entityId: 'shop-uuid', ...address };
  jest.mocked(httpClient.get).mockResolvedValue({ data: metadata } as never);
  expect((await getShopPublicAddressBySlug('coffee-slug')).data.entityId).toBe('shop-uuid');
  expect((await getShopPublicAddressById('shop-uuid')).data.canonicalPath).toBe(address.canonicalPath);
  expect(httpClient.get).toHaveBeenNthCalledWith(1, '/api/admin/shops/by-slug/coffee-slug/public-address');
  expect(httpClient.get).toHaveBeenNthCalledWith(2, '/api/admin/shops/shop-uuid/public-address');
});
