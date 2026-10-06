import { httpClient } from './core/httpClient';
import type { PublicAddress } from './publicAddresses';
import type { CoffeeFilters, DiscoveryFilters, RoasterFilters, ShopFilters } from '../utils/catalogSearch';

export interface Photo { fullUrl: string; urls: { thumbnail: string; card: string; detail: string; fullscreen: string } | null }
export interface PublicTag { slug: string; name: string; description: string | null; sortOrder: number }
export interface FilterValue { code: string; name: string; description: string | null; sortOrder: number }
export interface FilterGroup { code: string; name: string; selection: 'or'; values: FilterValue[] }
export interface FacetGroup { code: string; name: string; selection: 'single' | 'or' | 'and'; options: { code: string; name: string; count: number; selected: boolean }[] }
export interface Facets { totalItems: number; groups: FacetGroup[]; priceRange?: { currency: string; weightGrams: number; min: number; max: number } | null }
export interface Classification {
  defaultBrewPurposes: string[]; caffeine: string | null; roastLevel: string | null; acidity: string | null;
  processing: string[]; fermentation: string[]; tasteGroups: string[]; composition: string | null;
}
export interface CoffeeOffer {
  offerKey: string; weightGrams: number | null; price: number; currency: 'BYN' | 'RUB';
  brewPurpose: string | null; grind: string | null; availability: 'InStock' | 'OutOfStock' | 'Unknown';
  availabilityScope: 'online' | 'in_store'; sellerName: string; sourceUrl: string; checkedAtUtc: string;
}
export interface CoffeeCard {
  address: PublicAddress; name: string; roaster: { address: PublicAddress; name: string; coverPhoto: Photo | null };
  productKind: 'roasted_beans' | 'green_beans'; productForm: 'whole_beans' | 'ground_only'; classification: Classification;
  countries: { code: string; nameRu: string; nameEn: string }[]; coverPhoto: Photo | null;
  matchingOffers: CoffeeOffer[]; sortPrice: number | null; createdAtUtc: string; catalogCheckedAtUtc: string | null;
}
export interface CoffeeDetails extends Omit<CoffeeCard, 'coverPhoto' | 'matchingOffers' | 'sortPrice'> {
  description: string | null; tasteDescriptors: string[]; photos: Photo[]; offers: CoffeeOffer[];
}
export interface RoasterCard {
  address: PublicAddress; name: string; coverPhoto: Photo | null; tags: PublicTag[]; isFavorite: boolean | null;
  availableCoffeeProducts: number; matchingCoffeeProducts: number | null;
  coffeeCatalogUpdatedAtUtc: string | null; matchingCoffee: CoffeeCard | null;
}
export interface MatchedMenuItem {
  drinkSlug: string; name: string; brewMethod: 'espresso' | 'filter'; price: number | null;
  currency: string; volumeMl: number | null; checkedAtUtc: string | null;
}
export interface ShopCard {
  address: PublicAddress; name: string; city: PublicAddress | null; addressLine: string; coverPhoto: Photo | null;
  rating: number; reviewCount: number; isOpen: boolean | null; isVisited: boolean | null;
  isFavorite: boolean | null; distanceMeters: number | null; tags: PublicTag[]; matchingMenuItems: MatchedMenuItem[];
}
export interface Page<T> { items: T[]; totalItems: number; totalPages: number; currentPage: number; pageSize: number }
export interface SearchRequest<F> { q: string; filters: F; sort: string; page: number; pageSize: number }
export interface DiscoveryRequest {
  q: string; filters: DiscoveryFilters; sections: ('coffee_shops' | 'roasters')[]; sort: 'relevance' | 'name_asc';
  coffeeShops: { page: number; pageSize: number }; roasters: { page: number; pageSize: number };
}
export interface DiscoveryResult { q: string; coffeeShops: Page<ShopCard> | null; roasters: Page<RoasterCard> | null }

const read = async <T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> =>
  (await httpClient.post<T>(path, body, { requiresAuth: false, signal })).data;
export const searchDiscovery = (body: DiscoveryRequest, signal?: AbortSignal) => read<DiscoveryResult>('/api/v1/discovery/search', body, signal);
export const searchShops = (body: SearchRequest<ShopFilters>, signal?: AbortSignal) => read<Page<ShopCard>>('/api/v1/coffee-shops/search', body, signal);
export const searchRoasters = (body: SearchRequest<RoasterFilters>, signal?: AbortSignal) => read<Page<RoasterCard>>('/api/v1/roasters/search', body, signal);
export const searchCoffees = (body: SearchRequest<CoffeeFilters>, signal?: AbortSignal) => read<Page<CoffeeCard>>('/api/v1/coffees/search', body, signal);
export const getCoffeeFacets = (body: { q: string; filters: CoffeeFilters }, signal?: AbortSignal) => read<Facets>('/api/v1/coffees/facets', body, signal);
export const getRoasterFacets = (body: { q: string; filters: RoasterFilters }, signal?: AbortSignal) => read<Facets>('/api/v1/roasters/facets', body, signal);
export const getCoffeeDetails = async (slug: string, signal?: AbortSignal) =>
  (await httpClient.get<CoffeeDetails>(`/api/v1/coffees/${encodeURIComponent(slug)}`, { requiresAuth: false, signal })).data;
export const getRoasterTags = async (signal?: AbortSignal) =>
  (await httpClient.get<PublicTag[]>('/api/v1/catalogs/roaster-tags', { requiresAuth: false, signal })).data;
export const getCoffeeFilterValues = async (signal?: AbortSignal) =>
  (await httpClient.get<FilterGroup[]>('/api/v1/catalogs/coffee-filter-values', { requiresAuth: false, signal })).data;
