import { getBySlug, type PublicAddress } from './publicAddresses';
import { httpClient } from './core/httpClient';
import { normalizePublicDto } from './core/interceptors';
/**
 * API модуль для работы с публичными профилями пользователей
 */


import type { ApiResponse } from './core/types';
import { logger } from '../utils/logger';

// ==================== Types ====================

export interface PublicUserProfile {
  id: string;
  canonicalPath?: string;
  addedShopsCount?: number;
  userName: string;
  nickname?: string;
  avatarUrl?: string;
  about?: string;
  createdAtUtc?: string;
  checkInCount?: number;
  addedRoastersCount?: number;
  followersCount?: number;
  isFollowing?: boolean;
  isBlockedByViewer?: boolean;
  authorId?: string;
}

// ==================== API Functions ====================

/**
 * Получает публичный профиль пользователя по ID
 */
export async function getUserPublicProfile(
  userId: string
): Promise<ApiResponse<PublicUserProfile | null>> {
  try {
    const envelope = await getBySlug<PublicUserProfile>('users', userId);
    const userData = normalizePublicDto({ ...envelope.data, address: envelope.address });

    if (!userData || !userData.userName) {
      logger.warn(`[getUserPublicProfile] Empty or invalid user data in response`);
      return {
        success: false,
        message: "Invalid user data",
        data: null,
      };
    }

    return {
      success: true,
      message: "User profile loaded successfully",
      data: {
        id: envelope.address.slug,
        canonicalPath: envelope.address.canonicalPath,
        userName: userData.userName,
        nickname: userData.nickname,
        avatarUrl: userData.avatarUrl,
        about: userData.about,
        createdAtUtc: userData.createdAtUtc,
        addedShopsCount: userData.addedShopsCount,
        checkInCount: userData.checkInCount,
        addedRoastersCount: userData.addedRoastersCount,
        followersCount: userData.followersCount,
        isFollowing: userData.isFollowing,
        isBlockedByViewer: userData.isBlockedByViewer,
        authorId: userData.authorId,
      },
    };
  } catch (error: any) {
    logger.error("[getUserPublicProfile] Exception:", error);
    
    return {
      success: false,
      message: error.message || "Unknown error",
      data: null,
    };
  }
}

export interface ProfileFollowState {
  isFollowing: boolean;
  followersCount: number;
}

export interface ProfileConnection {
  userName: string;
  avatarUrl?: string | null;
  address: PublicAddress;
}

export interface ProfileConnectionsPage {
  items: ProfileConnection[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export type ProfileConnectionKind = 'followers' | 'following';

export interface ProfileFavorite {
  kind: 'coffee_shop' | 'roaster' | 'drink';
  name?: string | null;
  address?: PublicAddress | null;
  drink?: { slug: string } | null;
  coverPhoto?: { fullUrl?: string; urls?: { card?: string } } | null;
  createdAtUtc: string;
}

export interface ProfileActivity {
  year: number;
  month: number;
  timeZone: string;
  activeDays: number;
  totalCheckIns: number;
  days: { date: string; checkInCount: number }[];
}

export function setProfileFollowing(slug: string, following: boolean): Promise<ProfileFollowState> {
  const endpoint = `/api/Users/${encodeURIComponent(slug)}/follow`;
  return following ? httpClient.putRaw(endpoint) : httpClient.deleteRaw(endpoint);
}

export function getProfileConnections(slug: string, kind: ProfileConnectionKind, page: number, signal?: AbortSignal) {
  return httpClient.getRaw<ProfileConnectionsPage>(`/api/Users/${encodeURIComponent(slug)}/${kind}`, {
    params: { page, pageSize: 20 }, signal,
  });
}

export async function getProfileFavorites(slug: string, signal?: AbortSignal) {
  return (await httpClient.get<ProfileFavorite[]>(`/api/v1/profiles/${encodeURIComponent(slug)}/favorites`, {
    requiresAuth: false, signal,
  })).data;
}

export async function getProfileActivity(slug: string, month: string, signal?: AbortSignal) {
  const [year, monthNumber] = month.split('-').map(Number);
  return (await httpClient.get<ProfileActivity>(`/api/v1/profiles/${encodeURIComponent(slug)}/activity`, {
    params: { year, month: monthNumber, timeZone: 'Europe/Minsk' }, requiresAuth: false, signal,
  })).data;
}
