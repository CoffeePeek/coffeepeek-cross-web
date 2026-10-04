import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import { extractLinkImport } from '../src/utils/extractLinkImport';
import { LINK_IMPORT_VERSION, normalizeLinkImportUrl, validateLinkImportDraft } from '../src/utils/linkImport';
import { mergeEnrichment, safeMenuImageUrl } from '../src/utils/linkImportEnrichment';

const root = 'https://yandex.by/maps/org/coffelion/41070949812/';
const workerCode = readFileSync('browser-extension/worker.js', 'utf8').replace(/^import[^\n]+\n/, '');

function platform(blockInstagram = false) {
  let listener: (message: unknown, sender: unknown, respond: (result: any) => void) => void;
  let now = 0;
  const tabs = new Map<number, { id: number; url: string; status: string }>();
  const created: { id: number; url: string; active: boolean }[] = [];
  const removed: number[] = [];
  const chrome = {
    storage: { local: { get: async () => ({ adminOrigin: 'http://localhost:5174' }) } },
    tabs: {
      create: async (options: { url: string; active: boolean }) => {
        const tab = { id: created.length + 100, url: options.url, status: 'complete' };
        created.push({ ...tab, active: options.active }); tabs.set(tab.id, tab); return tab;
      },
      get: async (id: number) => tabs.get(id),
      remove: async (id: number) => { removed.push(id); tabs.delete(id); },
    },
    scripting: { executeScript: async ({ target, files }: { target: { tabId: number }; files?: string[] }) => {
      if (files) return [];
      const url = tabs.get(target.tabId)!.url;
      if (blockInstagram && url.includes('instagram')) return [{ result: { error: 'Профиль недоступен' } }];
      const html = url.includes('instagram')
        ? '<main><header><h2>coffelion_minsk</h2><div role="button">dog friendly<br>📍 Другой адрес<br>Пн-Пт 10:00–18:00</div></header></main>'
        : url.includes('/gallery/')
          ? '<div class="media-gallery__frame-wrapper"><img class="media-wrapper__media" src="https://avatars.mds.yandex.net/get-altay/1/menu/XXXL"></div>'
          : url.includes('/menu/')
            ? '<div class="orgpage-content-view"><div class="related-item-photo-view"><div class="related-item-photo-view__title">Капучино</div><div class="related-product-view__price">5 Br</div><div class="related-product-view__volume">250 мл</div></div></div>'
            : `<div class="orgpage-content-view"><h1>Coffelion</h1><span itemprop="streetAddress">Минск, Игуменский тракт, 14</span><a itemprop="sameAs" href="https://instagram.com/coffelion_minsk/">Instagram</a><div class="business-contacts-view__social-button"><a itemprop="sameAs" href="https://instagram.com/coffelion_minsk/">Instagram</a></div><div class="business-features-view"><span>Кофе с собой</span></div><a href="${root}menu/">Меню</a><a href="${root}gallery/">Фото</a><a href="https://yandex.by/maps/org/other/123/menu/">Меню</a><div itemprop="openingHours">Пн-Пт 08:00-22:00</div></div>`;
      return [{ result: { draft: extractLinkImport(new JSDOM(html, { url }).window.document, url) } }];
    } },
    runtime: { onMessage: { addListener: (callback: typeof listener) => { listener = callback; } } },
  };
  runInNewContext(workerCode, { chrome, URL, Map, Set, Date: { now: () => now },
    setTimeout: (fn: () => void, ms: number) => { now += ms; queueMicrotask(fn); }, clearTimeout,
    normalizeLinkImportUrl, validateLinkImportDraft, LINK_IMPORT_VERSION, mergeEnrichment, safeMenuImageUrl });
  const send = (action: string, url?: string) => new Promise<any>((resolve) => listener(
    { requestId: 'test-request', action, url }, { tab: { id: 7 }, frameId: 0, url: 'http://localhost:5174/import/test' }, resolve));
  return { send, created, removed };
}

test('extension follows own menu/gallery and Instagram, preserves identity and merges evidence', async () => {
  const fixture = platform();
  expect(await fixture.send('ping')).toEqual({ version: LINK_IMPORT_VERSION });
  const result = await fixture.send('extract', root);
  expect(result.error).toBeUndefined();
  expect(result.draft.fields).toMatchObject({ name: 'Coffelion', address: 'Минск, Игуменский тракт, 14' });
  expect(result.draft.enrichment.tags.map((tag: { slug: string }) => tag.slug)).toEqual(['to_go', 'pet_friendly']);
  expect(result.draft.enrichment.menuItems[0]).toMatchObject({ name: 'Капучино', price: 5, volumeMl: 250 });
  expect(result.draft.enrichment.photos).toHaveLength(1);
  expect(result.draft.enrichment.warnings[0]).toContain('другое расписание');
  expect(fixture.created).toHaveLength(4);
  expect(fixture.created.every((tab) => tab.active === false && !tab.url.includes('/123/'))).toBe(true);
  expect(fixture.removed).toEqual(fixture.created.map((tab) => tab.id));
});

test('unavailable Instagram does not discard menu or invent pet-friendly evidence', async () => {
  const fixture = platform(true);
  const result = await fixture.send('extract', root);
  expect(result.draft.enrichment.menuItems).toHaveLength(1);
  expect(result.draft.enrichment.tags.map((tag: { slug: string }) => tag.slug)).toEqual(['to_go']);
  expect(result.draft.enrichment.warnings).toContain('Instagram: Профиль недоступен');
  expect(fixture.removed).not.toContain(fixture.created.find((tab) => tab.url.includes('instagram'))!.id);
});

test('extension rejects arbitrary image download requests', async () => {
  expect((await platform().send('image', 'https://evil.test/image.jpg')).error).toContain('не поддерживается');
});
