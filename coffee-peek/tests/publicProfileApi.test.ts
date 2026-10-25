jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn(), getRaw: jest.fn(), putRaw: jest.fn(), deleteRaw: jest.fn() } }));
jest.mock('../src/api/core/interceptors', () => ({ normalizePublicDto: (value: unknown) => value }));
jest.mock('../src/utils/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));
import { httpClient } from '../src/api/core/httpClient';
import { getProfileActivity, getProfileConnections, getProfileFavorites, getUserPublicProfile, setProfileFollowing } from '../src/api/user';

beforeEach(() => jest.clearAllMocks());

test('public profile preserves server statistics, canonical identity and viewer state', async () => {
  const address = { slug: 'maria', canonicalPath: '/users/maria', revision: 2, isAlias: true };
  const data = { userName: 'Maria', checkInCount: 10, addedShopsCount: 6, addedRoastersCount: 1, followersCount: 2, isFollowing: true, authorId: 'author', isBlockedByViewer: true };
  jest.mocked(httpClient.getRaw).mockResolvedValue({ data, address });
  expect((await getUserPublicProfile('old-name')).data).toMatchObject({ ...data, id: 'maria', canonicalPath: '/users/maria' });
});

test('follow and unfollow encode the viewed slug and read the direct social response', async () => {
  const result = { isFollowing: true, followersCount: 3 };
  jest.mocked(httpClient.putRaw).mockResolvedValue(result);
  expect(await setProfileFollowing('user /?', true)).toEqual(result);
  expect(httpClient.putRaw).toHaveBeenCalledWith('/api/Users/user%20%2F%3F/follow');
  await setProfileFollowing('user /?', false);
  expect(httpClient.deleteRaw).toHaveBeenCalledWith('/api/Users/user%20%2F%3F/follow');
});

test('connections send page parameters and preserve cancellation', async () => {
  const signal = new AbortController().signal;
  await getProfileConnections('maria', 'following', 2, signal);
  expect(httpClient.getRaw).toHaveBeenCalledWith('/api/Users/maria/following', { params: { page: 2, pageSize: 20 }, signal });
});

test('activity and favorites belong to the viewed author and use public endpoints', async () => {
  jest.mocked(httpClient.get).mockResolvedValue({ data: [] } as never);
  const signal = new AbortController().signal;
  await getProfileFavorites('author /', signal);
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/v1/profiles/author%20%2F/favorites', { requiresAuth: false, signal });
  await getProfileActivity('author /', '2027-01', signal);
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/v1/profiles/author%20%2F/activity', { params: { year: 2027, month: 1, timeZone: 'Europe/Minsk' }, requiresAuth: false, signal });
});
