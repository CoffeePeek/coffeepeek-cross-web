jest.mock('../src/api/core/httpClient', () => ({ httpClient: {} }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: {} }));
jest.mock('@/src/components/ui/DataTable', () => require('../src/components/ui/DataTable'), { virtual: true });
jest.mock('@/src/components/ui/Input', () => require('../src/components/ui/Input'), { virtual: true });

import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import type { ShopMenuDto } from '../src/api/menu';

test.each([false, true])('menu prices keep focus and save decimal drafts (compact: %s)', async (compact) => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = require('react-dom/client');
  const { MenuEditor } = require('../src/components/menu/MenuEditor');
  const menu: ShopMenuDto = {
    currency: 'BYN', parseStatus: 'Ready', photos: [],
    items: [
      { slug: 'espresso', nameRu: 'Эспрессо', nameEn: 'Espresso', category: 'Espresso', availability: 'Present', price: null, currency: 'BYN', volumeMl: 30, source: 'Manual' },
      { slug: 'batch', nameRu: 'Батч', nameEn: 'Batch', category: 'Filter', availability: 'Present', price: 3, currency: 'BYN', volumeMl: 250, source: 'Parsed' },
    ],
  };
  const onSave = jest.fn().mockResolvedValue(undefined);
  const root = createRoot(document.getElementById('root'));
  const priceInput = (name: string) => document.querySelector<HTMLInputElement>(`input[aria-label="Цена ${name}"]`)!;
  const typePrice = async (name: string, drafts: string[]) => {
    const input = priceInput(name);
    input.focus();
    for (const draft of drafts) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, draft);
        input.setSelectionRange(draft.length, draft.length);
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
      expect(document.activeElement).toBe(input);
      expect(priceInput(name)).toBe(input);
      expect(input.value).toBe(draft);
      expect(input.selectionStart).toBe(draft.length);
    }
  };

  try {
    await act(async () => {
      root.render(createElement(MenuEditor, { menu, compact, onSave, onAttach: jest.fn(), onParse: jest.fn() }));
    });
    await typePrice('Эспрессо', ['1', '12', '12,', '12,5', '12,50']);
    await typePrice('Батч', ['7', '7.', '7.2', '7.25']);
    expect(priceInput('Эспрессо').value).toBe('12,50');
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => {
      [...document.querySelectorAll('button')].find(button => button.textContent === 'Сохранить меню')!.click();
    });
    expect(onSave).toHaveBeenLastCalledWith({
      items: [
        { slug: 'espresso', availability: 'Present', price: 12.5, volumeMl: 30 },
        { slug: 'batch', availability: 'Present', price: 7.25, volumeMl: 250 },
      ],
      applySuggestedPriceRange: undefined,
    });
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
  }
});
