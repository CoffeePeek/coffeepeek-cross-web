import { getMyContributions } from '../src/api/myContributions';
import { httpClient } from '../src/api/core/httpClient';

jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn(), getRaw: jest.fn() } }));

const get = httpClient.get as jest.Mock;
const shop = { slug: 'shop', canonicalPath: '/coffee-shops/shop', revision: 1, isAlias: false };
const live = { slug: 'live', canonicalPath: '/coffee-shops/live', revision: 1, isAlias: false };
const getRaw = httpClient.getRaw as jest.Mock;
const paging = { totalItems: 1, totalPages: 1, currentPage: 1, pageSize: 20 };
const query = { page: 1, pageSize: 20, status: 'Rejected' as const };

beforeEach(() => jest.clearAllMocks());

test('each /mine endpoint maps data.items and status/reason fields', async () => {
  get.mockResolvedValueOnce({ data: { ...paging, items: [{ id: 's', name: 'Shop', address: 'Street 1', moderationStatus: 'Approved', rejectedReason: null, publishedShop: null }] } });
  expect(await getMyContributions('shops', query)).toEqual({ totalItems: 1, totalPages: 1, items: [{ id: 's', title: 'Shop', subtitle: 'Street 1', status: 'Approved', reason: null, link: undefined }] });
  expect(get).toHaveBeenLastCalledWith('/api/ModerationShops/mine', { params: query });

  get.mockResolvedValueOnce({ data: { ...paging, items: [{ id: 'r', name: 'Roaster', about: null, moderationStatus: 'Pending', rejectedReason: null }] } });
  expect((await getMyContributions('roasters', query)).items[0]).toMatchObject({ title: 'Roaster', status: 'Pending' });

  get.mockResolvedValueOnce({ data: { ...paging, items: [{ id: 'v', header: null, comment: 'Nice', shop, createdAt: '2026-09-01T00:00:00Z', moderationStatus: 'Rejected', rejectedReason: 'Spam', rating: { place: 3, service: 4, coffee: 5 } }] } });
  expect((await getMyContributions('reviews', query)).items[0]).toMatchObject({ status: 'Rejected', reason: 'Spam', link: '/coffee-shops/shop' });

  get.mockResolvedValueOnce({ data: { ...paging, items: [{ id: 'e', shop, section: 'Menu', status: 'Rejected', rejectionReason: 'Wrong', createdAtUtc: '2026-09-01T00:00:00Z' }] } });
  expect((await getMyContributions('edits', query)).items[0]).toMatchObject({ title: 'Меню', section: 'Menu', status: 'Rejected', reason: 'Wrong', link: '/coffee-shops/shop' });
  expect(get).toHaveBeenLastCalledWith('/api/ShopChangeRequests/mine', { params: query });
});

test('published shop links to the supplied canonical address', async () => {
  get.mockResolvedValueOnce({ data: { ...paging, items: [{ id: 's', name: 'Shop', address: null, moderationStatus: 'Approved', rejectedReason: null, publishedShop: live }] } });
  expect((await getMyContributions('shops', query)).items[0].link).toBe('/coffee-shops/live');
});

test('unavailable historical publication has no link', async () => {
  get.mockResolvedValueOnce({ data: { ...paging, items: [{ id: 's', name: 'Shop', moderationStatus: 'Approved', publishedShop: null }] } });
  expect((await getMyContributions('shops', query)).items[0].link).toBeUndefined();
  expect(getRaw).not.toHaveBeenCalled();
});

test('inline addresses require no metadata request', async () => {
  get.mockResolvedValueOnce({ data: { ...paging, items: [{ id: 's', name: 'Shop', moderationStatus: 'Approved', publishedShop: live }] } });
  await getMyContributions('shops', query);
  expect(getRaw).not.toHaveBeenCalled();
});
