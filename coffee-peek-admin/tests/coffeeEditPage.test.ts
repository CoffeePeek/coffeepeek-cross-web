jest.mock('../src/api/coffeeCatalog', () => ({
  coffeeGroups: ['brew', 'caffeine', 'roast', 'acidity', 'processing', 'fermentation', 'taste', 'composition'],
  getAdminCoffee: jest.fn(), getClassification: jest.fn(), getDictionary: jest.fn(),
}));
jest.mock('../src/api/catalogs', () => ({ getCatalogRoasters: jest.fn() }));
jest.mock('../src/api/core/httpClient', () => ({ httpClient: { get: jest.fn() } }));
jest.mock('../src/contexts/UserContext', () => ({ useUser: () => ({ isAdmin: false }) }));
jest.mock('../src/contexts/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/hooks/useUnsavedCoffee', () => ({ useUnsavedCoffee: jest.fn() }));
jest.mock('../src/pages/CoffeeDictionariesPage', () => ({ groupNames: { brew: 'Назначение', caffeine: 'Кофеин', roast: 'Обжарка', acidity: 'Кислотность', processing: 'Обработка', fermentation: 'Ферментация', taste: 'Вкус', composition: 'Состав' } }));

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import { CoffeeEditPage } from '../src/pages/CoffeeEditPage';
import type { AdminCoffee, AdminClassification } from '../src/api/coffeeCatalog';

test('compact editor keeps all origins and inactive classifications while hiding advanced controls', () => {
  const countries = [
    { code: 'CO', nameRu: 'Колумбия', nameEn: 'Colombia' },
    { code: 'BR', nameRu: 'Бразилия', nameEn: 'Brazil' },
    { code: 'ET', nameRu: 'Эфиопия', nameEn: 'Ethiopia' },
    { code: 'KE', nameRu: 'Кения', nameEn: 'Kenya' },
  ];
  const coffee: AdminCoffee = {
    id: 'coffee-1', roasterId: 'roaster-1', slug: null, status: 'Draft', version: 3,
    content: { name: 'Смесь', description: null, productKind: 'roasted_beans', productForm: 'whole_beans', compositionKind: 'blend', processing: null, roastLevel: null, acidity: null, body: null, qGraderScoreRaw: null, tasteDescriptors: [], brewRecommendations: [], grindOptions: [], features: [] },
    countries: countries.slice(0, 3), protectedFields: ['Name'], photos: [], reviewWarnings: [],
    variants: [{ weightGrams: 250, price: 32, currency: 'BYN', grind: null, roastPurpose: null, availability: 'InStock', availabilityScope: 'online', sellerName: 'Roast.by', sourceUrl: 'javascript:alert(1)', checkedAtUtc: '2026-10-05T08:00:00Z' }],
  };
  const classification: AdminClassification = { id: coffee.id, version: 3, protectedFields: ['caffeine'], variants: [], classification: { defaultBrewPurposes: [], caffeine: 'old-caffeine', roastLevel: null, acidity: null, processing: ['old-processing', 'missing-code'], fermentation: [], tasteGroups: [], composition: null } };
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity } } });
  client.setQueryData(['admin', 'coffee', 'detail', coffee.id], { coffee, classification });
  client.setQueryData(['admin', 'catalogs', 'roasters'], [{ id: coffee.roasterId, name: 'Roast.by' }]);
  // The country removed from the catalog must retain its stored name and selection.
  client.setQueryData(['catalogs', 'coffee-origin-countries'], [countries[0], countries[1], countries[3]]);
  client.setQueryData(['admin', 'coffee-dictionary', 'values'], [
    { id: 'old', groupCode: 'processing', code: 'old-processing', name: 'Старая обработка', isActive: false },
    { id: 'washed', groupCode: 'processing', code: 'washed', name: 'Мытая', isActive: true },
  ]);
  const markup = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [`/coffees/${coffee.id}`] }, createElement(Routes, null, createElement(Route, { path: '/coffees/:id', element: createElement(CoffeeEditPage) })))));
  const document = new JSDOM(markup).window.document;
  const selected = document.querySelector('[aria-label="Выбранные страны"]')!;
  expect(selected.querySelectorAll('button')).toHaveLength(2);
  expect(selected.querySelectorAll('img')).toHaveLength(2);
  expect(selected.textContent).toBe('КолумбияБразилия');
  const extra = [...document.querySelectorAll('details')].find(element => element.querySelector('summary')?.textContent === 'Другие страны (1)')!;
  expect(extra.hasAttribute('open')).toBe(false);
  expect(extra.textContent).toContain('Эфиопия');
  expect(document.querySelector('[aria-label="Добавить страну"]')?.textContent).toBe('Добавить страну…Кения');
  expect(document.querySelector('[aria-label="Кофеин"] option:checked')?.getAttribute('value')).toBe('old-caffeine');
  expect(document.querySelector('[aria-label="Добавить: Обработка"]')?.textContent).toBe('Добавить…Мытая');
  expect(document.querySelector('[aria-label="Убрать: Обработка — Старая обработка"]')).not.toBeNull();
  expect(document.querySelector('[aria-label="Убрать: Обработка — missing-code"]')).not.toBeNull();
  expect(document.querySelector('[aria-label="Защита от импорта: Название"]')?.hasAttribute('checked')).toBe(true);
  expect(document.querySelector('[aria-label="Защита характеристики: Кофеин"]')?.hasAttribute('checked')).toBe(true);
  expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
  expect(document.body.textContent).toContain('Черновик');
  expect(document.querySelectorAll('input[type="checkbox"]:not(details input)')).toHaveLength(0);
  expect([...document.querySelectorAll('details')].every(element => !element.hasAttribute('open'))).toBe(true);
  client.clear();
});
