import { httpClient } from './core/httpClient';
import { API_ENDPOINTS } from './core/apiConfig';
import { ApiResponse } from './core/types';
import { apiDayOfWeekToUi } from '../utils/dayOfWeek';

export interface BrowseCoffeeShop {
  id: string;
  canonicalPath: string;
  name: string;
  address?: string;
  description?: string;
  cityName?: string;
  rating?: number;
  checkInCount?: number;
  imageUrl?: string;
}

export interface BrowseCoffeeShopDetails extends BrowseCoffeeShop {
  schedules?: Array<{ dayOfWeek: number; openTime?: string; closeTime?: string }>;
  location?: { address?: string; latitude?: number; longitude?: number };
  photos?: Array<{ fullUrl?: string | null }>;
  imageUrls?: string[];
  shopContact?: {
    phone?: string;
    email?: string;
    website?: string;
    instagram?: string;
  };
}

export interface MapShop {
  id: string;
  canonicalPath: string;
  latitude: number;
  longitude: number;
  title: string;
}

interface GetCoffeeShopsResponse {
  coffeeShops?: Record<string, unknown>[];
  items?: Record<string, unknown>[];
  totalItems?: number;
  totalPages?: number;
  currentPage?: number;
  pageSize?: number;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined;
}

function firstValue(record: UnknownRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function firstString(record: UnknownRecord, ...keys: string[]): string | undefined {
  const value = firstValue(record, ...keys);
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text || undefined;
}

function firstNumber(record: UnknownRecord, ...keys: string[]): number | undefined {
  const value = firstValue(record, ...keys);
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function unwrapShop(raw: UnknownRecord): UnknownRecord {
  const wrapped = firstValue(
    raw,
    'shopDto',
    'ShopDto',
    'coffeeShop',
    'CoffeeShop',
    'shop',
    'Shop',
    'item',
    'Item'
  );
  return asRecord(wrapped) ?? raw;
}

function normalizePhotos(raw: UnknownRecord): BrowseCoffeeShopDetails['photos'] {
  const value = firstValue(raw, 'photos', 'Photos', 'shopPhotos', 'ShopPhotos');
  if (!Array.isArray(value)) return undefined;
  return value.map((photo) => {
    if (typeof photo === 'string') return { fullUrl: photo };
    const record = asRecord(photo);
    return {
      fullUrl: record
        ? firstString(record, 'fullUrl', 'FullUrl', 'url', 'Url', 'thumbnailUrl', 'ThumbnailUrl') ?? null
        : null,
    };
  });
}

function normalizeSchedules(raw: UnknownRecord): BrowseCoffeeShopDetails['schedules'] {
  const value = firstValue(raw, 'schedules', 'Schedules');
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    const schedule = asRecord(item);
    if (!schedule) return [];
    const isClosed = Boolean(firstValue(schedule, 'isClosed', 'IsClosed'));
    const intervals = firstValue(schedule, 'intervals', 'Intervals');
    const interval = Array.isArray(intervals) ? asRecord(intervals[0]) : undefined;
    const openTime = firstString(
      interval ?? schedule,
      'openTime',
      'OpenTime'
    )?.substring(0, 5);
    const closeTime = firstString(
      interval ?? schedule,
      'closeTime',
      'CloseTime'
    )?.substring(0, 5);
    return [{
      dayOfWeek: apiDayOfWeekToUi(
        firstValue(schedule, 'dayOfWeek', 'DayOfWeek') as number | string | undefined
      ),
      openTime: isClosed ? undefined : openTime,
      closeTime: isClosed ? undefined : closeTime,
    }];
  });
}

function mapBrowseShop(raw: Record<string, unknown>): BrowseCoffeeShop {
  const shop = unwrapShop(raw);
  const address = asRecord(shop.address);
  const slug = firstString(address ?? {}, 'slug');
  if (!slug) throw new Error('В ответе отсутствует публичный адрес кофейни');
  const location = asRecord(firstValue(shop, 'location', 'Location'));
  const city = asRecord(firstValue(shop, 'city', 'City'));
  const photos = normalizePhotos(shop);
  const imageUrl = photos?.find((photo) => photo.fullUrl)?.fullUrl
    ?? firstString(shop, 'imageUrl', 'ImageUrl');

  return {
    id: slug,
    canonicalPath: firstString(address ?? {}, 'canonicalPath') ?? `/coffee-shops/${encodeURIComponent(slug)}`,
    name: firstString(shop, 'name', 'Name', 'title', 'Title') ?? 'Кофейня',
    address:
      (location ? firstString(location, 'address', 'Address') : undefined),
    description: firstString(shop, 'description', 'Description'),
    cityName:
      firstString(shop, 'cityName', 'CityName')
      ?? (city ? firstString(city, 'name', 'Name') : undefined),
    rating: firstNumber(shop, 'rating', 'Rating', 'averageRating', 'AverageRating'),
    checkInCount: firstNumber(shop, 'checkInCount', 'CheckInCount'),
    imageUrl: imageUrl ?? undefined,
  };
}

