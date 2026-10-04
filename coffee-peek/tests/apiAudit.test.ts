jest.mock('../src/utils/errorHandler', () => ({ getErrorMessageByStatus: () => 'Error' }));
jest.mock('../src/utils/logger', () => ({ logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() } }));
jest.mock('../src/api/core/httpClient', () => ({
  httpClient: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
  TokenManager: {},
}));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: {
  USER: { EMAIL_CONFIRMATION: '/api/users/me/email-confirmation' },
  REVIEW: { BY_ID: (id: string) => `/api/CoffeeShopReviews/${id}` },
  MODERATION: { REVIEWS: '/api/ModerationReviews', REVIEW_UPDATE: (id: string) => `/api/ModerationReviews/${id}` },
} }));

import { httpClient } from '../src/api/core/httpClient';
import { confirmEmail } from '../src/api/auth';
import { getReviewById, createReview, updateReview } from '../src/api/coffeeshop';
import { putPhotoToStorage } from '../src/api/photos';

beforeEach(() => jest.clearAllMocks());

test('email confirmation uses the anonymous PUT contract, preserving the token', async () => {
  await confirmEmail('token+with/special=characters');
  expect(httpClient.put).toHaveBeenCalledWith('/api/users/me/email-confirmation', undefined, {
    params: { token: 'token+with/special=characters' }, requiresAuth: false,
  });
});

test('editing reads the published ID and updates its distinct moderation source with nested ratings', async () => {
  jest.mocked(httpClient.get).mockResolvedValue({ success: true, data: {
    id: 'published-id', moderationReviewId: 'moderation-id', comment: 'Old',
    rating: { coffee: 3, service: 4, place: 5 },
  } } as never);
  const { data: review } = await getReviewById('published-id');
  expect(httpClient.get).toHaveBeenCalledWith('/api/CoffeeShopReviews/published-id', { requiresAuth: true });
  expect(review).toMatchObject({ moderationReviewId: 'moderation-id', ratingCoffee: 3, ratingPlace: 5 });
  const changes = { comment: 'Updated', rating: { coffee: 5, service: 4, place: 3 }, photos: [] };
  await updateReview(review.moderationReviewId!, changes);
  expect(httpClient.put).toHaveBeenCalledWith('/api/ModerationReviews/moderation-id', changes, { requiresAuth: true });
  expect(jest.mocked(httpClient.put).mock.calls[0][1]).not.toHaveProperty('id');
  expect(jest.mocked(httpClient.put).mock.calls[0][1]).not.toHaveProperty('visitedAt');
});

test('review creation returns the submission ID rather than a published review', async () => {
  jest.mocked(httpClient.post).mockResolvedValue({ success: true, data: { entityId: 'submission-id' } } as never);
  const response = await createReview({ shop: 'coffee-slug', comment: 'Great', ratingCoffee: 5, ratingService: 4, ratingPlace: 5 });
  expect(response.data).toEqual({ entityId: 'submission-id' });
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
