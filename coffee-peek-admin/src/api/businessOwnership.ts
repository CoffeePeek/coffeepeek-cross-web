import { httpClient } from './core/httpClient';
import { API_ENDPOINTS } from './core/apiConfig';
import type { ApiResponse } from './core/types';
import { z } from 'zod';

export type BusinessType = 'CoffeeShop' | 'Roaster';
export type OwnershipClaimStatus = 'Pending' | 'Approved' | 'Rejected';
export interface OwnershipClaim {
  id: string;
  businessType: BusinessType;
  businessId: string;
  businessNameSnapshot: string;
  businessSlugSnapshot: string;
  applicantUserId: string;
  contact: string;
  evidence: string;
  status: OwnershipClaimStatus;
  createdAtUtc: string;
  reviewedByUserId: string | null;
  reviewedAtUtc: string | null;
  decisionReason: string | null;
  hasCurrentAccess: boolean;
  currentOwnerUserId: string | null;
}
export interface OwnershipChange {
  id: string;
  businessType: BusinessType;
  businessId: string;
  previousOwnerUserId: string | null;
  newOwnerUserId: string | null;
  actorUserId: string;
  reason: string | null;
  claimId: string | null;
  createdAtUtc: string;
}
export interface OwnershipPage<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}
export interface OwnershipFilters {
  businessType?: BusinessType;
  businessId?: string;
  page?: number;
  pageSize?: number;
}
export const businessLabels: Record<BusinessType, string> = { CoffeeShop: 'Кофейня', Roaster: 'Обжарщик' };
export const claimStatusLabels: Record<OwnershipClaimStatus, string> = {
  Pending: 'Ожидает решения', Approved: 'Одобрена', Rejected: 'Отклонена',
};
export const ownershipKeys = {
  all: ['admin', 'business-ownership'] as const,
  claim: (id: string) => ['admin', 'business-ownership', 'claim', id] as const,
};
export const decisionSchema = z.object({ reason: z.string().trim().max(2000, 'Не более 2000 символов') });
export const assignmentSchema = z.object({
  ownerUserId: z.union([z.literal(''), z.string().trim().uuid('Введите UUID пользователя')]),
  reason: z.string().trim().min(1, 'Укажите причину изменения доступа').max(2000, 'Не более 2000 символов'),
});

function checked<T>(response: ApiResponse<T>): T {
  if (response.isSuccess === false || response.success === false) {
    throw new Error(response.message || 'Операция не выполнена');
  }
  return response.data;
}
export async function getOwnershipClaims(params: OwnershipFilters & { status?: OwnershipClaimStatus } = {}, signal?: AbortSignal) {
  return checked(await httpClient.get<OwnershipPage<OwnershipClaim>>(API_ENDPOINTS.ADMIN.OWNERSHIP_CLAIMS, {
    params: { ...params, status: params.status ?? 'Pending', page: params.page ?? 1, pageSize: params.pageSize ?? 20 },
    signal, cache: 'no-store',
  }));
}
export async function getOwnershipClaim(id: string, signal?: AbortSignal) {
  return checked(await httpClient.get<OwnershipClaim>(API_ENDPOINTS.ADMIN.OWNERSHIP_CLAIM(id), { signal, cache: 'no-store' }));
}
export async function reviewOwnershipClaim(id: string, decision: 'approve' | 'reject', reason: string) {
  const parsed = decisionSchema.parse({ reason });
  if (decision === 'reject' && !parsed.reason) throw new Error('Укажите причину отказа');
  return checked(await httpClient.post<OwnershipClaim>(API_ENDPOINTS.ADMIN.OWNERSHIP_DECISION(id, decision),
    parsed.reason ? { reason: parsed.reason } : {}));
}
export async function getOwnershipChanges(params: OwnershipFilters = {}, signal?: AbortSignal) {
  return checked(await httpClient.get<OwnershipPage<OwnershipChange>>(API_ENDPOINTS.ADMIN.OWNERSHIP_CHANGES, {
    params: { ...params, page: params.page ?? 1, pageSize: params.pageSize ?? 20 }, signal, cache: 'no-store',
  }));
}
export async function assignBusinessOwner(businessType: BusinessType, id: string, ownerUserId: string | null, reason: string) {
  const parsed = assignmentSchema.parse({ ownerUserId: ownerUserId ?? '', reason });
  return checked(await httpClient.patch<unknown>(
    businessType === 'CoffeeShop' ? API_ENDPOINTS.ADMIN.SHOP_OWNER(id) : API_ENDPOINTS.ADMIN.ROASTER_OWNER(id),
    { ownerUserId: parsed.ownerUserId || null, reason: parsed.reason },
  ));
}
export const businessEditPath = (type: BusinessType, id: string) =>
  `${type === 'CoffeeShop' ? '/published-shops' : '/published-roasters'}/${encodeURIComponent(id)}`;
export function ownershipError(error: unknown): string {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  if (status === 409) return 'Состояние изменилось или доступ не удалось подтвердить. Проверьте актуального владельца и решение перед повтором.';
  if (status === 404) return 'Заявка или бизнес больше не найдены. Обновите данные.';
  if (status === 403) return 'Управлять владением может только администратор.';
  return error instanceof Error ? error.message : 'Не удалось выполнить операцию. Попробуйте ещё раз.';
}
