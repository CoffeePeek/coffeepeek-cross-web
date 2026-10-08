import type { SavedDrink } from './consumedDrinks';
import type { PublicAddress } from './publicAddresses';
/**
 * API модуль для работы с кофейнями
 */

import { httpClient } from './core/httpClient';
import { API_ENDPOINTS } from './core/apiConfig';
import type { ApiResponse } from './core/types';
import { logger } from '../utils/logger';
import { normalizeCheckInDto } from './core/checkInNormalize';
import type { ShopMenuDto } from './menu';
import { queryClient } from '../lib/queryClient';

// ==================== UI models ====================
// Public entity id/cityId and filter *Ids fields contain server-provided slugs.
// publicAddress keeps the canonical metadata; photo/check-in IDs stay service IDs.

// imgproxy variants; without the proxy configured all four equal fullUrl.
export interface PhotoUrlsDto {
  thumbnail: string; // 240×180, cropped
  card: string; // 600×450, cropped
  detail: string; // ≤1200 longest side, fitted
  fullscreen: string; // ≤1920 longest side, fitted
}

export type PhotoVariant = keyof PhotoUrlsDto;

// DTO для фотографий
export interface ShortPhotoMetadataDto {
  id?: string;
  fileName: string;
  storageKey: string;
  fullUrl: string | null;
  urls?: PhotoUrlsDto | null;
  sortIndex?: number;
}

export interface PhotoMetadataDto {
  id?: string;
  fileName: string;
  contentType: string;
  storageKey: string;
  fullUrl: string | null;
  urls?: PhotoUrlsDto | null;
  sizeBytes: number;
  ownerId: string;
  uploadedAt: string; // ISO date string
  sortIndex?: number;
}

/**
 * URL нужного размера; фолбэк на fullUrl для DTO без urls (аватары, обжарщики, старые ответы).
 */
export function getPhotoUrl(
  photo: { fullUrl?: string | null; urls?: PhotoUrlsDto | null },
  variant: PhotoVariant,
): string {
  // The media service only returns photos via ready-to-use URLs (presigned/CDN);
  // there is no GET-photo-by-storageKey endpoint to fall back to.
  const url = photo.urls?.[variant] || photo.fullUrl;
  if (url) {
    return url;
  }

  logger.warn('[getPhotoUrl] Missing fullUrl for photo:', photo);
  return '';
}

export interface CoffeeShop {
  isFavorite?: boolean | null;
  publicAddress?: PublicAddress;
  canonicalPath?: string;
  id: string;
  name: string;
  address?: string;
  description?: string;
  priceRange?: number | string;
  cityId?: string;
  cityName?: string;
  shopContact?: {
    phone?: string;
    email?: string;
    website?: string;
    instagram?: string;
  };
  schedules?: Array<{
    dayOfWeek: number;
    openTime?: string;
    closeTime?: string;
  }>;
  equipmentIds?: string[];
  coffeeBeanIds?: string[];
  roasterIds?: string[];
  brewMethodIds?: string[];
  equipments?: Equipment[];
  photos?: ShortPhotoMetadataDto[];
  shopPhotos?: string[];
  rating?: number;
  checkInCount?: number;
  isOpen?: boolean;
  isVisited?: boolean;
  isNew?: boolean;
  type?: string;
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  latitude?: number;
  longitude?: number;
  title?: string;
}

export type CoffeeShopType = 'Specialty' | 'CoffeeBar' | 'Cafe';

export interface MapShop {
  publicAddress?: PublicAddress;
  canonicalPath?: string;
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  type: CoffeeShopType | number | null;
  primaryZoneId: string | null;
}

export interface MapCluster {
  id: string | null;
  latitude: number;
  longitude: number;
  count: number;
  bounds: {
    minLatitude: number;
    minLongitude: number;
    maxLatitude: number;
    maxLongitude: number;
  };
}

export interface MapCoffeeZone {
  publicAddress?: PublicAddress;
  canonicalPath?: string;
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  shopCount: number;
  polygon?: { latitude: number; longitude: number }[];
}

