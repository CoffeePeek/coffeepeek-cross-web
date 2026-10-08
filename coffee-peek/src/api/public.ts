import { httpClient } from './core/httpClient';
import { API_ENDPOINTS } from './core/apiConfig';
import type { ApiResponse } from './core/types';

export interface PublicStats {
  totalCoffeeShops: number;
  totalCheckIns: number;
  averageRating: number;
}

export async function getPublicStats(): Promise<ApiResponse<PublicStats>> {
  return httpClient.get<PublicStats>(API_ENDPOINTS.PUBLIC.STATS, {
    requiresAuth: false,
  });
}
