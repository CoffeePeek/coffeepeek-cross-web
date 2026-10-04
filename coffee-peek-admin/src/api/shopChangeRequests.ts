import { httpClient } from './core/httpClient';
import { API_ENDPOINTS } from './core/apiConfig';

export type ShopChangeSection =
  | 'Photos' | 'Contacts' | 'Description' | 'Tags'
  | 'Roasters' | 'Equipment' | 'Menu' | 'BrewMethods';
export type ShopChangeStatus = 'Pending' | 'Approved' | 'Rejected';
export type MenuItemAvailability = 'Unknown' | 'Present' | 'Absent';

export interface UploadedPhotoDto {
  fileName: string;
  contentType: string;
  storageKey: string;
  size: number;
  fullUrl?: string | null;
}

export interface ShopChangePayloadDto {
  description?: string | null;
  contacts?: {
    phoneNumber: string | null;
    email: string | null;
    siteLink: string | null;
    instagramLink: string | null;
  } | null;
  photos?: { retainedPhotoIds: string[]; newPhotos: UploadedPhotoDto[] } | null;
  tagIds?: string[] | null;
  roasterIds?: string[] | null;
  equipmentIds?: string[] | null;
  menu?: {
    items: Array<{
      slug: string;
      availability: MenuItemAvailability;
      price: number | null;
      volumeMl: number | null;
    }>;
    retainedPhotoIds: string[];
    newPhotos: UploadedPhotoDto[];
  } | null;
  brewMethodIds?: string[] | null;
}

export interface ShopChangeRequestDto {
  id: string;
  shopId: string;
  submittedByUserId: string;
  section: ShopChangeSection;
  payload: ShopChangePayloadDto;
  status: ShopChangeStatus;
  reviewedByUserId: string | null;
  reviewedAtUtc: string | null;
  rejectionReason: string | null;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

export interface ShopChangeRequestPageDto {
  items: ShopChangeRequestDto[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface ShopChangeRequestQuery {
  page?: number;
  pageSize?: number;
  status?: ShopChangeStatus;
  shopId?: string;
  section?: ShopChangeSection;
  submittedByUserId?: string;
}

export function getShopChangeRequests(query: ShopChangeRequestQuery = {}) {
  return httpClient.get<ShopChangeRequestPageDto>(API_ENDPOINTS.SHOP_CHANGE_REQUESTS.BASE, { params: query });
}

export function getShopChangeRequest(id: string) {
  return httpClient.get<ShopChangeRequestDto>(API_ENDPOINTS.SHOP_CHANGE_REQUESTS.BY_ID(id));
}

export function updateShopChangeRequest(
  id: string,
  body: { section: ShopChangeSection; payload: ShopChangePayloadDto }
) {
  return httpClient.put<ShopChangeRequestDto>(API_ENDPOINTS.SHOP_CHANGE_REQUESTS.BY_ID(id), body);
}

export function reviewShopChangeRequest(
  id: string,
  status: Exclude<ShopChangeStatus, 'Pending'>,
  comment: string | null
) {
  return httpClient.put<ShopChangeRequestDto>(API_ENDPOINTS.SHOP_CHANGE_REQUESTS.STATUS(id), { status, comment });
}
