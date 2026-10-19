jest.mock('../src/api/import', () => ({ getImportCandidates: jest.fn(), decideImportCandidate: jest.fn() }));
jest.mock('../src/contexts/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('@/src/components/ui/Input', () => require('../src/components/ui/Input'), { virtual: true });
jest.mock('@/src/components/ui/NativeSelect', () => require('../src/components/ui/NativeSelect'), { virtual: true });

import { act, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';

test('import search, filters and selection keep focus through updates and debounced requests', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = require('react-dom/client');
  const { MemoryRouter } = require('react-router-dom');
  const { ImportInboxPage } = require('../src/pages/ImportInboxPage');
  const { getImportCandidates } = require('../src/api/import');
  const page = {
    items: [{ id: 'candidate', name: 'Coffee house', address: 'Минск', source: 'File', queueStatus: 'Pending', collectorBucket: 'priority' }],
    totalCount: 1, totalPages: 1, pageSize: 20, page: 1,
  };
  getImportCandidates.mockResolvedValue({ data: page });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const root = createRoot(document.getElementById('root'));
  const searchInput = () => document.querySelector<HTMLInputElement>('input[placeholder="Название, адрес..."]')!;
  const filter = (column: number) => document.querySelectorAll('thead th')[column].querySelector('select')!;

  try {
    await act(async () => {
      root.render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(ImportInboxPage))));
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    const input = searchInput();
    input.focus();
    for (const value of ['C', 'Co', 'Cof', 'Coff', 'Coffe', 'Coffee']) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
        input.setSelectionRange(value.length, value.length);
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
      expect(document.activeElement === input).toBe(true);
      expect(searchInput() === input).toBe(true);
      expect(input.value).toBe(value);
      expect(input.selectionStart).toBe(value.length);
    }
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 450)); });
    expect(getImportCandidates).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Coffee' }));
    expect(document.activeElement === input).toBe(true);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

    const checkbox = document.querySelector<HTMLInputElement>('tbody input[type="checkbox"]')!;
    checkbox.focus();
    await act(async () => { checkbox.click(); });
    expect(document.activeElement === checkbox).toBe(true);
    expect(checkbox.checked).toBe(true);
    const selectAll = document.querySelector<HTMLInputElement>('input[aria-label="Выбрать все загруженные"]')!;
    expect(selectAll.checked).toBe(true);
    selectAll.focus();
    await act(async () => { selectAll.click(); });
    expect(document.activeElement === selectAll).toBe(true);
    expect(selectAll.checked).toBe(false);

    for (const [column, value] of [[1, 'File'], [2, 'cafe'], [5, 'review'], [6, 'Rejected']] as const) {
      const select = filter(column);
      select.focus();
      await act(async () => {
        select.value = value;
        select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      });
      expect(document.activeElement === select).toBe(true);
      expect(filter(column) === select).toBe(true);
      expect(select.value).toBe(value);
      expect(searchInput() === input).toBe(true);
      expect(input.value).toBe('Coffee');
    }
  } finally {
    await act(async () => { root.unmount(); });
    client.clear();
    dom.window.close();
  }
});