export interface MapSearchData {
  shops: MapShop[];
  clusters: MapCluster[];
  zones: MapCoffeeZone[];
  isTruncated?: boolean;
}

export interface MapViewportBounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export interface ShopTagDto {
  id: string;
  slug: string;
  name: string;
  description?: string;
  sortOrder: number;
}

export interface DetailedCoffeeShop {
  isFavorite?: boolean | null;
  publicAddress?: PublicAddress;
  canonicalPath?: string;
  id: string;
  cityId: string;
  name: string;
  description?: string;
  photos?: PhotoMetadataDto[];
  imageUrls?: string[];
  rating: number;
  checkInCount: number;
  checkIns?: CheckInDto[];
  userCheckIns?: CheckInDto[];
  isOpen: boolean;
  isVisited?: boolean;
  isNew?: boolean;
  priceRange: number | string;
  tags?: ShopTagDto[];
  type?: string;
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  beans?: Array<{ id: string; name: string }>;
  roasters?: Array<{ id: string; publicAddress?: PublicAddress; name: string; photoUrl?: string | null; coverPhoto?: ShortPhotoMetadataDto | null }>;
  equipments?: Equipment[];
  brewMethods?: Array<{ id: string; name: string }> | null;
  shopContact?: {
    phone?: string;
    email?: string;
    website?: string;
    instagram?: string;
  } | null;
  schedules?: Array<{
    dayOfWeek: number;
    openTime?: string;
    closeTime?: string;
  }>;
  menu?: ShopMenuDto | null;
}

export interface CoffeeShopFilters {
  cityId?: string;
  equipmentIds?: string[];
  coffeeBeanIds?: string[];
  roasterIds?: string[];
  brewMethodIds?: string[];
  priceRange?: string;
  /** Catalog tag slugs — AND semantics on the backend */
  tagIds?: string[];
  isOpen?: boolean;
  coffeeFocus?: string;
  isNew?: boolean;
  /** Only honored when JWT is present */
  isVisited?: boolean;
}

/** Query value for `type` — matches CoffeeShopType JSON names. */
const SHOP_TYPE_QUERY: Record<string, string> = {
  specialty: 'Specialty',
  coffee_bar: 'CoffeeBar',
  cafe: 'Cafe',
  Specialty: 'Specialty',
  CoffeeBar: 'CoffeeBar',
  Cafe: 'Cafe',
};

export interface ShortShopDto {
  publicAddress?: PublicAddress;
  canonicalPath?: string;
  id: string;
  cityId: string;
  name: string;
  photos: ShortPhotoMetadataDto[];
  rating: number;
  checkInCount: number;
  isVisited: boolean;
  isNew: boolean;
  isOpen: boolean;
  priceRange: number | string;
  tags?: ShopTagDto[];
  type?: string;
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  beans?: Array<{ id: string; name: string }>;
  roasters?: Array<{ id: string; publicAddress?: PublicAddress; name: string; photoUrl?: string | null; coverPhoto?: ShortPhotoMetadataDto | null }>;
  equipments?: Equipment[];
  brewMethods?: Array<{ id: string; name: string }>;
  shopContact?: {
    phone?: string;
    email?: string;
    website?: string;
    instagram?: string;
  };
  schedules?: Array<{
    dayOfWeek: number;
    openTime?: string;
    closeTime?: string;
  }>;
}

export interface GetCoffeeShopsResponse {
  coffeeShops?: ShortShopDto[];
  items?: CoffeeShop[];
  totalItems?: number;
  totalPages?: number;
  currentPage?: number;
  pageSize?: number;
}

export interface City {
  publicAddress?: PublicAddress;
  canonicalPath?: string;
  id: string;
  name: string;
}

export const EquipmentCategory = {
  EspressoMachine: 0,
  Grinder: 1,
  BulkAndShopGrinders: 2,
  AlternativeBrewing: 3,
  ManualBrewingEquipment: 4,
  BatchBrewers: 5,
  WaterFiltrationAndBoilers: 6,
  ScalesAndPrecisiontools: 7,
  ColdBrewSystems: 8,
  Other: 9,
} as const;

