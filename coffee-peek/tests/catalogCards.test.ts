jest.mock('../src/hooks/useFavorites', () => ({ useFavorite: () => ({ favorite: null, pending: false, toggle: jest.fn() }) }));
jest.mock('../src/components/ShopPhotoPlaceholder', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../src/api/core/httpClient', () => ({ httpClient: {} }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: {} }));
jest.mock('../src/utils/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('../src/hooks/queries/useCatalogs', () => ({ useRoaster: () => ({ data: { about: 'Настоящее описание обжарщика.', location: { address: 'Беларусь · Минск' } } }) }));
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { CoffeeCatalogCard, OfferList, RoasterCatalogCard } from '../src/components/CatalogCards';
import type { CoffeeCard, CoffeeOffer, RoasterCard } from '../src/api/discovery';
const offer: CoffeeOffer = { offerKey: '250', weightGrams: 250, price: 32, currency: 'BYN', brewPurpose: 'filter', grind: null, availability: 'InStock', availabilityScope: 'online', sellerName: 'Seller', sourceUrl: 'https://example.test/coffee', checkedAtUtc: '2026-10-05T10:00:00Z' };
test('list uses matchingOffers and server sortPrice, not a cheap offer of another weight', () => {
  const coffee = { address: { slug: 'coffee', canonicalPath: '/coffees/coffee', revision: 1 }, name: 'Coffee', roaster: { name: 'Roaster', address: { slug: 'roaster', canonicalPath: '/roasters/roaster', revision: 1 }, coverPhoto: null }, productKind: 'roasted_beans', productForm: 'whole_beans', classification: { defaultBrewPurposes: [], caffeine: null, roastLevel: null, acidity: null, processing: [], fermentation: [], tasteGroups: [], composition: null }, countries: [], coverPhoto: null, matchingOffers: [offer], sortPrice: 32, createdAtUtc: offer.checkedAtUtc, catalogCheckedAtUtc: null, offers: [{ ...offer, weightGrams: 100, price: 7 }] };
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, {}, React.createElement(CoffeeCatalogCard, { coffee: coffee as CoffeeCard, groups: [] })));
  expect(html).toContain('250 г'); expect(html).not.toContain('100 г'); expect(html).toContain('Цена сортировки: 32 BYN'); expect(html).not.toContain('regular');
  expect(html).toContain('Открыть кофе Coffee'); expect(html).toContain('aspect-[16/9]'); expect(html).not.toContain('Добавить в избранное');
});
test('all detail offers keep currencies separate, unknown weight/stock and safe links', () => {
  const html = renderToStaticMarkup(React.createElement(OfferList, { offers: [offer, { ...offer, offerKey: 'rub', currency: 'RUB', price: 600, weightGrams: null, availability: 'Unknown', sourceUrl: 'javascript:alert(1)' }] }));
  expect(html).toContain('32 BYN'); expect(html).toContain('600 RUB'); expect(html).toContain('Вес не указан'); expect(html).toContain('Наличие не подтверждено'); expect(html).not.toContain('javascript:'); expect(html).toContain('noopener noreferrer');
});

test('compact prices group matching offers by exact weight and currency', () => {
  const coffee = { address: { slug: 'coffee', canonicalPath: '/coffees/coffee', revision: 1 }, name: 'Coffee', roaster: { name: 'Roaster', address: { slug: 'roaster', canonicalPath: '/roasters/roaster', revision: 1 }, coverPhoto: null }, productKind: 'roasted_beans', productForm: 'whole_beans', classification: { defaultBrewPurposes: [], caffeine: null, roastLevel: null, acidity: null, processing: [], fermentation: [], tasteGroups: [], composition: null }, countries: [], coverPhoto: null, matchingOffers: [offer, { ...offer, offerKey: '250-expensive', price: 40 }, { ...offer, offerKey: '100', weightGrams: 100, price: 10 }, { ...offer, offerKey: 'rub', currency: 'RUB', price: 600 }], sortPrice: null, createdAtUtc: offer.checkedAtUtc, catalogCheckedAtUtc: null };
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, {}, React.createElement(CoffeeCatalogCard, { coffee: coffee as CoffeeCard, groups: [] })));
  expect(html).toContain('от 32'); expect(html).toContain('250 г'); expect(html).toContain('100 г'); expect(html).toContain('600'); expect(html).toContain('RUB');
  expect(html).not.toContain('от 10');
});

