import { getBySlug } from './publicAddresses';
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
