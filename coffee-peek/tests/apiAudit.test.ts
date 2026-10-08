jest.mock('../src/utils/errorHandler', () => ({ getErrorMessageByStatus: () => 'Error' }));
jest.mock('../src/utils/logger', () => ({ logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() } }));
jest.mock('../src/api/core/httpClient', () => ({
  httpClient: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
  TokenManager: {},
}));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: {
  USER: { EMAIL_CONFIRMATION: '/api/users/me/email-confirmation' },
  CHECK_IN: { BASE: '/api/v1/check-ins', BY_ID: (id: string) => `/api/v1/check-ins/${id}` },
} }));

import { httpClient } from '../src/api/core/httpClient';
import { confirmEmail } from '../src/api/auth';
import { getCheckInById, createCheckIn, updateCheckIn } from '../src/api/coffeeshop';
import { putPhotoToStorage } from '../src/api/photos';

beforeEach(() => jest.clearAllMocks());

test('email confirmation uses the anonymous PUT contract, preserving the token', async () => {
  await confirmEmail('token+with/special=characters');
  expect(httpClient.put).toHaveBeenCalledWith('/api/users/me/email-confirmation', undefined, {
    params: { token: 'token+with/special=characters' }, requiresAuth: false,
  });
});

test('avatar storage PUT repeats both signed headers', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
  try {
    const file = { name: 'avatar.png', type: 'image/png' } as File;
    await putPhotoToStorage('https://storage.example/avatar', file);
    expect(fetchMock).toHaveBeenCalledWith('https://storage.example/avatar', {
      method: 'PUT', body: file,
      headers: { 'Content-Type': 'image/png', 'x-amz-tagging': 'is_permanent=False' },
    });
  } finally {
    fetchMock.mockRestore();
  }
});
