import { httpClient } from './core/httpClient';
import { API_ENDPOINTS } from './core/apiConfig';
import { ApiResponse, PaginatedMeta } from './core/types';
import {
  CoffeeFocus,
  CollectorBucket,
  DuplicateSuggestionStatus,
  GoogleBusinessStatus,
  ImportSource,
  KnownQueueStatus,
  QueueStatus,
  RejectReason,
  BUCKET_TO_API,
  COFFEE_FOCUS_TO_API,
  DUPLICATE_STATUS_TO_API,
  IMPORT_SOURCE_TO_API,
  QUEUE_STATUS_TO_API,
  REJECT_REASON_TO_API,
  fallbackResearchLinks,
  looksLikeNameSearch,
  parseBucket,
  parseCoffeeFocus,
  parseDuplicateStatus,
  parseGoogleStatus,
  parseImportSource,
  parseRejectReason,
} from '../constants/catalogIngest';
import { parseFacts, safeHttpUrl } from '../utils/importDossier';
import {
  AttachMenuPhotosRequest,
  ShopMenuDto,
  UpdateShopMenuRequest,
  mapShopMenu,
} from './menu';

export interface ResearchLinks {
  instagram: string;
  googleMaps: string;
  yandexMaps: string;
  yandexImages: string;
  osmHistory: string;
  yandexEmbed?: string;
  googleEmbed?: string;
  streetView?: string;
}

export interface ImportCandidate {
  id: string;
  source: ImportSource | 'Unknown';
  externalId: string;
  name?: string;
  brand?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  instagram?: string;
  openingHours?: string;
  cuisine?: string;
  osmUpdatedAt?: string;
  osmAgeDays?: number;
  checkDate?: string;
  createdAtUtc?: string;
  importedFromFile: boolean;
  signals: string[];
  collectorBucket?: CollectorBucket;
  queueStatus: QueueStatus;
  coffeeFocus?: CoffeeFocus;
  tagSlugs: string[];
  googleBusinessStatus?: GoogleBusinessStatus;
  googleMapsUri?: string;
  googleFetchedAt?: string;
  suggestReject?: boolean;
  rejectReason?: RejectReason;
  reviewedByUserId?: string;
  reviewedAtUtc?: string;
  resultingShopId?: string;
  research: ResearchLinks;
  facts?: string[];
  menu?: ShopMenuDto | null;
}

export interface ImportCandidatesQuery {
  status?: KnownQueueStatus;
  bucket?: CollectorBucket;
  focus?: CoffeeFocus;
  search?: string;
  /** When true, only candidates with a non-empty address. */
  hasAddress?: boolean;
  rejectReason?: RejectReason;
  source?: ImportSource;
  page?: number;
  pageSize?: number;
}

