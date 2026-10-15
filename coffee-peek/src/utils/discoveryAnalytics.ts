import type { CatalogKind, SearchState } from './catalogSearch';

export interface CatalogAnalyticsContext {
  source: 'list' | 'map' | 'favorites' | 'related';
  search_id?: string;
  position?: number;
}

export interface DiscoverySearchProperties {
  catalog: CatalogKind;
  search_id: string;
  source: 'list' | 'map' | 'favorites';
  has_query: boolean;
  query_length: number;
  filter_keys: string[];
  sort: string;
  nearby: boolean;
  city_slug?: string;
}

export interface DiscoveryAnalyticsEvents {
  catalog_search_started: DiscoverySearchProperties;
  catalog_results_viewed: DiscoverySearchProperties & { result_count: number; is_empty: boolean; duration_ms: number };
  catalog_search_failed: DiscoverySearchProperties & { duration_ms: number; failure_category: 'network' | 'authorization' | 'validation' | 'server' | 'unknown'; http_status?: number };
  catalog_item_opened: CatalogAnalyticsContext & { entity_type: 'coffee_shop' | 'roaster' | 'coffee' };
  filters_opened: { catalog: CatalogKind; placement: 'desktop' | 'mobile' };
  filters_applied: { catalog: CatalogKind; filter_keys: string[]; changed_filter_keys: string[]; action: 'apply' | 'reset' };
  map_interaction: { action: 'expanded' | 'collapsed' | 'loaded' | 'load_failed' | 'marker_selected' | 'search_selected' | 'zones_toggled' | 'zoomed' | 'nearby_loaded' | 'nearby_failed'; result_count?: number; duration_ms?: number; enabled?: boolean };
  geolocation_result: { placement: 'discovery' | 'filters' | 'map'; trigger: 'automatic' | 'user'; outcome: 'available' | 'unavailable'; duration_ms?: number };
}

// Keep a closed vocabulary even when filters came from an untrusted URL.
const filterPaths = [
  'city', 'tags', 'excludeTags', 'roasters', 'isOpen', 'minRating', 'isNew', 'equipments', 'beans', 'brewMethods',
  'priceRange', 'type', 'visitedOnly', 'favoritesOnly', 'origin', 'radiusKm', 'countries', 'productKind', 'productForm',
  'brew', 'caffeine', 'roast', 'acidity', 'processing', 'fermentation', 'taste', 'composition', 'weightGrams', 'currency',
  'minPrice', 'maxPrice', 'availabilityScope', 'availableOnly', 'menu.brew', 'menu.currency', 'menu.minPrice',
  'menu.maxPrice', 'menu.volumeMl', 'budget.currency', 'budget.minDrinkPrice', 'budget.maxDrinkPrice',
  'budget.drinkVolumeMl', 'budget.minCoffeePrice', 'budget.maxCoffeePrice', 'budget.coffeeWeightGrams',
] as const;
const valueAt = (filters: Record<string, unknown>, path: string): unknown => path.split('.').reduce<unknown>((value, key) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, filters);
const present = (value: unknown) => value !== undefined && value !== null && value !== ''
  && (!Array.isArray(value) || value.length > 0) && (typeof value !== 'object' || Object.keys(value as object).length > 0);

export function analyticsFilterKeys(filters: Record<string, unknown>): string[] {
  return filterPaths.filter(path => present(valueAt(filters, path))).map(path => path === 'origin' ? 'nearby' : path).sort();
}

export function changedAnalyticsFilterKeys(previous: Record<string, unknown>, next: Record<string, unknown>): string[] {
  return filterPaths.filter(path => JSON.stringify(valueAt(previous, path)) !== JSON.stringify(valueAt(next, path)))
    .map(path => path === 'origin' ? 'nearby' : path).sort();
}

/** This fingerprint stays in component memory. Never send it to an analytics provider. */
export function discoveryCriteriaKey(catalog: CatalogKind, state: Pick<SearchState, 'q' | 'filters' | 'sort'>, source: DiscoverySearchProperties['source']): string {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? [...value].sort() : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])])) : value;
  return JSON.stringify([catalog, source, state.q.trim().replace(/\s+/g, ' '), canonical(state.filters), state.sort]);
}

export function discoverySearchProperties(catalog: CatalogKind, state: Pick<SearchState, 'q' | 'filters' | 'sort'>, source: DiscoverySearchProperties['source'], searchId: string, citySlug?: string): DiscoverySearchProperties {
  const queryLength = state.q.trim().replace(/\s+/g, ' ').length;
  return { catalog, search_id: searchId, source, has_query: queryLength > 0, query_length: Math.min(queryLength, 100),
    filter_keys: analyticsFilterKeys(state.filters), nearby: !!state.filters.origin,
    ...(citySlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(citySlug) && citySlug.length <= 100 ? { city_slug: citySlug } : {}),
    sort: ['name_asc', 'relevance', 'distance_asc', 'rating_desc', 'available_coffees_desc', 'price_asc', 'price_desc', 'newest'].includes(state.sort) ? state.sort : 'unknown' };
}

/** One logical criteria set, not one request: refetches and additional pages must not inflate funnels. */
export class DiscoverySearchSession {
  private started = false;
  private finished = false;
  readonly properties: DiscoverySearchProperties;
  private readonly createdAt: number;

  constructor(properties: DiscoverySearchProperties, createdAt: number) {
    this.properties = properties;
    this.createdAt = createdAt;
  }

  start(): DiscoverySearchProperties | null {
    if (this.started) return null;
    this.started = true;
    return this.properties;
  }

  results(count: number, now: number): DiscoveryAnalyticsEvents['catalog_results_viewed'] | null {
    if (!this.started || this.finished) return null;
    this.finished = true;
    const resultCount = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
    return { ...this.properties, result_count: resultCount, is_empty: resultCount === 0, duration_ms: Math.max(0, Math.round(now - this.createdAt)) };
  }

  failure(error: unknown, now: number): DiscoveryAnalyticsEvents['catalog_search_failed'] | null {
    if (!this.started || this.finished) return null;
    this.finished = true;
    const status = (error as { status?: unknown } | null)?.status;
    const httpStatus = typeof status === 'number' && status >= 100 && status <= 599 ? status : undefined;
    const category = httpStatus === 401 || httpStatus === 403 ? 'authorization' : httpStatus && httpStatus >= 500 ? 'server'
      : httpStatus && httpStatus >= 400 ? 'validation' : error instanceof TypeError ? 'network' : 'unknown';
    return { ...this.properties, duration_ms: Math.max(0, Math.round(now - this.createdAt)), failure_category: category,
      ...(httpStatus ? { http_status: httpStatus } : {}) };
  }
}
