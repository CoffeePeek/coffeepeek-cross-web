import { httpClient } from './core/httpClient';
import { API_ENDPOINTS } from './core/apiConfig';
import { ApiResponse } from './core/types';

export interface PublicUserProfile {
  userName: string;
  nickname?: string;
  avatarUrl?: string;
  about?: string;
  createdAtUtc?: string;
  reviewCount?: number;
  checkInCount?: number;
}

export function getUserPublicProfile(
  userId: string
): Promise<ApiResponse<PublicUserProfile>> {
  return httpClient.get<PublicUserProfile>(API_ENDPOINTS.ADMIN.USER_PROFILE(userId));
}
