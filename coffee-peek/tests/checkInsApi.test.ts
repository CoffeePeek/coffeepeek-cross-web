jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: {
  CHECK_IN: { BASE: '/api/v1/check-ins', MINE: '/api/v1/check-ins/mine', BY_ID: (id: string) => `/api/v1/check-ins/${encodeURIComponent(id)}` }, FEED: '/api/v1/feed',
} }));
jest.mock('../src/utils/logger', () => ({ logger: { warn: jest.fn() } }));
import { createCheckIn, getCheckIns, getCheckInsByDateRange, getPublicCheckIns, getFeed, getCheckInById, updateCheckIn, changeCheckInVisibility, deleteCheckIn, setCheckInHelpful } from '../src/api/coffeeshop';
import { httpClient } from '../src/api/core/httpClient';

const item = { id: 'check-in-id', text: 'Coffee', visibility: 'Private', moderationState: 'NotSubmitted', createdAtUtc: '2026-09-01T12:00:00Z', rating: { coffee: 5, service: 4, place: 3 }, photos: [] };
beforeEach(() => jest.clearAllMocks());

test('mine sends query pagination and reads totalCount, with header totals taking precedence', async () => {
  jest.mocked(httpClient.get).mockResolvedValue({ success: true, data: { items: [item], totalCount: 21 }, pagination: { totalItems: 31, totalPages: 4, page: 2, pageSize: 10 } } as never);
  expect((await getCheckIns(2, 10)).data).toEqual({ items: [item], totalCount: 31, totalPages: 4, currentPage: 2, pageSize: 10 });
  expect(httpClient.get).toHaveBeenCalledWith('/api/v1/check-ins/mine', { params: { pageNumber: 2, pageSize: 10 }, requiresAuth: true });
});

test('calendar fetches every page in a half-open date range', async () => {
  const range = { from: '2026-09-01T00:00:00+03:00', to: '2026-10-01T00:00:00+03:00' };
  jest.mocked(httpClient.get).mockResolvedValueOnce({ data: { items: [item], totalCount: 101 } } as never).mockResolvedValueOnce({ data: { items: [{ ...item, id: 'second' }], totalCount: 101 } } as never);
  expect(await getCheckInsByDateRange(range)).toHaveLength(2);
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/v1/check-ins/mine', { params: { pageNumber: 2, pageSize: 100, ...range }, requiresAuth: true });
});

test('public lists and feed use separate cursors, slug filters and optional authorization', async () => {
  const filters = { authorSlug: 'author', coffeeShopSlug: 'coffee', citySlug: 'minsk', cursor: 'public-cursor', pageSize: 20 };
  await getPublicCheckIns(filters);
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/v1/check-ins', { params: filters, requiresAuth: false });
  await getFeed({ ...filters, cursor: 'feed-cursor' });
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/v1/feed', { params: { ...filters, cursor: 'feed-cursor' }, requiresAuth: false });
  await getFeed({ citySlug: 'another-city' });
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/v1/feed', { params: { citySlug: 'another-city' }, requiresAuth: false });
});

test('creation returns the whole card and update uses the check-in ID with no mutable photos/date', async () => {
  jest.mocked(httpClient.post).mockResolvedValue({ data: item } as never);
  const request = { coffeeShopSlug: 'coffee', text: 'Coffee', rating: item.rating, photos: [{ fileName: 'coffee.jpg', contentType: 'image/jpeg', storageKey: 'check-ins/key', size: 42 }] };
  expect((await createCheckIn(request)).data.id).toBe('check-in-id');
  expect(httpClient.post).toHaveBeenLastCalledWith('/api/v1/check-ins', request, { requiresAuth: true });
  await getCheckInById('id/1');
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/v1/check-ins/id%2F1', { requiresAuth: false });
  const changes = { text: 'Updated', rating: item.rating, drinkSlug: 'cappuccino' };
  await updateCheckIn('id/1', changes);
  expect(httpClient.put).toHaveBeenLastCalledWith('/api/v1/check-ins/id%2F1', changes, { requiresAuth: true });
  expect(changes).not.toHaveProperty('photos');
  expect(changes).not.toHaveProperty('visitedAt');
});

test('visibility, helpful and deletion use explicit idempotent commands', async () => {
  await changeCheckInVisibility('id', 'Private');
  expect(httpClient.put).toHaveBeenLastCalledWith('/api/v1/check-ins/id/visibility', { visibility: 'Private' }, { requiresAuth: true });
  await setCheckInHelpful('id', true);
  expect(httpClient.put).toHaveBeenLastCalledWith('/api/v1/check-ins/id/helpful', undefined, { requiresAuth: true });
  await setCheckInHelpful('id', false);
  expect(httpClient.delete).toHaveBeenLastCalledWith('/api/v1/check-ins/id/helpful', { requiresAuth: true });
  await deleteCheckIn('id');
  expect(httpClient.delete).toHaveBeenLastCalledWith('/api/v1/check-ins/id', { requiresAuth: true });
});
