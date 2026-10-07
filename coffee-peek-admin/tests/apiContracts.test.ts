jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn(), put: jest.fn() } }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: {
  COFFEE_SHOP: { BASE: '/api/CoffeeShops', BY_SLUG: (slug: string) => `/api/CoffeeShops/${encodeURIComponent(slug)}` },
  MAP: { BASE: '/api/Map' },
  ADMIN: {
    APP_DOWNLOADS: '/api/admin/v1/app-downloads',
    APP_DOWNLOADS_ANDROID_RELEASES: '/api/admin/v1/app-downloads/android/releases',
    APP_DOWNLOADS_ANDROID_GOOGLE_PLAY: '/api/admin/v1/app-downloads/android/google-play',
    APP_DOWNLOADS_IOS_APP_STORE: '/api/admin/v1/app-downloads/ios/app-store',
    USER_PROFILE: (id: string) => `/api/admin/users/${id}/profile`,
    CATALOG_ROASTER_BY_ID: (id: string) => `/api/admin/roasters/${id}`,
    SHOP_PUBLIC_ADDRESS_BY_ID: (id: string) => `/api/admin/shops/${id}/public-address`,
    SHOP_PUBLIC_ADDRESS_BY_SLUG: (slug: string) => `/api/admin/shops/by-slug/${encodeURIComponent(slug)}/public-address`,
  },
} }));
jest.mock('@/src/components/ui/DataTable', () => require('../src/components/ui/DataTable'), { virtual: true });
jest.mock('@/src/components/ui/Input', () => require('../src/components/ui/Input'), { virtual: true });
jest.mock('../src/contexts/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));

import { act, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import { httpClient } from '../src/api/core/httpClient';
import { getBrowseCoffeeShops, getBrowseCoffeeShopBySlug, getCoffeeShopsByMapBounds } from '../src/api/coffeeShops';
import { getUserPublicProfile } from '../src/api/users';
import { getRoasterById } from '../src/api/roasters';
import { getShopPublicAddressById, getShopPublicAddressBySlug } from '../src/api/shopPublicAddresses';
import { getAppDownloadsConfig } from '../src/api/appDistribution';

const address = { slug: 'coffee-slug', canonicalPath: '/coffee-shops/canonical-coffee', revision: 2, isAlias: false };
beforeEach(() => jest.clearAllMocks());

test('store forms read externalUrl and save trimmed url, including disabling without a link', async () => {
  const urls = ['https://play.google.com/store/apps/details?id=by.coffeepeek.app', 'https://apps.apple.com/app/id123456789'];
  const response = { data: {
    androidGooglePlay: { enabled: true, available: true, externalUrl: ` ${urls[0]} ` },
    iosAppStore: { enabled: true, available: true, externalUrl: ` ${urls[1]} ` },
  } };
  jest.mocked(httpClient.get).mockResolvedValue(response as never);
  jest.mocked(httpClient.put).mockResolvedValue(response as never);
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = require('react-dom/client');
  const { AppDistributionPage } = require('../src/pages/AppDistributionPage');
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } } });
  client.setQueryData(['admin', 'app-distribution', 'config'], (await getAppDownloadsConfig()).data);
  client.setQueryData(['admin', 'app-distribution', 'android-releases'], []);
  const root = createRoot(document.getElementById('root'));
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  try {
    await act(async () => { root.render(createElement(QueryClientProvider, { client }, createElement(AppDistributionPage))); });
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="url"]')];
    const toggles = [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    const saves = [...document.querySelectorAll('button')].filter(button => button.textContent === 'Сохранить');
    for (const [index, path] of ['android/google-play', 'ios/app-store'].entries()) {
      expect(inputs[index].value).toBe(urls[index]);
      expect(toggles[index].checked).toBe(true);
      await act(async () => { saves[index].click(); await settle(); });
      expect(httpClient.put).toHaveBeenLastCalledWith(`/api/admin/v1/app-downloads/${path}`, { url: urls[index], enabled: true });

      await act(async () => {
        toggles[index].click();
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(inputs[index], '   ');
        inputs[index].dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
      await act(async () => { saves[index].click(); await settle(); });
      expect(httpClient.put).toHaveBeenLastCalledWith(`/api/admin/v1/app-downloads/${path}`, { url: null, enabled: false });
    }
  } finally {
    await act(async () => { root.unmount(); });
    client.clear();
    dom.window.close();
  }
});

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
