jest.mock('../src/api/coffeeCatalog', () => ({ getAdminCoffees: jest.fn() }));
jest.mock('../src/api/catalogs', () => ({ getCatalogRoasters: jest.fn() }));

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import { CoffeesPage } from '../src/pages/CoffeesPage';
import { coffeeWarningLabel } from '../src/utils/coffeePresentation';
import type { AdminCoffee } from '../src/api/coffeeCatalog';

const coffee: AdminCoffee = {
  id: 'coffee-1', roasterId: 'roaster-1', slug: null, status: 'Draft', version: 3,
  content: { name: 'Колумбия Bourbon Punch', description: null, productKind: 'roasted_beans', productForm: 'whole_beans', compositionKind: 'unknown', processing: null, roastLevel: null, acidity: null, body: null, qGraderScoreRaw: null, tasteDescriptors: ['Шоколад'], brewRecommendations: [], grindOptions: [], features: [] },
  countries: [{ code: 'CO', nameRu: 'Колумбия', nameEn: 'Colombia' }],
  protectedFields: [], photos: [{ fullUrl: '/full.jpg', urls: { card: '/card.jpg' } }], variants: [],
  reviewWarnings: ['country_requires_confirmation:CO', 'photos_not_imported'],
};

test('coffee list shows identities, photos, translated publication states and actionable warnings', () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity } } });
  client.setQueryData(['admin', 'catalogs', 'roasters'], [{ id: 'roaster-1', name: 'Roast.by' }]);
  client.setQueryData(['admin', 'coffee', 'list', { page: 1, status: undefined }], {
    items: [coffee, { ...coffee, id: 'coffee-2', status: 'Published', photos: [], countries: [], reviewWarnings: [] }, { ...coffee, id: 'coffee-3', status: 'Archived', roasterId: 'missing-roaster' }],
    totalItems: 382, totalPages: 20,
  });
  const markup = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(CoffeesPage))));
  const document = new JSDOM(markup).window.document;
  const cards = document.querySelectorAll('article');
  expect(cards).toHaveLength(3);
  expect(cards[0].textContent).toContain('Roast.by');
  expect(cards[0].textContent).toContain('Колумбия');
  expect(cards[0].querySelector('img')?.getAttribute('src')).toBe('/card.jpg');
  expect(cards[0].querySelector('h2 a')?.getAttribute('href')).toBe('/coffees/coffee-1');
  expect(cards[0].querySelector('summary')?.textContent).toContain('Нужно проверить (2)');
  expect(cards[0].querySelector('details ul')?.textContent).toContain('Подтвердите страну происхождения: Колумбия.');
  expect(cards[0].querySelector('details ul')?.textContent).toContain('Фото есть у источника');
  expect(cards[1].textContent).toContain('Нет фото');
  expect(cards[1].textContent).toContain('Не подтверждена');
  expect(cards[1].querySelector('details')).toBeNull();
  expect(cards[2].textContent).toContain('Не указан в справочнике');
  expect(document.querySelector('select')?.textContent).toBe('Все статусыЧерновикОпубликованВ архиве');
  expect(document.body.textContent).toContain('Найдено: 382');
  expect(document.querySelector('h1')).toBeNull();
  expect(cards[0].querySelectorAll('a')).toHaveLength(1);
  expect(document.body.textContent).not.toMatch(/Открыть карточку|Проверяйте данные кофе|Ещё не опубликован/);
  expect(document.body.textContent).not.toMatch(/версия|Draft|Published|Archived|photos_not_imported|country_requires_confirmation/);
  client.clear();
});

test('warning labels preserve variant identity, failed photo details and unknown source messages', () => {
  expect(coffeeWarningLabel('variant_weight_not_specified:name:250')).toContain('ID: name:250');
  expect(coffeeWarningLabel('photo_unavailable:404')).toContain('код ответа: 404');
  expect(coffeeWarningLabel('country_not_in_catalog:CG')).toContain('Конго');
  expect(coffeeWarningLabel('country_requires_confirmation:invalid')).toContain('invalid');
  expect(coffeeWarningLabel('Проверьте происхождение')).toBe('Проверьте происхождение');
  expect(coffeeWarningLabel('new_source_warning:123')).toBe('new_source_warning:123');
});