export type EquipmentCategory = (typeof EquipmentCategory)[keyof typeof EquipmentCategory];

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  [EquipmentCategory.EspressoMachine]: 'Эспрессо-машина',
  [EquipmentCategory.Grinder]: 'Кофемолка',
  [EquipmentCategory.BulkAndShopGrinders]: 'Промышленные кофемолки',
  [EquipmentCategory.AlternativeBrewing]: 'Альтернативное заваривание',
  [EquipmentCategory.ManualBrewingEquipment]: 'Ручное заваривание',
  [EquipmentCategory.BatchBrewers]: 'Батч-бруеры',
  [EquipmentCategory.WaterFiltrationAndBoilers]: 'Фильтрация воды и бойлеры',
  [EquipmentCategory.ScalesAndPrecisiontools]: 'Весы и точные инструменты',
  [EquipmentCategory.ColdBrewSystems]: 'Системы колд-брю',
  [EquipmentCategory.Other]: 'Другое',
};

export interface Equipment {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: EquipmentCategory | keyof typeof EquipmentCategory;
}

/**
 * Возвращает локализованное название категории оборудования
 */
export function getEquipmentCategoryLabel(category: Equipment['category']): string {
  const value = typeof category === 'string' ? EquipmentCategory[category] : category;
  return EQUIPMENT_CATEGORY_LABELS[value] ?? 'Другое';
}

/**
 * Форматирует название оборудования с брендом и моделью
 */
export function formatEquipmentName(equipment: Equipment): string {
  const parts = [equipment.brand, equipment.model].filter(Boolean);
  return parts.length > 0 ? `${equipment.name} (${parts.join(' ')})` : equipment.name;
}

export interface CoffeeBean {
  id: string;
  name: string;
}

export interface Roaster {
  coffeeShopsCount?: number | string | null;
  coffeeProductsCount?: number | string | null;
  publicAddress?: PublicAddress;
  canonicalPath?: string;
  id: string;
  name: string;
  photoUrl?: string | null;
  coverPhoto?: ShortPhotoMetadataDto | null;
}

export interface RoasterDetails {
  coffeeShopsCount?: number | string | null;
  coffeeProductsCount?: number | string | null;
  tags?: { slug: string; name: string }[];
  availableCoffeeProducts?: number;
  coffeeCatalogUpdatedAtUtc?: string | null;
  isFavorite?: boolean | null;
  publicAddress?: PublicAddress;
  canonicalPath?: string;
  id: string;
  name: string;
  about?: string | null;
  location?: { address?: string | null; latitude?: number | null; longitude?: number | null } | null;
  contact?: { instagramLink?: string | null; siteLink?: string | null } | null;
  photos: ShortPhotoMetadataDto[];
  shops: Array<{ id: string; publicAddress?: PublicAddress; name: string; photoUrl?: string | null; coverPhoto?: ShortPhotoMetadataDto | null }>;
}

export interface BrewMethod {
  id: string;
  name: string;
}

export interface RatingDto {
  coffee: number;
  service: number;
  place: number;
}

export type CheckInVisibility = 'Private' | 'Public';
export type CheckInModerationState = 'NotSubmitted' | 'Pending' | 'Approved' | 'Rejected';

export interface CheckInPhoto {
  id: string;
  fileName: string;
  contentType: string;
  storageKey: string;
  sizeBytes: number;
  sortIndex: number;
  url: string;
}

export interface CheckInDto extends SavedDrink {
  id: string;
  shop: PublicAddress | null;
  author: PublicAddress | null;
  username: string;
  shopName: string;
  text: string;
  rating: RatingDto;
  visitedAt: string;
  createdAtUtc: string;
  visibility: CheckInVisibility;
  moderationState: CheckInModerationState;
  contentRevision: number;
  rejectionReason: string | null;
  photos: CheckInPhoto[];
  helpfulCount: number;
  isHelpfulByCurrentUser: boolean;
}

