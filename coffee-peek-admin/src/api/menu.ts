import { httpClient } from './core/httpClient';
import { API_ENDPOINTS } from './core/apiConfig';
import { ApiResponse } from './core/types';

export type CoffeeDrinkCategory = 'Espresso' | 'Filter';
export type MenuAvailability = 'Unknown' | 'Present' | 'Absent';
export type MenuParseStatus = 'None' | 'Pending' | 'Running' | 'Ready' | 'Failed';
export type MenuItemSource = 'Parsed' | 'Manual';
export type SuggestedPriceRange = 'Cheap' | 'Moderate' | 'Expensive';

export interface CoffeeDrinkDefinitionDto {
  slug: string;
  nameRu: string;
  nameEn: string;
  category: CoffeeDrinkCategory;
  sortOrder: number;
}

export interface ShopMenuItemDto {
  slug: string;
  nameRu: string;
  nameEn: string;
  category: CoffeeDrinkCategory;
  availability: MenuAvailability;
  price?: number | null;
  currency: string;
  volumeMl?: number | null;
  source: MenuItemSource;
}

export interface MenuPhotoDto {
  id?: string;
  fileName: string;
  storageKey: string;
  fullUrl: string | null;
  sortIndex?: number;
}

export interface ShopMenuDto {
  capturedAtUtc?: string | null;
  updatedAtUtc?: string | null;
  currency: string;
  parseStatus: MenuParseStatus;
  parseError?: string | null;
  suggestedPriceRange?: SuggestedPriceRange | null;
  items: ShopMenuItemDto[];
  photos: MenuPhotoDto[];
}

export interface UnmatchedMenuItem {
  rawName: string;
  price?: number | null;
  confidence?: number | null;
}

export interface AdminShopMenuDto {
  menu: ShopMenuDto | null;
  unmatched: UnmatchedMenuItem[];
}

export interface UploadedPhotoDto {
  fileName: string;
  contentType: string;
  storageKey: string;
  size: number;
}

export interface AttachMenuPhotosRequest {
  photos: UploadedPhotoDto[];
}

export interface UpdateShopMenuItemRequest {
  slug: string;
  availability: MenuAvailability;
  price?: number | null;
  volumeMl?: number | null;
}

export interface UpdateShopMenuRequest {
  items: UpdateShopMenuItemRequest[];
  applySuggestedPriceRange?: boolean;
}

const PARSE_STATUSES: MenuParseStatus[] = ['None', 'Pending', 'Running', 'Ready', 'Failed'];
const AVAILABILITIES: MenuAvailability[] = ['Unknown', 'Present', 'Absent'];
const SOURCES: MenuItemSource[] = ['Parsed', 'Manual'];
const CATEGORIES: CoffeeDrinkCategory[] = ['Espresso', 'Filter'];
const RANGES: SuggestedPriceRange[] = ['Cheap', 'Moderate', 'Expensive'];

function pick(raw: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value);
}

function asNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  return fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function isMenuParsing(status?: MenuParseStatus | null): boolean {
  return status === 'Pending' || status === 'Running';
}

