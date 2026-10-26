jest.mock('../src/api/core/httpClient', () => ({ httpClient: { delete: jest.fn() } }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: { ADMIN: {
  SHOP_MENU_PHOTOS: (id: string) => `/api/admin/shops/${id}/menu/photos`,
} } }));
jest.mock('@/src/components/ui/DataTable', () => require('../src/components/ui/DataTable'), { virtual: true });
jest.mock('@/src/components/ui/Input', () => require('../src/components/ui/Input'), { virtual: true });

import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import { httpClient } from '../src/api/core/httpClient';
import { deletePublishedShopMenuPhotos, type ShopMenuDto } from '../src/api/menu';

const menu: ShopMenuDto = {
  currency: 'BYN', parseStatus: 'Ready',
  photos: [
    { id: 'photo-1', fileName: 'first.jpg', storageKey: 'first', fullUrl: '/first.jpg' },
    { id: 'photo-2', fileName: 'second.jpg', storageKey: 'second', fullUrl: '/second.jpg' },
    { fileName: 'legacy.jpg', storageKey: 'legacy', fullUrl: '/legacy.jpg' },
  ],
  items: [{ slug: 'espresso', nameRu: 'Эспрессо', nameEn: 'Espresso', category: 'Espresso', availability: 'Present', price: 5, currency: 'BYN', source: 'Manual' }],
};

test('photo deletion sends IDs in the DELETE body and returns the remaining menu', async () => {
  const remaining = { ...menu, photos: [menu.photos[0]] };
  jest.mocked(httpClient.delete).mockResolvedValueOnce({ data: { menu: remaining, unmatched: [] } } as never);
  const response = await deletePublishedShopMenuPhotos('shop-1', ['photo-2']);
  expect(httpClient.delete).toHaveBeenCalledWith('/api/admin/shops/shop-1/menu/photos', { data: { photoIds: ['photo-2'] } });
  expect(response.data.menu?.photos.map(photo => photo.id)).toEqual(['photo-1']);
  expect(response.data.menu?.items[0]).toMatchObject(menu.items[0]);
  jest.mocked(httpClient.delete).mockRejectedValueOnce(new Error('Удаление запрещено'));
  await expect(deletePublishedShopMenuPhotos('shop-1', ['photo-2'])).rejects.toThrow('Удаление запрещено');
});

describe('menu photo controls', () => {
  let dom: JSDOM;
  let root: ReturnType<typeof import('react-dom/client').createRoot>;
  let MenuEditor: typeof import('../src/components/menu/MenuEditor').MenuEditor;

  beforeEach(() => {
    dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
    Object.assign(globalThis, {
      window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
      Element: dom.window.Element, Node: dom.window.Node, NodeFilter: dom.window.NodeFilter,
      HTMLInputElement: dom.window.HTMLInputElement, MutationObserver: dom.window.MutationObserver,
      CustomEvent: dom.window.CustomEvent, getComputedStyle: dom.window.getComputedStyle,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    root = require('react-dom/client').createRoot(document.getElementById('root'));
    MenuEditor = require('../src/components/menu/MenuEditor').MenuEditor;
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    dom.window.close();
  });

  const button = (label: string) => [...document.querySelectorAll('button')].find(el => el.textContent === label)!;
  const deleteButton = () => document.querySelector<HTMLButtonElement>('button[aria-label="Удалить фото меню 2"]')!;
  const render = async (onDeletePhoto?: (id: string) => Promise<void>, currentMenu = menu, compact = false) => {
    await act(async () => root.render(createElement(MenuEditor, {
      menu: currentMenu, compact, onDeletePhoto, onAttach: jest.fn(), onParse: jest.fn(), onSave: jest.fn(),
    })));
  };

  test('deletion is only offered with a callback and photo ID, and waits for parsing', async () => {
    await render();
    expect(deleteButton()).toBeNull();
    const onDeletePhoto = jest.fn();
    await render(onDeletePhoto);
    expect(document.querySelectorAll('button[aria-label^="Удалить фото меню"]')).toHaveLength(2);
    expect(deleteButton().disabled).toBe(false);
    await render(onDeletePhoto, { ...menu, parseStatus: 'Running' });
    expect(deleteButton().disabled).toBe(true);
    expect(onDeletePhoto).not.toHaveBeenCalled();
  });

  test.each([false, true])('confirms, cancels, retries errors and preserves prices (compact: %s)', async compact => {
    let finishDeletion!: () => void;
    const deletion = new Promise<void>(resolve => { finishDeletion = resolve; });
    const onDeletePhoto = jest.fn().mockRejectedValueOnce(new Error('Не удалось удалить фото')).mockReturnValueOnce(deletion);
    await render(onDeletePhoto, menu, compact);
    const price = document.querySelector<HTMLInputElement>('input[aria-label="Цена Эспрессо"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(price, '7,50');
      price.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await act(async () => deleteButton().click());
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Напитки и цены сохранятся');
    expect(onDeletePhoto).not.toHaveBeenCalled();
    await act(async () => button('Отмена').click());
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onDeletePhoto).not.toHaveBeenCalled();

    await act(async () => deleteButton().click());
    await act(async () => button('Удалить фото').click());
    expect(onDeletePhoto).toHaveBeenCalledWith('photo-2');
    expect(document.querySelector('[role="alertdialog"] [role="alert"]')?.textContent).toBe('Не удалось удалить фото');
    expect(document.querySelectorAll('img')).toHaveLength(3);

    await act(async () => button('Удалить фото').click());
    expect(button('Удалить фото').disabled).toBe(true);
    expect(button('Отмена').disabled).toBe(true);
    await act(async () => button('Удалить фото').click());
    expect(onDeletePhoto).toHaveBeenCalledTimes(2);
    await act(async () => { finishDeletion(); await deletion; });
    await render(onDeletePhoto, { ...menu, photos: menu.photos.filter(photo => photo.id !== 'photo-2') }, compact);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.querySelector('img[src="/second.jpg"]')).toBeNull();
    expect(document.querySelectorAll('img')).toHaveLength(2);
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Цена Эспрессо"]')?.value).toBe('7,50');
  });
});
