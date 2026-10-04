import { JSDOM } from 'jsdom';
import { extractLinkImport } from '../src/utils/extractLinkImport';
import { extractImportEnrichment } from '../src/utils/extractImportEnrichment';
import { normalizeLinkImportUrl } from '../src/utils/linkImport';
import { emptyEnrichment, importDrinkUpdates, loadImportEnrichment, matchImportDrinks, mergeEnrichment, safeMenuImageUrl, saveImportEnrichment, tagsFromEvidence, validateEnrichment } from '../src/utils/linkImportEnrichment';
import type { CoffeeDrinkDefinitionDto, ShopMenuDto } from '../src/api/menu';

const url = 'https://yandex.by/maps/org/don_coffe_on/1148465931/';
const target = normalizeLinkImportUrl(url);
const documentOf = (html: string, pageUrl = url) => new JSDOM(html, { url: pageUrl }).window.document;
const drinks: CoffeeDrinkDefinitionDto[] = [{ slug: 'cappuccino', nameRu: 'Капучино', nameEn: 'Cappuccino', category: 'Espresso', sortOrder: 0 }];
const coffee = { name: 'Капучино 250 мл', price: 5.5, currency: 'BYN', volumeMl: 250, sourceUrl: url, delivery: false };

describe('link import enrichment', () => {
  test('extracts current Yandex phone, weekly hours and HTTP Instagram without nearby tags', () => {
    const doc = documentOf(`<div class="orgpage-content-view">
      <h1 class="orgpage-header-view__header">Don Coffe’On</h1>
      <span class="orgpage-phones-view__phone-number">+375 29 631-31-70</span>
      <div class="business-contacts-view__social-button"><a itemprop="sameAs" href="http://instagram.com/doncoffeonmenu">Instagram</a></div>
      <div class="business-features-view"><div><span>Кофе с собой</span></div><div><span>Wi-Fi</span></div></div>
      <a href="${url}menu/">Меню</a><a href="${url}gallery/">Фото</a>
    </div><div class="business-working-intervals-view"><div class="business-working-intervals-view__item"><span>Понедельник</span><span>11:00–23:00</span></div></div>
    <aside><div class="business-features-view"><span>Specialty</span><span>Собственная пекарня</span></div><a href="https://yandex.by/maps/org/other/123/menu/">Меню</a></aside>`);
    const draft = extractLinkImport(doc, url);
    expect(draft.fields).toMatchObject({ phone: '+375 29 631-31-70', instagram: 'https://www.instagram.com/doncoffeonmenu/', openingHours: 'Понедельник 11:00–23:00' });
    expect(draft.enrichment?.tags.map((tag) => tag.slug)).toEqual(['to_go']);
    expect(draft.enrichment?.menuSources.map((source) => source.kind)).toEqual(['menu', 'gallery']);
  });

  test('reads DOM-only Instagram bio with line breaks and a menu highlight', () => {
    const profileUrl = 'https://www.instagram.com/coffelion_minsk/';
    const doc = documentOf(`<main><header><h2>coffelion_minsk</h2><div role="button"><span>Больше чем кофе<br>dog friendly🐾<br>Пн-Пт 08:00–22:00<br>📍 Минск, Игуменский тракт, 14</span></div>
      <a aria-label="Смотреть актуальное: Ассортимент" href="/stories/highlights/18026166761607633/">Ассортимент</a></header></main>`, profileUrl);
    const draft = extractLinkImport(doc, profileUrl);
    expect(draft.fields.description).toContain('\ndog friendly');
    expect(draft.fields.address).toBe('Минск, Игуменский тракт, 14');
    expect(draft.enrichment?.tags.map((tag) => tag.slug)).toEqual(['pet_friendly']);
    expect(draft.enrichment?.menuSources).toHaveLength(1);
  });

  test('distinguishes delivery prices, grams and millilitres, including comma prices', () => {
    const menuUrl = url + 'menu/';
    const doc = documentOf(`<div class="business-menu-view">Это меню доставки. Источник: Яндекс Еда
      <div class="related-item-photo-view"><div class="related-item-photo-view__title">Капучино</div><div class="related-product-view__price">5,50 Br</div><div class="related-product-view__volume">0,25 л</div></div>
      <div class="related-item-photo-view"><div class="related-item-photo-view__title">Паста</div><div class="related-product-view__price">18 Br</div><div class="related-product-view__volume">250 г</div></div>
      <div class="related-item-photo-view"><div class="related-item-photo-view__title">Латте</div><div class="related-product-view__price">от 4 до 7 Br</div></div>
    </div>`, menuUrl);
    const result = extractImportEnrichment(doc, menuUrl, target);
    expect(result.menuItems[0]).toMatchObject({ price: 5.5, currency: 'BYN', volumeMl: 250, delivery: true });
    expect(result.menuItems[1]).toMatchObject({ weightGrams: 250 });
    expect(result.menuItems[1].volumeMl).toBeUndefined();
    expect(result.menuItems[2].price).toBeUndefined();
    expect(result.warnings[0]).toContain('доставки');
  });

  test.each(['Кофе с собой: нет', 'Кофе с собой Нет', 'Не предлагаем кофе с собой', 'Нет пуровера', 'V60 запрещён', 'not pet-friendly', 'dog friendly — нельзя с собакой'])('does not assign a tag from a negative statement: %s', (proof) => {
    expect(tagsFromEvidence([proof], url)).toEqual([]);
  });
  test('does not infer laptop, bakery, specialty or roastery from Wi-Fi, desserts and beans', () => {
    expect(tagsFromEvidence(['Wi-Fi', 'Десерты', 'Кофе Lavazza', 'Продажа зерна', 'Тихая музыка'], url)).toEqual([]);
    expect(tagsFromEvidence(['Собственная пекарня', 'Обжариваем кофе', 'V60'], url).map((tag) => tag.slug)).toEqual(['pour_over', 'roastery', 'bakery']);
  });
  test('sanitizes untrusted tags and photos, retains distinct menu variants', () => {
    const result = validateEnrichment({ tags: [{ slug: 'pet_friendly', evidence: 'Wi-Fi', sourceUrl: url }], photos: [
      { url: 'https://evil.test/image.jpg', sourceUrl: url }, { url: 'https://avatars.mds.yandex.net/get-altay/123/menu/XXXL', sourceUrl: url },
    ], menuItems: [coffee, coffee, { ...coffee, volumeMl: 350 }, { ...coffee, price: -5 }] });
    expect(result.tags).toEqual([]);
    expect(result.photos).toHaveLength(1);
    expect(result.menuItems).toHaveLength(3);
    expect(result.menuItems[2].price).toBeUndefined();
    expect(safeMenuImageUrl('https://avatars.mds.yandex.net.evil.test/get-altay/1/x')).toBeUndefined();
    expect(safeMenuImageUrl('https://x.cdninstagram.com/image.jpg')).toBeDefined();
  });
  test('matches coffee names with Russian units, preserves existing rows and rejects duplicate volumes/foreign currency', () => {
    const matched = matchImportDrinks([coffee, { ...coffee, name: 'Паста' }], drinks);
    expect(matched.map((row) => row.slug)).toEqual(['cappuccino']);
    const current: ShopMenuDto = { currency: 'BYN', parseStatus: 'Ready', photos: [], items: [{ slug: 'espresso', nameRu: 'Эспрессо', nameEn: 'Espresso', category: 'Espresso', availability: 'Present', price: 3, currency: 'BYN', volumeMl: 30, source: 'Manual' }] };
    expect(importDrinkUpdates(matched, current)).toEqual([
      { slug: 'espresso', availability: 'Present', price: 3, volumeMl: 30 }, { slug: 'cappuccino', availability: 'Present', price: 5.5, volumeMl: 250 },
    ]);
    expect(() => importDrinkUpdates([...matched, ...matched], current)).toThrow('один объём');
    expect(() => importDrinkUpdates([{ ...matched[0], item: { ...coffee, currency: 'RUB' } }], current)).toThrow('Валюта');
  });
  test('catalogue refresh does not shift the identity of a selected raw menu row', () => {
    const items = [{ ...coffee, name: 'Латте' }, coffee];
    expect(matchImportDrinks(items, drinks)[0].index).toBe(1);
    const expanded = [...drinks, { ...drinks[0], slug: 'latte', nameRu: 'Латте', nameEn: 'Latte' }];
    expect(matchImportDrinks(items, expanded).find((match) => match.index === 1)?.slug).toBe('cappuccino');
  });
  test('merging photos counts unique images before applying the gallery limit', () => {
    const photos = Array.from({ length: 60 }, (_, index) => ({ url: `https://avatars.mds.yandex.net/get-altay/1/${index}/XXXL`, sourceUrl: url, label: 'Фото' }));
    const result = mergeEnrichment({ ...emptyEnrichment(), photos: photos.slice(0, 6) }, { ...emptyEnrichment(), photos });
    expect(result.photos).toHaveLength(60);
    expect(result.photos[59].url).toContain('/59/');
  });
  test('merges evidence and restores local draft for a created external ID without cross-candidate leakage', () => {
    const store = new Map();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) } });
    const enrichment = mergeEnrichment(emptyEnrichment(), { ...emptyEnrichment(), menuItems: [coffee], tags: tagsFromEvidence(['Кофе с собой'], url) });
    saveImportEnrichment(target.externalId!, enrichment, ['to_go']);
    expect(loadImportEnrichment('new-candidate-id', target.externalId!)?.tagSlugs).toEqual(['to_go']);
    expect(loadImportEnrichment('other-candidate')).toBeUndefined();
    store.set('coffeepeek-import-enrichment-v2:broken', '{');
    expect(loadImportEnrichment('broken')).toBeUndefined();
  });
});