export interface UpdateCheckInRequest {
  text: string;
  rating: RatingDto;
  drinkSlug?: string | null;
  customDrinkName?: string | null;
}

export interface CreateCheckInRequest extends UpdateCheckInRequest {
  coffeeShopSlug: string;
  visibility?: CheckInVisibility;
  visitedAt?: string | null;
  photos?: Array<{
    fileName: string;
    contentType: string;
    storageKey: string;
    size: number;
  }> | null;
}

export interface GetCheckInsResponse {
  items: CheckInDto[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface CheckInDateRange {
  from: string;
  to: string;
}

export interface PublicCheckInFilters {
  citySlug?: string;
  coffeeShopSlug?: string;
  authorSlug?: string;
  pageSize?: number;
  cursor?: string;
}

export interface PublicCheckInsPage {
  items: CheckInDto[];
  nextCursor: string | null;
}

export interface FeedPage {
  items: Array<{ publishedAtUtc: string; checkIn: CheckInDto }>;
  nextCursor: string | null;
}

/**
 * Поиск кофеен с фильтрами
 * Использует публичный список кофеен с query-параметрами
 */
export async function searchCoffeeShops(
  searchQuery?: string,
  filters?: CoffeeShopFilters,
  page: number = 1,
  pageSize: number = 10,
  minRating?: number
): Promise<ApiResponse<GetCoffeeShopsResponse>> {
  const params: Record<string, any> = {
    page: page > 0 ? page : 1,
    pageSize: Math.min(100, pageSize > 0 ? pageSize : 10),
  };

  // Добавляем поисковый запрос
  if (searchQuery && searchQuery.trim()) {
    params.q = searchQuery.trim();
  }

  // Добавляем фильтры
  if (filters) {
    if (filters.cityId) params.city = filters.cityId;
    if (filters.priceRange) params.priceRange = filters.priceRange;
    if (filters.equipmentIds) params.equipments = filters.equipmentIds;
    if (filters.coffeeBeanIds) params.beans = filters.coffeeBeanIds;
    if (filters.roasterIds) params.roasters = filters.roasterIds;
    if (filters.brewMethodIds) params.brewMethods = filters.brewMethodIds;
    if (filters.tagIds?.length) params.tags = filters.tagIds;
    if (filters.coffeeFocus) params.type = SHOP_TYPE_QUERY[filters.coffeeFocus] ?? filters.coffeeFocus;
    if (filters.isOpen !== undefined) params.isOpen = filters.isOpen;
    if (filters.isNew !== undefined) params.isNew = filters.isNew;
    if (filters.isVisited !== undefined) params.isVisited = filters.isVisited;
  }

  // Добавляем минимальный рейтинг
  if (minRating !== undefined && minRating > 0) {
    params.minRating = minRating;
  }

  // Используем базовый эндпоинт вместо отдельного /search
  return httpClient.get<GetCoffeeShopsResponse>(API_ENDPOINTS.COFFEE_SHOP.BASE, {
    params,
    requiresAuth: false,
  });
}

function normalizeLongitude(longitude: number): number {
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

function splitMapBounds(bounds: MapViewportBounds): MapViewportBounds[] {
  const minLat = Math.max(-90, Math.min(90, bounds.minLat));
  const maxLat = Math.max(-90, Math.min(90, bounds.maxLat));
  const longitudeSpan = bounds.maxLon - bounds.minLon;

  if (longitudeSpan >= 360) {
    return [{ minLat, minLon: -180, maxLat, maxLon: 180 }];
  }

  const minLon = normalizeLongitude(bounds.minLon);
  const maxLon = normalizeLongitude(bounds.maxLon);
  if (minLon <= maxLon) {
    return [{ minLat, minLon, maxLat, maxLon }];
  }

  return [
    { minLat, minLon, maxLat, maxLon: 180 },
    { minLat, minLon: -180, maxLat, maxLon },
  ];
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export type MapSearchResponseData = {
  shops?: Array<{
    address: PublicAddress;
    latitude: string | number;
    longitude: string | number;
    title: string | null;
    type: number | string | null;
    primaryZone: PublicAddress | null;
  }>;
  clusters?: Array<{
    id: string | null;
    latitude: string | number;
    longitude: string | number;
    count: string | number;
    bounds: {
      minLatitude: string | number;
      minLongitude: string | number;
      maxLatitude: string | number;
      maxLongitude: string | number;
    };
  }>;
  zones?: Array<{
    address: PublicAddress;
    name: string | null;
    description: string | null;
    latitude: string | number;
    longitude: string | number;
    radiusMeters: string | number;
    shopCount: string | number;
    polygon: Array<{ latitude: string | number; longitude: string | number }>;
  }>;
  isTruncated?: boolean | null;
};

const finiteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function normalizeMapSearch(data: MapSearchResponseData): MapSearchData {
  const shops = (data.shops ?? []).flatMap((shop): MapShop[] => {
    const latitude = finiteNumber(shop.latitude);
    const longitude = finiteNumber(shop.longitude);
    if (!shop.address?.slug || latitude === null || longitude === null) return [];
    return [{
      id: shop.address.slug,
      publicAddress: shop.address,
      canonicalPath: shop.address?.canonicalPath,
      latitude,
      longitude,
      title: typeof shop.title === 'string' && shop.title.trim() ? shop.title : 'Кофейня',
      type: typeof shop.type === 'number' || typeof shop.type === 'string' ? shop.type as CoffeeShopType | number : null,
      primaryZoneId: shop.primaryZone?.slug ?? null,
    }];
  });
  const clusters = (data.clusters ?? []).flatMap((cluster): MapCluster[] => {
    const latitude = finiteNumber(cluster.latitude);
    const longitude = finiteNumber(cluster.longitude);
    const count = finiteNumber(cluster.count);
    const bounds = cluster.bounds;
    const minLatitude = finiteNumber(bounds?.minLatitude);
    const minLongitude = finiteNumber(bounds?.minLongitude);
    const maxLatitude = finiteNumber(bounds?.maxLatitude);
    const maxLongitude = finiteNumber(bounds?.maxLongitude);
    if ([latitude, longitude, count, minLatitude, minLongitude, maxLatitude, maxLongitude].some(value => value === null)) return [];
    return [{
      id: typeof cluster.id === 'string' ? cluster.id : null,
      latitude: latitude!,
      longitude: longitude!,
      count: count!,
      bounds: { minLatitude: minLatitude!, minLongitude: minLongitude!, maxLatitude: maxLatitude!, maxLongitude: maxLongitude! },
    }];
  });
  const zones = (data.zones ?? []).flatMap((zone): MapCoffeeZone[] => {
    const latitude = finiteNumber(zone.latitude);
    const longitude = finiteNumber(zone.longitude);
    const radiusMeters = finiteNumber(zone.radiusMeters);
    const shopCount = finiteNumber(zone.shopCount);
    if (!zone.address?.slug || latitude === null || longitude === null || radiusMeters === null || shopCount === null) return [];
    return [{
      id: zone.address.slug,
      publicAddress: zone.address,
      canonicalPath: zone.address?.canonicalPath,
      name: typeof zone.name === 'string' && zone.name.trim() ? zone.name : 'Кофейная зона',
      description: typeof zone.description === 'string' ? zone.description : null,
      latitude,
      longitude,
      radiusMeters,
      shopCount,
      polygon: (zone.polygon ?? []).flatMap((point) => {
        const pointLatitude = finiteNumber(point.latitude);
        const pointLongitude = finiteNumber(point.longitude);
        return pointLatitude === null || pointLongitude === null ? [] : [{ latitude: pointLatitude, longitude: pointLongitude }];
      }),
    }];
  });
  return { shops, clusters, zones, isTruncated: data.isTruncated === true };
}

/** Loads the server-selected map representation for the viewport at the given zoom. */
async function getMapSearch(
  bounds: MapViewportBounds,
  zoom: number,
  signal?: AbortSignal,
): Promise<ApiResponse<MapSearchData>> {
  signal?.throwIfAborted();
  const requests = splitMapBounds(bounds).map((part) =>
    queryClient.fetchQuery({
      queryKey: ['map', 'viewport', part, zoom],
      staleTime: 30 * 60_000,
      gcTime: 30 * 60_000,
      retry: false,
      queryFn: ({ signal: cacheSignal }) => httpClient.get<MapSearchResponseData>(API_ENDPOINTS.MAP.BASE, {
        params: { ...part, zoom: Math.max(0, Math.min(22, Math.round(zoom))) },
        requiresAuth: false,
        signal: cacheSignal,
      }),
    }),
  );
  const responses = await Promise.all(requests);
  signal?.throwIfAborted();
  const data = responses.map((response) => normalizeMapSearch(response.data));

  return {
    success: true,
    isSuccess: true,
    message: responses[0]?.message ?? '',
    statusCode: responses[0]?.statusCode,
    data: {
      shops: uniqueById(data.flatMap((part) => part.shops ?? [])),
      clusters: Array.from(new Map(data.flatMap((part) => part.clusters ?? []).map((cluster) => [
        cluster.id ?? `${cluster.latitude}:${cluster.longitude}:${cluster.count}`,
        cluster,
      ])).values()),
      zones: uniqueById(data.flatMap((part) => part.zones ?? [])),
      isTruncated: data.some((part) => part.isTruncated === true),
    },
  };
}

// ponytail: mirrors the server's MapClustering:ZoneMaxZoom; at or below it the endpoint returns zones + clusters,
// above it individual shops (capped at MaxResponseItems, see isTruncated).
const MAP_ZONES_ZOOM = 13;

/** Loads individual shops for the viewport at any zoom, bypassing server-side clustering. */
export async function getMapShops(bounds: MapViewportBounds, signal?: AbortSignal): Promise<ApiResponse<MapSearchData>> {
  return getMapSearch(bounds, MAP_ZONES_ZOOM + 1, signal);
}

/** Loads published zones for the viewport regardless of the current zoom. */
export async function getMapZones(bounds: MapViewportBounds, signal?: AbortSignal): Promise<MapCoffeeZone[]> {
  const response = await getMapSearch(bounds, MAP_ZONES_ZOOM, signal);
  return response.data.zones ?? [];
}

/**
 * Получает список городов
 */
export async function getCities(): Promise<ApiResponse<City[]>> {
  return httpClient.get<City[]>(API_ENDPOINTS.CATALOGS.CITIES, { requiresAuth: false });
}

/**
 * Получает список оборудования
 */
export async function getEquipments(): Promise<ApiResponse<Equipment[]>> {
  return httpClient.get<Equipment[]>(API_ENDPOINTS.CATALOGS.EQUIPMENTS, { requiresAuth: false });
}

/**
 * Получает список кофейных зёрен
 */
export async function getCoffeeBeans(): Promise<ApiResponse<CoffeeBean[]>> {
  return httpClient.get<CoffeeBean[]>(API_ENDPOINTS.CATALOGS.BEANS, { requiresAuth: false });
}

/**
 * Получает список обжарщиков
 */
export async function getRoasters(): Promise<ApiResponse<Roaster[]>> {
  return httpClient.get<Roaster[]>(API_ENDPOINTS.CATALOGS.ROASTERS, { requiresAuth: false });
}

/**
 * Получает полную информацию об обжарщике
 */
export async function getRoasterBySlug(slug: string, signal?: AbortSignal): Promise<ApiResponse<RoasterDetails>> {
  return httpClient.get<RoasterDetails>(API_ENDPOINTS.ROASTERS.BY_SLUG(slug), {
    requiresAuth: false,
    signal,
  });
}

/**
 * Получает список способов заваривания
 */
export async function getBrewMethods(): Promise<ApiResponse<BrewMethod[]>> {
  return httpClient.get<BrewMethod[]>(API_ENDPOINTS.CATALOGS.BREW_METHODS, { requiresAuth: false });
}

/**
 * Активные теги атмосферы для фильтров (GET /api/Catalogs/shop-tags)
 */
export async function getShopTags(): Promise<ApiResponse<ShopTagDto[]>> {
  return httpClient.get<ShopTagDto[]>(API_ENDPOINTS.CATALOGS.SHOP_TAGS, { requiresAuth: false });
}

/**
 * Получает кофейню по публичному slug
 */
export async function getCoffeeShopBySlug(slug: string, signal?: AbortSignal): Promise<ApiResponse<DetailedCoffeeShop>> {
  return httpClient.get<DetailedCoffeeShop>(API_ENDPOINTS.COFFEE_SHOP.BY_SLUG(slug), {
    requiresAuth: false,
    signal,
  });
}

export async function createCheckIn(request: CreateCheckInRequest): Promise<ApiResponse<CheckInDto>> {
  return httpClient.post<CheckInDto>(API_ENDPOINTS.CHECK_IN.BASE, request, { requiresAuth: true });
}

export async function getCheckInById(id: string): Promise<ApiResponse<CheckInDto>> {
  return httpClient.get<CheckInDto>(API_ENDPOINTS.CHECK_IN.BY_ID(id), { requiresAuth: false });
}

export async function updateCheckIn(id: string, request: UpdateCheckInRequest): Promise<ApiResponse<CheckInDto>> {
  return httpClient.put<CheckInDto>(API_ENDPOINTS.CHECK_IN.BY_ID(id), request, { requiresAuth: true });
}

export async function changeCheckInVisibility(id: string, visibility: CheckInVisibility): Promise<ApiResponse<CheckInDto>> {
  return httpClient.put<CheckInDto>(`${API_ENDPOINTS.CHECK_IN.BY_ID(id)}/visibility`, { visibility }, { requiresAuth: true });
}

export async function deleteCheckIn(id: string): Promise<ApiResponse<null>> {
  return httpClient.delete<null>(API_ENDPOINTS.CHECK_IN.BY_ID(id), { requiresAuth: true });
}

export async function setCheckInHelpful(id: string, helpful: boolean) {
  const path = `${API_ENDPOINTS.CHECK_IN.BY_ID(id)}/helpful`;
  return helpful
    ? httpClient.put<{ isHelpful: boolean; helpfulCount: number }>(path, undefined, { requiresAuth: true })
    : httpClient.delete<{ isHelpful: boolean; helpfulCount: number }>(path, { requiresAuth: true });
}

export async function getCheckIns(page = 1, pageSize = 10, range?: CheckInDateRange): Promise<ApiResponse<GetCheckInsResponse>> {
  const response = await httpClient.get<{ items: CheckInDto[]; totalCount: number }>(API_ENDPOINTS.CHECK_IN.MINE, {
    params: { pageNumber: page, pageSize, ...range }, requiresAuth: true,
  });
  const totalCount = response.pagination?.totalItems ?? response.data.totalCount;
  return { ...response, data: {
    items: response.data.items.map(normalizeCheckInDto),
    totalCount,
    totalPages: response.pagination?.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize)),
    currentPage: response.pagination?.page ?? page,
    pageSize: response.pagination?.pageSize ?? pageSize,
  } };
}

export async function getPublicCheckIns(filters: PublicCheckInFilters = {}): Promise<ApiResponse<PublicCheckInsPage>> {
  return httpClient.get<PublicCheckInsPage>(API_ENDPOINTS.CHECK_IN.BASE, { params: filters, requiresAuth: false });
}

export async function getFeed(filters: PublicCheckInFilters = {}): Promise<ApiResponse<FeedPage>> {
  return httpClient.get<FeedPage>(API_ENDPOINTS.FEED, { params: filters, requiresAuth: false });
}

/** Loads every check-in in the half-open visit-time range [from, to). */
export async function getCheckInsByDateRange(range: CheckInDateRange): Promise<CheckInDto[]> {
  const first = await getCheckIns(1, 100, range);
  const remaining = await Promise.all(
    Array.from({ length: Math.max(0, first.data.totalPages - 1) }, (_, index) => getCheckIns(index + 2, 100, range)),
  );
  return [first, ...remaining].flatMap(response => response.data.items);
}
