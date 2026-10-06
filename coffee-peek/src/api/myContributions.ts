import type { PublicAddress } from './publicAddresses';
import { httpClient } from './core/httpClient';
import { getMyShopChangeRequests, type ShopChangeRequestDto, type ShopChangeSection } from './shopChangeRequests';

// Enums arrive as strings (JsonStringEnumConverter on the backend).
export type ModerationStatus = 'Pending' | 'Approved' | 'Rejected';
export type ContributionKind = 'shops' | 'roasters' | 'reviews' | 'edits';

type Paging = { totalItems: number; totalPages: number };

// Only the fields the list renders; full DTOs live in the backend contracts.
interface ModerationShopDto { id: string; name: string; address: string | null; moderationStatus: ModerationStatus; rejectedReason: string | null; publishedShop: PublicAddress | null }
interface ModerationRoasterDto { id: string; name: string; about: string | null; moderationStatus: ModerationStatus; rejectedReason: string | null }
interface ModerationReviewDto { id: string; header: string | null; comment: string; shop: PublicAddress | null; createdAt: string; moderationStatus: ModerationStatus; rejectedReason: string | null; rating: { place: number; service: number; coffee: number } }

export interface Contribution {
  id: string;
  title: string;
  subtitle?: string;
  date?: string;
  link?: string;
  shopId?: string;
  section?: ShopChangeSection;
  status: ModerationStatus;
  reason: string | null;
}

export interface ContributionPage extends Paging { items: Contribution[] }

const sectionLabels: Record<ShopChangeSection, string> = {
  Photos: 'Фото', Contacts: 'Контакты', Description: 'Описание', Tags: 'Теги',
  Roasters: 'Обжарщики', Equipment: 'Оборудование', Menu: 'Меню', BrewMethods: 'Методы заваривания',
};

// All four /mine endpoints expose data.items; status/reason field names differ.
export const toContribution = {
  shops: (s: ModerationShopDto): Contribution => ({
    id: s.id, title: s.name, status: s.moderationStatus, reason: s.rejectedReason,
    subtitle: s.address ?? undefined,
    // Publication can lag behind moderation approval.
    shopId: s.publishedShop?.slug, link: s.publishedShop?.canonicalPath,
  }),
  roasters: (r: ModerationRoasterDto): Contribution => ({
    id: r.id, title: r.name, subtitle: r.about ?? undefined, status: r.moderationStatus, reason: r.rejectedReason,
  }),
  reviews: (r: ModerationReviewDto): Contribution => ({
    id: r.id, title: r.header || 'Отзыв о кофейне', status: r.moderationStatus, reason: r.rejectedReason,
    subtitle: `Кофе ${r.rating.coffee} · Сервис ${r.rating.service} · Атмосф. ${r.rating.place}${r.comment ? ` — ${r.comment}` : ''}`,
    date: r.createdAt, shopId: r.shop?.slug, link: r.shop?.canonicalPath,
  }),
  edits: (e: ShopChangeRequestDto): Contribution => ({
    id: e.id, title: sectionLabels[e.section] ?? e.section, section: e.section, subtitle: 'Правка кофейни', status: e.status, reason: e.rejectionReason,
    date: e.createdAtUtc, shopId: e.shop?.slug, link: e.shop?.canonicalPath,
  }),
};

type Query = { page: number; pageSize: number; status: ModerationStatus };

const toPage = <T,>(data: Paging | undefined, list: T[] | undefined, map: (item: T) => Contribution): ContributionPage => ({
  totalItems: data?.totalItems ?? 0,
  totalPages: data?.totalPages ?? 0,
  items: (list ?? []).map(map),
});

async function loadMyContributions(kind: ContributionKind, params: Query): Promise<ContributionPage> {
  switch (kind) {
    case 'shops': {
      const { data } = await httpClient.get<Paging & { items: ModerationShopDto[] }>('/api/ModerationShops/mine', { params });
      return toPage(data, data?.items, toContribution.shops);
    }
    case 'roasters': {
      const { data } = await httpClient.get<Paging & { items: ModerationRoasterDto[] }>('/api/ModerationRoasters/mine', { params });
      return toPage(data, data?.items, toContribution.roasters);
    }
    case 'reviews': {
      const { data } = await httpClient.get<Paging & { items: ModerationReviewDto[] }>('/api/ModerationReviews/mine', { params });
      return toPage(data, data?.items, toContribution.reviews);
    }
    case 'edits': {
      const { data } = await getMyShopChangeRequests(params);
      return toPage(data, data?.items, toContribution.edits);
    }
  }
}

export async function getMyContributions(kind: ContributionKind, params: Query): Promise<ContributionPage> {
  return loadMyContributions(kind, params);
}
