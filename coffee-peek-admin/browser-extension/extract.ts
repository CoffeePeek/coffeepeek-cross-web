import { extractLinkImport } from '../src/utils/extractLinkImport';
import { mergeEnrichment, type LinkImportEnrichment } from '../src/utils/linkImportEnrichment';
// Runs in the extension's isolated world, without reading application cookies or tokens.
const world = globalThis as typeof globalThis & { __coffeepeekExtract?: () => unknown; __coffeepeekHoursClick?: number;
  __coffeepeekGallery?: LinkImportEnrichment; __coffeepeekGalleryCollecting?: boolean };
if (location.hostname.includes('yandex.') && !document.querySelector('.business-working-intervals-view, .business-working-hours-view')) {
  const hours = document.querySelector<HTMLElement>('.business-working-status-view[aria-expanded="false"], .business-working-status-view [aria-expanded="false"], .business-working-status-view');
  if (hours && hours.getAttribute('aria-expanded') !== 'true' && Date.now() - (world.__coffeepeekHoursClick ?? 0) > 5000) {
    world.__coffeepeekHoursClick = Date.now();
    hours.click();
  }
}
if (location.hostname.endsWith('instagram.com')) {
  const more = [...document.querySelectorAll<HTMLElement>('main header [role="button"]')].find((button) => /^(ещё|еще|more)$/i.test(button.textContent?.trim() || ''));
  more?.click();
}
world.__coffeepeekExtract = () => {
  const draft = extractLinkImport(document, location.href);
  if (location.hostname.includes('yandex.') && /\/gallery\/?$/.test(location.pathname)) {
    world.__coffeepeekGallery = mergeEnrichment(world.__coffeepeekGallery, draft.enrichment);
    draft.enrichment = world.__coffeepeekGallery;
    const next = [...document.querySelectorAll<HTMLElement>('.media-gallery__frame-wrapper')]
      .find((frame) => !frame.querySelector('img.media-wrapper__media, video'));
    world.__coffeepeekGalleryCollecting = Boolean(next && draft.enrichment.photos.length < 60);
    if (world.__coffeepeekGalleryCollecting) next?.scrollIntoView({ block: 'center' });
  }
  return draft;
};
