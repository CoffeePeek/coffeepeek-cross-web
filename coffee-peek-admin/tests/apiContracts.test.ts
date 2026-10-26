jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn(), post: jest.fn(), put: jest.fn() } }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: {
  COFFEE_SHOP: { SEARCH: '/api/v1/coffee-shops/search', BY_SLUG: (slug: string) => `/api/CoffeeShops/${encodeURIComponent(slug)}` },
  MAP: { BASE: '/api/Map' },
  ADMIN: {
    APP_DOWNLOADS: '/api/admin/v1/app-downloads',
    APP_DOWNLOADS_ANDROID_RELEASES: '/api/admin/v1/app-downloads/android/releases',
    APP_DOWNLOADS_ANDROID_GOOGLE_PLAY: '/api/admin/v1/app-downloads/android/google-play',
    APP_DOWNLOADS_IOS_APP_STORE: '/api/admin/v1/app-downloads/ios/app-store',
    APP_DOWNLOADS_VERSION: (platform: string) => `/api/admin/v1/app-downloads/${platform}/version`,
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

test.each(['android', 'ios'] as const)('store links save independently; %s versions validate, save and retain input after an API error', async platform => {
  const urls = ['https://play.google.com/store/apps/details?id=by.coffeepeek.app', 'https://apps.apple.com/app/id123456789'];
  const response = { data: {
    androidGooglePlay: { enabled: true, available: true, externalUrl: ` ${urls[0]} ` },
    iosAppStore: { enabled: true, available: true, externalUrl: ` ${urls[1]} ` },
    iosVersion: { latestVersionCode: 45, minVersionCode: 0 },
    androidVersion: { latestVersionCode: 100, minVersionCode: 2 },
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
  const settle = () => new Promise(resolve => setTimeout(resolve, 15));
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

    const policyKey = platform === 'android' ? 'androidVersion' : 'iosVersion';
    const otherKey = platform === 'android' ? 'iosVersion' : 'androidVersion';
    const form = document.querySelector(`form[aria-label="Обновления ${platform === 'android' ? 'Android' : 'iOS'}"]`)!;
    const latest = form.querySelector<HTMLInputElement>('[name="latestVersionCode"]')!;
    const minimum = form.querySelector<HTMLInputElement>('[name="minVersionCode"]')!;
    expect(latest.value).toBe(String(response.data[policyKey].latestVersionCode));
    expect(minimum.value).toBe(String(response.data[policyKey].minVersionCode));
    const set = async (input: HTMLInputElement, value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
    };
    const submit = async () => {
      await act(async () => {
        form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
        await settle();
      });
    };
    jest.mocked(httpClient.put).mockClear();
    for (const [latestValue, minValue] of [['', '0'], ['0', '0'], ['-1', '0'], ['1.5', '0'], ['2147483648', '0'], ['46', ''], ['46', '-1'], ['46', '0.5'], ['46', '47']]) {
      await set(latest, latestValue);
      await set(minimum, minValue);
      await submit();
      expect(form.querySelector('[role="alert"]')).not.toBeNull();
      expect(httpClient.put).not.toHaveBeenCalled();
    }

    await set(latest, '46');
    await set(minimum, '0');
    const policy = { latestVersionCode: 46, minVersionCode: 0 };
    jest.mocked(httpClient.put).mockResolvedValueOnce({ data: { ...response.data, [policyKey]: policy } } as never);
    await submit();
    expect(httpClient.put).toHaveBeenCalledTimes(1);
    expect(httpClient.put).toHaveBeenLastCalledWith(`/api/admin/v1/app-downloads/${platform}/version`, policy);
    expect(client.getQueryData(['admin', 'app-distribution', 'config'])).toMatchObject({
      [policyKey]: policy, [otherKey]: response.data[otherKey],
    });
    expect(latest.value).toBe('46');
    expect(minimum.value).toBe('0');

    await set(latest, '47');
    jest.mocked(httpClient.put).mockRejectedValueOnce({ errors: { LatestVersionCode: ['Ошибка сохранения версии'] } });
    await submit();
    expect(form.textContent).toContain('Ошибка сохранения версии');
    expect(latest.value).toBe('47');
    expect(client.getQueryData(['admin', 'app-distribution', 'config'])).toMatchObject({ [policyKey]: policy });
  } finally {
    await act(async () => { root.unmount(); });
    client.clear();
    dom.window.close();
  }
});

test.each([
  { iosVersion: { latestVersionCode: 46, minVersionCode: 0 }, androidVersion: { latestVersionCode: 100, minVersionCode: 2 } },
  { Data: { IosVersion: { LatestVersionCode: 46, MinVersionCode: 0 }, AndroidVersion: { LatestVersionCode: 100, MinVersionCode: 2 } } },
])('download config preserves version policies and zero minimum codes: %j', async data => {
  jest.mocked(httpClient.get).mockResolvedValueOnce({ data } as never);
  expect((await getAppDownloadsConfig()).data).toMatchObject({
    iosVersion: { latestVersionCode: 46, minVersionCode: 0 },
    androidVersion: { latestVersionCode: 100, minVersionCode: 2 },
  });
});

test('missing version policies are not replaced with fabricated version codes', async () => {
  jest.mocked(httpClient.get).mockResolvedValueOnce({ data: {} } as never);
  expect((await getAppDownloadsConfig()).data).toMatchObject({ iosVersion: null, androidVersion: null });
});

test.each(['', ' coffee '])('public search preserves identity, street address, photos and pagination (%s)', async search => {
  jest.mocked(httpClient.post).mockResolvedValue({ data: { items: [{ address, name: 'Coffee', addressLine: 'Street 1', coverPhoto: { fullUrl: '/original.jpg', urls: { card: '/card.jpg' } } }], totalPages: 3 } } as never);
  expect((await getBrowseCoffeeShops(2, 20, search)).data).toMatchObject({
    items: [{ id: 'coffee-slug', canonicalPath: address.canonicalPath, address: 'Street 1', imageUrl: '/card.jpg' }], totalPages: 3,
  });
  expect(httpClient.post).toHaveBeenCalledWith('/api/v1/coffee-shops/search', {
    q: search.trim(), filters: {}, sort: search.trim() ? 'relevance' : 'name_asc', page: 2, pageSize: 20,
  }, { requiresAuth: false });
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
