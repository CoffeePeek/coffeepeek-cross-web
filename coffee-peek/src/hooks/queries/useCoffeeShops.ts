import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCatalogScope } from '../../lib/catalogSession';
import { useUser } from '../../contexts/UserContext';
import {
  getCoffeeShopBySlug,
  searchCoffeeShops,
  type CoffeeShopFilters,
} from '../../api/coffeeshop';

/**
 * Query keys for coffee shop queries
 */
export const coffeeShopKeys = {
  all: ['coffeeShops'] as const,
  lists: () => [...coffeeShopKeys.all, 'list'] as const,
  list: (filters?: CoffeeShopFilters, page?: number, pageSize?: number) =>
    [...coffeeShopKeys.lists(), { filters, page, pageSize }] as const,
  details: () => [...coffeeShopKeys.all, 'detail'] as const,
  detail: (id: string) => [...coffeeShopKeys.details(), id] as const,
  search: (query?: string, filters?: CoffeeShopFilters, page?: number, pageSize?: number, minRating?: number) =>
    [...coffeeShopKeys.all, 'search', { query, filters, page, pageSize, minRating }] as const,
  byCity: (cityId: string, page?: number, pageSize?: number) =>
    [...coffeeShopKeys.all, 'city', cityId, { page, pageSize }] as const,
};

/**
 * Hook to fetch a single coffee shop by ID
 */
export function useCoffeeShop(shopId: string | null, enabled: boolean = true) {
  const { isLoading } = useUser();
  return useQuery({
    queryKey: [...coffeeShopKeys.detail(shopId!), getCatalogScope()],
    queryFn: async ({ signal }) => {
      if (!shopId) throw new Error('Shop ID is required');
      const response = await getCoffeeShopBySlug(shopId, signal);
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch coffee shop');
      }
      return response.data;
    },
    enabled: enabled && !!shopId && !isLoading,
  });
}

/**
 * Hook to search coffee shops
 */
export function useSearchCoffeeShops(
  searchQuery?: string,
  filters?: CoffeeShopFilters,
  page: number = 1,
  pageSize: number = 10,
  minRating?: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: coffeeShopKeys.search(searchQuery, filters, page, pageSize, minRating),
    queryFn: async () => {
      const response = await searchCoffeeShops(searchQuery, filters, page, pageSize, minRating);
      if (!response.success) {
        throw new Error(response.message || 'Failed to search coffee shops');
      }
      return response.data;
    },
    enabled: enabled && (!!searchQuery || !!filters),
  });
}

/**
 * Hook to invalidate coffee shop queries
 */
export function useInvalidateCoffeeShops() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: coffeeShopKeys.all }),
    invalidateList: () => queryClient.invalidateQueries({ queryKey: coffeeShopKeys.lists() }),
    invalidateDetail: (shopId: string) =>
      queryClient.invalidateQueries({ queryKey: coffeeShopKeys.detail(shopId) }),
  };
}

