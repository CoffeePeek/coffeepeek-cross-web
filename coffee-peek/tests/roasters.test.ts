jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn() } }));
import { httpClient } from '../src/api/core/httpClient';
import { getRoasterCards } from '../src/api/discovery';

test('roasters use GET /api/roasters without search or pagination parameters and preserve the new DTO', async () => {
  const data = [{ address: { slug: null, canonicalPath: null, revision: '1', isAlias: false }, name: null, photoUrl: null,
    coverPhoto: { fullUrl: null, urls: { card: '/logo.png' } }, tags: [], coffeeShopsCount: '5', coffeeProductsCount: '10', availableCoffeeProducts: '3' }];
  jest.mocked(httpClient.get).mockResolvedValue({ data } as never);
  const signal = new AbortController().signal;
  await expect(getRoasterCards(signal)).resolves.toEqual(data);
  expect(httpClient.get).toHaveBeenCalledWith('/api/roasters', { requiresAuth: false, signal });
  jest.mocked(httpClient.get).mockResolvedValue({ data: [] } as never);
  await expect(getRoasterCards()).resolves.toEqual([]);
  jest.mocked(httpClient.get).mockResolvedValue({ data: { items: data } } as never);
  await expect(getRoasterCards()).rejects.toThrow('Некорректный список обжарщиков');
});
