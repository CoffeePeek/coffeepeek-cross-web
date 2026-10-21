jest.mock('../src/api/discovery', () => ({ searchShops: jest.fn(), searchCoffees: jest.fn(), getCoffeeFilterValues: jest.fn() }));
jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('../src/contexts/UserContext', () => ({ useUser: jest.fn(() => ({ isLoading: false })) }));
jest.mock('../src/hooks/usePageTitle', () => ({ usePageTitle: jest.fn() }));
jest.mock('../src/hooks/queries/useCheckIns', () => ({ usePublicCheckIns: jest.fn() }));
jest.mock('../src/lib/catalogSession', () => ({ getCatalogScope: () => 'guest:1' }));
jest.mock('../src/components/Header', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/MapPage', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/LandingMapWidget', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/mobile-app', () => ({ MobileAppDownload: () => null }));
jest.mock('../src/components/CatalogCards', () => ({
  CoffeeCatalogCard: ({ coffee }: { coffee: { name: string } }) => coffee.name,
  ShopCatalogCard: ({ shop }: { shop: { name: string } }) => shop.name,
}));
jest.mock('../src/components/CheckInCard', () => ({ __esModule: true, default: ({ item }: { item: { text: string } }) => item.text }));
jest.mock('../src/pages/LandingPage.css', () => ({}));
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePublicCheckIns } from '../src/hooks/queries/useCheckIns';
import { useUser } from '../src/contexts/UserContext';
import LandingPage from '../src/pages/LandingPage';

const render = () => renderToStaticMarkup(React.createElement(MemoryRouter, {}, React.createElement(LandingPage)));
const query = useQuery as jest.Mock;
const checkIns = usePublicCheckIns as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  query.mockReturnValue({ data: { items: [] }, isPending: false, isError: false });
  checkIns.mockReturnValue({ data: { pages: [{ items: [] }] }, isPending: false, isError: false });
});

test('empty catalog and community keep navigation usable without invented products or reviews', () => {
  const html = render();
  expect(html).toContain('В каталоге пока нет кофе.');
  expect(html).toContain('Поделись первым впечатлением о кофейнях Минска.');
  for (const href of ['/map', '/coffees', '/roasters', '/feed']) expect(html).toContain(`href="${href}"`);
  expect(html.match(/<details /g)).toHaveLength(4);
  expect(html).toContain('aria-hidden="true" inert=""');
});

test('renders the returned coffee and public check-in through existing cards', () => {
  query.mockImplementation(({ queryKey }) => ({
    data: queryKey.at(-1) === 'coffees' ? { items: [{ address: { slug: 'coffee' }, name: 'Кофе из API' }] }
      : queryKey.at(-1) === 'shops' ? { items: [{ address: { slug: 'shop' }, name: 'Кофейня из API' }] } : [],
    isPending: false, isError: false,
  }));
  checkIns.mockReturnValue({ data: { pages: [{ items: [{ text: 'Публичный чекин из API' }] }] }, isPending: false, isError: false });
  const html = render();
  expect(html).toContain('Кофе из API');
  expect(html).toContain('Публичный чекин из API');
  expect(html).not.toContain('В каталоге пока нет кофе.');
  expect(checkIns).toHaveBeenCalledWith({ citySlug: 'minsk', pageSize: 1 });
});

test('request failures show retry actions instead of an empty catalog', () => {
  query.mockReturnValue({ isPending: false, isError: true });
  checkIns.mockReturnValue({ isPending: false, isError: true });
  const html = render();
  expect(html).toContain('Не удалось загрузить кофе.');
  expect(html).toContain('Не удалось загрузить чекины.');
  expect(html.match(/Попробовать ещё раз/g)).toHaveLength(2);
  expect(html).not.toContain('В каталоге пока нет кофе.');
});

test('personalized catalog requests wait for the session to resolve and use its cache scope', () => {
  (useUser as jest.Mock).mockReturnValueOnce({ isLoading: true });
  render();
  const requests = query.mock.calls.map(([options]) => options).filter(options => options.queryKey[0] === 'catalog');
  expect(requests).toHaveLength(1);
  for (const request of requests) {
    expect(request.enabled).toBe(false);
    expect(request.queryKey[1]).toBe('guest:1');
  }
});

test('download dialog has a public phone link and real app screenshots', () => {
  const html = render();
  expect(html).toContain('<dialog');
  expect(html).toContain('aria-labelledby="download-dialog-title"');
  expect(html).toContain('https://coffeepeek.by/settings#app-download-title');
  expect(html).not.toContain('mailto:');
  expect(html).not.toContain('Написать нам');
  for (const screen of ['shops', 'map', 'feed']) expect(html).toContain(`/images/app-screenshots/${screen}-dark.png`);
  expect(html).not.toContain('Скриншот приложения');
  expect(html).not.toContain('<footer');
});
