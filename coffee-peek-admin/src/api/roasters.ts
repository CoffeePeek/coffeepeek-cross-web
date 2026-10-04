import { httpClient } from './core/httpClient';
import { API_ENDPOINTS } from './core/apiConfig';
import { ApiResponse, PaginatedMeta } from './core/types';
import { ModerationStatus, PaginatedResult } from './admin';
import { UploadedPhotoDto } from './menu';

interface ListParams {
  status?: ModerationStatus;
  page?: number;
  pageSize?: number;
}

function toPaginatedResult<T>(
  items: T[],
  meta: PaginatedMeta | undefined,
  fallbackPage: number,
  fallbackPageSize: number
): PaginatedResult<T> {
  return {
    items,
    totalCount: meta?.totalCount ?? items.length,
    totalPages: meta?.totalPages ?? 1,
    page: meta?.currentPage ?? fallbackPage,
    pageSize: meta?.pageSize ?? fallbackPageSize,
  };
}

function mapModerationStatus(status: ModerationStatus | number | undefined): ModerationStatus {
  if (status === undefined || status === null) return 'Pending';
  if (typeof status === 'string') return status;
  return (['Pending', 'Approved', 'Rejected'][status] ?? 'Pending') as ModerationStatus;
}

function buildStatusParams(id: string, status: ModerationStatus, comment?: string) {
  return {
    id,
    status,
    ...(comment?.trim() ? { comment: comment.trim() } : {}),
  };
}

// ==================== Shared shapes ====================

export interface RoasterPhoto {
  id?: string;
  fileName?: string | null;
  storageKey: string;
  fullUrl: string;
  sortIndex?: number;
}

export interface RoasterLocation {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface RoasterContact {
  instagramLink?: string | null;
  siteLink?: string | null;
}

// ==================== Moderation queue ====================

export interface ModerationRoaster {
  id: string;
  name: string;
  about?: string | null;
  cityId?: string | null;
  location?: RoasterLocation | null;
  contact?: RoasterContact | null;
  photos: RoasterPhoto[];
  status: ModerationStatus;
}

interface BackendModerationRoaster {
  id: string;
  name: string;
  about?: string | null;
  cityId?: string | null;
  location?: RoasterLocation | null;
  contact?: RoasterContact | null;
  photos?: RoasterPhoto[] | null;
  status?: ModerationStatus | number;
  moderationStatus?: ModerationStatus | number;
}

interface GetAllModerationRoastersResponse {
  items: BackendModerationRoaster[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

function mapModerationRoaster(raw: BackendModerationRoaster): ModerationRoaster {
  return {
    id: raw.id,
    name: raw.name,
    about: raw.about ?? undefined,
    cityId: raw.cityId ?? undefined,
    location: raw.location ?? undefined,
    contact: raw.contact ?? undefined,
    photos: raw.photos ?? [],
    status: mapModerationStatus(raw.status ?? raw.moderationStatus),
  };
}

export async function getModerationRoasters(
  params: ListParams = {}
): Promise<ApiResponse<PaginatedResult<ModerationRoaster>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const response = await httpClient.get<GetAllModerationRoastersResponse>(
    API_ENDPOINTS.MODERATION.ROASTERS,
    { params: { status: params.status, page, pageSize } }
  );
  const raw = response.data as unknown as GetAllModerationRoastersResponse;

  return {
    ...response,
    data: toPaginatedResult((raw.items ?? []).map(mapModerationRoaster), response.meta, page, pageSize),
  };
}

export async function getModerationRoasterById(id: string): Promise<ApiResponse<ModerationRoaster>> {
  const response = await httpClient.get<BackendModerationRoaster>(
    API_ENDPOINTS.MODERATION.ROASTER_BY_ID(id)
  );
  return { ...response, data: mapModerationRoaster(response.data) };
}

export async function approveRoaster(id: string, comment?: string): Promise<ApiResponse<void>> {
  return httpClient.put<void>(API_ENDPOINTS.MODERATION.ROASTER_STATUS, undefined, {
    params: buildStatusParams(id, 'Approved', comment),
  });
}

export async function rejectRoaster(id: string, comment?: string): Promise<ApiResponse<void>> {
  return httpClient.put<void>(API_ENDPOINTS.MODERATION.ROASTER_STATUS, undefined, {
    params: buildStatusParams(id, 'Rejected', comment),
  });
}

// ==================== Published roaster ====================

export interface RoasterDetails {
  id: string;
  cityId?: string | null;
  name: string;
  about?: string | null;
  location?: RoasterLocation | null;
  contact?: RoasterContact | null;
  photos: RoasterPhoto[];
  shops: Array<{ id: string; name: string }>;
}

export async function getRoasterById(id: string): Promise<ApiResponse<RoasterDetails>> {
  const response = await httpClient.get<Record<string, unknown>>(API_ENDPOINTS.ADMIN.CATALOG_ROASTER_BY_ID(id), {
    requiresAuth: true,
  });
  const raw = response.data ?? {};

  return {
    ...response,
    data: {
      id: String(raw.id ?? id),
      cityId: (raw.cityId as string | null | undefined) ?? null,
      name: String(raw.name ?? ''),
      about: (raw.about as string | null | undefined) ?? undefined,
      location: (raw.location as RoasterLocation | null | undefined) ?? undefined,
      contact: (raw.contact as RoasterContact | null | undefined) ?? undefined,
      photos: (raw.photos as RoasterPhoto[] | null | undefined) ?? [],
      shops: (raw.shops as Array<{ id: string; name: string }> | null | undefined) ?? [],
    },
  };
}

export interface UpdateRoasterRequest {
  name: string;
  about?: string | null;
  cityId?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  instagramLink?: string | null;
  siteLink?: string | null;
  photos?: UploadedPhotoDto[] | null;
}

export async function updateRoaster(
  id: string,
  data: UpdateRoasterRequest
): Promise<ApiResponse<{ id: string; name: string }>> {
  return httpClient.patch<{ id: string; name: string }>(
    API_ENDPOINTS.ADMIN.CATALOG_ROASTER_BY_ID(id),
    data
  );
}

export async function deleteRoaster(id: string): Promise<ApiResponse<void>> {
  return httpClient.delete<void>(API_ENDPOINTS.ADMIN.CATALOG_ROASTER_BY_ID(id));
}
