import { useQuery } from '@tanstack/react-query';
import {
  getCities,
  getEquipments,
  getCoffeeBeans,
  getRoasters,
  getRoasterBySlug,
  getBrewMethods,
} from '../../api/coffeeshop';

/**
 * Query keys for catalog queries
 */
export const catalogKeys = {
  all: ['catalogs'] as const,
  cities: () => [...catalogKeys.all, 'cities'] as const,
  equipments: () => [...catalogKeys.all, 'equipments'] as const,
  coffeeBeans: () => [...catalogKeys.all, 'coffeeBeans'] as const,
  roasters: () => [...catalogKeys.all, 'roasters'] as const,
  roaster: (id: string) => [...catalogKeys.all, 'roaster', id] as const,
  brewMethods: () => [...catalogKeys.all, 'brewMethods'] as const,
};

/**
 * Hook to fetch cities
 */
export function useCities(enabled: boolean = true) {
  return useQuery({
    queryKey: catalogKeys.cities(),
    queryFn: async () => {
      const response = await getCities();
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch cities');
      }
      return response.data;
    },
    enabled,
    staleTime: Infinity, // Cities rarely change, cache forever
  });
}

/**
 * Hook to fetch equipments
 */
export function useEquipments(enabled: boolean = true) {
  return useQuery({
    queryKey: catalogKeys.equipments(),
    queryFn: async () => {
      const response = await getEquipments();
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch equipments');
      }
      return response.data;
    },
    enabled,
    staleTime: Infinity, // Equipments rarely change, cache forever
  });
}

/**
 * Hook to fetch coffee beans
 */
export function useCoffeeBeans(enabled: boolean = true) {
  return useQuery({
    queryKey: catalogKeys.coffeeBeans(),
    queryFn: async () => {
      const response = await getCoffeeBeans();
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch coffee beans');
      }
      return response.data;
    },
    enabled,
    staleTime: Infinity, // Coffee beans rarely change, cache forever
  });
}

/**
 * Hook to fetch roasters
 */
export function useRoasters(enabled: boolean = true) {
  return useQuery({
    queryKey: catalogKeys.roasters(),
    queryFn: async () => {
      const response = await getRoasters();
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch roasters');
      }
      return response.data;
    },
    enabled,
    staleTime: Infinity, // Roasters rarely change, cache forever
  });
}

/**
 * Hook to fetch a single roaster by ID
 */
export function useRoaster(roasterId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: catalogKeys.roaster(roasterId!),
    queryFn: async () => {
      if (!roasterId) throw new Error('Roaster ID is required');
      const response = await getRoasterBySlug(roasterId);
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch roaster');
      }
      return response.data;
    },
    enabled: enabled && !!roasterId,
  });
}

/**
 * Hook to fetch brew methods
 */
export function useBrewMethods(enabled: boolean = true) {
  return useQuery({
    queryKey: catalogKeys.brewMethods(),
    queryFn: async () => {
      const response = await getBrewMethods();
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch brew methods');
      }
      return response.data;
    },
    enabled,
    staleTime: Infinity, // Brew methods rarely change, cache forever
  });
}

