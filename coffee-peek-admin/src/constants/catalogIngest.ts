/** 'Unknown' = backend sent a value we don't recognise; never sent back, never batch-selectable. */
export type QueueStatus = 'Pending' | 'Skipped' | 'Published' | 'Rejected' | 'Unknown';
export type KnownQueueStatus = Exclude<QueueStatus, 'Unknown'>;
export type CoffeeFocus = 'specialty' | 'coffee_bar' | 'cafe';
export type CollectorBucket = 'priority' | 'review' | 'noise' | 'vending';
/** Why an OSM candidate was rejected (not published). */
export type RejectReason = 'closed' | 'invalid' | 'not_coffee' | 'duplicate';
export type ImportSource = 'Osm' | 'File';
export type DuplicateSuggestionStatus = 'Pending' | 'Confirmed' | 'Rejected' | 'Unknown';
export type GoogleBusinessStatus =
  | 'Unknown'
  | 'Operational'
  | 'ClosedPermanently'
  | 'ClosedTemporarily'
  | 'NotFound'
  | 'Far';

export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  Pending: 'Ожидает',
  Skipped: 'Позже',
  Published: 'В ленте',
  Rejected: 'Не в ленту',
  Unknown: 'Неизвестно',
};

export const REJECT_REASON_OPTIONS: {
  value: RejectReason;
  label: string;
  hint: string;
  key: string;
}[] = [
  { value: 'closed', label: 'Закрыта', hint: 'Больше не работает', key: '1' },
  { value: 'invalid', label: 'Невалидные данные', hint: 'Нет адреса / имени / мусор в OSM', key: '2' },
  { value: 'not_coffee', label: 'Не кофейня', hint: 'Не про кофе / не наш формат', key: '3' },
];

export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  closed: 'Закрыта',
  invalid: 'Невалидные данные',
  not_coffee: 'Не кофейня',
  duplicate: 'Дубликат',
};

/** Numeric enum for decide + list filter. Backend: 1=Closed, 2=Invalid, 3=NotCoffee, 4=Duplicate. */
export const REJECT_REASON_TO_API: Record<RejectReason, number> = {
  closed: 1,
  invalid: 2,
  not_coffee: 3,
  duplicate: 4,
};

export const IMPORT_SOURCE_LABELS: Record<ImportSource, string> = {
  Osm: 'OSM',
  File: 'внешний импорт',
};

/** Backend: Osm=1, File=2. */
export const IMPORT_SOURCE_TO_API: Record<ImportSource, number> = {
  Osm: 1,
  File: 2,
};

/** Backend: Pending=1, Confirmed=2, Rejected=3. */
export const DUPLICATE_STATUS_TO_API: Record<Exclude<DuplicateSuggestionStatus, 'Unknown'>, number> = {
  Pending: 1,
  Confirmed: 2,
  Rejected: 3,
};

export const COFFEE_FOCUS_OPTIONS: { value: CoffeeFocus; label: string; hint: string; key: string }[] = [
  { value: 'specialty', label: 'Specialty', hint: 'Третья волна / обжарка / origin', key: '1' },
  { value: 'coffee_bar', label: 'Кофейня', hint: 'Кофе — главный продукт', key: '2' },
  { value: 'cafe', label: 'Кафе', hint: 'Еда и атмосфера, кофе всё равно стоит списка', key: '3' },
];

export const COFFEE_FOCUS_LABELS: Record<CoffeeFocus, string> = {
  specialty: 'Specialty',
  coffee_bar: 'Кофейня',
  cafe: 'Кафе',
};

export const BUCKET_LABELS: Record<CollectorBucket, string> = {
  priority: 'Приоритет',
  review: 'Проверить',
  noise: 'Шум',
  vending: 'Вендинг',
};

export const GOOGLE_STATUS_LABELS: Record<GoogleBusinessStatus, string> = {
  Unknown: 'Неизвестно',
  Operational: 'Работает',
  ClosedPermanently: 'Закрыто',
  ClosedTemporarily: 'Временно закрыто',
  NotFound: 'Не найдено',
  Far: 'Далеко',
};

export const CATALOG_TAG_OPTIONS: { slug: string; label: string }[] = [
  { slug: 'laptop_friendly', label: 'Ноутбук' },
  { slug: 'specialty', label: 'Specialty' },
  { slug: 'pet_friendly', label: 'С животными' },
  { slug: 'pour_over', label: 'Пуровер' },
  { slug: 'quiet_work', label: 'Тихая работа' },
  { slug: 'to_go', label: 'С собой' },
  { slug: 'roastery', label: 'Обжарка' },
  { slug: 'confectionery', label: 'Кондитерская' },
  { slug: 'bakery', label: 'Пекарня' },
];

/** Prefer Russian labels when slug is known; otherwise use API name. */
export function catalogTagLabel(slug: string, fallbackName?: string): string {
  const known = CATALOG_TAG_OPTIONS.find((t) => t.slug === slug);
  return known?.label ?? fallbackName?.trim() ?? slug;
}

