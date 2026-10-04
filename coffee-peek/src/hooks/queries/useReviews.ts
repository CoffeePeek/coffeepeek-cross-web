import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getReviewsByUserId,
  getReviewById,
  createReview,
  updateReview,
  type CreateReviewRequest,
  type UpdateReviewRequest,
} from '../../api/coffeeshop';

/**
 * Query keys for review queries
 */
export const reviewKeys = {
  all: ['reviews'] as const,
  lists: () => [...reviewKeys.all, 'list'] as const,
  list: (shopId: string, page?: number, pageSize?: number) =>
    [...reviewKeys.lists(), 'shop', shopId, { page, pageSize }] as const,
  byUser: (userId: string, page?: number, pageSize?: number) =>
    [...reviewKeys.lists(), 'user', userId, { page, pageSize }] as const,
  details: () => [...reviewKeys.all, 'detail'] as const,
  detail: (reviewId: string) => [...reviewKeys.details(), reviewId] as const,
};

/**
 * Hook to fetch reviews by user ID
 */
export function useUserReviews(
  userId: string | null,
  page: number = 1,
  pageSize: number = 10,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: reviewKeys.byUser(userId!, page, pageSize),
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      const response = await getReviewsByUserId(userId, page, pageSize);
      if (!response.success && response.isSuccess === false) {
        throw new Error(response.message || 'Не удалось загрузить отзывы');
      }
      return response.data;
    },
    enabled: enabled && !!userId,
  });
}

/**
 * Hook to fetch a single review by ID
 */
export function useReview(reviewId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: reviewKeys.detail(reviewId!),
    queryFn: async () => {
      if (!reviewId) throw new Error('Review ID is required');
      const response = await getReviewById(reviewId);
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch review');
      }
      return response.data;
    },
    enabled: enabled && !!reviewId,
  });
}

/**
 * Hook to create a review
 */
export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateReviewRequest) => {
      const response = await createReview(request);
      if (!response.success) {
        throw new Error(response.message || 'Failed to create review');
      }
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.list(variables.shop),
      });
      queryClient.invalidateQueries({
        queryKey: ['coffeeShops', 'detail', variables.shop],
      });
    },
  });
}

/**
 * Hook to update a review
 */
export function useUpdateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ moderationReviewId, request }: {
      moderationReviewId: string;
      request: UpdateReviewRequest;
    }) => {
      const response = await updateReview(moderationReviewId, request);
      if (!response.success) {
        throw new Error(response.message || 'Failed to update review');
      }
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['coffeeShops'] });
    },
  });
}

/**
 * Hook to invalidate review queries
 */
export function useInvalidateReviews() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: reviewKeys.all }),
    invalidateShopReviews: (shopId: string) =>
      queryClient.invalidateQueries({ queryKey: reviewKeys.list(shopId) }),
    invalidateUserReviews: (userId: string) =>
      queryClient.invalidateQueries({ queryKey: reviewKeys.byUser(userId) }),
    invalidateReview: (reviewId: string) =>
      queryClient.invalidateQueries({ queryKey: reviewKeys.detail(reviewId) }),
  };
}
