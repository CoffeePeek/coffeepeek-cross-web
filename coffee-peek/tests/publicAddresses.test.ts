jest.mock('../src/api/core/httpClient', () => ({ httpClient: { getRaw: jest.fn() } }));
import { httpClient } from '../src/api/core/httpClient';
import { getBySlug } from '../src/api/publicAddresses';
const getRaw = httpClient.getRaw as jest.Mock;
const address = { slug: 'coffee', canonicalPath: '/coffee-shops/coffee', revision: 2, isAlias: true };
beforeEach(() => getRaw.mockReset());
test.each(['shops', 'roasters'] as const)('%s details have data.address and no extra envelope', async kind => {
  getRaw.mockResolvedValue({ isSuccess: true, message: null, data: { name: 'Coffee', address } });
  expect(await getBySlug(kind, 'old')).toEqual({ data: { name: 'Coffee', address }, address });
  expect(getRaw).toHaveBeenCalledTimes(1);
});
test.each(['cities', 'zones'] as const)('%s is an unwrapped DTO', async kind => {
  getRaw.mockResolvedValue({ name: 'Coffee', address });
  expect(await getBySlug(kind, 'coffee')).toEqual({ data: { name: 'Coffee', address }, address });
});
test('user has a separate address and slug path is encoded', async () => {
  getRaw.mockResolvedValue({ data: { userName: 'Petr' }, address });
  expect((await getBySlug('users', 'кофе /?')).address).toEqual(address);
  expect(getRaw).toHaveBeenCalledWith(`/api/Users/by-slug/${encodeURIComponent('кофе /?')}`, { signal: undefined });
});
test('missing mandatory address is an error, never a GUID fallback', async () => {
  getRaw.mockResolvedValue({ isSuccess: true, data: { name: 'Coffee' } });
  await expect(getBySlug('shops', 'coffee')).rejects.toThrow('Public address unavailable');
  expect(getRaw).toHaveBeenCalledTimes(1);
});
