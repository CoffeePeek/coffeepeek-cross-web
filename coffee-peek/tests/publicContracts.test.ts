jest.mock('../src/utils/errorHandler', () => ({ getErrorMessageByStatus: () => 'Error' }));
jest.mock('../src/utils/logger', () => ({ logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() } }));
jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: {
  COFFEE_SHOP: { BASE: '/api/CoffeeShops' },
  CHECK_IN: { BASE: '/api/v1/check-ins' },
  MAP: { BASE: '/api/Map' },
  MODERATION: { SHOP: '/api/ModerationShops', ROASTER: '/api/ModerationRoasters', REVIEWS: '/api/ModerationReviews' },
} }));
import { normalizeResponseData } from '../src/api/core/interceptors';
import { EquipmentCategory, getEquipmentCategoryLabel, searchCoffeeShops, getMapShops, getPublicCheckIns, createCheckIn } from '../src/api/coffeeshop';
import { sendCoffeeShopToModeration, sendRoasterToModeration } from '../src/api/moderation';
import { createShopChangeRequest } from '../src/api/shopChangeRequests';
import { httpClient } from '../src/api/core/httpClient';
import { queryClient } from '../src/lib/queryClient';
const address = { slug: 'coffee', canonicalPath: '/coffee-shops/server-path', revision: 3, isAlias: false };
const author = { ...address, slug: 'petr', canonicalPath: '/users/petr' };
beforeEach(() => { jest.clearAllMocks(); queryClient.clear(); });
afterEach(() => { jest.useRealTimers(); queryClient.clear(); });

test('map autocomplete requests the first three server search results without viewport filters', async () => {
  jest.mocked(httpClient.get).mockResolvedValue({ data: { coffeeShops: [] } } as never);
  await searchCoffeeShops(' кофе ', undefined, 1, 3);
  expect(httpClient.get).toHaveBeenCalledWith('/api/CoffeeShops', {
    params: { q: 'кофе', page: 1, pageSize: 3 }, requiresAuth: false,
  });
});

test('map responses are shared for 30 minutes, then refetched', async () => {
  jest.useFakeTimers();
  jest.mocked(httpClient.get).mockResolvedValue({ data: { shops: [], zones: [], clusters: [] } } as never);
  const bounds = { minLat: 52, maxLat: 54, minLon: 26, maxLon: 28 };
  await Promise.all([getMapShops(bounds), getMapShops(bounds)]);
  expect(httpClient.get).toHaveBeenCalledTimes(1);
  jest.setSystemTime(Date.now() + 29 * 60_000);
  await getMapShops(bounds);
  expect(httpClient.get).toHaveBeenCalledTimes(1);
  jest.setSystemTime(Date.now() + 60_001);
  await getMapShops(bounds);
  expect(httpClient.get).toHaveBeenCalledTimes(2);
});

