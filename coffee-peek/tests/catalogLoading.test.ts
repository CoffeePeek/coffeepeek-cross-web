let mockRequest: Record<string, unknown> = { isError: true, isPending: false, isSuccess: false, error: { status: 503 } };
jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: () => mockRequest,
  useQuery: () => ({ isError: true, isPending: false, error: { status: 503 } }),
  useMutationState: () => [],
}));
jest.mock('../src/api/discovery', () => ({}));
jest.mock('../src/api/coffeeshop', () => ({}));
jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../src/contexts/UserContext', () => ({ useUser: () => ({ user: null, isLoading: false }) }));
jest.mock('../src/contexts/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/hooks/queries/useCatalogs', () => ({ useCities: () => ({ data: [], isPending: false }) }));
jest.mock('../src/hooks/useFavorites', () => ({ useFavorites: () => ({ isFavorite: () => false }) }));
jest.mock('../src/hooks/useLocalCity', () => ({ useLocalCity: () => ({ cityId: 'minsk' }) }));
jest.mock('../src/hooks/usePageTitle', () => ({ usePageTitle: () => {} }));
jest.mock('../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ requireAuth: jest.fn() }) }));
jest.mock('../src/hooks/useLoadMoreOnScroll', () => ({ useLoadMoreOnScroll: () => undefined }));
jest.mock('../src/components/ShopSearchBar', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/ShopFilterPanel', () => ({ __esModule: true, default: () => 'Цена' }));
jest.mock('../src/components/CatalogFilters', () => ({ CatalogFilters: () => null, FilterChips: () => null, activeFilterCount: () => 0, catalogInput: '' }));
jest.mock('../src/components/Mascot', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/skeletons', () => ({ ShopCardSkeleton: () => 'Загрузка' }));
jest.mock('../src/components/CatalogCards', () => ({
  ShopCatalogCard: ({ shop }: { shop: { name: string } }) => shop.name,
  CoffeeCatalogCard: () => null, RoasterCatalogCard: () => null, CatalogPagination: () => null,
  catalogButton: '', catalogPanel: '',
}));
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import CoffeeShopList from '../src/components/CoffeeShopList';
import CatalogSearchPage from '../src/pages/CatalogSearchPage';

test('failed catalog loads stay silent; empty results require success and loaded shops stay visible', () => {
  const shops = React.createElement(CoffeeShopList, { onShopSelect: jest.fn() });
  const render = (element = shops) => renderToStaticMarkup(React.createElement(MemoryRouter, {}, element));
  for (const element of [shops, ...(['roasters', 'coffees', 'discovery'] as const).map(kind => React.createElement(CatalogSearchPage, { kind }))]) {
    const html = render(element);
    expect(html).not.toMatch(/Не удалось загрузить|Каталог временно недоступен|Повторить|Ничего не найдено|role="alert"/);
  }
  const page = { items: [], totalItems: 0, totalPages: 0, currentPage: 1, pageSize: 12 };
  mockRequest = { isSuccess: true, data: { pages: [page] } };
  expect(render()).toContain('Ничего не найдено');
  mockRequest = { isError: true, error: { status: 503 }, data: { pages: [{ ...page, items: [{ address: { slug: 'coffee' }, name: 'Кофейня' }], totalItems: 1 }] } };
  expect(render()).toContain('Кофейня');
  expect(render()).not.toContain('Ничего не найдено');
  mockRequest = { isError: true, error: { status: 400 } };
  expect(render()).toContain('Проверьте фильтры');
});