const FOCUS_ALIASES: Record<string, CoffeeFocus> = {
  specialty: 'specialty',
  Specialty: 'specialty',
  '1': 'specialty',
  coffee_bar: 'coffee_bar',
  CoffeeBar: 'coffee_bar',
  coffeeBar: 'coffee_bar',
  good_coffee: 'coffee_bar',
  '2': 'coffee_bar',
  cafe: 'cafe',
  Cafe: 'cafe',
  '3': 'cafe',
};

export const COFFEE_FOCUS_TO_API: Record<CoffeeFocus, number> = {
  specialty: 1,
  coffee_bar: 2,
  cafe: 3,
};

export const QUEUE_STATUS_TO_API: Record<KnownQueueStatus, number> = {
  Pending: 0,
  Skipped: 1,
  Published: 2,
  Rejected: 3,
};

export const BUCKET_TO_API: Record<CollectorBucket, number> = {
  priority: 0,
  review: 1,
  noise: 2,
  vending: 3,
};

export const IMPORT_LIST_PAGE_SIZE = 20;
export const IMPORT_QUEUE_PAGE_SIZE = 50;

export function parseImportListSearch(searchParams: URLSearchParams) {
  const status = (searchParams.get('status') ?? 'Pending') as KnownQueueStatus | 'all';
  const bucket = (searchParams.get('bucket') ?? 'priority') as CollectorBucket | 'all';
  const focus = (searchParams.get('focus') ?? '') as CoffeeFocus | '';
  const search = searchParams.get('search') ?? '';
  const hasAddress = searchParams.get('hasAddress') === '1';
  const rejectReason = (searchParams.get('rejectReason') ?? '') as RejectReason | '';
  const source = parseImportSource(searchParams.get('source')) ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10) || 1;
  return { status, bucket, focus, search, hasAddress, rejectReason, source, page };
}

const BUCKET_ALIASES: Record<string, CollectorBucket> = {
  priority: 'priority',
  Priority: 'priority',
  '0': 'priority',
  review: 'review',
  Review: 'review',
  '1': 'review',
  noise: 'noise',
  Noise: 'noise',
  '2': 'noise',
  vending: 'vending',
  Vending: 'vending',
  '3': 'vending',
};

const GOOGLE_ALIASES: Record<string, GoogleBusinessStatus> = {
  Unknown: 'Unknown',
  UNKNOWN: 'Unknown',
  '0': 'Unknown',
  Operational: 'Operational',
  OPERATIONAL: 'Operational',
  '1': 'Operational',
  ClosedPermanently: 'ClosedPermanently',
  CLOSED_PERMANENTLY: 'ClosedPermanently',
  '2': 'ClosedPermanently',
  ClosedTemporarily: 'ClosedTemporarily',
  CLOSED_TEMPORARILY: 'ClosedTemporarily',
  '3': 'ClosedTemporarily',
  NotFound: 'NotFound',
  NOT_FOUND: 'NotFound',
  '4': 'NotFound',
  Far: 'Far',
  FAR: 'Far',
  '5': 'Far',
};

const REJECT_ALIASES: Record<string, RejectReason> = {
  closed: 'closed',
  Closed: 'closed',
  '1': 'closed',
  invalid: 'invalid',
  Invalid: 'invalid',
  InvalidData: 'invalid',
  '2': 'invalid',
  not_coffee: 'not_coffee',
  NotCoffee: 'not_coffee',
  notCoffee: 'not_coffee',
  '3': 'not_coffee',
  duplicate: 'duplicate',
  Duplicate: 'duplicate',
  '4': 'duplicate',
};

const SOURCE_ALIASES: Record<string, ImportSource> = {
  Osm: 'Osm',
  OSM: 'Osm',
  osm: 'Osm',
  '1': 'Osm',
  File: 'File',
  file: 'File',
  '2': 'File',
};

const DUPLICATE_STATUS_ALIASES: Record<string, DuplicateSuggestionStatus> = {
  Pending: 'Pending',
  pending: 'Pending',
  '1': 'Pending',
  Confirmed: 'Confirmed',
  confirmed: 'Confirmed',
  '2': 'Confirmed',
  Rejected: 'Rejected',
  rejected: 'Rejected',
  '3': 'Rejected',
};

export function parseCoffeeFocus(value: unknown): CoffeeFocus | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return FOCUS_ALIASES[String(value)];
}

export function parseBucket(value: unknown): CollectorBucket | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return BUCKET_ALIASES[String(value)];
}

export function parseGoogleStatus(value: unknown): GoogleBusinessStatus | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return GOOGLE_ALIASES[String(value)];
}

export function parseRejectReason(value: unknown): RejectReason | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return REJECT_ALIASES[String(value)];
}

