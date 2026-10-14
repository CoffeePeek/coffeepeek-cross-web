jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
import { httpClient } from '../src/api/core/httpClient';
import { createHomeCheckIn, deleteHomeCheckIn, getHomeCalendar, getHomeCheckIn, getHomeCheckIns, privateHomeUpdate, searchHomeCoffee, updateHomeCheckIn, type HomeCheckIn, type HomeCheckInRequest } from '../src/api/homeCheckIns';

const request: HomeCheckInRequest = {
  preparedAt: '2026-10-14T09:00:00Z', preparedOn: '2026-10-14', brewMethodCode: 'hario-v60',
  coffeeProductSlug: 'beans', coffeeProductId: null, customBeanName: null, doseGrams: 18.5,
  brewDurationSeconds: 180, tasteScore: 5, text: '', drinkSlug: null, customDrinkName: null,
  visibility: 'Private', photos: [], drinkPhoto: null,
};
const item = { id: 'home-id', preparedOn: '2026-10-14', tasteScore: 5, visibility: 'Private', photos: [] };
beforeEach(() => jest.clearAllMocks());

test('home creation requires an id and confirmed visibility', async () => {
  jest.mocked(httpClient.post).mockResolvedValueOnce({ data: { ...item, visibility: null } } as never).mockResolvedValueOnce({ data: item } as never);
  await expect(createHomeCheckIn(request)).rejects.toThrow(/не подтвердил/);
  expect((await createHomeCheckIn(request)).id).toBe('home-id');
  expect(httpClient.post).toHaveBeenCalledWith('/api/v1/check-ins/home', request, { requiresAuth: true });
});

test('home history, calendar, detail and changes use their dedicated endpoints', async () => {
  jest.mocked(httpClient.get).mockResolvedValueOnce({ data: { items: [item], totalCount: 1 } } as never)
    .mockResolvedValueOnce({ data: [{ preparedOn: '2026-10-14', brewCount: 1 }] } as never)
    .mockResolvedValueOnce({ data: item } as never);
  expect((await getHomeCheckIns(2, 20, { from: '2026-10-01', to: '2026-10-31' })).items).toHaveLength(1);
  expect(httpClient.get).toHaveBeenCalledWith('/api/v1/check-ins/home', { params: { pageNumber: 2, pageSize: 20, from: '2026-10-01', to: '2026-10-31' }, requiresAuth: true });
  expect(await getHomeCalendar('2026-10-01', '2026-10-31')).toHaveLength(1);
  expect((await getHomeCheckIn('home/id')).id).toBe('home-id');
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/v1/check-ins/home/home%2Fid', { requiresAuth: true });
  jest.mocked(httpClient.put).mockResolvedValue({ data: item } as never);
  const { photos: _photos, drinkPhoto: _drinkPhoto, ...edit } = request;
  await updateHomeCheckIn('home/id', edit);
  expect(httpClient.put).toHaveBeenCalledWith('/api/v1/check-ins/home/home%2Fid', edit, { requiresAuth: true });
  await deleteHomeCheckIn('home/id');
  expect(httpClient.delete).toHaveBeenCalledWith('/api/v1/check-ins/home/home%2Fid', { requiresAuth: true });
});

test('coffee search fetches the first page including unavailable products', async () => {
  jest.mocked(httpClient.post).mockResolvedValue({ data: { items: [{ slug: 'beans' }] } } as never);
  expect(await searchHomeCoffee('руанда')).toEqual([{ slug: 'beans' }]);
  expect(httpClient.post).toHaveBeenCalledWith('/api/v1/coffees/search', { q: 'руанда', filters: { availableOnly: false }, page: 1, pageSize: 20 }, { requiresAuth: true });
});

test('hiding a home check-in retains its recipe and omits photos from PUT', () => {
  const edit = privateHomeUpdate({
    ...item, preparedAtUtc: '2026-10-14T09:00:00Z', coffeeProductId: 'product-id',
    beanName: 'Руанда', brewMethodCode: 'hario-v60', doseGrams: 18.5,
    brewDurationSeconds: 180, text: 'Ягоды', drinkSlug: 'other', customDrinkName: 'Фильтр',
    visibility: 'Public', photos: [{ id: 'photo', url: '/photo', sortIndex: 0 }],
  } as HomeCheckIn);
  expect(edit).toMatchObject({ visibility: 'Private', coffeeProductId: 'product-id', coffeeProductSlug: null,
    customBeanName: null, brewMethodCode: 'hario-v60', doseGrams: 18.5, brewDurationSeconds: 180,
    text: 'Ягоды', drinkSlug: 'other', customDrinkName: 'Фильтр' });
  expect(edit).not.toHaveProperty('photos');
  expect(edit).not.toHaveProperty('drinkPhoto');
});