test('roaster card shows its description without the address, inline counts and empty catalog state', () => {
  const roaster: RoasterCard = { address: { slug: 'roast', canonicalPath: '/roasters/roast', revision: '1', isAlias: false }, name: 'Roast', photoUrl: '/fallback.png', coverPhoto: { fullUrl: null, urls: { thumbnail: '/thumbnail.png', card: '/logo.png', detail: '/detail.png', fullscreen: '/fullscreen.png' } }, tags: [{ slug: 'online-order', name: 'Онлайн-заказ', description: null, sortOrder: '1' }], coffeeShopsCount: null, coffeeProductsCount: null, availableCoffeeProducts: '14' };
  const render = () => renderToStaticMarkup(React.createElement(MemoryRouter, {}, React.createElement(RoasterCatalogCard, { roaster })));
  for (const [count, shops, products] of [[7, '7 кофеен', '7 товаров'], ['12', '12 кофеен', '12 товаров'], [1, '1 кофейня', '1 товар'], [2, '2 кофейни', '2 товара'], [0, 'Нет кофеен', 'Нет товаров'], ['0', 'Нет кофеен', 'Нет товаров'], [null, 'Кофейни: —', 'Товары: —'], ['string', 'Кофейни: —', 'Товары: —'], [-1, 'Кофейни: —', 'Товары: —'], [1.5, 'Кофейни: —', 'Товары: —']] as const) {
    roaster.coffeeShopsCount = count;
    roaster.coffeeProductsCount = count;
    const html = render();
    expect(html).toContain(`>${shops}</span>`);
    expect(html).toContain(`>${products}</${count === 0 || count === '0' ? 'span' : 'a'}>`);
    expect(html).toContain('Настоящее описание обжарщика.');
    expect(html).not.toContain('Беларусь · Минск');
    expect(html).toContain('Кофейни используют');
    expect(html).toContain('Товары в каталоге');
    expect(html).not.toContain('>99</dd>');
    expect(html).not.toContain('>14</dd>');
    expect(html).toContain('src="/logo.png"');
    expect(html).not.toContain('/fallback.png');
    if (count === 0 || count === '0') {
      expect(html).toContain('Каталог пока пуст');
      expect(html).toContain('aria-disabled="true"');
      expect(html).not.toContain('/coffees?');
    } else expect(html).toContain(`/coffees?filters=${encodeURIComponent(JSON.stringify({ roasters: ['roast'], availableOnly: false }))}`);
    expect(html).toContain('object-contain');
    expect(html.match(/<svg/g)).toHaveLength(3);
    expect(html).toContain('Добавить в избранное');
    expect(html).not.toContain('Проверка не указана');
    expect(html).not.toContain('Светлая');
    expect(html).not.toContain('Декаф');
  }
  roaster.coffeeShopsCount = 0;
  roaster.coffeeProductsCount = '3';
  expect(render()).toContain('>Нет кофеен</span>');
  expect(render()).toContain('>3 товара</a>');
  roaster.coverPhoto = null;
  expect(render()).toContain('src="/fallback.png"');
  roaster.name = null;
  roaster.photoUrl = null;
  roaster.address.slug = null;
  roaster.address.canonicalPath = null;
  const html = render();
  expect(html).toContain('Обжарщик');
  expect(html).toContain('disabled=""');
  expect(html).not.toContain('/coffees?');
  expect(html).not.toContain('role="button"');
});

test('roaster titles move only when they overflow and recalculate after resizing', () => {
  const heading = { firstElementChild: { scrollWidth: 180 }, clientWidth: 200 };
  const setOverflow = jest.fn();
  let resize = () => {};
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousObserver = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { fonts: { addEventListener: jest.fn(), removeEventListener: jest.fn() } } });
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect() {}
  } });
  jest.spyOn(React, 'useRef').mockReturnValueOnce({ current: heading });
  jest.spyOn(React, 'useState').mockImplementationOnce(() => [0, setOverflow] as any);
  jest.spyOn(React, 'useLayoutEffect').mockImplementationOnce(effect => { effect(); });
  try {
    const roaster = { name: 'A long roaster name', address: {}, coffeeShopsCount: 0, coffeeProductsCount: 0 } as RoasterCard;
    renderToStaticMarkup(React.createElement(MemoryRouter, {}, React.createElement(RoasterCatalogCard, { roaster })));
    expect(setOverflow).toHaveBeenLastCalledWith(0);
    heading.clientWidth = 120;
    resize();
    expect(setOverflow).toHaveBeenLastCalledWith(60);
    heading.clientWidth = 240;
    resize();
    expect(setOverflow).toHaveBeenLastCalledWith(0);
  } finally {
    jest.restoreAllMocks();
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (previousObserver) Object.defineProperty(globalThis, 'ResizeObserver', previousObserver);
    else Reflect.deleteProperty(globalThis, 'ResizeObserver');
  }
});