export function parseImportSource(value: unknown): ImportSource | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return SOURCE_ALIASES[String(value)];
}

export function parseDuplicateStatus(value: unknown): DuplicateSuggestionStatus {
  if (value === undefined || value === null || value === '') return 'Unknown';
  return DUPLICATE_STATUS_ALIASES[String(value)] ?? 'Unknown';
}

export function isClosedPermanently(status?: GoogleBusinessStatus): boolean {
  return status === 'ClosedPermanently';
}

export function isUsableShopName(name?: string): boolean {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return lower !== 'без имени' && lower !== 'unnamed' && !lower.startsWith('node/');
}

export function displayShopName(name?: string, brand?: string): string {
  if (isUsableShopName(name)) return name!.trim();
  if (brand?.trim()) return brand.trim();
  return 'без имени';
}

export function coordPair(latitude?: number, longitude?: number): { lat: string; lon: string } | null {
  if (latitude == null || longitude == null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { lat: String(latitude), lon: String(longitude) };
}

/** Pin/whatshere/embed URLs for a coordinate. Never interpolates the shop name. */
export function fallbackResearchLinks(input: {
  name?: string;
  brand?: string;
  address?: string;
  instagram?: string;
  website?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  externalId?: string;
  googleMapsUri?: string;
  source?: string;
}): {
  instagram: string;
  googleMaps: string;
  yandexMaps: string;
  yandexImages: string;
  osmHistory: string;
  yandexEmbed: string;
  googleEmbed: string;
  streetView: string;
} {
  const pair = coordPair(input.latitude, input.longitude);
  const lat = pair?.lat;
  const lon = pair?.lon;
  const handle = instagramHandleFrom(input.instagram);

  return {
    googleMaps:
      (input.googleMapsUri && !looksLikeNameSearch(input.googleMapsUri) ? input.googleMapsUri : '') ||
      (lat && lon ? `https://www.google.com/maps/@${lat},${lon},18z` : ''),
    instagram: handle ? `https://www.instagram.com/${handle}/` : '',
    yandexMaps:
      lat && lon
        ? `https://yandex.by/maps/?ll=${lon},${lat}&z=18&mode=whatshere&whatshere[point]=${lon},${lat}&whatshere[zoom]=18`
        : '',
    yandexImages: lat && lon ? `https://yandex.by/maps/?ll=${lon},${lat}&z=18&l=stv` : '',
    osmHistory: osmHistoryUrl(input.source, input.externalId),
    yandexEmbed:
      lat && lon
        ? `https://yandex.ru/map-widget/v1/?ll=${lon},${lat}&z=18&pt=${lon},${lat},pm2rdm`
        : '',
    googleEmbed: lat && lon ? `https://maps.google.com/maps?q=${lat},${lon}&z=18&output=embed` : '',
    streetView:
      lat && lon
        ? `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lon}&cbp=11,0,0,0,0&output=embed`
        : '',
  };
}

export function instagramHandleFrom(value?: string | null): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  const fromUrl = trimmed.match(
    /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)?instagram\.com\/([A-Za-z0-9._]+)\/?(?:[/?#].*)?$/i
  )?.[1];
  const fromAt = trimmed.match(/^@([A-Za-z0-9._]+)$/)?.[1];
  const fromBare = /^[A-Za-z0-9._]+$/.test(trimmed) ? trimmed : undefined;
  const handle = fromUrl || fromAt || fromBare;
  if (!handle) return undefined;
  const blocked = new Set(['explore', 'p', 'reel', 'reels', 'stories', 'accounts']);
  if (blocked.has(handle.toLowerCase())) return undefined;
  return handle;
}

export function normalizeInstagramUrl(raw: string): string | undefined {
  const handle = instagramHandleFrom(raw);
  return handle ? `https://www.instagram.com/${handle}/` : undefined;
}

export function looksLikeNameSearch(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (host.includes('instagram.com') && path.includes('/explore/search')) return true;
    if (host.includes('yandex') && path.includes('/images/')) return true;
    const text = parsed.searchParams.get('text') ?? '';
    const query = parsed.searchParams.get('query') ?? '';
    const q = parsed.searchParams.get('q') ?? '';
    const looksNamed = (value: string) =>
      Boolean(value) && !/^-?\d+(\.\d+)?\s*,\s*-?\d+/.test(value.trim());
    if (looksNamed(text) || looksNamed(query)) return true;
    if (looksNamed(q) && !parsed.searchParams.has('output') && !parsed.searchParams.has('layer')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function osmHistoryUrl(source?: string, externalId?: string): string {
  const parsed = parseImportSource(source);
  if (parsed && parsed !== 'Osm') return '';
  if (!externalId) return '';
  const parts = externalId.split('/');
  if (parts.length !== 2) return '';
  const [type, id] = parts;
  if (!['node', 'way', 'relation'].includes(type) || !id) return '';
  return `https://www.openstreetmap.org/${type}/${id}/history`;
}
