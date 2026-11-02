jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn() } }));
import { httpClient } from '../src/api/core/httpClient';
import { collectionId, collectionPlacePath, getCollection } from '../src/api/collections';

beforeEach(() => jest.clearAllMocks());
const id = '123456781234123412341234567890ab';

test('normalizes supported IDs and rejects paths and malformed UUIDs', () => {
  expect(collectionId('12345678-1234-1234-1234-1234567890AB')).toBe(id);
  for (const invalid of ['', '../secret', `${id}/x`, `-${id}`, id.slice(1)]) expect(() => collectionId(invalid)).toThrow();
});

test('anonymous reads do not attach viewer credentials and preserve cancellation', async () => {
  const signal = new AbortController().signal;
  const data = { id, title: 'Places', canonicalPath: `/collections/${id}`, items: [], createdAtUtc: '' };
  jest.mocked(httpClient.get).mockResolvedValueOnce({ data } as never);
  expect(await getCollection(id, signal)).toEqual(data);
  expect(httpClient.get).toHaveBeenCalledWith(`/api/v1/favorite-collections/${id}`, { signal, requiresAuth: false, skipAuthHeader: true });
});

test('does not accept an unexpected canonical address from a response', async () => {
  jest.mocked(httpClient.get).mockResolvedValueOnce({ data: { canonicalPath: '//other.invalid' } } as never);
  await expect(getCollection(id)).rejects.toThrow('Invalid collection address');
});

test('place navigation never uses an arbitrary canonical URL', () => {
  const place = { kind: 'coffee_shop' as const, address: { slug: 'place', canonicalPath: '//other.invalid', revision: 1, isAlias: false }, name: 'Place' };
  expect(collectionPlacePath(place)).toBe('/coffee-shops/place');
  expect(collectionPlacePath({ ...place, kind: 'roaster' })).toBe('/roasters/place');
  expect(collectionPlacePath({ ...place, address: { ...place.address, slug: '..' } })).toBeNull();
});