test('failed map requests do not become cached results', async () => {
  const bounds = { minLat: 52, maxLat: 54, minLon: 26, maxLon: 28 };
  jest.mocked(httpClient.get).mockRejectedValueOnce(new Error('Network'));
  await expect(getMapShops(bounds)).rejects.toThrow('Network');
  jest.mocked(httpClient.get).mockResolvedValueOnce({ data: { shops: [] } } as never);
  await getMapShops(bounds);
  expect(httpClient.get).toHaveBeenCalledTimes(2);
});
test('shop with brew methods and roasters remains a shop, with slug keys and canonical metadata', () => {
  const result = normalizeResponseData<any>({ address, name: 'Coffee', city: { ...address, slug: 'minsk' },
    location: { address: 'Street 1' }, beans: [{ slug: 'arabica', name: 'Arabica' }],
    brewMethods: [{ slug: 'v60', name: 'V60' }], roasters: [{ address: author, name: 'Roaster' }],
    checkIns: [{ id: 'check-in-service-id', shop: address, author, visibility: 'Public', moderationState: 'Approved', rating: { coffee: 5, service: 4, place: 3 } }],
    userCheckIns: [{ id: 'check-in-service-id', shop: null }],
  });
  expect(result).toMatchObject({ id: 'coffee', cityId: 'minsk', address: 'Street 1', publicAddress: address,
    canonicalPath: '/coffee-shops/server-path', beans: [{ id: 'arabica' }], brewMethods: [{ id: 'v60' }],
    roasters: [{ id: 'petr' }], checkIns: [{ id: 'check-in-service-id', author, shop: address, rating: { coffee: 5 } }],
    userCheckIns: [{ id: 'check-in-service-id', shop: null, shopId: '' }],
  });
});
test('catalog arrays map supplied slugs without modifying address metadata or service IDs', () => {
  expect(normalizeResponseData<any>([{ address, name: 'Coffee' }])[0]).toMatchObject({ id: 'coffee', publicAddress: address });
  expect(normalizeResponseData<any>({ items: [{ id: 'request-service-id', shop: null }], totalItems: 1 })).toMatchObject({
    items: [{ id: 'request-service-id', shopId: '' }], totalItems: 1,
  });
});
test('shop search with or without text send city and slug arrays using the same query fields', async () => {
  jest.mocked(httpClient.get).mockResolvedValue({ data: {} } as never);
  const filters = { cityId: 'minsk', equipmentIds: ['linea'], coffeeBeanIds: ['arabica'], tagIds: ['dog-friendly'] };
  await searchCoffeeShops(undefined, filters, 1, 1000);
  await searchCoffeeShops('coffee', filters);
  for (const [, config] of jest.mocked(httpClient.get).mock.calls) {
    expect(config?.params).toMatchObject({ city: 'minsk', equipments: ['linea'], beans: ['arabica'], tags: ['dog-friendly'] });
    expect(config?.params).not.toHaveProperty('cityId');
  }
  expect(jest.mocked(httpClient.get).mock.calls[0][1]?.params?.pageSize).toBe(100);
});
test('map markers and zones use addresses without losing clusters', async () => {
  jest.mocked(httpClient.get).mockResolvedValue({ data: {
    shops: [{ address, latitude: 53, longitude: 27, title: 'Coffee', type: 'Specialty', primaryZone: author }],
    zones: [{ address: author, name: 'Zone', latitude: 53, longitude: 27, radiusMeters: 100, shopCount: 1, polygon: [] }],
    clusters: [], isTruncated: true,
  } } as never);
  const result = await getMapShops({ minLat: 52, maxLat: 54, minLon: 26, maxLon: 28 });
  expect(result.data).toMatchObject({ shops: [{ id: 'coffee', publicAddress: address, primaryZoneId: 'petr' }], zones: [{ id: 'petr' }], isTruncated: true });
});
test('moderation, reviews and changes send slug fields and preserve empty/null lists', async () => {
  jest.mocked(httpClient.post).mockResolvedValue({ success: true, data: {} } as never);
  await sendCoffeeShopToModeration({ name: 'Coffee', notValidatedAddress: 'Street 1', cityId: 'minsk', coffeeBeanIds: ['arabica'], equipmentIds: [], roasterIds: [], brewMethodIds: ['v60'] });
  expect(httpClient.post).toHaveBeenLastCalledWith('/api/ModerationShops', expect.objectContaining({ city: 'minsk', beans: ['arabica'], equipments: [], roasters: [], brewMethods: ['v60'] }), { requiresAuth: false });
  expect(jest.mocked(httpClient.post).mock.calls[0][1]).not.toHaveProperty('cityId');
  await sendRoasterToModeration({ name: 'Roaster' });
  expect(httpClient.post).toHaveBeenLastCalledWith('/api/ModerationRoasters', expect.objectContaining({ city: null }), { requiresAuth: false });
  const checkIn = { coffeeShopSlug: 'coffee', text: 'Great', rating: { coffee: 5, place: 4, service: 5 } };
  await createCheckIn(checkIn);
  expect(httpClient.post).toHaveBeenLastCalledWith('/api/v1/check-ins', checkIn, { requiresAuth: true });
  const change = { shop: 'coffee', section: 'Tags' as const, payload: { tags: [], roasters: null } };
  await createShopChangeRequest(change);
  expect(httpClient.post).toHaveBeenLastCalledWith('/api/ShopChangeRequests', change);
});

test('equipment category constants preserve numeric values and string labels', () => {
  expect(EquipmentCategory.EspressoMachine).toBe(0);
  expect(getEquipmentCategoryLabel('EspressoMachine')).toBe(getEquipmentCategoryLabel(0));
  expect(getEquipmentCategoryLabel('Other')).toBe('Другое');
});