function normalizeShopList(data: GetCoffeeShopsResponse | undefined): {
  items: BrowseCoffeeShop[];
  totalPages: number;
} {
  const rawList = data?.coffeeShops ?? data?.items ?? [];
  return {
    items: rawList.map((item) => mapBrowseShop(item)),
    totalPages: data?.totalPages ?? 1,
  };
}

export async function getBrowseCoffeeShops(
  page = 1,
  pageSize = 20,
  search?: string
): Promise<ApiResponse<{ items: BrowseCoffeeShop[]; totalPages: number }>> {
  const params: Record<string, unknown> = { page, pageSize };
  if (search?.trim()) params.q = search.trim();

  const response = await httpClient.get<GetCoffeeShopsResponse>(
    API_ENDPOINTS.COFFEE_SHOP.BASE,
    { params, requiresAuth: false }
  );

  const normalized = normalizeShopList(response.data);
  return { ...response, data: normalized };
}

export async function getBrowseCoffeeShopBySlug(
  slug: string
): Promise<ApiResponse<BrowseCoffeeShopDetails>> {
  const response = await httpClient.get<Record<string, unknown>>(
    API_ENDPOINTS.COFFEE_SHOP.BY_SLUG(slug),
    { requiresAuth: false }
  );

  const raw = unwrapShop(response.data ?? {});
  const mapped = mapBrowseShop(raw);
  const locationRaw = asRecord(firstValue(raw, 'location', 'Location'));
  const contactRaw = asRecord(firstValue(raw, 'shopContact', 'ShopContact', 'contacts', 'Contacts'));
  const photos = normalizePhotos(raw);
  const imageUrlsValue = firstValue(raw, 'imageUrls', 'ImageUrls');
  return {
    ...response,
    data: {
      ...mapped,
      schedules: normalizeSchedules(raw),
      location: locationRaw ? {
        address: firstString(locationRaw, 'address', 'Address'),
        latitude: firstNumber(locationRaw, 'latitude', 'Latitude', 'lat', 'Lat'),
        longitude: firstNumber(locationRaw, 'longitude', 'Longitude', 'lon', 'Lon', 'lng', 'Lng'),
      } : undefined,
      photos,
      imageUrls: Array.isArray(imageUrlsValue)
        ? imageUrlsValue.map(String).filter(Boolean)
        : undefined,
      shopContact: contactRaw ? {
        phone: firstString(contactRaw, 'phone', 'Phone', 'phoneNumber', 'PhoneNumber'),
        email: firstString(contactRaw, 'email', 'Email'),
        website: firstString(contactRaw, 'website', 'Website', 'siteLink', 'SiteLink'),
        instagram: firstString(contactRaw, 'instagram', 'Instagram', 'instagramLink', 'InstagramLink'),
      } : undefined,
    },
  };
}

export async function getCoffeeShopsByMapBounds(
  minLat?: number,
  minLon?: number,
  maxLat?: number,
  maxLon?: number
): Promise<ApiResponse<{ shops: MapShop[] }>> {
  const params: Record<string, number> = { zoom: 14 };
  if (minLat !== undefined) params.minLat = minLat;
  if (minLon !== undefined) params.minLon = minLon;
  if (maxLat !== undefined) params.maxLat = maxLat;
  if (maxLon !== undefined) params.maxLon = maxLon;

  const response = await httpClient.get<{ shops?: Array<{ address: { slug: string; canonicalPath: string } | null; latitude: number; longitude: number; title: string }> }>(API_ENDPOINTS.MAP.BASE, {
    params,
    requiresAuth: false,
  });

  const shops = (response.data?.shops ?? []).filter((shop) => shop.address?.slug && Number.isFinite(Number(shop.latitude)) && Number.isFinite(Number(shop.longitude))).map((shop) => ({
    id: shop.address!.slug,
    canonicalPath: shop.address!.canonicalPath,
    latitude: Number(shop.latitude),
    longitude: Number(shop.longitude),
    title: shop.title || 'Кофейня',
  }));

  return { ...response, data: { shops } };
}
