let mockRequest: Record<string, unknown> = { isError: true, isPending: false, isSuccess: false, error: { status: 503 } };
let mockRoasters: Record<string, unknown> = { isError: true, isPending: false, error: { status: 503 } };
jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: () => mockRequest,
  useQuery: jest.fn(() => mockRoasters),
  useMutationState: () => [],
}));
jest.mock('../src/api/discovery', () => ({}));
jest.mock('../src/api/coffeeshop', () => ({}));
jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../src/contexts/UserContext', () => ({ useUser: () => ({ user: null, isLoading: false }) }));
jest.mock('../src/contexts/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/hooks/queries/useCatalogs', () => ({ useCities: (enabled: boolean) => ({ data: enabled ? [{ id: 'minsk' }] : [], isPending: false }) }));
jest.mock('../src/hooks/useFavorites', () => ({ useFavorites: () => ({ isFavorite: () => false }) }));
jest.mock('../src/hooks/useLocalCity', () => ({ useLocalCity: () => ({ cityId: 'minsk' }) }));
jest.mock('../src/hooks/usePageTitle', () => ({ usePageTitle: () => {} }));
jest.mock('../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ requireAuth: jest.fn() }) }));
jest.mock('../src/hooks/useLoadMoreOnScroll', () => ({ useLoadMoreOnScroll: () => undefined }));
jest.mock('../src/components/ShopSearchBar', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/utils/lazyWithRetry', () => ({ lazyWithRetry: () => () => null }));
jest.mock('../src/components/ShopFilterPanel', () => ({ __esModule: true, default: () => 'Цена' }));
jest.mock('../src/components/CatalogFilters', () => ({ CatalogFilters: () => null, FilterChips: () => null, activeFilterCount: () => 0, catalogInput: '' }));
jest.mock('../src/components/Mascot', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/skeletons', () => ({ ShopCardSkeleton: () => 'Загрузка' }));
jest.mock('../src/components/CatalogCards', () => ({
  ShopCatalogCard: ({ shop }: { shop: { name: string } }) => shop.name,
  CoffeeCatalogCard: () => null, RoasterCatalogCard: ({ roaster }: { roaster: { name: string } }) => roaster.name, CatalogPagination: () => null,
  catalogButton: '', catalogPanel: '',
}));
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import CoffeeShopList from '../src/components/CoffeeShopList';
import CatalogSearchPage from '../src/pages/CatalogSearchPage';

test('coffee facets retain their values during filtering only within the same session and catalog', () => {
  jest.mocked(useQuery).mockClear();
  renderToStaticMarkup(React.createElement(MemoryRouter, {}, React.createElement(CatalogSearchPage, { kind: 'coffees' })));
  const options = jest.mocked(useQuery).mock.calls.map(([options]) => options).find(options => options.queryKey?.[3] === 'facets')!;
  const previous = { totalItems: 1, groups: [{ code: 'taste', options: [{ code: 'chocolate', count: 1 }] }] };
  const placeholder = options.placeholderData as (data: unknown, query: { queryKey: unknown[] }) => unknown;
  expect(placeholder(previous, { queryKey: options.queryKey! })).toBe(previous);
  expect(placeholder(previous, { queryKey: ['catalog', 'another-session', 'coffees', 'facets'] })).toBeUndefined();
  expect(placeholder(previous, { queryKey: ['catalog', options.queryKey![1], 'shops', 'facets'] })).toBeUndefined();
});

test('failed catalog loads stay silent; empty results require success and loaded shops stay visible', () => {
  const shops = React.createElement(CoffeeShopList);
  const render = (element = shops) => renderToStaticMarkup(React.createElement(MemoryRouter, {}, element));
  for (const element of [shops, ...(['roasters', 'coffees', 'discovery'] as const).map(kind => React.createElement(CatalogSearchPage, { kind }))]) {
    const html = render(element);
    expect(html).not.toMatch(/Не удалось загрузить|Каталог временно недоступен|Повторить|Ничего не найдено|role="alert"/);
  }
  const page = { items: [], totalItems: 0, totalPages: 0, currentPage: 1, pageSize: 12 };
  mockRequest = { isSuccess: true, data: { pages: [page] } };
  mockRoasters = { isSuccess: true, data: [] };
  expect(render()).toContain('Ничего не найдено');
  mockRequest = { isError: true, error: { status: 503 }, data: { pages: [{ ...page, items: [{ address: { slug: 'coffee' }, name: 'Кофейня' }], totalItems: 1 }] } };
  expect(render()).toContain('Кофейня');
  expect(render()).not.toContain('Ничего не найдено');
  mockRequest = { isError: true, error: { status: 400 } };
  expect(render()).toContain('Проверьте фильтры');
});

test('mobile overview includes every roaster for horizontal scrolling', () => {
  mockRequest = { isSuccess: true, data: { pages: [{ items: [], totalItems: 0 }] } };
  mockRoasters = { isSuccess: true, data: ['First Roaster', 'Second Roaster'].map((name, index) => ({ name, address: { slug: `roaster-${index}` }, tags: [] })) };
  const render = () => renderToStaticMarkup(React.createElement(MemoryRouter, {}, React.createElement(CoffeeShopList)));
  expect(render()).not.toContain('Second Roaster');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => ({ matches: false }) } });
  try {
    expect(render()).toContain('First Roaster');
    expect(render()).toContain('Second Roaster');
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('the default city restored from the URL keeps the overview map visible', () => {
  const url = `/search?filters=${encodeURIComponent(JSON.stringify({ city: 'minsk' }))}`;
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [url] }, React.createElement(CoffeeShopList)));
  expect(html).toContain('discovery-layout--overview');
  expect(html).not.toContain('discovery-map--hidden');
});
