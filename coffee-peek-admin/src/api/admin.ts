import { httpClient } from './core/httpClient';
import { API_ENDPOINTS, buildUrlWithParams } from './core/apiConfig';
import { ApiResponse, PaginatedMeta, PaginatedResponse } from './core/types';
import type { PriceRangeLevel } from '../constants/priceRange';
import { parsePriceRange, toPriceRangeLevel } from '../constants/priceRange';
import type { CoffeeFocus } from '../constants/catalogIngest';
import { COFFEE_FOCUS_TO_API, parseCoffeeFocus } from '../constants/catalogIngest';
import { mapShopMenu, ShopMenuDto } from './menu';
import { apiDayOfWeekToUi, uiDayToDotNetName } from '../utils/dayOfWeek';
import { schedulesFromUtc, schedulesToUtc } from '../utils/shopForm';

// ==================== Types ====================

export type ModerationStatus = 'Pending' | 'Approved' | 'Rejected';
export type UserRole = 'User' | 'Moderator' | 'Admin' | 'Owner' | 'Employee' | 'Roaster';

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface BackendShopContact {
  phoneNumber?: string | null;
  email?: string | null;
  siteLink?: string | null;
  instagramLink?: string | null;
}

interface BackendScheduleInterval {
  openTime: string;
  closeTime: string;
}

interface BackendSchedule {
  dayOfWeek: number | string;
  isClosed?: boolean;
  intervals?: BackendScheduleInterval[] | null;
}

interface BackendShopPhoto {
  fileName: string;
  storageKey: string;
  fullUrl: string;
}

interface BackendModerationShop {
  id: string;
  name: string;
  dataCompletenessScore: number;
  address?: string | null;
  addressIsValidated?: boolean;
  description?: string | null;
  /** Enums are serialized as names ("Moderate"); legacy numbers are still accepted. */
  priceRange?: number | string;
  cityId?: string | null;
  userId: string;
  moderationStatus: ModerationStatus | number;
  /** Published shop id; null until approval completes. */
  publishedShopId?: string | null;
  shopContact?: BackendShopContact | null;
  schedules?: BackendSchedule[] | null;
  equipmentIds?: string[];
  coffeeBeanIds?: string[];
  roasterIds?: string[];
  brewMethodIds?: string[];
  shopPhotos?: BackendShopPhoto[] | null;
  menu?: unknown;
}

interface BackendModerationReview {
  id: string;
  header: string;
  comment: string;
  drinkSlug?: string | null;
  customDrinkName?: string | null;
  drinkNameRu?: string | null;
  drinkNameEn?: string | null;
  userId: string;
  userName?: string;
  shopId: string;
  shopName?: string;
  rating?: {
    coffee: number;
    service: number;
    place: number;
  };
  rejectedReason?: string | null;
  createdAt: string;
  moderationStatus: ModerationStatus | number;
  photos?: PhotoMetadataDto[] | null;
}

export interface PhotoMetadataDto {
  id: string;
  fileName: string;
  contentType: string;
  storageKey: string;
  fullUrl: string | null;
  sizeBytes: number;
  ownerId: string;
  uploadedAt: string;
  sortIndex: number;
}

