/**
 * API модуль для отправки кофеен и отзывов
 */

import { httpClient } from './core/httpClient';
import { API_ENDPOINTS } from './core/apiConfig';
import type { ApiResponse } from './core/types';
import type { SendShopSuccessResponse } from './core/apiError';
import {
  localTimeToUtc,
  uiDayToDotNetName,
} from '../utils/shopUtils';

// ==================== Types ====================

export interface ModerationShopPhoto {
  fileName: string;
  contentType: string;
  storageKey: string;
  size: number;
}

/**
 * Интервал работы кофейни (соответствует ShopScheduleIntervalDto на бэкенде)
 */
export interface ShopScheduleIntervalDto {
  openTime: string; // TimeSpan в формате "HH:mm:ss" или "HH:mm"
  closeTime: string; // TimeSpan в формате "HH:mm:ss" или "HH:mm"
}

/**
 * Расписание работы кофейни (соответствует ScheduleDto на бэкенде)
 */
export interface ScheduleDto {
  // Outbound requests use names; responses may still contain legacy enum numbers.
  dayOfWeek: number | string;
  isClosed: boolean;
  intervals: ShopScheduleIntervalDto[] | null;
}

/**
 * Контакты кофейни (соответствует ShopContactDto на бэкенде)
 */
export interface ShopContactDto {
  instagramLink?: string | null;
  email?: string | null;
  siteLink?: string | null;
  phoneNumber?: string | null;
}

/**
 * Упрощенный формат расписания для работы на фронтенде
 */
export interface FrontendSchedule {
  dayOfWeek: number;
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm"
}

/**
 * Упрощенный формат контактов для работы на фронтенде
 */
export interface FrontendShopContact {
  phone?: string;
  email?: string;
  website?: string;
  instagram?: string;
}

export interface SendCoffeeShopToModerationRequest {
  name: string;
  notValidatedAddress: string;
  description?: string;
  priceRange?: number;
  cityId?: string;
  shopContact?: {
    phone?: string;
    email?: string;
    website?: string;
    instagram?: string;
  };
  schedules?: FrontendSchedule[];
  equipmentIds?: string[];
  coffeeBeanIds?: string[];
  roasterIds?: string[];
  brewMethodIds?: string[];
  shopPhotos?: Array<{
    fileName: string;
    contentType: string;
    storageKey: string;
    size: number;
  }>;
  menuPhotos?: Array<{
    fileName: string;
    contentType: string;
    storageKey: string;
    size: number;
  }>;
}

export interface SendRoasterToModerationRequest {
  name: string;
  about?: string;
  cityId?: string;
  address?: string;
  instagramLink?: string;
  siteLink?: string;
  photos?: ModerationShopPhoto[];
}

export interface SendRoasterModerationResult {
  roasterId: string;
  status: string;
  isAddressValidated: boolean;
}

// ==================== Transformation Functions ====================

/**
 * Преобразует время из формата "HH:mm" в формат "HH:mm:ss" для TimeSpan
 */
function formatTimeForTimeSpan(time: string): string {
  if (time.includes(':')) {
    const parts = time.split(':');
    if (parts.length === 2) {
      return `${time}:00`;
    }
  }
  return time;
}

/**
 * Преобразует расписание из фронтенд формата в бэкенд формат
 */
export function transformSchedulesToBackend(
  schedules: FrontendSchedule[]
): ScheduleDto[] {
  return schedules.map(schedule => {
    const open = localTimeToUtc(schedule.dayOfWeek, schedule.openTime);
    const close = localTimeToUtc(schedule.dayOfWeek, schedule.closeTime);
    return {
      dayOfWeek: uiDayToDotNetName(open.dayOfWeek),
      isClosed: false,
      intervals: [
        {
          openTime: formatTimeForTimeSpan(open.time),
          closeTime: formatTimeForTimeSpan(close.time),
        },
      ],
    };
  });
}

/**
 * Преобразует контакты из фронтенд формата в бэкенд формат
 */
export function transformContactToBackend(
  contact: FrontendShopContact | undefined
): ShopContactDto | undefined {
  if (!contact) return undefined;
  
  const hasAnyValue = contact.phone || contact.email || contact.website || contact.instagram;
  if (!hasAnyValue) return undefined;

  return {
    phoneNumber: contact.phone || null,
    email: contact.email || null,
    siteLink: contact.website || null,
    instagramLink: contact.instagram || null,
  };
}

export interface SendShopModerationResult {
  shopId: string;
  status: string;
  isAddressValidated: boolean;
}

/**
 * Отправляет кофейню на модерацию.
 * Успех: HTTP 201 + isSuccess: true
 */
export async function sendCoffeeShopToModeration(
  shopData: SendCoffeeShopToModerationRequest,
  shopPhotos?: SendCoffeeShopToModerationRequest['shopPhotos'],
  menuPhotos?: SendCoffeeShopToModerationRequest['menuPhotos']
): Promise<ApiResponse<SendShopModerationResult>> {
  const backendData: Record<string, unknown> = {
    name: shopData.name,
    address: shopData.notValidatedAddress,
    description: shopData.description,
    priceRange: shopData.priceRange,
    city: shopData.cityId,
    shopContact: shopData.shopContact
      ? transformContactToBackend(shopData.shopContact)
      : undefined,
    schedules: shopData.schedules
      ? transformSchedulesToBackend(shopData.schedules)
      : undefined,
    equipments: shopData.equipmentIds,
    beans: shopData.coffeeBeanIds,
    roasters: shopData.roasterIds,
    brewMethods: shopData.brewMethodIds,
    shopPhotos: shopPhotos ?? shopData.shopPhotos,
    menuPhotos: menuPhotos ?? shopData.menuPhotos,
  };

  const response = await httpClient.post<SendShopSuccessResponse['data']>(
    API_ENDPOINTS.MODERATION.SHOP,
    backendData,
    { requiresAuth: false }
  );

  return response;
}

/**
 * Отправляет обжарщика на модерацию.
 * Успех: HTTP 201 + isSuccess: true
 */
export async function sendRoasterToModeration(
  roasterData: SendRoasterToModerationRequest
): Promise<ApiResponse<SendRoasterModerationResult>> {
  const hasLocation = Boolean(roasterData.address && roasterData.cityId);

  return httpClient.post<SendRoasterModerationResult>(
    API_ENDPOINTS.MODERATION.ROASTER,
    {
      name: roasterData.name,
      about: roasterData.about || undefined,
      city: roasterData.cityId || null,
      address: hasLocation ? roasterData.address : undefined,
      instagramLink: roasterData.instagramLink || undefined,
      siteLink: roasterData.siteLink || undefined,
      photos: roasterData.photos,
    },
    { requiresAuth: false }
  );
}
