jest.mock('../src/api/coffeeCatalog', () => ({
  coffeeGroups: ['brew', 'caffeine', 'roast', 'acidity', 'processing', 'fermentation', 'taste', 'composition'],
  getDictionary: jest.fn(), getImportRuns: jest.fn(),
}));
jest.mock('../src/contexts/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));

import { act, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import type { DictionaryEntry, ImportRun } from '../src/api/coffeeCatalog';

test('dictionary and import filters preserve records, ordering, groups and failed-run meaning', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  // Load DOM event handling after the document exists; Jest uses the node environment.
  const { createRoot } = require('react-dom/client');
  const { CoffeeDictionariesPage } = require('../src/pages/CoffeeDictionariesPage');
  const { CoffeeImportPage } = require('../src/pages/CoffeeImportPage');
  const { getDictionary, getImportRuns } = require('../src/api/coffeeCatalog');
  const entries: DictionaryEntry[] = [
    { id: 'hidden', slug: 'pickup', name: 'Самовывоз', description: null, sortOrder: 5, isActive: false },
    { id: 'second', slug: 'delivery', name: 'Доставка', description: 'По Беларуси', sortOrder: 20, isActive: true },
    { id: 'first', slug: 'online-order', name: 'Онлайн-заказ', description: null, sortOrder: 10, isActive: true },
  ];
  const values = entries.map((entry, index) => ({ ...entry, code: entry.slug, groupCode: index === 2 ? 'taste' : 'brew' }));
  const runs: ImportRun[] = [
    { id: 'ok', sourceKey: 'source-one', status: 'Applied', snapshotId: 'snapshot-ok', collectedAtUtc: '2026-10-06T08:00:00Z', appliedAtUtc: '2026-10-06T08:05:00Z', products: 2, variants: 3, added: 1, missingAvailabilityApplied: true, error: null },
    { id: 'failed', sourceKey: 'source-two', status: 'Failed', snapshotId: 'snapshot-failed', collectedAtUtc: 'invalid-date', appliedAtUtc: '2026-10-06T09:00:00Z', products: 0, variants: 0, added: 0, missingAvailabilityApplied: false, error: 'Не удалось получить данные' },
  ];
  getDictionary.mockImplementation((kind: string) => Promise.resolve(kind === 'tags' ? entries : values));
  getImportRuns.mockResolvedValue(runs);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } } });
  client.setQueryData(['admin', 'coffee-dictionary', 'tags'], entries);
  client.setQueryData(['admin', 'coffee-dictionary', 'values'], values);
  client.setQueryData(['admin', 'coffee-import', 30], runs);
  const root = createRoot(document.getElementById('root'));
  const render = async (component: React.ReactElement) => {
    await act(async () => { root.render(createElement(QueryClientProvider, { client }, component)); });
  };
  const headings = () => [...document.querySelectorAll('section h2')].map(node => node.textContent);
  const select = async (label: string, value: string) => {
    await act(async () => {
      const field = document.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;
      field.value = value;
      field.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };
  try {
    await render(createElement(CoffeeDictionariesPage, { kind: 'tags', key: 'tags' }));
    expect(headings()).toEqual(['Самовывоз', 'Онлайн-заказ', 'Доставка']);
    await select('Статус', 'inactive');
    expect(headings()).toEqual(['Самовывоз']);
    expect(document.querySelector('section li')?.textContent).toContain('Вернуть в каталог');
    await select('Статус', 'all');
    await act(async () => {
      const input = document.querySelector('input[type="search"]')!;
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, ' ONLINE-ORDER ');
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    expect(headings()).toEqual(['Онлайн-заказ']);
    expect(client.getQueryData(['admin', 'coffee-dictionary', 'tags'])).toEqual(entries);

    await render(createElement(CoffeeDictionariesPage, { kind: 'values', key: 'values' }));
    expect(headings()).toEqual(['Самовывоз', 'Доставка']);
    await select('Группа', 'taste');
    expect(headings()).toEqual(['Онлайн-заказ']);
    await select('Группа', 'roast');
    expect(headings()).toEqual([]);
    expect(document.body.textContent).toContain('В этой группе пока нет значений.');

    await render(createElement(CoffeeImportPage));
    expect(headings()).toEqual(['source-one', 'source-two']);
    const failed = document.querySelector('[aria-label="Импорт: source-two"]')!;
    expect(failed.textContent).toContain('Ошибка записана');
    expect(failed.textContent).toContain('Не удалось получить данные');
    expect(failed.textContent).not.toMatch(/Invalid Date|Товаров|наличие сохранено/);
    expect(failed.textContent).toContain('Не указано');
    expect(document.querySelector('details')?.open).toBe(false);
    await select('Статус импорта', 'Failed');
    expect(headings()).toEqual(['source-two']);
    await select('Источник', 'source-one');
    expect(headings()).toEqual([]);
    expect(document.body.textContent).toContain('Нет запусков с выбранными фильтрами.');
    await act(async () => { ([...document.querySelectorAll('button')].find(node => node.textContent === 'Сбросить фильтры'))!.click(); });
    expect(headings()).toEqual(['source-one', 'source-two']);
  } finally {
    await act(async () => { root.unmount(); });
    client.clear();
    dom.window.close();
  }
});