interface GetAllModerationShopsResponse {
  moderationShops: BackendModerationShop[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

interface GetAllModerationReviewsResponse {
  reviewDtos: BackendModerationReview[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

interface BackendAdminUser {
  id: string;
  userName: string;
  email: string;
  createdAtUtc: string;
  about: string | null;
  avatarUrl: string | null;
  reviewCount: number;
  checkInCount: number;
  addedShopsCount: number;
  roles: string[];
  isBlocked: boolean;
}

interface GetAdminUsersResponse {
  items: BackendAdminUser[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface AdminShopSchedule {
  dayOfWeek: number;
  isClosed?: boolean;
  openTime: string;
  closeTime: string;
  utcDayOfWeek?: number;
  openTimeUtc?: string;
  closeTimeUtc?: string;
}

export interface AdminCoffeeShop {
  id: string;
  name: string;
  dataCompletenessScore: number;
  address: string;
  cityId?: string;
  cityName?: string;
  userId?: string;
  addressIsValidated?: boolean;
  status: ModerationStatus;
  publishedShopId?: string;
  ownerEmail?: string;
  createdAtUtc: string;
  averageRating?: number;
  reviewCount?: number;
  description?: string;
  priceRange?: number;
  photos?: { fileName?: string; storageKey: string; fullUrl: string }[];
  shopContact?: {
    phone?: string;
    email?: string;
    website?: string;
    instagram?: string;
  };
  schedules?: AdminShopSchedule[];
  equipmentIds?: string[];
  coffeeBeanIds?: string[];
  roasterIds?: string[];
  brewMethodIds?: string[];
  equipments?: { id: string; name: string }[];
  beans?: { id: string; name: string }[];
  roasters?: { id: string; name: string }[];
  brewMethods?: { id: string; name: string }[];
  menu?: ShopMenuDto | null;
}

export interface UpdateCoffeeShopRequest {
  name?: string;
  address?: string;
  description?: string;
  priceRange?: number;
  cityId?: string;
  shopContact?: {
    phone?: string;
    email?: string;
    website?: string;
    instagram?: string;
  };
  schedules?: AdminShopSchedule[];
  equipmentIds?: string[];
  coffeeBeanIds?: string[];
  roasterIds?: string[];
  brewMethodIds?: string[];
}

export interface ModerationActionRequest {
  comment?: string;
}

export interface AdminReview {
  id: string;
  shopId: string;
  shopName: string;
  drinkSlug?: string | null;
  customDrinkName?: string | null;
  drinkNameRu?: string | null;
  drinkNameEn?: string | null;
  authorEmail: string;
  authorName?: string;
  header: string;
  comment: string;
  ratingCoffee: number;
  ratingService: number;
  ratingPlace: number;
  status: ModerationStatus;
  createdAtUtc: string;
  photos: { fileName?: string; storageKey: string; fullUrl: string }[];
}

export type ShopIssueCategory =
  | 'OutdatedMenu'
  | 'ShopClosed'
  | 'IncorrectAddress'
  | 'WrongOpeningHours'
  | 'IncorrectPhotos'
  | 'Other';

export type ShopIssueReportStatus = 'Submitted' | 'Reviewed' | 'Fixed' | 'Invalid';

export interface AdminShopIssueReport {
  id: string;
  shopId: string;
  reportedByUserId: string;
  category: ShopIssueCategory;
  description: string | null;
  status: ShopIssueReportStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAtUtc: string;
}

export interface AdminUser {
  id: string;
  userName: string;
  email: string;
  roles: UserRole[];
  about?: string | null;
  createdAtUtc: string;
  avatarUrl?: string | null;
  reviewCount: number;
  checkInCount: number;
  addedShopsCount: number;
  isBlocked: boolean;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  registeredToday: number;
  usersByRole: Record<string, number>;
}

export interface UpdateUserRoleRequest {
  role: UserRole;
}

export interface OverviewStats {
  totalUsers: number;
  usersRegisteredToday: number;
  /** activeUsers + blockedUsers + deletedUsers = totalUsers */
  activeUsers: number;
  /** Blocked and not deleted. */
  blockedUsers: number;
  deletedUsers: number;
  /** Rolling 24h / 7d / 30d, counted by login or token refresh. */
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  emailConfirmedUsers: number;
  googleUsers: number;
  totalCoffeeShops: number;
  totalReviews: number;
  pendingModerationShops: number;
  pendingModerationReviews: number;
  newCoffeeShopsToday: number;
  newReviewsToday: number;
  import: { pending: number; published: number; rejected: number; skipped: number; inFeed: number };
  /** false → shop-service numbers are placeholders. */
  shopsAvailable: boolean;
  /** false → moderation-service numbers are placeholders. */
  moderationAvailable: boolean;
}

export interface AdminDailyCount {
  /** YYYY-MM-DD (UTC) */
  date: string;
  count: number;
}

export interface AdminUsersTimeseries {
  days: number;
  newUsers: AdminDailyCount[];
}

export interface AdminShopsTimeseries {
  days: number;
  newShops: AdminDailyCount[];
  newReviews: AdminDailyCount[];
  newCheckIns: AdminDailyCount[];
}

export interface AdminTopShop {
  shopId: string;
  name: string;
  count: number;
}

export interface AdminShopsInsights {
  ratings: {
    totalReviews: number;
    averageRating: number;
    averagePlace: number;
    averageService: number;
    averageCoffee: number;
    distribution: { stars: number; count: number }[];
  };
  topShopsByCheckIns30Days: AdminTopShop[];
  topShopsByReviews: AdminTopShop[];
  downloads: {
    total: number;
    last30Days: number;
    byChannel: { channel: string; total: number; last30Days: number }[];
    topCountries30Days: { country: string; count: number }[];
  };
}

export type AdminModerationQueueName = 'shops' | 'reviews' | 'roasters' | 'changeRequests' | 'issueReports';

export interface AdminModerationInsights {
  sla: { reviewsModerated30Days: number; avgReviewModerationHours: number | null };
  queues: { queue: AdminModerationQueueName; pending: number; oldestPendingHours: number | null }[];
  oldestPendingHours: number | null;
  topModerators30Days: { moderatorUserId: string; total: number; approved: number; rejected: number }[];
}

export interface ClearCacheResponse {
  clearedCount: number;
  pattern: string;
}

export type CoffeeShopStatus = 'Active' | 'TemporarilyClosed' | 'PermanentlyClosed';
export type { PriceRangeLevel } from '../constants/priceRange';
export type AuditEntityType = 'Shop' | 'Review' | 'CommunityPost';
export type AuditAction = 'Approved' | 'Rejected' | 'Pending';

export interface PublishedShopLocation {
  cityId?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PublishedShopContacts {
  phoneNumber?: string | null;
  email?: string | null;
  siteLink?: string | null;
  instagramLink?: string | null;
}

export interface PublishedShop {
  id: string;
  name: string;
  dataCompletenessScore: number;
  cityId: string;
  status: CoffeeShopStatus;
  creatorId: string;
  ownerUserId: string | null;
  moderationId: string | null;
  createdAtUtc: string;
  isHidden: boolean;
  priceRange?: 1 | 2 | 3 | 4;
  description?: string;
  coffeeFocus?: CoffeeFocus;
  tagSlugs?: string[];
  tagIds?: string[];
  photos: PublishedShopPhoto[];
  tags?: ShopTagDto[];
  /** Admin-only: set when shop came from file ingest. */
  importedFromFileAt?: string;
  location?: PublishedShopLocation;
  contacts?: PublishedShopContacts;
  schedules?: AdminShopSchedule[];
  equipmentIds?: string[];
  beanIds?: string[];
  roasterIds?: string[];
  brewMethodIds?: string[];
}

export interface ShopTagDto {
  id: string;
  slug: string;
  name: string;
  description?: string;
  sortOrder: number;
}

export interface AdminShopTag {
  id: string;
  slug: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CreateShopTagRequest {
  slug: string;
  name: string;
  description?: string;
  sortOrder: number;
}

export interface UpdateShopTagRequest {
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface UserSession {
  id: string;
  deviceName?: string;
  ipAddress?: string;
  expiryDate: string;
  isRevoked: boolean;
  createdAtUtc: string;
  lastSeenAtUtc?: string;
}

export interface PublishedShopPhoto {
  id: string;
  fileName: string;
  contentType: string;
  storageKey: string;
  fullUrl: string;
  sizeBytes: number;
  sortIndex: number;
}

export interface UpdatePublishedShopRequest {
  name?: string;
  description?: string | null;
  priceRange?: PriceRangeLevel | number;
  status?: CoffeeShopStatus;
  location?: PublishedShopLocation;
  contacts?: PublishedShopContacts;
  schedules?: AdminShopSchedule[];
  catalogs?: {
    equipmentIds?: string[];
    beanIds?: string[];
    roasterIds?: string[];
    brewMethodIds?: string[];
  };
}

export interface AttachPublishedShopPhotosRequest {
  photos: Array<{
    fileName: string;
    contentType: string;
    storageKey: string;
    size: number;
  }>;
}

export interface DeletePublishedShopPhotosRequest {
  photoIds: string[];
}

export interface ModerationAuditEntry {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  action: AuditAction;
  moderatorUserId: string;
  comment: string | null;
  createdAtUtc: string;
}

export interface BlockUserRequest {
  blocked: boolean;
}

interface ListParams {
  status?: ModerationStatus;
  page?: number;
  pageSize?: number;
  search?: string;
}

// ==================== Helpers ====================

function mapModerationStatus(status: ModerationStatus | number | undefined): ModerationStatus {
  if (status === undefined || status === null) return 'Pending';
  if (typeof status === 'string') return status;
  return (['Pending', 'Approved', 'Rejected'][status] ?? 'Pending') as ModerationStatus;
}

function formatTimeSpan(value: string | undefined): string {
  if (!value) return '';
  return value.substring(0, 5);
}

function mapBackendSchedules(schedules?: BackendSchedule[] | null): AdminShopSchedule[] {
  if (!schedules?.length) return [];

  return schedulesFromUtc(
    schedules.map((schedule) => ({
      dayOfWeek: apiDayOfWeekToUi(schedule.dayOfWeek),
      isClosed: Boolean(schedule.isClosed),
      openTime: formatTimeSpan(schedule.intervals?.[0]?.openTime),
      closeTime: formatTimeSpan(schedule.intervals?.[0]?.closeTime),
    }))
  );
}

function mapShopToAdmin(shop: BackendModerationShop): AdminCoffeeShop {
  return {
    id: shop.id,
    name: shop.name,
    dataCompletenessScore: shop.dataCompletenessScore,
    address: shop.address ?? '',
    cityId: shop.cityId ?? undefined,
    userId: shop.userId,
    addressIsValidated: shop.addressIsValidated,
    status: mapModerationStatus(shop.moderationStatus),
    publishedShopId: shop.publishedShopId ?? undefined,
    description: shop.description ?? undefined,
    priceRange: parsePriceRange(shop.priceRange),
    photos: shop.shopPhotos?.map((photo) => ({
      fileName: photo.fileName,
      storageKey: photo.storageKey,
      fullUrl: photo.fullUrl,
    })),
    shopContact: shop.shopContact
      ? {
          phone: shop.shopContact.phoneNumber ?? undefined,
          email: shop.shopContact.email ?? undefined,
          website: shop.shopContact.siteLink ?? undefined,
          instagram: shop.shopContact.instagramLink ?? undefined,
        }
      : undefined,
    schedules: mapBackendSchedules(shop.schedules),
    equipmentIds: shop.equipmentIds ?? [],
    coffeeBeanIds: shop.coffeeBeanIds ?? [],
    roasterIds: shop.roasterIds ?? [],
    brewMethodIds: shop.brewMethodIds ?? [],
    createdAtUtc: '',
    menu: mapShopMenu(shop.menu),
  };
}

function mapReviewToAdmin(review: BackendModerationReview): AdminReview {
  return {
    id: review.id,
    shopId: review.shopId,
    shopName: review.shopName ?? review.shopId,
    drinkSlug: review.drinkSlug,
    customDrinkName: review.customDrinkName,
    drinkNameRu: review.drinkNameRu,
    drinkNameEn: review.drinkNameEn,
    authorEmail: review.userName ?? review.userId,
    authorName: review.userName,
    header: review.header,
    comment: review.comment,
    ratingCoffee: review.rating?.coffee ?? 0,
    ratingService: review.rating?.service ?? 0,
    ratingPlace: review.rating?.place ?? 0,
    status: mapModerationStatus(review.moderationStatus),
    createdAtUtc: review.createdAt,
    // fullUrl is null when the media public endpoint isn't configured — nothing to render then.
    photos: [...(review.photos ?? [])]
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .flatMap((p) => (p.fullUrl ? [{ fileName: p.fileName, storageKey: p.storageKey, fullUrl: p.fullUrl }] : [])),
  };
}

function mapUserToAdmin(user: BackendAdminUser): AdminUser {
  return {
    id: user.id,
    userName: user.userName,
    email: user.email,
    roles: user.roles as UserRole[],
    about: user.about,
    createdAtUtc: user.createdAtUtc,
    avatarUrl: user.avatarUrl,
    reviewCount: user.reviewCount,
    checkInCount: user.checkInCount,
    addedShopsCount: user.addedShopsCount,
    isBlocked: user.isBlocked,
  };
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

function toBackendTime(value: string): string {
  if (!value) return '00:00:00';
  const [hours = '00', minutes = '00'] = value.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
}

/**
 * PUT /api/ModerationShops binds ModerationShopDto from a JSON body. Its lists (schedules, catalog ids, photos)
 * are required, so the stored DTO is resent and only the edited fields are overridden.
 */
function buildModerationShopBody(shop: BackendModerationShop, updates: UpdateCoffeeShopRequest) {
  const contact = updates.shopContact;
  return {
    ...shop,
    // The update handler ignores the menu (it has its own endpoints).
    menu: null,
    name: updates.name ?? shop.name,
    address: updates.address ?? shop.address,
    description: updates.description ?? shop.description,
    // Non-nullable enum on the backend: always resend a value.
    priceRange: updates.priceRange ?? shop.priceRange,
    // Guid?: '' fails to bind; null keeps the stored city (the backend cannot clear it).
    cityId: updates.cityId || shop.cityId || null,
    shopContact: contact
      ? {
          phoneNumber: contact.phone || null,
          email: contact.email || null,
          siteLink: contact.website || null,
          instagramLink: contact.instagram || null,
        }
      : shop.shopContact,
    // No schedule update → resend the stored (already UTC) entries untouched.
    schedules: updates.schedules ? toPublishedApiSchedules(updates.schedules) : shop.schedules ?? [],
    equipmentIds: updates.equipmentIds ?? shop.equipmentIds ?? [],
    coffeeBeanIds: updates.coffeeBeanIds ?? shop.coffeeBeanIds ?? [],
    roasterIds: updates.roasterIds ?? shop.roasterIds ?? [],
    brewMethodIds: updates.brewMethodIds ?? shop.brewMethodIds ?? [],
    // Photos missing from this list are deleted by the backend.
    shopPhotos: shop.shopPhotos ?? [],
  };
}

function buildStatusParams(id: string, status: ModerationStatus, comment?: string) {
  return {
    id,
    status,
    ...(comment?.trim() ? { comment: comment.trim() } : {}),
  };
}

// ==================== Shop moderation ====================

export async function getModerationShops(
  params: ListParams = {}
): Promise<ApiResponse<PaginatedResult<AdminCoffeeShop>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const response = await httpClient.get<GetAllModerationShopsResponse>(
    API_ENDPOINTS.MODERATION.SHOPS,
    { params }
  );
  const raw = response.data as unknown as GetAllModerationShopsResponse;

  return {
    ...response,
    data: toPaginatedResult(
      (raw.moderationShops ?? []).map(mapShopToAdmin),
      response.meta,
      page,
      pageSize
    ),
  };
}

export async function getModerationShopById(id: string): Promise<ApiResponse<AdminCoffeeShop>> {
  const response = await httpClient.get<BackendModerationShop>(
    API_ENDPOINTS.MODERATION.SHOP_BY_ID(id)
  );

  return {
    ...response,
    data: mapShopToAdmin(response.data),
  };
}

export async function approveShop(id: string, data?: ModerationActionRequest): Promise<ApiResponse<void>> {
  return httpClient.put<void>(API_ENDPOINTS.MODERATION.SHOP_STATUS, undefined, {
    params: buildStatusParams(id, 'Approved', data?.comment),
  });
}

export async function rejectShop(id: string, data?: ModerationActionRequest): Promise<ApiResponse<void>> {
  return httpClient.put<void>(API_ENDPOINTS.MODERATION.SHOP_STATUS, undefined, {
    params: buildStatusParams(id, 'Rejected', data?.comment),
  });
}

export async function updateCoffeeShop(
  id: string,
  data: UpdateCoffeeShopRequest
): Promise<ApiResponse<AdminCoffeeShop>> {
  const shopResponse = await httpClient.get<BackendModerationShop>(
    API_ENDPOINTS.MODERATION.SHOP_BY_ID(id)
  );
  const shop = shopResponse.data;
  const response = await httpClient.put<BackendModerationShop>(
    API_ENDPOINTS.MODERATION.SHOPS,
    buildModerationShopBody(shop, data)
  );

  return {
    ...response,
    data: mapShopToAdmin(response.data ?? shop),
  };
}

// ==================== Review moderation ====================

export async function getModerationReviews(
  params: ListParams = {}
): Promise<ApiResponse<PaginatedResult<AdminReview>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const response = await httpClient.get<GetAllModerationReviewsResponse>(
    API_ENDPOINTS.MODERATION.REVIEWS,
    { params }
  );
  const raw = response.data as unknown as GetAllModerationReviewsResponse;

  return {
    ...response,
    data: toPaginatedResult(
      (raw.reviewDtos ?? []).map(mapReviewToAdmin),
      response.meta,
      page,
      pageSize
    ),
  };
}

export async function approveReview(id: string, data?: ModerationActionRequest): Promise<ApiResponse<void>> {
  return httpClient.put<void>(API_ENDPOINTS.MODERATION.REVIEWS, {
    moderationReviewId: id,
    moderationStatus: 'Approved',
    comment: data?.comment?.trim() || null,
    rejectReason: null,
  });
}

export async function rejectReview(id: string, data?: ModerationActionRequest): Promise<ApiResponse<void>> {
  const reason = data?.comment?.trim() || null;
  return httpClient.put<void>(API_ENDPOINTS.MODERATION.REVIEWS, {
    moderationReviewId: id,
    moderationStatus: 'Rejected',
    comment: reason,
    rejectReason: reason,
  });
}

// ==================== Shop issue reports ====================

interface ShopReportListParams {
  status?: ShopIssueReportStatus;
  shopId?: string;
  page?: number;
  pageSize?: number;
}

export async function getShopIssueReports(
  params: ShopReportListParams = {}
): Promise<ApiResponse<PaginatedResponse<AdminShopIssueReport>>> {
  return httpClient.get<PaginatedResponse<AdminShopIssueReport>>(API_ENDPOINTS.ADMIN.SHOP_REPORTS, { params });
}

export async function updateShopIssueReportStatus(
  id: string,
  status: Exclude<ShopIssueReportStatus, 'Submitted'>
): Promise<ApiResponse<ShopIssueReportStatus>> {
  return httpClient.put<ShopIssueReportStatus>(API_ENDPOINTS.ADMIN.SHOP_REPORT_STATUS(id), { status });
}

// ==================== Users ====================

export async function getAdminUsers(
  params: { page?: number; pageSize?: number; search?: string; role?: UserRole }
): Promise<ApiResponse<PaginatedResult<AdminUser>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const response = await httpClient.get<GetAdminUsersResponse>(
    API_ENDPOINTS.ADMIN.USERS,
    { params }
  );
  const raw = response.data as unknown as GetAdminUsersResponse;

  return {
    ...response,
    data: toPaginatedResult(
      (raw.items ?? []).map(mapUserToAdmin),
      response.meta,
      page,
      pageSize
    ),
  };
}

export async function updateUserRole(
  id: string,
  data: UpdateUserRoleRequest
): Promise<ApiResponse<string>> {
  return httpClient.patch<string>(API_ENDPOINTS.ADMIN.USER_ROLE(id), data);
}

export async function deleteAdminUser(id: string): Promise<ApiResponse<boolean>> {
  return httpClient.delete<boolean>(API_ENDPOINTS.ADMIN.USER_DELETE(id));
}

export async function blockUser(id: string, data: BlockUserRequest): Promise<ApiResponse<boolean>> {
  return httpClient.patch<boolean>(API_ENDPOINTS.ADMIN.USER_BLOCK(id), data);
}

export async function getUserStats(): Promise<ApiResponse<UserStats>> {
  return httpClient.get<UserStats>(API_ENDPOINTS.ADMIN.USER_STATS);
}

// ==================== Stats ====================

export async function getOverviewStats(): Promise<ApiResponse<OverviewStats>> {
  return httpClient.get<OverviewStats>(API_ENDPOINTS.ADMIN.STATS_OVERVIEW);
}

export async function getUsersTimeseries(days: number): Promise<ApiResponse<AdminUsersTimeseries>> {
  return httpClient.get<AdminUsersTimeseries>(buildUrlWithParams(API_ENDPOINTS.ADMIN.STATS_USERS_TIMESERIES, { days }));
}

export async function getShopsTimeseries(days: number): Promise<ApiResponse<AdminShopsTimeseries>> {
  return httpClient.get<AdminShopsTimeseries>(buildUrlWithParams(API_ENDPOINTS.ADMIN.STATS_SHOPS_TIMESERIES, { days }));
}

export async function getShopsInsights(): Promise<ApiResponse<AdminShopsInsights>> {
  return httpClient.get<AdminShopsInsights>(API_ENDPOINTS.ADMIN.STATS_SHOPS_INSIGHTS);
}

export async function getModerationInsights(): Promise<ApiResponse<AdminModerationInsights>> {
  return httpClient.get<AdminModerationInsights>(API_ENDPOINTS.ADMIN.STATS_MODERATION_INSIGHTS);
}

// ==================== Moderation audit ====================

interface GetModerationAuditLogResponse {
  items: ModerationAuditEntry[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

function mapEnumStatus<T extends string>(value: T | number | undefined, labels: string[]): T {
  if (value === undefined || value === null) return labels[0] as T;
  if (typeof value === 'string') return value as T;
  return (labels[value] ?? labels[0]) as T;
}

function pickHiddenFlag(shop: Record<string, unknown>): boolean {
  for (const key of ['isHidden', 'hidden', 'IsHidden', 'Hidden']) {
    if (!(key in shop)) continue;
    const value = shop[key];
    if (value === true || value === 1 || value === 'true' || value === 'True') return true;
    if (value === false || value === 0 || value === 'false' || value === 'False') return false;
  }
  for (const key of ['isVisible', 'visible', 'IsVisible', 'Visible']) {
    if (!(key in shop)) continue;
    const value = shop[key];
    if (value === true || value === 1 || value === 'true' || value === 'True') return false;
    if (value === false || value === 0 || value === 'false' || value === 'False') return true;
  }
  return false;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return undefined;
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return undefined;
}

function mapPublishedSchedules(raw: unknown): AdminShopSchedule[] {
  if (!Array.isArray(raw)) return [];
  return schedulesFromUtc(
    (raw as Record<string, unknown>[]).map((schedule) => {
      const intervals = (schedule.intervals ?? schedule.Intervals) as
        | Array<Record<string, unknown>>
        | undefined;
      const interval = Array.isArray(intervals) ? intervals[0] : undefined;
      return {
        dayOfWeek: apiDayOfWeekToUi(
          (schedule.dayOfWeek ?? schedule.DayOfWeek) as number | string | undefined
        ),
        isClosed: Boolean(schedule.isClosed ?? schedule.IsClosed),
        openTime: formatTimeSpan(
          String(interval?.openTime ?? interval?.OpenTime ?? schedule.openTime ?? schedule.OpenTime ?? '')
        ),
        closeTime: formatTimeSpan(
          String(interval?.closeTime ?? interval?.CloseTime ?? schedule.closeTime ?? schedule.CloseTime ?? '')
        ),
      };
    })
  );
}

/** Local week → JSON schedule DTOs (UTC, no duplicate days). Shared with the owner API. */
export function toPublishedApiSchedules(schedules: AdminShopSchedule[]) {
  return schedulesToUtc(schedules).map((schedule) =>
    schedule.isClosed || !schedule.openTime || !schedule.closeTime
      ? { dayOfWeek: uiDayToDotNetName(schedule.dayOfWeek), isClosed: true, intervals: [] }
      : {
          dayOfWeek: uiDayToDotNetName(schedule.dayOfWeek),
          isClosed: false,
          intervals: [
            {
              openTime: toBackendTime(schedule.openTime),
              closeTime: toBackendTime(schedule.closeTime),
            },
          ],
        }
  );
}

export function mapPublishedShop(shop: Record<string, unknown>): PublishedShop {
  const photos = Array.isArray(shop.photos)
    ? (shop.photos as Record<string, unknown>[])
    : Array.isArray(shop.Photos)
      ? (shop.Photos as Record<string, unknown>[])
      : [];
  const tags = Array.isArray(shop.tags)
    ? (shop.tags as Record<string, unknown>[])
    : Array.isArray(shop.Tags)
      ? (shop.Tags as Record<string, unknown>[])
      : undefined;

  const locationRaw = asRecord(shop.location ?? shop.Location);
  const contactsRaw = asRecord(shop.contacts ?? shop.Contacts ?? shop.shopContact ?? shop.ShopContact);
  const catalogsRaw = asRecord(shop.catalogs ?? shop.Catalogs);

  const location: PublishedShopLocation | undefined = locationRaw
    ? {
        cityId: pickString(locationRaw.cityId, locationRaw.CityId),
        address: pickString(locationRaw.address, locationRaw.Address),
        latitude: pickNumber(locationRaw.latitude, locationRaw.Latitude) ?? null,
        longitude: pickNumber(locationRaw.longitude, locationRaw.Longitude) ?? null,
      }
    : pickString(shop.address, shop.Address) || pickString(shop.cityId, shop.CityId)
      ? {
          cityId: pickString(shop.cityId, shop.CityId),
          address: pickString(shop.address, shop.Address),
          latitude: pickNumber(shop.latitude, shop.Latitude) ?? null,
          longitude: pickNumber(shop.longitude, shop.Longitude) ?? null,
        }
      : undefined;

  const contacts: PublishedShopContacts | undefined = contactsRaw
    ? {
        phoneNumber: pickString(
          contactsRaw.phoneNumber,
          contactsRaw.PhoneNumber,
          contactsRaw.phone,
          contactsRaw.Phone
        ) ?? null,
        email: pickString(contactsRaw.email, contactsRaw.Email) ?? null,
        siteLink: pickString(
          contactsRaw.siteLink,
          contactsRaw.SiteLink,
          contactsRaw.website,
          contactsRaw.Website
        ) ?? null,
        instagramLink: pickString(
          contactsRaw.instagramLink,
          contactsRaw.InstagramLink,
          contactsRaw.instagram,
          contactsRaw.Instagram
        ) ?? null,
      }
    : undefined;

  const equipmentIds =
    (Array.isArray(shop.equipmentIds) ? (shop.equipmentIds as unknown[]).map(String) : undefined) ??
    (Array.isArray(catalogsRaw?.equipmentIds)
      ? (catalogsRaw!.equipmentIds as unknown[]).map(String)
      : undefined) ??
    (Array.isArray(catalogsRaw?.EquipmentIds)
      ? (catalogsRaw!.EquipmentIds as unknown[]).map(String)
      : undefined);

  const beanIds =
    (Array.isArray(shop.beanIds) ? (shop.beanIds as unknown[]).map(String) : undefined) ??
    (Array.isArray(shop.coffeeBeanIds) ? (shop.coffeeBeanIds as unknown[]).map(String) : undefined) ??
    (Array.isArray(catalogsRaw?.beanIds) ? (catalogsRaw!.beanIds as unknown[]).map(String) : undefined) ??
    (Array.isArray(catalogsRaw?.BeanIds) ? (catalogsRaw!.BeanIds as unknown[]).map(String) : undefined);

  const roasterIds =
    (Array.isArray(shop.roasterIds) ? (shop.roasterIds as unknown[]).map(String) : undefined) ??
    (Array.isArray(catalogsRaw?.roasterIds)
      ? (catalogsRaw!.roasterIds as unknown[]).map(String)
      : undefined) ??
    (Array.isArray(catalogsRaw?.RoasterIds)
      ? (catalogsRaw!.RoasterIds as unknown[]).map(String)
      : undefined);

  const brewMethodIds =
    (Array.isArray(shop.brewMethodIds) ? (shop.brewMethodIds as unknown[]).map(String) : undefined) ??
    (Array.isArray(catalogsRaw?.brewMethodIds)
      ? (catalogsRaw!.brewMethodIds as unknown[]).map(String)
      : undefined) ??
    (Array.isArray(catalogsRaw?.BrewMethodIds)
      ? (catalogsRaw!.BrewMethodIds as unknown[]).map(String)
      : undefined);

  const cityId =
    pickString(location?.cityId, shop.cityId, shop.CityId) ?? '';

  return {
    id: String(shop.id ?? shop.Id ?? ''),
    name: String(shop.name ?? shop.Name ?? ''),
    dataCompletenessScore: pickNumber(
      shop.dataCompletenessScore,
      shop.DataCompletenessScore
    ) ?? 0,
    cityId,
    status: mapEnumStatus<CoffeeShopStatus>(
      (shop.status ?? shop.Status) as CoffeeShopStatus | number,
      ['Active', 'TemporarilyClosed', 'PermanentlyClosed']
    ),
    creatorId: String(shop.creatorId ?? shop.CreatorId ?? ''),
    ownerUserId: shop.ownerUserId || shop.OwnerUserId ? String(shop.ownerUserId ?? shop.OwnerUserId) : null,
    moderationId:
      shop.moderationId || shop.ModerationId ? String(shop.moderationId ?? shop.ModerationId) : null,
    createdAtUtc: String(shop.createdAtUtc ?? shop.CreatedAtUtc ?? ''),
    isHidden: pickHiddenFlag(shop),
    priceRange: parsePriceRange(shop.priceRange ?? shop.PriceRange),
    description: pickString(shop.description, shop.Description),
    coffeeFocus: parseCoffeeFocus(shop.coffeeFocus ?? shop.CoffeeFocus ?? shop.type ?? shop.Type),
    tagSlugs: Array.isArray(shop.tagSlugs)
      ? (shop.tagSlugs as unknown[]).map(String)
      : Array.isArray(shop.TagSlugs)
        ? (shop.TagSlugs as unknown[]).map(String)
        : undefined,
    tagIds: Array.isArray(shop.tagIds)
      ? (shop.tagIds as unknown[]).map(String)
      : Array.isArray(shop.TagIds)
        ? (shop.TagIds as unknown[]).map(String)
        : undefined,
    importedFromFileAt: pickString(shop.importedFromFileAt, shop.ImportedFromFileAt),
    location,
    contacts,
    schedules: mapPublishedSchedules(shop.schedules ?? shop.Schedules),
    equipmentIds,
    beanIds,
    roasterIds,
    brewMethodIds,
    photos: photos
      .map((photo) => ({
        id: String(photo.id ?? photo.Id ?? ''),
        fileName: String(photo.fileName ?? photo.FileName ?? ''),
        contentType: String(photo.contentType ?? photo.ContentType ?? ''),
        storageKey: String(photo.storageKey ?? photo.StorageKey ?? ''),
        fullUrl: String(photo.fullUrl ?? photo.FullUrl ?? ''),
        sizeBytes: Number(photo.sizeBytes ?? photo.SizeBytes ?? photo.size ?? photo.Size ?? 0),
        sortIndex: Number(photo.sortIndex ?? photo.SortIndex ?? 0),
      }))
      .sort((left, right) => left.sortIndex - right.sortIndex),
    tags: tags?.map((tag) => ({
      id: String(tag.id ?? tag.Id ?? ''),
      slug: String(tag.slug ?? tag.Slug ?? ''),
      name: String(tag.name ?? tag.Name ?? ''),
      description: pickString(tag.description, tag.Description),
      sortOrder: Number(tag.sortOrder ?? tag.SortOrder ?? 0),
    })),
  };
}

function mapAuditEntry(entry: Record<string, unknown>): ModerationAuditEntry {
  return {
    id: String(entry.id),
    entityType: mapEnumStatus<AuditEntityType>(entry.entityType as AuditEntityType | number, [
      'Shop',
      'Review',
      'CommunityPost',
    ]),
    entityId: String(entry.entityId),
    entityName: String(entry.entityName),
    action: mapEnumStatus<AuditAction>(entry.action as AuditAction | number, [
      'Pending',
      'Approved',
      'Rejected',
    ]),
    moderatorUserId: String(entry.moderatorUserId),
    comment: entry.comment ? String(entry.comment) : null,
    createdAtUtc: String(entry.createdAtUtc),
  };
}

export async function getModerationAuditLog(
  params: {
    page?: number;
    pageSize?: number;
    entityType?: AuditEntityType;
    action?: AuditAction;
  } = {}
): Promise<ApiResponse<PaginatedResult<ModerationAuditEntry>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const response = await httpClient.get<GetModerationAuditLogResponse>(
    API_ENDPOINTS.ADMIN.AUDIT_MODERATION,
    { params }
  );
  const raw = response.data as unknown as GetModerationAuditLogResponse;

  return {
    ...response,
    data: toPaginatedResult(
      (raw.items ?? []).map((item) => mapAuditEntry(item as unknown as Record<string, unknown>)),
      response.meta,
      page,
      pageSize
    ),
  };
}

// ==================== Published shops (admin) ====================

interface GetAdminCoffeeShopsResponse {
  items: Record<string, unknown>[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export async function getPublishedShops(
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: CoffeeShopStatus;
    importedFromFile?: boolean;
    sortBy?: 'name' | 'coffeeFocus' | 'status' | 'createdAtUtc';
    sortDirection?: 'asc' | 'desc';
  } = {}
): Promise<ApiResponse<PaginatedResult<PublishedShop>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const response = await httpClient.get<GetAdminCoffeeShopsResponse>(
    API_ENDPOINTS.ADMIN.SHOPS,
    {
      params: {
        page,
        pageSize,
        search: params.search,
        status: params.status,
        importedFromFile: params.importedFromFile === true ? true : undefined,
        sortBy: params.sortBy,
        sortDirection: params.sortDirection,
      },
    }
  );
  const raw = response.data as unknown as GetAdminCoffeeShopsResponse & {
    coffeeShops?: Record<string, unknown>[];
    shops?: Record<string, unknown>[];
  };
  const list = raw.items ?? raw.coffeeShops ?? raw.shops ?? [];

  return {
    ...response,
    data: toPaginatedResult(
      list.map((item) => mapPublishedShop(item)),
      response.meta,
      page,
      pageSize
    ),
  };
}

export async function getPublishedShopById(id: string): Promise<ApiResponse<PublishedShop>> {
  const response = await httpClient.get<Record<string, unknown>>(API_ENDPOINTS.ADMIN.SHOP_BY_ID(id));
  const raw = response.data ?? {};
  const nested = ['shop', 'Shop', 'coffeeShop', 'CoffeeShop']
    .map((key) => raw[key])
    .find((value) => value && typeof value === 'object' && !Array.isArray(value));
  return {
    ...response,
    data: mapPublishedShop((nested as Record<string, unknown> | undefined) ?? raw),
  };
}

export async function reorderPublishedShopPhotos(
  id: string,
  photoIds: string[]
): Promise<ApiResponse<PublishedShop>> {
  const response = await httpClient.put<Record<string, unknown>>(
    `${API_ENDPOINTS.ADMIN.SHOP_BY_ID(id)}/photos/order`,
    { photoIds }
  );
  return { ...response, data: mapPublishedShop(response.data) };
}

function normalizePriceRange(value: PriceRangeLevel | number): PriceRangeLevel {
  return toPriceRangeLevel(value);
}

export async function updatePublishedShop(
  id: string,
  data: UpdatePublishedShopRequest
): Promise<ApiResponse<PublishedShop>> {
  const body: Record<string, unknown> = {};
  if (data.name !== undefined) body.name = data.name;
  if (data.description !== undefined) body.description = data.description;
  if (data.priceRange !== undefined) body.priceRange = normalizePriceRange(data.priceRange);
  if (data.status !== undefined) body.status = data.status;
  if (data.location !== undefined) body.location = data.location;
  if (data.contacts !== undefined) body.contacts = data.contacts;
  if (data.schedules !== undefined) body.schedules = toPublishedApiSchedules(data.schedules);
  if (data.catalogs !== undefined) body.catalogs = data.catalogs;

  const response = await httpClient.put<Record<string, unknown>>(
    API_ENDPOINTS.ADMIN.SHOP_BY_ID(id),
    body
  );

  return { ...response, data: mapPublishedShop(response.data ?? {}) };
}

export async function attachPublishedShopPhotos(
  id: string,
  data: AttachPublishedShopPhotosRequest
): Promise<ApiResponse<PublishedShop>> {
  const response = await httpClient.post<Record<string, unknown>>(
    API_ENDPOINTS.ADMIN.SHOP_PHOTOS(id),
    data
  );
  return { ...response, data: mapPublishedShop(response.data ?? {}) };
}

export async function deletePublishedShopPhotos(
  id: string,
  data: DeletePublishedShopPhotosRequest
): Promise<ApiResponse<PublishedShop>> {
  const response = await httpClient.delete<Record<string, unknown>>(
    API_ENDPOINTS.ADMIN.SHOP_PHOTOS(id),
    { data }
  );
  return { ...response, data: mapPublishedShop(response.data ?? {}) };
}

export async function patchPublishedShopFocus(
  id: string,
  coffeeFocus: CoffeeFocus
): Promise<ApiResponse<PublishedShop>> {
  const focusValue = COFFEE_FOCUS_TO_API[coffeeFocus];
  const response = await httpClient.patch<Record<string, unknown>>(
    API_ENDPOINTS.ADMIN.SHOP_FOCUS(id),
    { coffeeFocus: focusValue, type: focusValue }
  );
  return { ...response, data: mapPublishedShop(response.data) };
}

export async function setPublishedShopVisibility(
  id: string,
  hidden: boolean
): Promise<ApiResponse<PublishedShop | undefined>> {
  const response = await httpClient.patch<Record<string, unknown>>(
    API_ENDPOINTS.ADMIN.SHOP_VISIBILITY(id),
    { hidden }
  );
  if (response.isSuccess === false) {
    throw new Error(response.message || 'Не удалось изменить видимость');
  }
  const raw = response.data;
  const looksLikeShop = raw && typeof raw === 'object' && (raw.id || raw.Id);
  const mapped = looksLikeShop ? mapPublishedShop(raw) : undefined;
  if (mapped) mapped.isHidden = hidden;

  return {
    ...response,
    data: mapped,
  };
}

export async function assignPublishedShopOwner(
  id: string,
  ownerUserId: string | null
): Promise<ApiResponse<PublishedShop>> {
  const response = await httpClient.patch<Record<string, unknown>>(
    API_ENDPOINTS.ADMIN.SHOP_OWNER(id),
    { ownerUserId }
  );

  return { ...response, data: mapPublishedShop(response.data) };
}

// ==================== Shop tags ====================

function unwrapAdminList<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== 'object') return [];

  const record = data as Record<string, unknown>;
  const byLower = new Map(Object.entries(record).map(([k, v]) => [k.toLowerCase(), v]));
  const candidates = [key, 'items', 'sessions', 'usersessions', 'refreshsessions', 'tokens'];

  for (const candidate of candidates) {
    const nested = byLower.get(candidate.toLowerCase());
    if (Array.isArray(nested)) return nested as T[];
  }

  return [];
}

function pickSessionString(row: Record<string, unknown>, ...keys: string[]): string | undefined {
  const byLower = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  for (const key of keys) {
    const value = byLower.get(key.toLowerCase());
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
}

function pickSessionBool(row: Record<string, unknown>, ...keys: string[]): boolean {
  const byLower = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  for (const key of keys) {
    const value = byLower.get(key.toLowerCase());
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === 'true' || value === 'True') return true;
  }
  return false;
}

export function mapUserSession(raw: unknown): UserSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = pickSessionString(row, 'id', 'sessionId', 'refreshTokenId');
  if (!id) return null;

  return {
    id,
    deviceName: pickSessionString(row, 'deviceName', 'device', 'userAgent', 'clientName'),
    ipAddress: pickSessionString(row, 'ipAddress', 'ip', 'remoteIp'),
    expiryDate:
      pickSessionString(row, 'expiryDate', 'expiresAtUtc', 'expiryDateUtc', 'expiresAt') ?? '',
    isRevoked: pickSessionBool(row, 'isRevoked', 'revoked'),
    createdAtUtc:
      pickSessionString(row, 'createdAtUtc', 'createdAt', 'issuedAtUtc') ?? '',
    lastSeenAtUtc: pickSessionString(row, 'lastSeenAtUtc', 'lastUsedAtUtc', 'updatedAtUtc'),
  };
}

export async function getAdminShopTags(): Promise<ApiResponse<AdminShopTag[]>> {
  const response = await httpClient.get<unknown>(API_ENDPOINTS.ADMIN.SHOP_TAGS);
  return {
    ...response,
    data: unwrapAdminList<AdminShopTag>(response.data, 'tags'),
  };
}

export async function createAdminShopTag(
  body: CreateShopTagRequest
): Promise<ApiResponse<AdminShopTag>> {
  return httpClient.post<AdminShopTag>(API_ENDPOINTS.ADMIN.SHOP_TAGS, body);
}

export async function updateAdminShopTag(
  id: string,
  body: UpdateShopTagRequest
): Promise<ApiResponse<AdminShopTag>> {
  return httpClient.patch<AdminShopTag>(API_ENDPOINTS.ADMIN.SHOP_TAG_BY_ID(id), body);
}

export async function deactivateAdminShopTag(id: string): Promise<ApiResponse<void>> {
  return httpClient.delete<void>(API_ENDPOINTS.ADMIN.SHOP_TAG_BY_ID(id));
}

export async function assignShopTags(
  shopId: string,
  tagIds: string[]
): Promise<ApiResponse<void>> {
  return httpClient.put<void>(API_ENDPOINTS.ADMIN.SHOP_TAGS_ASSIGN(shopId), {
    tagIds: tagIds.slice(0, 20),
  });
}

// ==================== User sessions ====================

export async function getUserSessions(userId: string): Promise<ApiResponse<UserSession[]>> {
  const response = await httpClient.get<unknown>(API_ENDPOINTS.ADMIN.USER_SESSIONS(userId));
  return {
    ...response,
    data: unwrapAdminList<unknown>(response.data, 'sessions')
      .map(mapUserSession)
      .filter((session): session is UserSession => session !== null),
  };
}

export async function revokeUserSession(
  userId: string,
  sessionId: string
): Promise<ApiResponse<void>> {
  return httpClient.delete<void>(API_ENDPOINTS.ADMIN.USER_SESSION_BY_ID(userId, sessionId));
}

export async function revokeAllUserSessions(userId: string): Promise<ApiResponse<void>> {
  return httpClient.delete<void>(API_ENDPOINTS.ADMIN.USER_SESSIONS(userId));
}

// ==================== Cache ====================

export async function getCacheKeys(
  pattern: string,
  limit = 100
): Promise<ApiResponse<string[]>> {
  const response = await httpClient.get<{ keys: string[]; count: number }>(
    API_ENDPOINTS.ADMIN.CACHE_KEYS,
    { params: { pattern, limit } }
  );

  return {
    ...response,
    data: response.data?.keys ?? [],
  };
}

export async function clearCacheByPattern(pattern: string): Promise<ApiResponse<ClearCacheResponse>> {
  return httpClient.post<ClearCacheResponse>(API_ENDPOINTS.ADMIN.CACHE.CLEAR, { pattern });
}

export async function clearCacheByKey(key: string): Promise<ApiResponse<void>> {
  return httpClient.post<void>(API_ENDPOINTS.ADMIN.CACHE_CLEAR_KEY(key));
}
