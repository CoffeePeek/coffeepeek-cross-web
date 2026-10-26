import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCatalogScope } from '../../lib/catalogSession';
import { useUser } from '../../contexts/UserContext';
import {
  getCoffeeShopBySlug,
  type CoffeeShopFilters,
} from '../../api/coffeeshop';
import { searchShops } from '../../api/discovery';

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
  search: (query: string, page: number, pageSize: number) =>
    [...coffeeShopKeys.all, 'search', { query, page, pageSize }] as const,
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
  searchQuery: string,
  page: number = 1,
  pageSize: number = 10,
  enabled: boolean = true
) {
  const q = searchQuery.trim();
  return useQuery({
    queryKey: [...coffeeShopKeys.search(q, page, pageSize), getCatalogScope()],
    queryFn: ({ signal }) => searchShops({ q, filters: {}, sort: q ? 'relevance' : 'name_asc', page, pageSize }, signal),
    enabled: enabled && !!q,
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

