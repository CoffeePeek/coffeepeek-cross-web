export const LINK_IMPORT_CHANNEL = 'coffeepeek-link-import-v1';
export const LINK_IMPORT_VERSION = 1;
export const YANDEX_HOSTS = ['yandex.ru', 'yandex.by', 'yandex.com', 'yandex.kz', 'yandex.uz'];
export type LinkImportSource = 'yandex' | 'instagram';
export type LinkImportFields = Partial<{
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  website: string;
  instagram: string;
  openingHours: string;
  description: string;
}>;
export type LinkImportField = keyof LinkImportFields;
export interface LinkImportTarget {
  source: LinkImportSource;
  url: string;
  externalId?: string;
}
export interface LinkImportDraft extends LinkImportTarget {
  extractedAt: string;
  fields: LinkImportFields;
  evidence: Partial<Record<LinkImportField, string>>;
}
export const CONTACT_FIELDS = ['phone', 'website', 'instagram', 'openingHours'] as const;
export const LINK_IMPORT_LABELS: Record<LinkImportField, string> = {
  name: 'Название', address: 'Адрес', latitude: 'Широта', longitude: 'Долгота',
  phone: 'Телефон', website: 'Сайт', instagram: 'Instagram', openingHours: 'Расписание', description: 'Описание',
};

export function normalizeLinkImportUrl(input: string): LinkImportTarget {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('Вставьте ссылку на организацию Яндекса или профиль Instagram'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Нужна ссылка HTTPS');
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'instagram.com') {
    const match = url.pathname.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
    const handle = match?.[1]?.toLowerCase();
    if (!handle || ['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'direct', 'share', 'about', 'legal', 'challenge'].includes(handle)) {
      throw new Error('Нужна ссылка на профиль Instagram');
    }
    return { source: 'instagram', url: `https://www.instagram.com/${handle}/`, externalId: `instagram:${handle}` };
  }
  if (YANDEX_HOSTS.includes(host)) {
    const org = url.pathname.match(/^\/maps\/org\/(?:[^/]+\/)?(\d+)\/?(?:[^/]*)?\/?$/);
    const oid = url.searchParams.get('oid');
    const isShort = /^\/maps\/-\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname);
    const queryOrg = /^\/maps\/?$/.test(url.pathname) && oid && /^\d+$/.test(oid);
    const id = org?.[1] || (queryOrg ? oid : undefined);
    if (!id && !isShort) throw new Error('Нужна ссылка на организацию Яндекса');
    const path = id ? `/maps/org/${id}/` : url.pathname;
    return { source: 'yandex', url: `https://${host}${path}?lang=ru_RU`, ...(id ? { externalId: `yandex:${id}` } : {}) };
  }
  throw new Error('Поддерживаются Яндекс Карты и Instagram');
}

export function cleanExternalUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch { return undefined; }
}

// Treat extension messages like external input. Never render or submit raw HTML or unknown properties.
export function validateLinkImportDraft(raw: unknown, requested: LinkImportTarget): LinkImportDraft {
  if (!raw || typeof raw !== 'object') throw new Error('Расширение вернуло некорректные данные');
  const input = raw as LinkImportDraft;
  const target = normalizeLinkImportUrl(input.url);
  if (target.source !== requested.source || !target.externalId ||
    (requested.externalId && target.externalId !== requested.externalId)) throw new Error('Открылась другая карточка');
  const fields: LinkImportFields = {};
  const evidence: LinkImportDraft['evidence'] = {};
  for (const key of Object.keys(LINK_IMPORT_LABELS) as LinkImportField[]) {
    const value = input.fields?.[key];
    if (key === 'latitude' || key === 'longitude') continue;
    if (typeof value !== 'string' || !value.trim()) continue;
    if (value.length > (key === 'description' ? 4000 : 2000)) continue;
    let cleaned = value.trim();
    if (key === 'website') {
      const website = cleanExternalUrl(cleaned);
      if (!website) continue;
      cleaned = website;
    }
    if (key === 'instagram') {
      try {
        const instagram = normalizeLinkImportUrl(cleaned);
        if (instagram.source !== 'instagram') continue;
        cleaned = instagram.url;
      } catch { continue; }
    }
    if (key === 'phone' && !/^\+?[\d\s().,;/-]{7,100}$/.test(cleaned)) continue;
    fields[key] = cleaned;
    if (typeof input.evidence?.[key] === 'string') evidence[key] = input.evidence[key]!.slice(0, 400);
  }
  const { latitude, longitude } = input.fields ?? {};
  if (typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
    fields.latitude = latitude;
    fields.longitude = longitude;
  }
  if (!fields.name && !CONTACT_FIELDS.some((key) => fields[key])) throw new Error('Данные карточки не найдены');
  return { ...target, extractedAt: new Date().toISOString(), fields, evidence };
}

export function selectedContactPatch(fields: LinkImportFields, selected: ReadonlySet<LinkImportField>) {
  const patch: Partial<Record<typeof CONTACT_FIELDS[number], string>> = {};
  for (const key of CONTACT_FIELDS) {
    if (!selected.has(key)) continue;
    const value = fields[key]?.trim();
    if (!value || value.length > 2000) throw new Error(`Проверьте поле «${LINK_IMPORT_LABELS[key]}»`);
    if (key === 'website' && !cleanExternalUrl(value)) throw new Error('Проверьте ссылку на сайт');
    if (key === 'phone' && !/^\+?[\d\s().,;/-]{7,100}$/.test(value)) throw new Error('Проверьте телефон');
    if (key === 'instagram') {
      const target = normalizeLinkImportUrl(value);
      if (target.source !== 'instagram') throw new Error('Проверьте ссылку Instagram');
      patch[key] = target.url;
    } else patch[key] = value;
  }
  return patch;
}

export function newCandidateFromLink(draft: LinkImportDraft, selected: ReadonlySet<LinkImportField>) {
  const fields = Object.fromEntries(Object.entries(draft.fields).filter(([key]) => selected.has(key as LinkImportField) && key !== 'description')) as LinkImportFields;
  if (!fields.name?.trim() || !fields.address?.trim() || typeof fields.latitude !== 'number' || typeof fields.longitude !== 'number' ||
    !Number.isFinite(fields.latitude) || !Number.isFinite(fields.longitude) || Math.abs(fields.latitude) > 90 || Math.abs(fields.longitude) > 180) {
    throw new Error('Для новой кофейни нужны название, адрес и координаты');
  }
  return { ...fields, ...selectedContactPatch(fields, new Set(CONTACT_FIELDS.filter((key) => selected.has(key) && fields[key]))), externalId: draft.externalId };
}
