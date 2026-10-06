import { httpClient } from './core/httpClient';

export const coffeeGroups = ['brew', 'caffeine', 'roast', 'acidity', 'processing', 'fermentation', 'taste', 'composition'] as const;
export type GroupCode = typeof coffeeGroups[number];
export interface DictionaryEntry { id: string; slug?: string; code?: string; groupCode?: GroupCode; name: string; description: string | null; sortOrder: number; isActive: boolean }
export interface CoffeeContent {
  name: string; description: string | null; productKind: string; productForm: string; compositionKind: string;
  processing: string | null; roastLevel: string | null; acidity: string | null; body: string | null; qGraderScoreRaw: string | null;
  tasteDescriptors: string[]; brewRecommendations: string[]; grindOptions: string[]; features: string[];
}
export interface Classification { defaultBrewPurposes: string[]; caffeine: string | null; roastLevel: string | null; acidity: string | null; processing: string[]; fermentation: string[]; tasteGroups: string[]; composition: string | null }
export interface AdminClassification { id: string; classification: Classification; protectedFields: (keyof Classification)[]; variants: { id: string; brewPurpose: string | null; protectFromImport: boolean }[]; version: number }
export interface CoffeeVariant { weightGrams: number | null; price: number; currency: string; grind: string | null; roastPurpose: string | null; availability: string; availabilityScope: string; sellerName: string; sourceUrl: string; checkedAtUtc: string }
export interface AdminCoffee {
  id: string; roasterId: string; slug: string | null; status: 'Draft' | 'Published' | 'Archived'; content: CoffeeContent;
  countries: { code: string; nameRu: string; nameEn: string }[]; protectedFields: string[];
  photos: { fullUrl: string; urls?: { card?: string; detail?: string } | null }[]; variants: CoffeeVariant[]; reviewWarnings: string[]; version: number;
}
export interface CoffeeEdit { content: CoffeeContent; countryCodes: string[]; protectedFields: string[]; status: AdminCoffee['status']; version: number }
export interface CoffeePage { items: AdminCoffee[]; totalItems: number; totalPages: number; currentPage: number; pageSize: number }
export interface ImportRun { id: string; sourceKey: string; snapshotId: string; status: 'Applied' | 'Failed'; collectedAtUtc: string; appliedAtUtc: string; products: number; variants: number; added: number; missingAvailabilityApplied: boolean; error: string | null }
export const dictionaryPath = (kind: 'tags' | 'values') => `/api/admin/${kind === 'tags' ? 'roaster-tags' : 'coffee-filter-values'}`;
export const getDictionary = async (kind: 'tags' | 'values', signal?: AbortSignal) => (await httpClient.get<DictionaryEntry[]>(dictionaryPath(kind), { signal })).data;
export const createDictionaryEntry = async (kind: 'tags' | 'values', body: { slug?: string; code?: string; groupCode?: GroupCode; name: string; description: string | null; sortOrder: number }) => (await httpClient.post<DictionaryEntry>(dictionaryPath(kind), body)).data;
export const editDictionaryEntry = async (kind: 'tags' | 'values', id: string, body: Pick<DictionaryEntry, 'name' | 'description' | 'sortOrder' | 'isActive'>) => (await httpClient.patch<DictionaryEntry>(`${dictionaryPath(kind)}/${encodeURIComponent(id)}`, body)).data;
export const deactivateDictionaryEntry = async (kind: 'tags' | 'values', id: string) => (await httpClient.delete<DictionaryEntry>(`${dictionaryPath(kind)}/${encodeURIComponent(id)}`)).data;
export const getAssignedTags = async (id: string, signal?: AbortSignal) => (await httpClient.get<DictionaryEntry[]>(`/api/admin/roasters/${encodeURIComponent(id)}/tags`, { signal })).data;
export const setAssignedTags = async (id: string, tagIds: string[]) => { await httpClient.put<void>(`/api/admin/roasters/${encodeURIComponent(id)}/tags`, { tagIds }); };
export const getAdminCoffees = async (params: { page: number; pageSize: number; status?: string }, signal?: AbortSignal) => (await httpClient.get<CoffeePage>('/api/admin/coffees', { params, signal })).data;
export const getAdminCoffee = async (id: string, signal?: AbortSignal) => (await httpClient.get<AdminCoffee>(`/api/admin/coffees/${encodeURIComponent(id)}`, { signal })).data;
export const editAdminCoffee = async (id: string, body: CoffeeEdit) => (await httpClient.patch<AdminCoffee>(`/api/admin/coffees/${encodeURIComponent(id)}`, body)).data;
export const getClassification = async (id: string, signal?: AbortSignal) => (await httpClient.get<AdminClassification>(`/api/admin/coffees/${encodeURIComponent(id)}/classification`, { signal })).data;
export const editClassification = async (id: string, body: Pick<AdminClassification, 'classification' | 'protectedFields' | 'version'>) => (await httpClient.patch<AdminClassification>(`/api/admin/coffees/${encodeURIComponent(id)}/classification`, body)).data;
export const editVariantClassification = async (id: string, variantId: string, body: { brewPurpose: string | null; protectFromImport: boolean; version: number }) => (await httpClient.patch<AdminClassification>(`/api/admin/coffees/${encodeURIComponent(id)}/variants/${encodeURIComponent(variantId)}/classification`, body)).data;
export const getImportRuns = async (limit: number, signal?: AbortSignal) => (await httpClient.get<ImportRun[]>('/api/admin/coffee-import/runs', { params: { limit }, signal })).data;
