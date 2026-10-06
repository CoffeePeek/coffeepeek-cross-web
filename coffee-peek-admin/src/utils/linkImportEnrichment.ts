import type { CoffeeDrinkDefinitionDto, ShopMenuDto, UpdateShopMenuItemRequest } from '../api/menu';

export interface ImportTagEvidence {
  slug: string;
  evidence: string;
  sourceUrl: string;
}
export interface ImportMenuItem {
  name: string;
  price?: number;
  currency?: string;
  volumeMl?: number;
  weightGrams?: number;
  sourceUrl: string;
  delivery: boolean;
}
export interface ImportMenuSource {
  url: string;
  label: string;
  kind: 'menu' | 'gallery' | 'instagram';
}
export interface ImportMenuPhoto {
  url: string;
  sourceUrl: string;
  label: string;
}
export interface LinkImportEnrichment {
  tags: ImportTagEvidence[];
  menuItems: ImportMenuItem[];
  menuSources: ImportMenuSource[];
  photos: ImportMenuPhoto[];
  warnings: string[];
}
export const emptyEnrichment = (): LinkImportEnrichment => ({ tags: [], menuItems: [], menuSources: [], photos: [], warnings: [] });

const TAG_RULES: [string, RegExp][] = [
  ['to_go', /кофе с собой|еда навынос|напитки с собой|coffee to go|takeaway|take.away/i],
  ['pet_friendly', /dog[ -]friendly|pet[ -]friendly|можно с (?:собак|животн)|с животными разрешено/i],
  ['pour_over', /\b(?:v60|chemex|pour.over)\b|пуровер|кемекс/i],
  ['specialty', /\bspecialty\b|спешелти/i],
  ['laptop_friendly', /можно (?:работать )?с ноутбуком|для работы с ноутбуком|laptop friendly/i],
  ['quiet_work', /тихое место для работы|тихо для работы|quiet workspace/i],
  ['roastery', /собственная обжарка|обжариваем кофе|кофейная обжарочная|coffee roastery/i],
  ['bakery', /собственная пекарня|печ[её]м (?:хлеб|круассаны)|пекарня(?:$|[\s,.!])/i],
  ['confectionery', /собственная кондитерская|кондитерская(?:$|[\s,.!])/i],
];

// Only pass the organisation's own features/bio/menu here, never reviews or nearby businesses.
export function tagsFromEvidence(texts: string[], sourceUrl: string): ImportTagEvidence[] {
  return TAG_RULES.flatMap(([slug, rule]) => {
    const proof = texts.find((value) => rule.test(value) &&
      !/(?:не разреш|запрещ|нельзя|недоступ|не предлагаем|без животных|not allowed|no dogs|(?:^|[\s:—-])нет(?:$|[\s,.])|(?:^|\s)не\s+(?:dog|pet|laptop|specialty)|(?:^|\s)(?:not|no)\s+(?:dog|pet|laptop|specialty|v60|chemex))/i.test(value) &&
      !/(?:нет|не пода[её]м|не делаем|без)\s+(?:пуровер|кемекс|specialty|спешелти|v60|chemex)/i.test(value));
    return proof ? [{ slug, evidence: proof.trim().slice(0, 400), sourceUrl }] : [];
  });
}

export function safeSourceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 3000) return;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return;
    return url.href;
  } catch { return; }
}

