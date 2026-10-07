jest.mock('../src/components/PublicAddressPage', () => ({ usePublicResolution: () => null }));
jest.mock('../src/hooks/queries/useCatalogs', () => ({ useRoaster: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ ...jest.requireActual('@tanstack/react-query'), useQuery: jest.fn() }));
jest.mock('../src/hooks/usePageTitle', () => ({ usePageTitle: jest.fn() }));
jest.mock('../src/hooks/useFavorites', () => ({ useFavorite: () => ({ favorite: null, pending: false, toggle: jest.fn() }) }));
jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../src/contexts/UserContext', () => ({ useUser: () => ({ isLoading: false }) }));
jest.mock('../src/contexts/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/components/PhotoLightbox', () => ({ __esModule: true, default: () => null }));
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

test('pending coffee and roaster requests show their page skeletons, including a disabled roaster query during session restoration', () => {
  jest.mocked(useRoaster).mockReturnValue({ isLoading: false, isPending: true } as ReturnType<typeof useRoaster>);
  jest.mocked(useQuery).mockReturnValue({ isPending: true } as ReturnType<typeof useQuery>);
  const render = (page: React.ReactElement) => renderToStaticMarkup(React.createElement(MemoryRouter, {}, page));
  expect(render(React.createElement(RoasterDetailPage))).toContain('aria-label="Загрузка обжарщика"');
  expect(render(React.createElement(CoffeeDetailPage))).toContain('aria-label="Загрузка кофе"');
});

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

test('coffee detail keeps product photos, country flags and related coffees in the existing components', () => {
  const photo = { fullUrl: '/coffee-full.jpg', urls: { thumbnail: '/coffee-thumb.jpg', card: '/coffee-card.jpg', detail: '/coffee-detail.jpg', fullscreen: '/coffee-large.jpg' } };
  jest.mocked(useQuery).mockImplementation(({ queryKey }: any) => queryKey.includes('coffee-detail')
    ? { data: { ...coffee, photos: [photo, { ...photo, fullUrl: '/second.jpg' }], offers: [], description: 'Описание кофе', tasteDescriptors: ['Какао'], countries: [{ code: 'BR', nameRu: 'Бразилия', nameEn: 'Brazil' }] }, isPending: false, isError: false } as any
    : queryKey.includes('similar-coffees')
      ? { data: { items: [coffee, { ...coffee, name: 'Другой кофе', address: { ...coffee.address, slug: 'other', canonicalPath: '/coffees/other' } }] }, isSuccess: true } as any
      : { data: [] } as any);
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/coffees/coffee'] }, React.createElement(Routes, {}, React.createElement(Route, { path: '/coffees/:slug', element: React.createElement(CoffeeDetailPage) }))));
  expect(html).toContain('src="/coffee-detail.jpg"');
  expect(html).toContain('aria-label="Фото кофе 2"');
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain('src="https://flagcdn.com/br.svg"');
  expect(html).toContain('Бразилия');
  expect(html).toContain('aria-label="Поделиться кофе"');
  expect(html).toContain('Вкусовой профиль');
  expect(html).toContain('Какао');
  expect(html).not.toContain('id="coffee-roaster"');
  expect(html).toContain('Похожие сорта');
  expect(html).toContain('Открыть кофе Другой кофе');
  expect(html).not.toContain('Открыть кофе Кофе');
  expect(html).toContain('href="/roasters/roast"');
});

test('long coffee descriptions use a closed disclosure while short and missing descriptions need no control', () => {
  const render = (description: string | null) => {
    jest.mocked(useQuery).mockImplementation(({ queryKey }: any) => queryKey.includes('coffee-detail')
      ? { data: { ...coffee, photos: [], offers: [], description, tasteDescriptors: [] }, isPending: false, isError: false } as any
      : { data: [] } as any);
    return renderToStaticMarkup(React.createElement(MemoryRouter, {}, React.createElement(CoffeeDetailPage)));
  };
  for (const description of ['Описание кофе. '.repeat(30), 'Один\nДва\nТри\nЧетыре\nПять']) {
    const html = render(description);
    const disclosure = html.match(/<details\b[^>]*>/)?.[0];
    expect(disclosure).toBeDefined();
    expect(disclosure).not.toMatch(/\bopen(?:\s|=|>)/);
    expect(html).toContain('Показать всё');
    expect(html).toContain('Скрыть');
    expect(html).toContain(description);
  }
  expect(render('Короткое описание')).not.toContain('<details');
  expect(render(null)).not.toContain('Показать всё');
});
