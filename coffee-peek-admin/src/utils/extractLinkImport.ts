import { cleanExternalUrl, LinkImportDraft, LinkImportField, LinkImportFields, normalizeLinkImportUrl } from './linkImport';
import { formatImportOpeningHours } from './importOpeningHours';

const text = (node: Element | null) => node?.textContent?.replace(/[\t ]+/g, ' ').trim() || '';
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const string = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const array = (value: unknown): unknown[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const meta = (doc: Document, key: string) => doc.querySelector(`meta[property="${key}"], meta[name="${key}"]`)?.getAttribute('content')?.trim() || '';
const phoneFromText = (value: string) => value.match(/\+\d[\d ()-]{7,24}\d/g)?.find((phone) => phone.replace(/\D/g, '').length >= 9);

function structuredObjects(doc: Document): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = [];
  let count = 0;
  const visit = (value: unknown, depth: number) => {
    if (depth > 30 || ++count > 30000) return;
    if (Array.isArray(value)) { value.forEach((child) => visit(child, depth + 1)); return; }
    const obj = record(value);
    if (!Object.keys(obj).length) return;
    objects.push(obj);
    Object.values(obj).forEach((child) => { if (child && typeof child === 'object') visit(child, depth + 1); });
  };
  doc.querySelectorAll('script[type="application/ld+json"], script[type="application/json"], script.state-view').forEach((script) => {
    if ((script.textContent?.length ?? 0) > 4_000_000) return;
    try { visit(JSON.parse(script.textContent || ''), 0); } catch { /* A source script may contain JavaScript, not JSON. */ }
  });
  return objects;
}

