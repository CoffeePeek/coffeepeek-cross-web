import type { PublicAddress } from './publicAddresses';
import { httpClient } from './core/httpClient';
import type { ApiResponse } from './core/types';
import type { UploadedPhotoDto } from './auth';

export type ShopChangeSection =
  | 'Photos' | 'Contacts' | 'Description' | 'Tags'
  | 'Roasters' | 'Equipment' | 'Menu' | 'BrewMethods';
export type ShopChangeStatus = 'Pending' | 'Approved' | 'Rejected';
export type MenuItemAvailability = 'Unknown' | 'Present' | 'Absent';

export interface ShopChangeContactsDto {
  phoneNumber: string | null;
  email: string | null;
  siteLink: string | null;
  instagramLink: string | null;
}

export interface ShopChangeGalleryDto {
  retainedPhotoIds: string[];
  newPhotos: UploadedPhotoDto[];
}

export interface UpdateShopMenuItemRequest {
  slug: string;
  availability: MenuItemAvailability;
  price: number | null;
  volumeMl: number | null;
}

export interface ShopChangeMenuDto extends ShopChangeGalleryDto {
  items: UpdateShopMenuItemRequest[];
}

export interface ShopChangePayloadDto {
  description?: string | null;
  contacts?: ShopChangeContactsDto | null;
  photos?: ShopChangeGalleryDto | null;
  tags?: string[] | null;
  roasters?: string[] | null;
  equipments?: string[] | null;
  menu?: ShopChangeMenuDto | null;
  brewMethods?: string[] | null;
}

export interface ShopChangeRequestDto {
  id: string;
  shop: PublicAddress | null;
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
  shop?: string;
  section?: ShopChangeSection;
}

const BASE = '/api/ShopChangeRequests';

export function createShopChangeRequest(body: {
  shop: string;
  section: ShopChangeSection;
  payload: ShopChangePayloadDto;
}): Promise<ApiResponse<ShopChangeRequestDto>> {
  return httpClient.post<ShopChangeRequestDto>(BASE, body);
}

export function getMyShopChangeRequests(
  query: ShopChangeRequestQuery = {}
): Promise<ApiResponse<ShopChangeRequestPageDto>> {
  return httpClient.get<ShopChangeRequestPageDto>(`${BASE}/mine`, { params: query });
}
