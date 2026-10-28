jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: { ADMIN: {
  OWNERSHIP_CLAIMS: '/api/admin/ownership-claims',
  OWNERSHIP_CLAIM: (id: string) => `/api/admin/ownership-claims/${encodeURIComponent(id)}`,
  OWNERSHIP_DECISION: (id: string, decision: string) => `/api/admin/ownership-claims/${encodeURIComponent(id)}/${decision}`,
  OWNERSHIP_CHANGES: '/api/admin/ownership-changes',
  SHOP_OWNER: (id: string) => `/api/admin/shops/${encodeURIComponent(id)}/owner`,
  ROASTER_OWNER: (id: string) => `/api/admin/roasters/${encodeURIComponent(id)}/owner`,
} } }));
import { httpClient } from '../src/api/core/httpClient';
import { getOwnershipClaims, getOwnershipClaim, getOwnershipChanges, reviewOwnershipClaim, assignBusinessOwner } from '../src/api/businessOwnership';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(httpClient.get).mockResolvedValue({ data: { items: [], totalCount: 41, page: 2, pageSize: 20 } } as never);
  jest.mocked(httpClient.post).mockResolvedValue({ data: { status: 'Approved', hasCurrentAccess: false } } as never);
  jest.mocked(httpClient.patch).mockResolvedValue({ data: {} } as never);
});
test('queue defaults to Pending and keeps the backend page envelope without invented totalPages', async () => {
  const page = await getOwnershipClaims({ page: 2 });
  expect(page).toEqual({ items: [], totalCount: 41, page: 2, pageSize: 20 });
  expect(httpClient.get).toHaveBeenCalledWith('/api/admin/ownership-claims', expect.objectContaining({
    cache: 'no-store', params: { status: 'Pending', page: 2, pageSize: 20 },
  }));
});
test('filters and cancellation reach the private queue and audit endpoints', async () => {
  const signal = new AbortController().signal;
  const filters = { businessType: 'Roaster' as const, businessId: 'roaster-id', page: 2, pageSize: 20 };
  await getOwnershipClaims({ ...filters, status: 'Rejected' }, signal);
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/admin/ownership-claims', { params: { ...filters, status: 'Rejected' }, signal, cache: 'no-store' });
  await getOwnershipChanges(filters, signal);
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/admin/ownership-changes', { params: filters, signal, cache: 'no-store' });
  await getOwnershipClaim('claim/a', signal);
  expect(httpClient.get).toHaveBeenLastCalledWith('/api/admin/ownership-claims/claim%2Fa', { signal, cache: 'no-store' });
});
test('approval sends an empty object for optional blank reason and never infers current access from status', async () => {
  const result = await reviewOwnershipClaim('claim', 'approve', '  ');
  expect(httpClient.post).toHaveBeenCalledWith('/api/admin/ownership-claims/claim/approve', {});
  expect(result.hasCurrentAccess).toBe(false);
});
test('rejection trims its reason and refuses missing or overlong reasons before sending', async () => {
  for (const reason of ['', '  ', 'x'.repeat(2001)]) await expect(reviewOwnershipClaim('claim', 'reject', reason)).rejects.toThrow();
  expect(httpClient.post).not.toHaveBeenCalled();
  await reviewOwnershipClaim('claim', 'reject', '  Недостаточно подтверждений  ');
  expect(httpClient.post).toHaveBeenCalledWith('/api/admin/ownership-claims/claim/reject', { reason: 'Недостаточно подтверждений' });
});
test.each(['CoffeeShop', 'Roaster'] as const)('%s manual assignment and revocation use the right endpoint and preserve server identity', async type => {
  const id = '11111111-1111-4111-8111-111111111111';
  const endpoint = `/api/admin/${type === 'CoffeeShop' ? 'shops' : 'roasters'}/business/owner`;
  await assignBusinessOwner(type, 'business', id, ' Подтверждено вручную ');
  expect(httpClient.patch).toHaveBeenLastCalledWith(endpoint, { ownerUserId: id, reason: 'Подтверждено вручную' });
  await assignBusinessOwner(type, 'business', null, 'Аккаунт удалён');
  expect(httpClient.patch).toHaveBeenLastCalledWith(endpoint, { ownerUserId: null, reason: 'Аккаунт удалён' });
});
test('invalid manual changes and failed envelopes cannot be reported as successful', async () => {
  await expect(assignBusinessOwner('Roaster', 'id', 'bad', 'reason')).rejects.toThrow();
  await expect(assignBusinessOwner('Roaster', 'id', null, '  ')).rejects.toThrow();
  expect(httpClient.patch).not.toHaveBeenCalled();
  jest.mocked(httpClient.post).mockResolvedValue({ isSuccess: false, message: 'Конфликт', data: null } as never);
  await expect(reviewOwnershipClaim('claim', 'approve', '')).rejects.toThrow('Конфликт');
});