function openingHours(value: unknown, specs: unknown): string {
  const raw = array(value).filter((entry): entry is string => typeof entry === 'string').join('; ');
  if (raw) return raw;
  return array(specs).map((item) => {
    const spec = record(item);
    const days = array(spec.dayOfWeek).map((day) => string(day).replace(/^https?:\/\/schema.org\//, '')).filter(Boolean).join(', ');
    const opens = string(spec.opens), closes = string(spec.closes);
    return days && opens && closes ? `${days} ${opens}-${closes}` : '';
  }).filter(Boolean).join('; ');
}

function addressText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  const address = record(value);
  return ['addressLocality', 'streetAddress'].map((key) => string(address[key])).filter(Boolean).join(', ');
}

export function extractLinkImport(doc: Document, currentUrl: string): LinkImportDraft {
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
  let target = normalizeLinkImportUrl(currentUrl);
  if (!target.externalId && canonical) target = normalizeLinkImportUrl(canonical);
  if (!target.externalId) throw new Error('Откройте карточку организации');
  if (doc.querySelector('form[action*="checkcaptcha"], #captcha, [data-testid="captcha"]') || /showcaptcha|\/challenge\//.test(currentUrl)) {
    throw new Error('Источник требует проверку. Пройдите её во вкладке и повторите импорт');
  }
  const fields: LinkImportFields = {};
  const evidence: LinkImportDraft['evidence'] = {};
  const put = (key: LinkImportField, value: unknown, proof = '') => {
    if (fields[key] !== undefined) return;
    if (key === 'latitude' || key === 'longitude') {
      const number = typeof value === 'number' ? value : Number(value);
      if (value !== null && value !== undefined && value !== '' && Number.isFinite(number) && Math.abs(number) <= (key === 'latitude' ? 90 : 180)) fields[key] = number;
      return;
    }
    const cleaned = string(value);
    if (!cleaned) return;
    if (key === 'website' && !cleanExternalUrl(cleaned)) return;
    fields[key] = (key === 'openingHours' ? formatImportOpeningHours(cleaned) : cleaned).slice(0, key === 'description' ? 4000 : 2000);
    evidence[key] = (proof || cleaned).slice(0, 400);
  };
  const objects = structuredObjects(doc);
  if (target.source === 'yandex') {
    const scope = doc.querySelector('.business-card-view, .orgpage-content-view') ?? doc;
    const name = text(scope.querySelector('.orgpage-header-view__header, .business-card-title-view__title, h1'));
    const id = target.externalId.replace('yandex:', '');
    // Only take data belonging to this organisation; recommendation cards also contain business objects.
    const businesses = objects.filter((obj) => {
      const types = array(obj['@type']).map(string);
      if (!types.some((type) => /(?:LocalBusiness|CafeOrCoffeeShop|Restaurant|Organization|FoodEstablishment)$/.test(type))) return false;
      const identity = `${string(obj.url)} ${string(obj['@id'])}`;
      if (/\/maps\/org\//.test(identity)) return new RegExp(`/${id}(?:/|[?#\\s]|$)`).test(identity);
      return Boolean(name && string(obj.name) === name);
    });
    const company = objects.find((obj) => String(obj.id ?? '') === id && (obj.address || obj.Phones));
    put('name', name);
    for (const business of businesses) {
      put('name', business.name);
      put('address', addressText(business.address));
      put('phone', business.telephone);
      const geo = record(business.geo);
      put('latitude', geo.latitude); put('longitude', geo.longitude);
      put('openingHours', openingHours(business.openingHours, business.openingHoursSpecification));
      for (const link of [business.url, ...array(business.sameAs)]) {
        const url = cleanExternalUrl(link);
        if (!url) continue;
        try {
          const social = normalizeLinkImportUrl(url);
          if (social.source === 'instagram') put('instagram', social.url);
        } catch { put('website', url); }
      }
    }
    if (company) {
      put('name', company.name); put('address', company.address); put('website', company.url);
      put('phone', string(record(array(company.Phones)[0]).formatted));
      put('openingHours', record(company.Hours).text);
      const feature = objects.find((obj) => record(record(obj.properties).CompanyMetaData).id === company.id);
      const coords = record(feature?.geometry).coordinates;
      if (Array.isArray(coords)) { put('longitude', coords[0]); put('latitude', coords[1]); }
    }
    put('address', text(scope.querySelector('.business-contacts-view__address-link, [itemprop="streetAddress"]')));
    const tel = scope.querySelector('a[href^="tel:"]');
    put('phone', tel?.getAttribute('href')?.replace(/^tel:/, '') || text(scope.querySelector('.business-phones-view__phone-number')));
    const hourRows = doc.querySelectorAll('.business-working-hours-view__day');
    put('openingHours', hourRows.length ? Array.from(hourRows).map((row) => text(row)).join('; ') : text(doc.querySelector('.business-working-hours-view, [itemprop="openingHours"]')));
    for (const link of scope.querySelectorAll<HTMLAnchorElement>('.business-urls-view a[href], .business-social-links-view a[href], a[itemprop="url"]')) {
      const url = cleanExternalUrl(link.href);
      if (!url) continue;
      try {
        const social = normalizeLinkImportUrl(url);
        if (social.source === 'instagram') put('instagram', social.url);
      } catch { put('website', url); }
    }
    // itemprop/content represents organisation coordinates. Map centre parameters are deliberately ignored.
    put('latitude', doc.querySelector('[itemprop="latitude"]')?.getAttribute('content'));
    put('longitude', doc.querySelector('[itemprop="longitude"]')?.getAttribute('content'));
  } else {
    const handle = target.externalId.replace('instagram:', '');
    const title = meta(doc, 'og:title');
    const description = meta(doc, 'og:description');
    const profile = objects.find((obj) => array(obj['@type']).includes('Person') &&
      (string(obj.alternateName).replace(/^@/, '').toLowerCase() === handle || string(obj.url).toLowerCase().includes(`/${handle}/`)));
    const user = objects.find((obj) => string(obj.username).toLowerCase() === handle && (obj.biography || obj.full_name || obj.bio_links));
    const header = doc.querySelector('main header');
    if (!profile && !user && !title.toLowerCase().includes(`@${handle}`) && !text(header).toLowerCase().includes(handle)) {
      throw new Error('Профиль недоступен. Откройте его во вкладке источника и повторите импорт');
    }
    put('instagram', target.url);
    put('name', user?.full_name || profile?.name || title.split(/\s*\(@/)[0].replace(/\s*[•|]\s*Instagram.*$/i, ''));
    // Meta descriptions often start with follower counts. Only the quoted bio is usable as contact text.
    const quoted = description.match(/(?:[:：]\s*["“])([\s\S]+)["”]\s*$/)?.[1];
    const bio = string(user?.biography) || string(profile?.description) || quoted || text(header?.querySelector('[data-testid="user-bio"]') ?? null);
    put('description', bio);
    put('phone', user?.public_phone_number || user?.business_phone_number || phoneFromText(bio), bio);
    let businessAddress = record(user?.business_address_json);
    if (typeof user?.business_address_json === 'string') {
      try { businessAddress = record(JSON.parse(user.business_address_json)); } catch { /* Missing structured business address. */ }
    }
    put('address', [businessAddress.city_name, businessAddress.street_address].map(string).filter(Boolean).join(', '));
    put('latitude', businessAddress.latitude); put('longitude', businessAddress.longitude);
    const address = bio.split(/\n/).find((line) => /^(?:\s*📍\s*|\s*(?:адрес|address)\s*:)/i.test(line));
    put('address', address?.replace(/^(?:\s*📍\s*|\s*(?:адрес|address)\s*:)\s*/i, ''), address);
    const hours = bio.split(/\n/).filter((line) => /(?:\d{1,2}[:.]\d{2}\s*[-–—]\s*\d{1,2}[:.]\d{2}|24\s*\/\s*7)/.test(line) && /(?:пн|вт|ср|чт|пт|сб|вс|ежедневно|mon|tue|wed|thu|fri|sat|sun|daily|24\s*\/\s*7)/i.test(line)).map((line) => line.replace(/(\d{1,2})\.(\d{2})/g, '$1:$2').replace(/⌚️?|🕒/gu, '').replace(/[ ]{2,}/g, ' ').trim()).join('; ');
    put('openingHours', hours);
    for (const link of [user?.external_url, ...array(user?.bio_links).map((item) => record(item).url), ...array(profile?.sameAs), ...(header ? Array.from(header.querySelectorAll<HTMLAnchorElement>('a[href]')).map((a) => a.href) : [])]) {
      let url = cleanExternalUrl(link);
      if (!url) continue;
      const parsed = new URL(url);
      if (parsed.hostname === 'l.instagram.com') url = cleanExternalUrl(parsed.searchParams.get('u'));
      if (url && !/(^|\.)instagram.com$/.test(new URL(url).hostname)) put('website', url);
    }
  }
  if (!fields.name && !fields.phone && !fields.website) throw new Error('Данные карточки не найдены');
  return { ...target, fields, evidence, extractedAt: new Date().toISOString() };
}