export function formatMenuPrice(price: number, currency = 'BYN'): string {
  return `${price.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function formatMenuCapturedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function suggestedRangeHint(range?: SuggestedPriceRange | null): string | null {
  if (!range) return null;
  if (range === 'Cheap') return 'по меню: Cheap (< 7 BYN)';
  if (range === 'Moderate') return 'по меню: Moderate (~8 BYN)';
  return 'по меню: Expensive (> 9 BYN)';
}

export function mapShopMenu(rawInput: unknown): ShopMenuDto | null {
  if (!rawInput || typeof rawInput !== 'object') return null;
  const raw = asRecord(rawInput);
  const itemsRaw = pick(raw, 'items', 'Items');
  const photosRaw = pick(raw, 'photos', 'Photos');
  const parseStatus = asEnum(pick(raw, 'parseStatus', 'ParseStatus'), PARSE_STATUSES, 'None');
  const items = Array.isArray(itemsRaw) ? itemsRaw.map(mapMenuItem) : [];
  const photos = Array.isArray(photosRaw) ? photosRaw.map(mapMenuPhoto) : [];
  if (items.length === 0 && photos.length === 0 && parseStatus === 'None' && !pick(raw, 'capturedAtUtc', 'CapturedAtUtc')) {
    return null;
  }
  return {
    capturedAtUtc: asString(pick(raw, 'capturedAtUtc', 'CapturedAtUtc')) ?? null,
    updatedAtUtc: asString(pick(raw, 'updatedAtUtc', 'UpdatedAtUtc')) ?? null,
    currency: asString(pick(raw, 'currency', 'Currency')) ?? 'BYN',
    parseStatus,
    parseError: asString(pick(raw, 'parseError', 'ParseError')) ?? null,
    suggestedPriceRange: (() => {
      const value = pick(raw, 'suggestedPriceRange', 'SuggestedPriceRange');
      return typeof value === 'string' && RANGES.includes(value as SuggestedPriceRange)
        ? (value as SuggestedPriceRange)
        : null;
    })(),
    items,
    photos,
  };
}

function mapMenuItem(rawInput: unknown): ShopMenuItemDto {
  const raw = asRecord(rawInput);
  return {
    slug: asString(pick(raw, 'slug', 'Slug')) ?? '',
    nameRu: asString(pick(raw, 'nameRu', 'NameRu')) ?? '',
    nameEn: asString(pick(raw, 'nameEn', 'NameEn')) ?? '',
    category: asEnum(pick(raw, 'category', 'Category'), CATEGORIES, 'Espresso'),
    availability: asEnum(pick(raw, 'availability', 'Availability'), AVAILABILITIES, 'Unknown'),
    price: asNumber(pick(raw, 'price', 'Price')) ?? null,
    currency: asString(pick(raw, 'currency', 'Currency')) ?? 'BYN',
    volumeMl: asNumber(pick(raw, 'volumeMl', 'VolumeMl')) ?? null,
    source: asEnum(pick(raw, 'source', 'Source'), SOURCES, 'Parsed'),
  };
}

function mapMenuPhoto(rawInput: unknown): MenuPhotoDto {
  const raw = asRecord(rawInput);
  return {
    id: asString(pick(raw, 'id', 'Id')),
    fileName: asString(pick(raw, 'fileName', 'FileName')) ?? '',
    storageKey: asString(pick(raw, 'storageKey', 'StorageKey')) ?? '',
    fullUrl: asString(pick(raw, 'fullUrl', 'FullUrl')) ?? null,
    sortIndex: asNumber(pick(raw, 'sortIndex', 'SortIndex')),
  };
}

function mapUnmatched(rawInput: unknown): UnmatchedMenuItem {
  const raw = asRecord(rawInput);
  return {
    rawName: asString(pick(raw, 'rawName', 'RawName')) ?? '',
    price: asNumber(pick(raw, 'price', 'Price')) ?? null,
    confidence: asNumber(pick(raw, 'confidence', 'Confidence')) ?? null,
  };
}

export function mapAdminShopMenu(rawInput: unknown): AdminShopMenuDto {
  const raw = asRecord(rawInput);
  const unmatchedRaw = pick(raw, 'unmatched', 'Unmatched');
  const unmatched = Array.isArray(unmatchedRaw) ? unmatchedRaw.map(mapUnmatched) : [];
  const hasMenuKey = 'menu' in raw || 'Menu' in raw;
  if (hasMenuKey) {
    const nested = raw.menu ?? raw.Menu;
    return { menu: nested == null ? null : mapShopMenu(nested), unmatched };
  }
  return { menu: mapShopMenu(raw), unmatched };
}

export async function attachModerationShopMenuPhotos(
  id: string,
  body: AttachMenuPhotosRequest
): Promise<ApiResponse<ShopMenuDto | null>> {
  const response = await httpClient.post<unknown>(
    `${API_ENDPOINTS.MODERATION.SHOP_BY_ID(id)}/menu/photos`,
    body
  );
  return { ...response, data: mapShopMenu(response.data) };
}

export async function parseModerationShopMenu(id: string): Promise<ApiResponse<ShopMenuDto | null>> {
  const response = await httpClient.post<unknown>(`${API_ENDPOINTS.MODERATION.SHOP_BY_ID(id)}/menu/parse`);
  return { ...response, data: mapShopMenu(response.data) };
}

export async function updateModerationShopMenu(
  id: string,
  body: UpdateShopMenuRequest
): Promise<ApiResponse<ShopMenuDto | null>> {
  const response = await httpClient.put<unknown>(`${API_ENDPOINTS.MODERATION.SHOP_BY_ID(id)}/menu`, body);
  return { ...response, data: mapShopMenu(response.data) };
}

function unwrapDrinks(data: unknown): CoffeeDrinkDefinitionDto[] {
  if (Array.isArray(data)) return data as CoffeeDrinkDefinitionDto[];
  if (data && typeof data === 'object' && Array.isArray((data as { drinks?: unknown }).drinks)) {
    return (data as { drinks: CoffeeDrinkDefinitionDto[] }).drinks;
  }
  return [];
}

export async function getMenuDrinks(): Promise<ApiResponse<CoffeeDrinkDefinitionDto[]>> {
  const response = await httpClient.get<unknown>(API_ENDPOINTS.MENU.DRINKS, { requiresAuth: false });
  return { ...response, data: unwrapDrinks(response.data) };
}

export async function getPublishedShopMenu(id: string): Promise<ApiResponse<AdminShopMenuDto>> {
  const response = await httpClient.get<unknown>(API_ENDPOINTS.ADMIN.SHOP_MENU(id));
  return { ...response, data: mapAdminShopMenu(response.data) };
}

export async function attachPublishedShopMenuPhotos(
  id: string,
  body: AttachMenuPhotosRequest
): Promise<ApiResponse<AdminShopMenuDto>> {
  const response = await httpClient.post<unknown>(API_ENDPOINTS.ADMIN.SHOP_MENU_PHOTOS(id), body);
  return { ...response, data: mapAdminShopMenu(response.data) };
}

export async function deletePublishedShopMenuPhotos(
  id: string,
  photoIds: string[]
): Promise<ApiResponse<AdminShopMenuDto>> {
  const response = await httpClient.delete<unknown>(API_ENDPOINTS.ADMIN.SHOP_MENU_PHOTOS(id), {
    data: { photoIds },
  });
  return { ...response, data: mapAdminShopMenu(response.data) };
}

export async function parsePublishedShopMenu(id: string): Promise<ApiResponse<AdminShopMenuDto>> {
  const response = await httpClient.post<unknown>(API_ENDPOINTS.ADMIN.SHOP_MENU_PARSE(id));
  return { ...response, data: mapAdminShopMenu(response.data) };
}

export async function updatePublishedShopMenu(
  id: string,
  body: UpdateShopMenuRequest
): Promise<ApiResponse<AdminShopMenuDto>> {
  const response = await httpClient.put<unknown>(API_ENDPOINTS.ADMIN.SHOP_MENU(id), body);
  return { ...response, data: mapAdminShopMenu(response.data) };
}
