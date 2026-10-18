import { httpClient } from './core/httpClient';
import type { CheckInDto, CheckInVisibility, CheckInPhoto } from './coffeeshop';
import { normalizeCheckInDto } from './core/checkInNormalize';
import { invalidateProtectedPhotos } from '../lib/photoSession';
import type { UploadedPhoto } from '../hooks/usePhotoUpload';

const BASE = '/api/v1/check-ins/home';

export interface HomeCheckIn extends Partial<CheckInDto> {
  id: string;
  preparedAtUtc?: string;
  preparedAt?: string;
  preparedOn: string;
  brewMethodCode?: string | null;
  beanName?: string | null;
  coffeeProductId?: string | null;
  doseGrams?: number | null;
  brewDurationSeconds?: number | null;
  tasteScore: number;
  visibility?: CheckInVisibility;
  moderationState?: CheckInDto['moderationState'];
  photos: CheckInPhoto[];
  drinkPhoto?: CheckInPhoto | null;
}

export interface HomeCheckInRequest {
  preparedAt: string;
  preparedOn: string;
  brewMethodCode: string | null;
  coffeeProductSlug: string | null;
  coffeeProductId: string | null;
  customBeanName: string | null;
  doseGrams: number | null;
  brewDurationSeconds: number | null;
  tasteScore: number;
  text: string;
  drinkSlug: string | null;
  customDrinkName: string | null;
  photos?: UploadedPhoto[];
  drinkPhoto?: null;
  visibility?: CheckInVisibility;
}

export interface HomePage {
  items: HomeCheckIn[];
  totalCount: number;
}

export interface HomeCalendarDay {
  preparedOn: string;
  brewCount: number;
}

/** Preserve the complete recipe when hiding a published home check-in. */
export function privateHomeUpdate(item: HomeCheckIn): Omit<HomeCheckInRequest, 'photos' | 'drinkPhoto'> {
  const preparedAt = item.preparedAtUtc || item.preparedAt;
  const tasteScore = item.tasteScore || item.home?.tasteScore;
  if (!preparedAt || !item.preparedOn || !tasteScore) throw new Error('Не удалось прочитать рецепт перед изменением видимости');
  return {
    preparedAt, preparedOn: item.preparedOn,
    brewMethodCode: item.brewMethodCode || item.home?.brewMethodCode || null,
    coffeeProductSlug: null, coffeeProductId: item.coffeeProductId || null,
    customBeanName: item.coffeeProductId ? null : item.beanName || item.home?.beanName || null,
    doseGrams: item.doseGrams ?? item.home?.doseGrams ?? null,
    brewDurationSeconds: item.brewDurationSeconds ?? item.home?.brewDurationSeconds ?? null,
    tasteScore, text: item.text || '', drinkSlug: item.drinkSlug || null,
    customDrinkName: item.customDrinkName || null, visibility: 'Private',
  };
}

function requireData<T>(data: T | null | undefined): T {
  if (data == null) throw new Error('Сервер вернул ответ без данных');
  return data;
}

function normalizeHome(item: HomeCheckIn): HomeCheckIn {
  return normalizeCheckInDto({ ...item, drinkPhotoUrl: item.drinkPhotoUrl ?? item.drinkPhoto?.url,
    drinkPhotoVariants: item.drinkPhotoVariants ?? item.drinkPhoto?.variants } as CheckInDto) as HomeCheckIn;
}

export async function getHomeCheckIns(pageNumber = 1, pageSize = 20, range?: { from: string; to: string }): Promise<HomePage> {
  const { data } = await httpClient.get<HomePage>(BASE, { params: { pageNumber, pageSize, ...range }, requiresAuth: true });
  const page = requireData(data);
  if (!Array.isArray(page.items) || !Number.isFinite(page.totalCount)) throw new Error('Неверный формат истории домашних чекинов');
  return { ...page, items: page.items.map(normalizeHome) };
}

export async function getHomeCalendar(from: string, to: string): Promise<HomeCalendarDay[]> {
  const { data } = await httpClient.get<HomeCalendarDay[]>(`${BASE}/calendar`, { params: { from, to }, requiresAuth: true });
  if (!Array.isArray(data)) throw new Error('Неверный формат календаря');
  return data;
}

export async function getHomeCheckIn(id: string): Promise<HomeCheckIn> {
  const { data } = await httpClient.get<HomeCheckIn>(`${BASE}/${encodeURIComponent(id)}`, { requiresAuth: true });
  return normalizeHome(requireData(data));
}

export async function createHomeCheckIn(request: HomeCheckInRequest): Promise<HomeCheckIn> {
  const { data } = await httpClient.post<HomeCheckIn>(BASE, { ...request, drinkPhoto: null }, { requiresAuth: true });
  if (!data?.id || !data.visibility) throw new Error('Сервер не подтвердил создание домашнего чекина. Проверьте «Мои чекины» перед повтором.');
  return normalizeHome(data);
}

export async function updateHomeCheckIn(id: string, request: Omit<HomeCheckInRequest, 'photos' | 'drinkPhoto'>): Promise<HomeCheckIn> {
  const { data } = await httpClient.put<HomeCheckIn>(`${BASE}/${encodeURIComponent(id)}`, request, { requiresAuth: true });
  invalidateProtectedPhotos();
  return normalizeHome(requireData(data));
}

export async function deleteHomeCheckIn(id: string): Promise<void> {
  await httpClient.delete<null>(`${BASE}/${encodeURIComponent(id)}`, { requiresAuth: true });
  invalidateProtectedPhotos();
}

export interface CoffeeProductOption { id?: string; slug?: string; address?: { slug?: string }; name?: string; title?: string }

export async function searchHomeCoffee(q: string): Promise<CoffeeProductOption[]> {
  const { data } = await httpClient.post<{ items: CoffeeProductOption[] } | CoffeeProductOption[]>(
    '/api/v1/coffees/search', { q, filters: { availableOnly: false }, page: 1, pageSize: 20 }, { requiresAuth: true },
  );
  const items = Array.isArray(data) ? data : data?.items;
  if (!Array.isArray(items)) throw new Error('Не удалось получить каталог зерна');
  return items;
}