export function safeMenuImageUrl(value: unknown): string | undefined {
  const safe = safeSourceUrl(value);
  if (!safe) return;
  const url = new URL(safe);
  if (url.protocol !== 'https:' || url.port) return;
  if (url.hostname === 'avatars.mds.yandex.net' && /^\/get-altay\//.test(url.pathname)) return safe;
  if (url.hostname.endsWith('.cdninstagram.com')) return safe;
}

const bounded = (value: unknown, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const positive = (value: unknown, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : undefined;
const list = (value: unknown): Record<string, unknown>[] => Array.isArray(value)
  ? value.filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)) : [];

export function validateEnrichment(raw: unknown): LinkImportEnrichment {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const result = emptyEnrichment();
  for (const tag of list(input.tags).slice(0, 30)) {
    const slug = bounded(tag.slug, 80), evidence = bounded(tag.evidence, 400), sourceUrl = safeSourceUrl(tag.sourceUrl);
    if (TAG_RULES.some(([known]) => known === slug) && evidence && sourceUrl &&
      tagsFromEvidence([evidence], sourceUrl).some((t) => t.slug === slug) &&
      !result.tags.some((t) => t.slug === slug)) result.tags.push({ slug, evidence, sourceUrl });
  }
  for (const row of list(input.menuItems).slice(0, 200)) {
    const name = bounded(row.name, 200), sourceUrl = safeSourceUrl(row.sourceUrl);
    if (!name || !sourceUrl) continue;
    const currency = bounded(row.currency, 3).toUpperCase();
    const price = positive(row.price, 10000);
    const item: ImportMenuItem = {
      name, sourceUrl, delivery: row.delivery === true,
      ...(price !== undefined && /^[A-Z]{3}$/.test(currency) ? { price, currency } : {}),
      ...(positive(row.volumeMl, 5000) !== undefined ? { volumeMl: row.volumeMl as number } : {}),
      ...(positive(row.weightGrams, 10000) !== undefined ? { weightGrams: row.weightGrams as number } : {}),
    };
    if (!result.menuItems.some((r) => r.name === name && r.price === item.price &&
      r.volumeMl === item.volumeMl && r.weightGrams === item.weightGrams && r.currency === item.currency && r.delivery === item.delivery && r.sourceUrl === sourceUrl)) result.menuItems.push(item);
  }
  for (const entry of list(input.menuSources).slice(0, 20)) {
    const url = safeSourceUrl(entry.url), label = bounded(entry.label, 120);
    const kind = entry.kind;
    if (url && label && (kind === 'menu' || kind === 'gallery' || kind === 'instagram') &&
      !result.menuSources.some((s) => s.url === url)) result.menuSources.push({ url, label, kind });
  }
  for (const entry of list(input.photos).slice(0, 300)) {
    const url = safeMenuImageUrl(entry.url), sourceUrl = safeSourceUrl(entry.sourceUrl);
    if (url && sourceUrl && !result.photos.some((p) => p.url === url)) {
      result.photos.push({ url, sourceUrl, label: bounded(entry.label, 120) || 'Фото меню' });
      if (result.photos.length >= 60) break;
    }
  }
  result.warnings = Array.isArray(input.warnings)
    ? [...new Set(input.warnings.filter((v): v is string => typeof v === 'string').map((v) => v.slice(0, 300)))].slice(0, 12) : [];
  return result;
}

export function mergeEnrichment(...parts: (LinkImportEnrichment | undefined)[]): LinkImportEnrichment {
  const result = emptyEnrichment();
  for (const part of parts) {
    if (!part) continue;
    for (const key of ['tags', 'menuItems', 'menuSources', 'photos', 'warnings'] as const) {
      (result[key] as unknown[]).push(...part[key]);
    }
  }
  return validateEnrichment(result);
}

const normalizeDrink = (name: string) => name.toLowerCase().replace(/ё/g, 'е')
  .replace(/\d+(?:[.,]\d+)?\s*(?:мл|ml|л|l)(?=$|[^\p{L}])/giu, '').replace(/[_\-]/g, ' ')
  .replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();

export interface MatchedImportDrink {
  index: number;
  slug: string;
  name: string;
  item: ImportMenuItem;
}
export function matchImportDrinks(items: ImportMenuItem[], catalog: CoffeeDrinkDefinitionDto[]): MatchedImportDrink[] {
  return items.flatMap((item, index) => {
    const name = normalizeDrink(item.name);
    const drink = catalog.find((entry) => [entry.slug, entry.nameRu, entry.nameEn].some((n) => normalizeDrink(n) === name));
    return drink ? [{ index, slug: drink.slug, name: drink.nameRu, item }] : [];
  });
}

// The API stores one row per drink. Never erase existing drinks or transplant another currency.
export function importDrinkUpdates(selected: MatchedImportDrink[], current?: ShopMenuDto | null): UpdateShopMenuItemRequest[] {
  const rows = new Map<string, UpdateShopMenuItemRequest>();
  for (const item of current?.items ?? []) rows.set(item.slug, {
    slug: item.slug, availability: item.availability, price: item.price, volumeMl: item.volumeMl,
  });
  const selectedSlugs = new Set<string>();
  for (const { slug, item } of selected) {
    if (selectedSlugs.has(slug)) throw new Error('Выберите один объём для каждого напитка');
    selectedSlugs.add(slug);
    if (item.price !== undefined && item.currency !== (current?.currency || 'BYN')) throw new Error('Валюта меню отличается');
    rows.set(slug, { slug, availability: 'Present', price: item.price ?? rows.get(slug)?.price ?? null,
      volumeMl: item.volumeMl ?? rows.get(slug)?.volumeMl ?? null });
  }
  return [...rows.values()];
}

const CACHE_PREFIX = 'coffeepeek-import-enrichment-v2:';
export interface SavedImportEnrichment { enrichment: LinkImportEnrichment; tagSlugs: string[]; sourceUrl?: string }
export function saveImportEnrichment(key: string, enrichment: LinkImportEnrichment, tagSlugs: string[], sourceUrl?: string): void {
  localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ enrichment: validateEnrichment(enrichment), tagSlugs,
    sourceUrl: safeSourceUrl(sourceUrl) ?? loadImportEnrichment(key)?.sourceUrl }));
}
export function loadImportEnrichment(...keys: string[]): SavedImportEnrichment | undefined {
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) continue;
      const value = JSON.parse(raw);
      return { enrichment: validateEnrichment(value.enrichment),
        sourceUrl: safeSourceUrl(value.sourceUrl),
        tagSlugs: Array.isArray(value.tagSlugs) ? value.tagSlugs.filter((s: unknown): s is string => typeof s === 'string' && /^[a-z0-9_-]{1,80}$/.test(s)) : [] };
    } catch { /* An unavailable or old draft must not prevent opening the candidate. */ }
  }
}