export interface ImportCandidatesPage {
  items: ImportCandidate[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ImportStats {
  pending: number;
  skipped: number;
  published: number;
  rejected: number;
  pendingDuplicates: number;
  publishedByFocus: Record<CoffeeFocus, number>;
  byBucket: Record<CollectorBucket, number>;
}

export interface DecideCandidateRequest {
  status: 'Published' | 'Rejected' | 'Skipped';
  coffeeFocus?: CoffeeFocus;
  tagSlugs?: string[];
  overrideClosed?: boolean;
  /** Required when status is Rejected. */
  rejectReason?: RejectReason;
}

export interface DuplicateCandidateSide {
  id: string;
  source: ImportSource | 'Unknown';
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  instagram?: string;
  queueStatus: QueueStatus;
  importedFromFile: boolean;
  resultingShopId?: string;
  externalId?: string;
}

export interface DuplicateSuggestion {
  id: string;
  score: number;
  distanceMeters?: number;
  reasons: string[];
  status: DuplicateSuggestionStatus;
  left: DuplicateCandidateSide;
  right: DuplicateCandidateSide;
}

export interface DuplicateSuggestionsPage {
  items: DuplicateSuggestion[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RefreshDuplicatesResult {
  scanned: number;
  suggested: number;
  alreadyTracked: number;
}

export interface DecideDuplicateResult {
  suggestionId: string;
  status: DuplicateSuggestionStatus;
  keeperCandidateId?: string;
  mergedCandidateId?: string;
}

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

/** Coordinates come either as a number or as `{ source, parsedValue }`. */
function asCoord(value: unknown): number | undefined {
  if (value && typeof value === 'object') {
    const raw = value as Record<string, unknown>;
    return asNumber(pick(raw, 'parsedValue', 'ParsedValue', 'source', 'Source'));
  }
  return asNumber(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function mapQueueStatus(value: unknown): QueueStatus {
  const labels: KnownQueueStatus[] = ['Pending', 'Skipped', 'Published', 'Rejected'];
  if (typeof value === 'number') return labels[value] ?? 'Unknown';
  if (typeof value === 'string' && labels.includes(value as KnownQueueStatus)) return value as KnownQueueStatus;
  return 'Unknown';
}

export function mapImportCandidate(rawInput: Record<string, unknown>): ImportCandidate {
  const raw = rawInput;
  const name = asString(pick(raw, 'name', 'Name'));
  const brand = asString(pick(raw, 'brand', 'Brand'));
  const address = asString(pick(raw, 'address', 'Address'));
  const latitude = asCoord(pick(raw, 'latitude', 'Latitude', 'lat', 'Lat'));
  const longitude = asCoord(pick(raw, 'longitude', 'Longitude', 'lon', 'Lon'));
  const instagram = asString(pick(raw, 'instagram', 'Instagram'));
  const website = asString(pick(raw, 'website', 'Website'));
  const externalId = asString(pick(raw, 'externalId', 'ExternalId')) ?? '';
  const googleMapsUri = safeHttpUrl(asString(pick(raw, 'googleMapsUri', 'GoogleMapsUri')));
  const source =
    parseImportSource(pick(raw, 'source', 'Source')) ??
    'Unknown';
  const apiLinks = asRecord(pick(raw, 'research', 'researchLinks', 'ResearchLinks'));
  const fallback = fallbackResearchLinks({
    name,
    brand,
    address,
    instagram,
    website,
    latitude,
    longitude,
    externalId,
    googleMapsUri,
    source,
  });
  const pickLink = (...keys: string[]) => {
    const value = safeHttpUrl(asString(pick(apiLinks, ...keys)));
    if (!value || looksLikeNameSearch(value)) return undefined;
    return value;
  };

  return {
    id: String(pick(raw, 'id', 'Id') ?? ''),
    source,
    externalId,
    name,
    brand,
    address,
    latitude,
    longitude,
    phone: asString(pick(raw, 'phone', 'Phone')),
    website,
    instagram,
    openingHours: asString(pick(raw, 'openingHours', 'OpeningHours')),
    cuisine: asString(pick(raw, 'cuisine', 'Cuisine')),
    osmUpdatedAt: asString(pick(raw, 'osmUpdatedAt', 'OsmUpdatedAt')),
    osmAgeDays: asNumber(pick(raw, 'osmAgeDays', 'OsmAgeDays')),
    checkDate: asString(pick(raw, 'checkDate', 'CheckDate')),
    createdAtUtc: asString(pick(raw, 'createdAtUtc', 'CreatedAtUtc')),
    importedFromFile:
      Boolean(pick(raw, 'importedFromFile', 'ImportedFromFile')) ||
      parseImportSource(pick(raw, 'source', 'Source')) === 'File' ||
      asStringArray(pick(raw, 'signals', 'Signals')).some((s) => s.toLowerCase().includes('import:file')),
    signals: asStringArray(pick(raw, 'signals', 'Signals')),
    collectorBucket: parseBucket(pick(raw, 'collectorBucket', 'CollectorBucket')),
    queueStatus: mapQueueStatus(pick(raw, 'queueStatus', 'QueueStatus')),
    coffeeFocus: parseCoffeeFocus(pick(raw, 'coffeeFocus', 'CoffeeFocus', 'type', 'Type')),
    tagSlugs: asStringArray(pick(raw, 'tagSlugs', 'TagSlugs')),
    googleBusinessStatus: parseGoogleStatus(
      pick(raw, 'googleBusinessStatus', 'GoogleBusinessStatus')
    ),
    googleMapsUri,
    googleFetchedAt: asString(pick(raw, 'googleFetchedAt', 'GoogleFetchedAt', 'googleFetchedAtUtc')),
    suggestReject: Boolean(pick(raw, 'suggestReject', 'SuggestReject')),
    rejectReason: parseRejectReason(pick(raw, 'rejectReason', 'RejectReason')),
    reviewedByUserId: asString(pick(raw, 'reviewedByUserId', 'ReviewedByUserId')),
    reviewedAtUtc: asString(pick(raw, 'reviewedAtUtc', 'ReviewedAtUtc')),
    resultingShopId: asString(pick(raw, 'resultingShopId', 'ResultingShopId')),
    research: {
      googleMaps: pickLink('googleMaps', 'GoogleMaps') ?? fallback.googleMaps,
      instagram: fallback.instagram,
      yandexMaps: pickLink('yandexMaps', 'YandexMaps') ?? fallback.yandexMaps,
      yandexImages: pickLink('yandexImages', 'YandexImages') ?? fallback.yandexImages,
      osmHistory: pickLink('osmHistory', 'OsmHistory') ?? fallback.osmHistory,
      yandexEmbed: pickLink('yandexEmbed', 'YandexEmbed') ?? fallback.yandexEmbed,
      googleEmbed: pickLink('googleEmbed', 'GoogleEmbed') ?? fallback.googleEmbed,
      streetView: pickLink('streetView', 'StreetView') ?? fallback.streetView,
    },
    facts: parseFacts(pick(raw, 'facts', 'Facts')),
    menu: mapShopMenu(pick(raw, 'menu', 'Menu') ?? (pick(raw, 'parseStatus', 'ParseStatus', 'items', 'Items') ? raw : undefined)),
  };
}

function unwrapCandidateList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const raw = asRecord(data);
  const nested = pick(raw, 'items', 'Items', 'candidates', 'Candidates', 'data', 'Data');
  if (Array.isArray(nested)) return nested;
  const inner = asRecord(nested);
  const innerList = pick(inner, 'items', 'Items', 'candidates', 'Candidates');
  return Array.isArray(innerList) ? innerList : [];
}

function mapPage(
  data: unknown,
  meta: PaginatedMeta | undefined,
  page: number,
  pageSize: number
): ImportCandidatesPage {
  const raw = asRecord(Array.isArray(data) ? {} : data);
  const items = unwrapCandidateList(data).map((item) => mapImportCandidate(asRecord(item)));
  const parsedPage = Number(
    pick(raw, 'currentPage', 'page', 'CurrentPage', 'Page') ?? meta?.currentPage ?? page
  );
  const parsedTotalPages = Number(
    pick(raw, 'totalPages', 'TotalPages') ?? meta?.totalPages ?? 0
  );
  const parsedPageSize = Number(pick(raw, 'pageSize', 'PageSize') ?? meta?.pageSize ?? pageSize);
  const totalCount = Number(
    pick(raw, 'totalItems', 'totalCount', 'TotalItems', 'TotalCount') ?? meta?.totalCount ?? items.length
  );

  return {
    items,
    totalCount,
    page: parsedPage > 0 ? parsedPage : page,
    pageSize: parsedPageSize > 0 ? parsedPageSize : pageSize,
    totalPages:
      parsedTotalPages > 0
        ? parsedTotalPages
        : Math.max(1, Math.ceil(totalCount / (parsedPageSize > 0 ? parsedPageSize : pageSize))),
  };
}

export async function getImportCandidates(
  params: ImportCandidatesQuery = {}
): Promise<ApiResponse<ImportCandidatesPage>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const response = await httpClient.get<unknown>(API_ENDPOINTS.ADMIN.IMPORT_CANDIDATES, {
    params: {
      status: params.status !== undefined ? QUEUE_STATUS_TO_API[params.status] : undefined,
      bucket: params.bucket !== undefined ? BUCKET_TO_API[params.bucket] : undefined,
      focus: params.focus !== undefined ? COFFEE_FOCUS_TO_API[params.focus] : undefined,
      search: params.search,
      hasAddress: params.hasAddress === true ? true : undefined,
      rejectReason:
        params.rejectReason !== undefined ? REJECT_REASON_TO_API[params.rejectReason] : undefined,
      source: params.source !== undefined ? IMPORT_SOURCE_TO_API[params.source] : undefined,
      page,
      pageSize,
    },
  });

  return { ...response, data: mapPage(response.data, response.meta, page, pageSize) };
}

export async function getImportCandidate(id: string): Promise<ApiResponse<ImportCandidate>> {
  const response = await httpClient.get<Record<string, unknown>>(
    API_ENDPOINTS.ADMIN.IMPORT_CANDIDATE_BY_ID(id)
  );
  return { ...response, data: mapImportCandidate(asRecord(response.data)) };
}

export async function attachImportCandidateMenuPhotos(
  id: string,
  body: AttachMenuPhotosRequest
): Promise<ApiResponse<ImportCandidate>> {
  const response = await httpClient.post<Record<string, unknown>>(
    API_ENDPOINTS.ADMIN.IMPORT_CANDIDATE_MENU_PHOTOS(id),
    body
  );
  return { ...response, data: mapImportCandidate(asRecord(response.data)) };
}

export async function parseImportCandidateMenu(id: string): Promise<ApiResponse<ImportCandidate>> {
  const response = await httpClient.post<Record<string, unknown>>(
    API_ENDPOINTS.ADMIN.IMPORT_CANDIDATE_MENU_PARSE(id)
  );
  return { ...response, data: mapImportCandidate(asRecord(response.data)) };
}

export async function updateImportCandidateMenu(
  id: string,
  body: UpdateShopMenuRequest
): Promise<ApiResponse<ImportCandidate>> {
  const response = await httpClient.put<Record<string, unknown>>(
    API_ENDPOINTS.ADMIN.IMPORT_CANDIDATE_MENU(id),
    body
  );
  return { ...response, data: mapImportCandidate(asRecord(response.data)) };
}

export async function patchImportCandidate(
  id: string,
  body: { instagram?: string | null; phone?: string | null; website?: string | null }
): Promise<ApiResponse<ImportCandidate> & { patchMissing?: boolean }> {
  try {
    const response = await httpClient.patch<Record<string, unknown>>(
      API_ENDPOINTS.ADMIN.IMPORT_CANDIDATE_BY_ID(id),
      body
    );
    return { ...response, data: mapImportCandidate(asRecord(response.data)) };
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status === 404 || status === 405 || status === 501) {
      return {
        success: false,
        isSuccess: false,
        message: 'PATCH контактов ещё нет на бэке',
        data: undefined as unknown as ImportCandidate,
        patchMissing: true,
      };
    }
    throw error;
  }
}

export async function decideImportCandidate(
  id: string,
  body: DecideCandidateRequest
): Promise<ApiResponse<ImportCandidate>> {
  const payload: Record<string, unknown> = {
    status: QUEUE_STATUS_TO_API[body.status],
    overrideClosed: body.overrideClosed ?? false,
    tagSlugs: body.tagSlugs ?? [],
  };
  if (body.coffeeFocus) {
    const focus = COFFEE_FOCUS_TO_API[body.coffeeFocus];
    payload.coffeeFocus = focus;
    payload.type = focus;
  }
  if (body.status === 'Rejected' && body.rejectReason && body.rejectReason !== 'duplicate') {
    payload.rejectReason = REJECT_REASON_TO_API[body.rejectReason];
  }

  const response = await httpClient.post<Record<string, unknown>>(
    API_ENDPOINTS.ADMIN.IMPORT_CANDIDATE_DECIDE(id),
    payload
  );
  return { ...response, data: mapImportCandidate(asRecord(response.data)) };
}

export async function getImportStats(): Promise<ApiResponse<ImportStats>> {
  const response = await httpClient.get<Record<string, unknown>>(API_ENDPOINTS.ADMIN.IMPORT_STATS);
  const raw = asRecord(response.data);
  const byFocus = asRecord(pick(raw, 'publishedByFocus', 'PublishedByFocus'));
  const byBucket = asRecord(pick(raw, 'byBucket', 'ByBucket'));

  return {
    ...response,
    data: {
      pending: Number(pick(raw, 'pending', 'Pending') ?? 0),
      skipped: Number(pick(raw, 'skipped', 'Skipped') ?? 0),
      published: Number(pick(raw, 'published', 'Published') ?? 0),
      rejected: Number(pick(raw, 'rejected', 'Rejected') ?? 0),
      pendingDuplicates: Number(pick(raw, 'pendingDuplicates', 'PendingDuplicates') ?? 0),
      publishedByFocus: {
        specialty: Number(pick(byFocus, 'specialty', 'Specialty') ?? 0),
        coffee_bar: Number(pick(byFocus, 'coffee_bar', 'CoffeeBar', 'coffeeBar') ?? 0),
        cafe: Number(pick(byFocus, 'cafe', 'Cafe') ?? 0),
      },
      byBucket: {
        priority: Number(pick(byBucket, 'priority', 'Priority') ?? 0),
        review: Number(pick(byBucket, 'review', 'Review') ?? 0),
        noise: Number(pick(byBucket, 'noise', 'Noise') ?? 0),
        vending: Number(pick(byBucket, 'vending', 'Vending') ?? 0),
      },
    },
  };
}

export async function refreshOsmImport(): Promise<ApiResponse<unknown>> {
  return httpClient.post(API_ENDPOINTS.ADMIN.IMPORT_OSM_REFRESH);
}

function mapDuplicateSide(rawInput: unknown): DuplicateCandidateSide {
  const raw = asRecord(rawInput);
  const source =
    parseImportSource(pick(raw, 'source', 'Source')) ??
    'Unknown';
  return {
    id: String(pick(raw, 'id', 'Id') ?? ''),
    source,
    name: asString(pick(raw, 'name', 'Name')),
    address: asString(pick(raw, 'address', 'Address')),
    latitude: asCoord(pick(raw, 'latitude', 'Latitude', 'lat', 'Lat')),
    longitude: asCoord(pick(raw, 'longitude', 'Longitude', 'lon', 'Lon')),
    phone: asString(pick(raw, 'phone', 'Phone')),
    website: asString(pick(raw, 'website', 'Website')),
    instagram: asString(pick(raw, 'instagram', 'Instagram')),
    queueStatus: mapQueueStatus(pick(raw, 'queueStatus', 'QueueStatus')),
    importedFromFile:
      Boolean(pick(raw, 'importedFromFile', 'ImportedFromFile')) || source === 'File',
    resultingShopId: asString(pick(raw, 'resultingShopId', 'ResultingShopId')),
    externalId: asString(pick(raw, 'externalId', 'ExternalId')),
  };
}

function mapDuplicateSuggestion(rawInput: unknown): DuplicateSuggestion {
  const raw = asRecord(rawInput);
  return {
    id: String(pick(raw, 'id', 'Id') ?? ''),
    score: Number(pick(raw, 'score', 'Score') ?? 0),
    distanceMeters: asNumber(pick(raw, 'distanceMeters', 'DistanceMeters')),
    reasons: asStringArray(pick(raw, 'reasons', 'Reasons')),
    status: parseDuplicateStatus(pick(raw, 'status', 'Status')),
    left: mapDuplicateSide(pick(raw, 'left', 'Left')),
    right: mapDuplicateSide(pick(raw, 'right', 'Right')),
  };
}

export async function getDuplicateSuggestions(
  params: {
    status?: Exclude<DuplicateSuggestionStatus, 'Unknown'>;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<ApiResponse<DuplicateSuggestionsPage>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const response = await httpClient.get<unknown>(API_ENDPOINTS.ADMIN.IMPORT_DUPLICATES, {
    params: {
      status: params.status !== undefined ? DUPLICATE_STATUS_TO_API[params.status] : undefined,
      page,
      pageSize,
    },
  });

  const raw = asRecord(Array.isArray(response.data) ? {} : response.data);
  const items = unwrapCandidateList(response.data).map(mapDuplicateSuggestion);
  const parsedPage = Number(
    pick(raw, 'currentPage', 'page', 'CurrentPage', 'Page') ?? response.meta?.currentPage ?? page
  );
  const parsedPageSize = Number(
    pick(raw, 'pageSize', 'PageSize') ?? response.meta?.pageSize ?? pageSize
  );
  const totalCount = Number(
    pick(raw, 'totalItems', 'totalCount', 'TotalItems', 'TotalCount') ??
      response.meta?.totalCount ??
      items.length
  );
  const parsedTotalPages = Number(
    pick(raw, 'totalPages', 'TotalPages') ?? response.meta?.totalPages ?? 0
  );

  return {
    ...response,
    data: {
      items,
      totalCount,
      page: parsedPage > 0 ? parsedPage : page,
      pageSize: parsedPageSize > 0 ? parsedPageSize : pageSize,
      totalPages:
        parsedTotalPages > 0
          ? parsedTotalPages
          : Math.max(1, Math.ceil(totalCount / (parsedPageSize > 0 ? parsedPageSize : pageSize))),
    },
  };
}

export async function refreshDuplicateSuggestions(): Promise<ApiResponse<RefreshDuplicatesResult>> {
  const response = await httpClient.post<Record<string, unknown>>(
    API_ENDPOINTS.ADMIN.IMPORT_DUPLICATES_REFRESH
  );
  const raw = asRecord(response.data);
  return {
    ...response,
    data: {
      scanned: Number(pick(raw, 'scanned', 'Scanned') ?? 0),
      suggested: Number(pick(raw, 'suggested', 'Suggested') ?? 0),
      alreadyTracked: Number(pick(raw, 'alreadyTracked', 'AlreadyTracked') ?? 0),
    },
  };
}

export async function decideDuplicateSuggestion(
  id: string,
  accept: boolean
): Promise<ApiResponse<DecideDuplicateResult>> {
  const response = await httpClient.post<Record<string, unknown>>(
    API_ENDPOINTS.ADMIN.IMPORT_DUPLICATE_DECIDE(id),
    { accept }
  );
  const raw = asRecord(response.data);
  return {
    ...response,
    data: {
      suggestionId: String(pick(raw, 'suggestionId', 'SuggestionId') ?? id),
      status: parseDuplicateStatus(pick(raw, 'status', 'Status')),
      keeperCandidateId: asString(pick(raw, 'keeperCandidateId', 'KeeperCandidateId')),
      mergedCandidateId: asString(pick(raw, 'mergedCandidateId', 'MergedCandidateId')),
    },
  };
}
