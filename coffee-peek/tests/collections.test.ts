jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn() } }));
jest.mock('../src/api/core/apiConfig', () => ({ API_GATEWAY_URL: 'https://api.example' }));
import { httpClient } from '../src/api/core/httpClient';
import { collectionCoverUrl, collectionId, collectionPlacePath, getCollection, getProfileCollection, orderCollectionPlaces, type CollectionPlace } from '../src/api/collections';

beforeEach(() => jest.clearAllMocks());
const id = '123456781234123412341234567890ab';

test('all shops precede roasters and each group keeps its chosen order', () => {
  const input = [
    { kind: 'roaster', name: 'Roaster one' }, { kind: 'coffee_shop', name: 'Shop one' },
    { kind: 'roaster', name: 'Roaster two' }, { kind: 'coffee_shop', name: 'Shop two' },
  ] as CollectionPlace[];
  expect(orderCollectionPlaces(input).map(place => place.name)).toEqual(['Shop one', 'Shop two', 'Roaster one', 'Roaster two']);
  expect(input[0].name).toBe('Roaster one');
});

test('normalizes supported IDs and rejects paths and malformed UUIDs', () => {
  expect(collectionId('12345678-1234-1234-1234-1234567890AB')).toBe(id);
  for (const invalid of ['', '../secret', `${id}/x`, `-${id}`, id.slice(1)]) expect(() => collectionId(invalid)).toThrow();
});

test('anonymous reads do not attach viewer credentials and preserve cancellation', async () => {
  const signal = new AbortController().signal;
  const data = { id, title: 'Places', canonicalPath: `/collections/${id}`, items: [], createdAtUtc: '' };
  jest.mocked(httpClient.get).mockResolvedValueOnce({ data } as never);
  expect(await getCollection(id, signal)).toEqual(data);
  expect(httpClient.get).toHaveBeenCalledWith(`/api/v1/favorite-collections/${id}`, { signal, requiresAuth: false, skipAuthHeader: true, credentials: 'omit' });
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

test('public collection reads reject private library data even if the server returned it', async () => {
  for (const visibility of ['private', undefined, 'Private']) {
    jest.mocked(httpClient.get).mockResolvedValueOnce({ data: {
      id, mode: 'list', visibility, canonicalPath: `/collections/${id}`, items: [],
    } } as never);
    await expect(getCollection(id)).rejects.toThrow('Collection unavailable');
  }
});

test('profile collection is optional and never substitutes global favorites or private lists', async () => {
  for (const data of [null, { mode: 'list', visibility: 'private' }, { mode: 'snapshot', visibility: 'public' }]) {
    jest.mocked(httpClient.get).mockResolvedValueOnce({ data } as never);
    expect(await getProfileCollection('author /')).toBeNull();
  }
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/v1/profiles/author%20%2F/collection', { requiresAuth: false, signal: undefined });
});

test('featured collection preserves metadata and validates its canonical address', async () => {
  const data = { id, mode: 'list', visibility: 'public', title: 'Places', description: 'My places',
    canonicalPath: `/collections/${id}`, items: [], createdAtUtc: '' };
  jest.mocked(httpClient.get).mockResolvedValueOnce({ data } as never);
  expect(await getProfileCollection('author')).toEqual(data);
  jest.mocked(httpClient.get).mockResolvedValueOnce({ data: { ...data, canonicalPath: '//other.invalid' } } as never);
  await expect(getProfileCollection('author')).rejects.toThrow('Invalid collection address');
});

test('collection covers accept only HTTPS addresses without embedded credentials', () => {
  expect(collectionCoverUrl({ fullUrl: 'https://media.example/cover.jpg' })).toBe('https://media.example/cover.jpg');
  for (const fullUrl of ['javascript:bad()', 'data:image/svg+xml,x', 'http://media.example/x', 'https://user:pass@media.example/x']) {
    expect(collectionCoverUrl({ fullUrl })).toBeNull();
  }
});

test('saved covers resolve only the public stream on the configured API origin', () => {
  const url = `/api/v1/favorite-collections/${id}/cover/photo`;
  expect(collectionCoverUrl({ id: 'photo', url })).toBe(`https://api.example${url}`);
  for (const invalid of [url.replace('favorite-collections', 'saved-collections'), `https://other.invalid${url}`]) {
    expect(collectionCoverUrl({ id: 'photo', url: invalid })).toBeNull();
  }
});
