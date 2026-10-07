import { z } from 'zod';
import type { RoasterCard } from '../api/discovery';

const codes = z.array(z.string().min(1).max(100)).max(30);
const price = z.number().finite().min(0).optional();
const weight = z.number().int().min(1).max(100000).optional();
const volume = z.number().int().min(1).max(5000).optional();
const currency = z.enum(['BYN', 'RUB']).optional();
const coffeeShape = {
  roasters: codes.optional(), countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(30).optional(),
  productKind: z.enum(['roasted_beans', 'green_beans']).optional(), productForm: z.enum(['whole_beans', 'ground_only']).optional(),
  brew: codes.optional(), caffeine: codes.optional(), roast: codes.optional(), acidity: codes.optional(),
  processing: codes.optional(), fermentation: codes.optional(), taste: codes.optional(), composition: codes.optional(),
  weightGrams: weight, currency, minPrice: price, maxPrice: price,
  availabilityScope: z.enum(['online', 'in_store']).optional(), availableOnly: z.boolean().optional(),
};
function checkPrice(value: { minPrice?: number; maxPrice?: number; currency?: string }, ctx: z.RefinementCtx) {
  if ((value.minPrice !== undefined || value.maxPrice !== undefined) && !value.currency)
    ctx.addIssue({ code: 'custom', path: ['currency'], message: 'Выберите валюту для цены' });
  if (value.minPrice !== undefined && value.maxPrice !== undefined && value.minPrice > value.maxPrice)
    ctx.addIssue({ code: 'custom', path: ['minPrice'], message: 'Минимум не может превышать максимум' });
}
export const coffeeFiltersSchema = z.object(coffeeShape).strict().superRefine(checkPrice);
export type CoffeeFilters = z.infer<typeof coffeeFiltersSchema>;
export const roasterFiltersSchema = z.object({
  tags: codes.optional(), excludeTags: codes.optional(), favoritesOnly: z.boolean().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.tags?.some(tag => value.excludeTags?.includes(tag)))
    ctx.addIssue({ code: 'custom', path: ['excludeTags'], message: 'Тег нельзя одновременно выбрать и исключить' });
});
export type RoasterFilters = z.infer<typeof roasterFiltersSchema>;
export const menuFiltersSchema = z.object({ brew: z.array(z.enum(['espresso', 'filter'])).max(2).optional(), currency, minPrice: price, maxPrice: price, volumeMl: volume }).strict().superRefine(checkPrice);
export const shopFiltersSchema = z.object({
  city: z.string().optional(), tags: codes.optional(), roasters: codes.optional(), isOpen: z.boolean().optional(),
  minRating: z.number().min(0).max(5).optional(), isNew: z.boolean().optional(), equipments: codes.optional(), beans: codes.optional(), brewMethods: codes.optional(),
  priceRange: z.enum(['cheap', 'moderate', 'expensive']).optional(), type: z.enum(['specialty', 'coffee-bar', 'cafe']).optional(),
  visitedOnly: z.boolean().optional(), favoritesOnly: z.boolean().optional(),
  origin: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).strict().optional(),
  radiusKm: z.number().positive().max(100).optional(), menu: menuFiltersSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.radiusKm && !value.origin) ctx.addIssue({ code: 'custom', path: ['origin'], message: 'Для поиска рядом нужны координаты' });
});
export type ShopFilters = z.infer<typeof shopFiltersSchema>;
export const discoveryFiltersSchema = z.object({
  brew: z.array(z.enum(['espresso', 'filter'])).max(2).optional(),
  budget: z.object({ currency: z.enum(['BYN', 'RUB']), minDrinkPrice: price, maxDrinkPrice: price, drinkVolumeMl: volume,
    minCoffeePrice: price, maxCoffeePrice: price, coffeeWeightGrams: weight }).strict().superRefine((value, ctx) => {
    for (const [min, max] of [['minDrinkPrice', 'maxDrinkPrice'], ['minCoffeePrice', 'maxCoffeePrice']] as const)
      if (value[min] !== undefined && value[max] !== undefined && value[min]! > value[max]!)
        ctx.addIssue({ code: 'custom', path: [min], message: 'Минимум не может превышать максимум' });
    if ((value.minCoffeePrice !== undefined || value.maxCoffeePrice !== undefined) && !value.coffeeWeightGrams)
      ctx.addIssue({ code: 'custom', path: ['coffeeWeightGrams'], message: 'Выберите вес пачки для цены кофе' });
  }).optional(),
}).strict();
export type DiscoveryFilters = z.infer<typeof discoveryFiltersSchema>;
export type CatalogKind = 'discovery' | 'shops' | 'roasters' | 'coffees';
export interface SearchState { q: string; filters: Record<string, unknown>; sort: string; page: number; coffeeShopsPage: number; roastersPage: number }
const sorts: Record<CatalogKind, string[]> = {
  discovery: ['name_asc', 'relevance'], shops: ['name_asc', 'relevance', 'distance_asc', 'rating_desc'],
  roasters: ['name_asc', 'relevance', 'available_coffees_desc'], coffees: ['name_asc', 'relevance', 'price_asc', 'price_desc', 'newest'],
};
export const filterSchemas = { discovery: discoveryFiltersSchema, shops: shopFiltersSchema, roasters: roasterFiltersSchema, coffees: coffeeFiltersSchema };
export const normalizeQuery = (q: string) => q.trim().replace(/\s+/g, ' ');
export function filterRoasters(items: RoasterCard[], state: Pick<SearchState, 'q' | 'filters' | 'sort'>, isFavorite: (slug: string) => boolean = () => false): RoasterCard[] {
  const text = (value: string | null) => normalizeQuery(value ?? '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
  const q = text(state.q);
  const filters = state.filters as RoasterFilters;
  return items.filter(item => text(item.name).includes(q)
    && (!filters.tags?.length || filters.tags.every(tag => item.tags.some(value => value.slug === tag)))
    && !filters.excludeTags?.some(tag => item.tags.some(value => value.slug === tag))
    && (!filters.favoritesOnly || !!item.address.slug && isFavorite(item.address.slug)));
}
export function isDiscoveryFiltering(q: string, filters: ShopFilters, defaultCity: string): boolean {
  return !!normalizeQuery(q) || Object.entries(normalizeFilters(filters)).some(([key, value]) =>
    key === 'city' ? value !== defaultCity : value !== false);
}
export function discoveryRoasters(items: RoasterCard[], state: Pick<SearchState, 'q' | 'filters' | 'sort'>, isFavorite: (slug: string) => boolean = () => false): RoasterCard[] {
  const filters = state.filters as ShopFilters;
  const selected = filters.roasters ?? [];
  if (!selected.length && !state.q && Object.entries(normalizeFilters(filters)).some(([key, value]) => !['city', 'favoritesOnly'].includes(key) && value !== false)) return [];
  return filterRoasters(items, { ...state, q: selected.length ? '' : state.q, filters: { favoritesOnly: filters.favoritesOnly } }, isFavorite)
    .filter(item => !selected.length || !!item.address.slug && selected.includes(item.address.slug));
}
export function normalizeFilters(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.keys(value).sort().flatMap(key => {
    const raw = value[key];
    const next = Array.isArray(raw) ? [...new Set(raw)].sort() : raw && typeof raw === 'object' ? normalizeFilters(raw as Record<string, unknown>) : raw;
    return next === undefined || next === '' || (Array.isArray(next) && !next.length) || (next && typeof next === 'object' && !Object.keys(next).length) ? [] : [[key, next]];
  }));
}
export function readSearchState(params: URLSearchParams, kind: CatalogKind): SearchState {
  const q = normalizeQuery(params.get('q') ?? '');
  // Invalid saved codes remain visible for explicit removal and server validation.
  const raw = params.get('filters');
  const filters: unknown = raw ? JSON.parse(raw) : kind === 'coffees' ? { availableOnly: true } : kind === 'shops' ? {
    city: params.get('citySlug') || params.get('city') || undefined,
    roasters: params.get('roasterSlug') ? [params.get('roasterSlug')] : undefined,
    favoritesOnly: params.get('filter') === 'favorite' || undefined,
  } : {};
  if (!filters || Array.isArray(filters) || typeof filters !== 'object') throw new Error('Некорректные фильтры в адресе');
  const page = (key: string) => {
    const value = Number(params.get(key) ?? 1);
    if (!Number.isInteger(value) || value < 1 || value > 100000) throw new Error('Некорректная страница в адресе');
    return value;
  };
  const sort = params.get('sort') ?? (q ? 'relevance' : 'name_asc');
  if (!sorts[kind].includes(sort)) throw new Error('Некорректная сортировка в адресе');
  return { q, filters: normalizeFilters(filters as Record<string, unknown>), sort, page: page('page'), coffeeShopsPage: page('shopsPage'), roastersPage: page('roastersPage') };
}
export function writeSearchState(state: SearchState, kind: CatalogKind): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q) params.set('q', normalizeQuery(state.q));
  const filters = normalizeFilters(state.filters);
  if (Object.keys(filters).length || kind === 'shops') params.set('filters', JSON.stringify(filters));
  params.set('sort', state.sort);
  if (kind === 'discovery') { params.set('shopsPage', String(state.coffeeShopsPage)); params.set('roastersPage', String(state.roastersPage)); }
  else params.set('page', String(state.page));
  return params;
}
export function applyCriteria(state: SearchState, changes: Partial<SearchState>): SearchState {
  return { ...state, ...changes, page: 1, coffeeShopsPage: 1, roastersPage: 1 };
}
export function canSortByPrice(filters: CoffeeFilters): boolean { return !!filters.currency && !!filters.weightGrams; }
export function validateSearch(state: SearchState, kind: CatalogKind): Record<string, string> {
  const result = filterSchemas[kind].safeParse(state.filters);
  const errors = result.success ? {} : Object.fromEntries(result.error.issues.map(issue => [issue.path.join('.'), issue.message]));
  if (state.q.length > 100) errors.q = 'Не более 100 символов';
  if (state.sort === 'relevance' && !state.q) errors.sort = 'Для релевантности введите запрос';
  if (kind === 'coffees' && state.sort.startsWith('price_') && !canSortByPrice(state.filters as CoffeeFilters)) errors.sort = 'Для сортировки по цене выберите валюту и вес';
  if (state.sort === 'distance_asc' && !state.filters.origin) errors.sort = 'Для расстояния нужны координаты';
  return errors;
}
export function transferDiscovery(state: SearchState, kind: 'shops' | 'roasters'): SearchState {
  const { brew, budget } = state.filters as DiscoveryFilters;
  const shopCriteria = !!brew?.length || budget?.minDrinkPrice !== undefined || budget?.maxDrinkPrice !== undefined || budget?.drinkVolumeMl !== undefined;
  const menu = normalizeFilters({ brew, currency: budget?.currency, minPrice: budget?.minDrinkPrice, maxPrice: budget?.maxDrinkPrice, volumeMl: budget?.drinkVolumeMl });
  return applyCriteria(state, { filters: kind === 'shops' && shopCriteria ? { menu } : {}, sort: state.q ? 'relevance' : 'name_asc' });
}
export function safePurchaseUrl(value: string): string | undefined {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
