jest.mock('../src/utils/errorHandler', () => ({ getErrorMessageByStatus: () => 'Error' }));
jest.mock('../src/utils/logger', () => ({ logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() } }));
jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@tanstack/react-query', () => ({ ...jest.requireActual('@tanstack/react-query'), useQuery: jest.fn() }));
jest.mock('../src/contexts/UserContext', () => ({ useUser: jest.fn() }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: {
  CHECK_IN: { BASE: '/api/v1/check-ins' },
  MAP: { BASE: '/api/Map' },
  MODERATION: { SHOP: '/api/ModerationShops', ROASTER: '/api/ModerationRoasters', REVIEWS: '/api/ModerationReviews' },
} }));
import { normalizeResponseData } from '../src/api/core/interceptors';
import { EquipmentCategory, getEquipmentCategoryLabel, getMapSearch, getMapShops, getMapZones, getPublicCheckIns, createCheckIn } from '../src/api/coffeeshop';
import { useQuery } from '@tanstack/react-query';
import { useSearchCoffeeShops } from '../src/hooks/queries/useCoffeeShops';
import { sendCoffeeShopToModeration, sendRoasterToModeration } from '../src/api/moderation';
import { createShopChangeRequest } from '../src/api/shopChangeRequests';
import { httpClient } from '../src/api/core/httpClient';
import { queryClient } from '../src/lib/queryClient';
const address = { slug: 'coffee', canonicalPath: '/coffee-shops/server-path', revision: 3, isAlias: false };
const author = { ...address, slug: 'petr', canonicalPath: '/users/petr' };
beforeEach(() => { jest.clearAllMocks(); queryClient.clear(); });
afterEach(() => { jest.useRealTimers(); queryClient.clear(); });

test('map autocomplete requests the first three server search results without viewport filters', async () => {
  const data = { items: [{ address, name: 'Coffee', addressLine: 'Street 1' }], totalItems: 1 };
  jest.mocked(httpClient.post).mockResolvedValue({ data } as never);
  useSearchCoffeeShops(' кофе ', 1, 3);
  const options = jest.mocked(useQuery).mock.calls.at(-1)![0];
  expect(options.enabled).toBe(true);
  const request = options.queryFn as (context: { signal: AbortSignal }) => Promise<unknown>;
  const signal = new AbortController().signal;
  expect(await request({ signal })).toBe(data);
  expect(httpClient.post).toHaveBeenCalledWith('/api/v1/coffee-shops/search', {
    q: 'кофе', filters: {}, page: 1, pageSize: 3,
  }, { requiresAuth: false, signal });
  useSearchCoffeeShops(' ');
  expect(jest.mocked(useQuery).mock.calls.at(-1)![0].enabled).toBe(false);
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
test('map markers and zones use addresses without losing clusters', async () => {
  jest.mocked(httpClient.get).mockResolvedValue({ data: {
    shops: [{ address, latitude: 53, longitude: 27, title: 'Coffee', type: 'Specialty', primaryZone: author }],
    zones: [{ address: author, name: 'Zone', latitude: 53, longitude: 27, radiusMeters: 100, shopCount: 1, polygon: [] }],
    clusters: [], isTruncated: true,
  } } as never);
  const result = await getMapShops({ minLat: 52, maxLat: 54, minLon: 26, maxLon: 28 });
  expect(result.data).toMatchObject({ shops: [{ id: 'coffee', publicAddress: address, primaryZoneId: 'petr' }], zones: [{ id: 'petr' }], isTruncated: true });
});

test('map grouping follows camera zoom, shares rounded zooms and preserves server counts and bounds', async () => {
  const bounds = { minLat: 52, maxLat: 54, minLon: 26, maxLon: 28 };
  const cluster = { id: 'server-group', latitude: '53', longitude: '27', count: '125',
    bounds: { minLatitude: '52.9', minLongitude: '26.9', maxLatitude: '53.1', maxLongitude: '27.1' } };
  jest.mocked(httpClient.get).mockResolvedValue({ data: { clusters: [cluster], isTruncated: true } } as never);
  const result = await getMapSearch(bounds, 9.7);
  await getMapSearch(bounds, 10.2);
  expect(httpClient.get).toHaveBeenCalledTimes(1);
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/Map', expect.objectContaining({ params: { ...bounds, zoom: 10 } }));
  expect(result.data).toMatchObject({ shops: [], clusters: [{ id: 'server-group', count: 125,
    latitude: 53, longitude: 27, bounds: { minLatitude: 52.9, minLongitude: 26.9, maxLatitude: 53.1, maxLongitude: 27.1 } }], isTruncated: true });
  await getMapShops(bounds);
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/Map', expect.objectContaining({ params: { ...bounds, zoom: 14 } }));
});

test('invalid cluster counts, coordinates and bounds are excluded before rendering', async () => {
  const cluster = { id: 'valid', latitude: 53, longitude: 27, count: 1,
    bounds: { minLatitude: 53, minLongitude: 27, maxLatitude: 53, maxLongitude: 27 } };
  jest.mocked(httpClient.get).mockResolvedValue({ data: { clusters: [cluster,
    ...[0, -1, 1.5, null, 'bad'].map(count => ({ ...cluster, count })),
    { ...cluster, latitude: 91 }, { ...cluster, longitude: Infinity },
    { ...cluster, bounds: { ...cluster.bounds, minLatitude: 54 } },
    { ...cluster, bounds: { ...cluster.bounds, maxLongitude: 181 } },
    { ...cluster, bounds: null },
  ] } } as never);
  const result = await getMapSearch({ minLat: 52, maxLat: 54, minLon: 26, maxLon: 28 }, 10);
  expect(result.data.clusters).toEqual([cluster]);
});

test.each([['#b45a78', '#b45a78'], [undefined, undefined], ['invalid', undefined]])('map zones validate the server color %s', async (color, expected) => {
  jest.mocked(httpClient.get).mockResolvedValue({ data: {
    zones: [{ address: author, name: 'Zone', color, latitude: 53, longitude: 27, radiusMeters: 100, shopCount: 1, polygon: [] }],
  } } as never);
  const zones = await getMapZones({ minLat: 52, maxLat: 54, minLon: 26, maxLon: 28 });
  expect(zones[0].color).toBe(expected);
});
test('moderation, reviews and changes send slug fields and preserve empty/null lists', async () => {
  jest.mocked(httpClient.post).mockResolvedValue({ success: true, data: {} } as never);
  await sendCoffeeShopToModeration({ name: 'Coffee', notValidatedAddress: 'Street 1', cityId: 'minsk', coffeeBeanIds: ['arabica'], equipmentIds: [], roasterIds: [], brewMethodIds: ['v60'] });
  expect(httpClient.post).toHaveBeenLastCalledWith('/api/ModerationShops', expect.objectContaining({ city: 'minsk', beans: ['arabica'], equipments: [], roasters: [], brewMethods: ['v60'] }), { requiresAuth: false });
  expect(jest.mocked(httpClient.post).mock.calls[0][1]).not.toHaveProperty('cityId');
  await sendRoasterToModeration({ name: 'Roaster' });
  expect(httpClient.post).toHaveBeenLastCalledWith('/api/ModerationRoasters', expect.objectContaining({ city: null }), { requiresAuth: false });
  const checkIn = { coffeeShopSlug: 'coffee', text: 'Great', rating: { coffee: 5, place: 4, service: 5 } };
  jest.mocked(httpClient.post).mockResolvedValueOnce({ success: true, data: { id: 'check-in-1', visibility: 'Private' } } as never);
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
