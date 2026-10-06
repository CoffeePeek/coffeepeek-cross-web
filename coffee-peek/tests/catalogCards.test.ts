let mockShopCount: number | undefined = 7;
let mockDetailsError = false;
jest.mock('../src/hooks/queries/useCatalogs', () => ({ useRoaster: () => ({ data: mockShopCount === undefined ? undefined : { shops: Array.from({ length: mockShopCount }) }, isError: mockDetailsError }) }));
jest.mock('../src/hooks/useFavorites', () => ({ useFavorite: () => ({ favorite: null, pending: false, toggle: jest.fn() }) }));
jest.mock('../src/components/ShopPhotoPlaceholder', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../src/api/core/httpClient', () => ({ httpClient: {} }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: {} }));
jest.mock('../src/utils/logger', () => ({ logger: { warn: jest.fn() } }));
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

test('roaster row keeps confirmed tags and counts, with unknown count distinct from zero', () => {
  const roaster = { address: { slug: 'roast', canonicalPath: '/roasters/roast', revision: 1 }, name: 'Roast', coverPhoto: { fullUrl: '/logo.png', urls: null }, tags: [{ slug: 'online-order', name: 'Онлайн-заказ', description: null, sortOrder: 1 }], isFavorite: false, availableCoffeeProducts: 14, matchingCoffeeProducts: null, coffeeCatalogUpdatedAtUtc: null, matchingCoffee: null } as RoasterCard;
  const render = () => renderToStaticMarkup(React.createElement(MemoryRouter, {}, React.createElement(RoasterCatalogCard, { roaster })));
  for (const [count, label] of [[0, '0 кофеен используют'], [1, '1 кофейня использует'], [2, '2 кофейни используют'], [7, '7 кофеен используют'], [11, '11 кофеен используют'], [21, '21 кофейня использует']] as const) {
    mockShopCount = count;
    const html = render();
    expect(html).toContain(label);
    expect(html).toContain('Доступные товары: 14');
    expect(html).toContain('Онлайн-заказ');
    expect(html).toContain('object-contain');
    expect(html.match(/<svg/g)).toHaveLength(3);
    expect(html).toContain('Добавить в избранное');
    expect(html).not.toContain('Проверка не указана');
    expect(html).not.toContain('Светлая');
    expect(html).not.toContain('Декаф');
  }
  mockShopCount = undefined;
  expect(render()).toContain('Загрузка числа кофеен');
  expect(render()).not.toContain('0 кофеен');
  mockDetailsError = true;
  expect(render()).toContain('Число кофеен недоступно');
  expect(render()).toContain('Повторить загрузку числа кофеен');
  mockDetailsError = false;
});
