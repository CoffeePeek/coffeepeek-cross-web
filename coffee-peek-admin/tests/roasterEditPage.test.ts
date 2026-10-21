jest.mock('../src/api/roasters', () => ({ getRoasterById: jest.fn(), updateRoaster: jest.fn(), deleteRoaster: jest.fn() }));
jest.mock('../src/api/coffeeCatalog', () => ({ getDictionary: jest.fn(), getAssignedTags: jest.fn(), setAssignedTags: jest.fn() }));
jest.mock('../src/api/photos', () => ({ uploadRoasterPhotoFiles: jest.fn() }));
jest.mock('../src/hooks/useCatalogs', () => ({ useCatalogs: () => ({ data: { cities: [] } }) }));
let mockIsAdmin = true;
const mockShowToast = jest.fn();
jest.mock('../src/contexts/UserContext', () => ({ useUser: () => ({ isAdmin: mockIsAdmin }) }));
jest.mock('../src/contexts/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock('@/src/components/ui/Input', () => require('../src/components/ui/Input'), { virtual: true });
jest.mock('@/src/components/ui/NativeSelect', () => require('../src/components/ui/NativeSelect'), { virtual: true });
jest.mock('@/src/components/ui/Textarea', () => require('../src/components/ui/Textarea'), { virtual: true });

import { act, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { JSDOM } from 'jsdom';
import { getRoasterById, updateRoaster } from '../src/api/roasters';
import { getAssignedTags, getDictionary, setAssignedTags } from '../src/api/coffeeCatalog';

const id = 'roaster-uuid';
const tagId = '10000000-0000-4000-8000-000000000001';
const inactiveId = '10000000-0000-4000-8000-000000000002';
const tag = { id: tagId, name: 'Доставка', isActive: true, sortOrder: 0, description: null };
const inactive = { ...tag, id: inactiveId, name: 'Старая услуга', isActive: false };
let dom: JSDOM;
let client: QueryClient;
let root: ReturnType<typeof import('react-dom/client').createRoot>;

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAdmin = true;
  dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } } });
  const roaster = { id, name: 'Обжарщик', photos: [], shops: [], cityId: 'city-uuid' };
  client.setQueryData(['admin', 'roaster', id], roaster);
  client.setQueryData(['admin', 'coffee-dictionary', 'tags'], [tag]);
  client.setQueryData(['admin', 'roaster-tags', id], []);
  jest.mocked(getRoasterById).mockResolvedValue({ data: roaster } as never);
  jest.mocked(getDictionary).mockResolvedValue([tag]);
  jest.mocked(getAssignedTags).mockResolvedValue([tag]);
  jest.mocked(updateRoaster).mockResolvedValue({ data: { id, name: 'Обжарщик' } } as never);
  jest.mocked(setAssignedTags).mockResolvedValue(undefined);
  const { createRoot } = require('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  dom.window.close();
});

async function mount() {
  const { RoasterEditPage } = require('../src/pages/RoasterEditPage');
  await act(async () => root.render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [`/roaster/${id}`] }, createElement(Routes, null, createElement(Route, { path: '/roaster/:id', element: createElement(RoasterEditPage) }))))));
}
async function submit() {
  await act(async () => {
    document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 30));
  });
}

test('one form saves roaster fields, photos and services together', async () => {
  await mount();
  expect(document.querySelectorAll('form')).toHaveLength(1);
  expect(document.querySelectorAll('button[type="submit"]')).toHaveLength(1);
  await act(async () => (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
  await submit();
  expect(updateRoaster).toHaveBeenCalledWith(id, expect.objectContaining({ name: 'Обжарщик', cityId: 'city-uuid', photos: [] }));
  expect(setAssignedTags).toHaveBeenCalledWith(id, [tagId]);
});

test('unchanged services preserve inactive assignments and do not send a replacement', async () => {
  client.setQueryData(['admin', 'roaster-tags', id], [inactive]);
  await mount();
  await submit();
  expect(updateRoaster).toHaveBeenCalledTimes(1);
  expect(setAssignedTags).not.toHaveBeenCalled();
});

test('changing services with inactive assignments requires explicit removal consent', async () => {
  client.setQueryData(['admin', 'roaster-tags', id], [inactive]);
  await mount();
  await act(async () => (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
  expect((document.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  await submit();
  expect(updateRoaster).not.toHaveBeenCalled();
  expect(setAssignedTags).not.toHaveBeenCalled();
  await act(async () => (document.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement).click());
  await submit();
  expect(setAssignedTags).toHaveBeenCalledWith(id, [tagId]);
});

test('service failures report partial saves and moderators only write services', async () => {
  await mount();
  await act(async () => (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
  jest.mocked(setAssignedTags).mockRejectedValueOnce(new Error('Ошибка сети'));
  await submit();
  expect(mockShowToast).toHaveBeenLastCalledWith(expect.stringContaining('Карточка сохранена, но услуги сохранить не удалось'), 'error');
  mockIsAdmin = false;
  await mount();
  jest.mocked(updateRoaster).mockClear();
  await submit();
  expect(updateRoaster).not.toHaveBeenCalled();
  expect(setAssignedTags).toHaveBeenLastCalledWith(id, [tagId]);
});

test('removing the last service sends an empty set and a failed card save never writes services', async () => {
  client.setQueryData(['admin', 'roaster-tags', id], [tag]);
  jest.mocked(getAssignedTags).mockResolvedValue([]);
  await mount();
  await act(async () => (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
  jest.mocked(updateRoaster).mockRejectedValueOnce(new Error('Не удалось сохранить карточку'));
  await submit();
  expect(setAssignedTags).not.toHaveBeenCalled();
  await submit();
  expect(setAssignedTags).toHaveBeenCalledWith(id, []);
});
