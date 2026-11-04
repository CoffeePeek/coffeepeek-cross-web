jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn() } }));
jest.mock('../src/api/core/apiConfig', () => ({ API_GATEWAY_URL: 'https://api.example' }));
import { httpClient } from '../src/api/core/httpClient';
import { getProfileShelf, publicShelfPhotoUrl, safeCoffeeSlug } from '../src/api/profileShelf';

const bag = '11111111-1111-4111-8111-111111111111';
const photo = '22222222-2222-4222-8222-222222222222';
const path = `/api/v1/profiles/author/shelf/bags/${bag}/photos/${photo}`;
beforeEach(() => jest.clearAllMocks());

test('hidden shelf remains null and does not fall back to a private shelf endpoint', async () => {
  jest.mocked(httpClient.get).mockResolvedValueOnce({ data: null } as never);
  const signal = new AbortController().signal;
  expect(await getProfileShelf('author /', signal)).toBeNull();
  expect(httpClient.get).toHaveBeenCalledTimes(1);
  expect(httpClient.get).toHaveBeenCalledWith('/api/v1/profiles/author%20%2F/shelf', { requiresAuth: false, signal, cache: 'no-store' });
});

test('public shelf preserves order and only returns explicit public card fields', async () => {
  jest.mocked(httpClient.get).mockResolvedValueOnce({ data: { totalCount: 2, items: [
    { id: bag, name: 'First', roasterName: 'Roaster', coffeeSlug: 'bean', photoUrl: path, ownerId: 'private', weightGrams: 250 },
    { id: photo, name: '', photoUrl: '/api/v1/shelf/bags/private/photos/photo' },
  ] } } as never);
  expect(await getProfileShelf('author')).toEqual({ totalCount: 2, items: [
    { id: bag, name: 'First', roasterName: 'Roaster', coffeeSlug: 'bean', photoUrl: `https://api.example${path}` },
    { id: photo, name: '', roasterName: null, coffeeSlug: null, photoUrl: null },
  ] });
});

test.each([undefined, {}, { items: [], totalCount: 1 }, { items: [{ id: bag }], totalCount: 1 }])('malformed shelf fails closed: %j', async data => {
  jest.mocked(httpClient.get).mockResolvedValueOnce({ data } as never);
  await expect(getProfileShelf('author')).rejects.toThrow();
});

test('public photos use only the exact current profile and bag path on the API origin', () => {
  expect(publicShelfPhotoUrl('author', bag, path)).toBe(`https://api.example${path}`);
  for (const value of [path.replace(bag, photo), path.replace('author', 'other'), `${path}?token=private`, `${path}#x`,
    `https://evil.example${path}`, `https://user:secret@api.example${path}`, path.replace('/profiles/author/shelf', '/shelf'),
    'data:image/svg+xml,bad', `http://api.example${path}`, `${path}/extra`]) {
    expect(publicShelfPhotoUrl('author', bag, value)).toBeNull();
  }
});

test('coffee destinations use only a safe slug', () => {
  expect(safeCoffeeSlug('my-coffee')).toBe('my-coffee');
  for (const value of [null, '', ' ', '..', '../private', 'bad\\path', 'bad\u0000']) expect(safeCoffeeSlug(value)).toBeNull();
});

test('request failures and cancellation propagate without returning cached public cards', async () => {
  const cancelled = new DOMException('Cancelled', 'AbortError');
  jest.mocked(httpClient.get).mockRejectedValueOnce(cancelled);
  await expect(getProfileShelf('author')).rejects.toBe(cancelled);
});
