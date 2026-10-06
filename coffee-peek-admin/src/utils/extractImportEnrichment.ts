import { normalizeLinkImportUrl, YANDEX_HOSTS, type LinkImportTarget } from './linkImport';
import { emptyEnrichment, safeMenuImageUrl, safeSourceUrl, tagsFromEvidence, validateEnrichment, type LinkImportEnrichment } from './linkImportEnrichment';

const text = (e: Node | null) => e?.textContent?.replace(/\s+/g, ' ').trim() || '';
const menuLabel = /меню|menu|прайс|price list|кофейная карта|ассортимент/i;

export function extractImportEnrichment(doc: Document, currentUrl: string, target: LinkImportTarget, bio = ''): LinkImportEnrichment {
  const result = emptyEnrichment();
  const scope = target.source === 'yandex'
    ? doc.querySelector('.orgpage-content-view, .business-card-view') ?? doc.body
    : doc.querySelector('main') ?? doc.body;
  const features: string[] = [];
  if (target.source === 'yandex') {
    scope.querySelectorAll('.business-features-view').forEach((block) => {
      block.querySelectorAll('*').forEach((node) => {
        if (node.children.length === 0 && text(node)) features.push(text(node.parentElement));
      });
    });
  }
  result.tags = tagsFromEvidence(target.source === 'yandex' ? features : bio.split(/\n/), currentUrl);
  for (const a of scope.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const url = safeSourceUrl(a.href);
    if (!url) continue;
    const label = a.getAttribute('aria-label') || text(a);
    const path = new URL(url).pathname;
    let ownYandex = false;
    try {
      const linked = normalizeLinkImportUrl(url);
      ownYandex = target.source === 'yandex' && linked.source === 'yandex' && linked.externalId === target.externalId;
    } catch { /* External menu links stay reviewable without being crawled as Yandex cards. */ }
    if (ownYandex && /\/menu\/?$/.test(path)) result.menuSources.push({ url, label: 'Меню в Яндексе', kind: 'menu' });
    else if (ownYandex && /\/gallery\/?$/.test(path)) result.menuSources.push({ url, label: 'Фото в Яндексе', kind: 'gallery' });
    else if (menuLabel.test(label) && /\/stories\/highlights\//.test(path) && target.source === 'instagram') {
      result.menuSources.push({ url, label: label.replace(/^Смотреть актуальное:\s*/, ''), kind: 'instagram' });
    } else if (menuLabel.test(label) && !YANDEX_HOSTS.includes(new URL(url).hostname.replace(/^www\./, '')) && !/\/maps\/(?:user|category)\//.test(path)) {
      result.menuSources.push({ url, label: label.slice(0, 120) || 'Меню', kind: 'menu' });
    }
  }

  if (target.source === 'yandex' && /\/menu\/?$/.test(new URL(currentUrl).pathname)) {
    const delivery = /Это меню доставки|Источник:\s*Яндекс Еда/i.test(text(scope));
    scope.querySelectorAll('.related-item-photo-view').forEach((row) => {
      const name = text(row.querySelector('.related-item-photo-view__title'));
      const priceText = text(row.querySelector('.related-product-view__price'));
      if (!name || !priceText) return;
      const amount = priceText.match(/^(\d+(?:[.,]\d{1,2})?)\s*(Br|BYN|бел\.?\s*руб\.?|RUB|₽|USD|EUR|€|\$)$/i);
      const rawUnit = amount?.[2]?.toUpperCase();
      const currency = rawUnit && (/BR|BYN|БЕЛ/.test(rawUnit) ? 'BYN' : /RUB|₽/.test(rawUnit) ? 'RUB' : /EUR|€/.test(rawUnit) ? 'EUR' : 'USD');
      const size = text(row.querySelector('.related-product-view__volume'));
      const volume = size.match(/^(\d+(?:[.,]\d+)?)\s*(мл|ml|л|l)$/i);
      const weight = size.match(/^(\d+)\s*г$/i);
      result.menuItems.push({
        name, sourceUrl: currentUrl, delivery,
        ...(amount && currency ? { price: Number(amount[1].replace(',', '.')), currency } : {}),
        ...(volume ? { volumeMl: Number(volume[1].replace(',', '.')) * (/^мл$|^ml$/i.test(volume[2]) ? 1 : 1000) } : {}),
        ...(weight ? { weightGrams: Number(weight[1]) } : {}),
      });
    });
    if (delivery) result.warnings.push('Меню доставки: цены в заведении могут отличаться.');
    result.tags.push(...tagsFromEvidence(result.menuItems.map((item) => item.name), currentUrl));
  }
  // Gallery photos are candidates for a user selection, not automatically classified as menu.
  const images = target.source === 'yandex'
    ? doc.querySelectorAll<HTMLImageElement>('.media-gallery__frame-wrapper img.media-wrapper__media')
    : scope.querySelectorAll<HTMLImageElement>('img');
  for (const image of images) {
    if (target.source === 'instagram' && !menuLabel.test(image.alt) && !/\/p\//.test(new URL(currentUrl).pathname)) continue;
    const url = safeMenuImageUrl(image.currentSrc || image.src);
    if (url) result.photos.push({ url, sourceUrl: currentUrl, label: image.alt || 'Фото меню' });
  }
  return validateEnrichment(result);
}
