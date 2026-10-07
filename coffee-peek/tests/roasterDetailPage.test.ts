jest.mock('../src/components/PublicAddressPage', () => ({ usePublicResolution: () => null }));
jest.mock('../src/hooks/queries/useCatalogs', () => ({ useRoaster: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ ...jest.requireActual('@tanstack/react-query'), useQuery: jest.fn() }));
jest.mock('../src/hooks/usePageTitle', () => ({ usePageTitle: jest.fn() }));
jest.mock('../src/hooks/useFavorites', () => ({ useFavorite: () => ({ favorite: null, pending: false, toggle: jest.fn() }) }));
jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../src/contexts/UserContext', () => ({ useUser: () => ({ isLoading: false }) }));
jest.mock('../src/components/ShopPhotoPlaceholder', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/api/core/httpClient', () => ({ httpClient: {} }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: {} }));
jest.mock('../src/utils/logger', () => ({ logger: { warn: jest.fn() } }));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRoaster } from '../src/hooks/queries/useCatalogs';
import RoasterDetailPage from '../src/pages/RoasterDetailPage';
import CoffeeDetailPage from '../src/pages/CoffeeDetailPage';
import type { CoffeeCard } from '../src/api/discovery';

const address = { slug: 'roast', canonicalPath: '/roasters/roast', revision: 1, isAlias: false };
const coffee: CoffeeCard = { address: { ...address, slug: 'coffee', canonicalPath: '/coffees/coffee' }, name: 'Кофе', roaster: { name: 'Обжарщик', address, coverPhoto: null }, coverPhoto: null, productKind: 'roasted_beans', productForm: 'whole_beans', classification: { defaultBrewPurposes: [], caffeine: null, roastLevel: null, acidity: null, processing: [], fermentation: [], tasteGroups: [], composition: null }, countries: [], matchingOffers: [], sortPrice: null, createdAtUtc: '', catalogCheckedAtUtc: null };

test('roaster assortment end state requires a complete successful result and zero counts remain visible', () => {
  jest.mocked(useRoaster).mockReturnValue({ data: { id: 'roast', name: 'Обжарщик', publicAddress: address, photos: [], shops: [], location: { address: 'Минск' }, coffeeProductsCount: 0, coffeeShopsCount: '0' }, isLoading: false, error: null } as ReturnType<typeof useRoaster>);
  const render = (items: CoffeeCard[], totalItems: number, isError = false) => {
    jest.mocked(useQuery).mockImplementation(({ queryKey }: any) => queryKey.includes('roaster-assortment')
      ? { data: { items, totalItems }, isPending: false, isError, refetch: jest.fn() } as any
      : { data: [] } as any);
    return renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/roasters/roast'] }, React.createElement(Routes, {}, React.createElement(Route, { path: '/roasters/:roasterId', element: React.createElement(RoasterDetailPage) }))));
  };
  const complete = render([coffee], 1);
  expect(complete).toContain('Пока это весь ассортимент');
  expect(complete).toContain(`/coffees?filters=${encodeURIComponent(JSON.stringify({ roasters: ['roast'], availableOnly: true }))}`);
  expect(complete.match(/>0<\/dd>/g)).toHaveLength(2);
  expect(complete).toContain('aria-label="Навигационная цепочка"');
  expect(complete).toContain('href="/roasters"');
  expect(complete).toContain('aria-current="page"');
  expect(complete).toContain('Минск');
  expect(complete).not.toContain('Где найти');
  expect(complete).not.toContain('Больше обжарщиков');
  expect(render([coffee], 7)).not.toContain('Пока это весь ассортимент');
  const failed = render([], 0, true);
  expect(failed).toContain('Ассортимент временно недоступен');
  expect(failed).not.toContain('Ассортимент пока пуст');
  expect(render([], 0)).toContain('Ассортимент пока пуст');
});

test('coffee breadcrumbs link to the coffee catalog and the canonical roaster page', () => {
  jest.mocked(useQuery).mockImplementation(({ queryKey }: any) => queryKey.includes('coffee-detail')
    ? { data: { ...coffee, photos: [], offers: [], description: null, tasteDescriptors: [] }, isPending: false, isError: false } as any
    : { data: [] } as any);
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/coffees/coffee'] }, React.createElement(Routes, {}, React.createElement(Route, { path: '/coffees/:slug', element: React.createElement(CoffeeDetailPage) }))));
  const breadcrumb = html.match(/<nav.*?<\/nav>/)?.[0];
  expect(breadcrumb).toContain('aria-label="Навигационная цепочка"');
  expect(breadcrumb).toContain('href="/coffees"');
  expect(breadcrumb).toContain('href="/roasters/roast"');
  expect(breadcrumb).toContain('aria-current="page"');
  expect(html).not.toContain('← Каталог кофе');
});
