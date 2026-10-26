import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockQuery = {
  data: { id: 'post-id', username: 'Анна', shopName: 'Кофейня', text: 'Текст публикации' },
  isLoading: false, isError: false, error: null as { status: number } | null,
};
jest.mock('../src/hooks/queries/useCheckIns', () => ({ useCheckIn: () => mockQuery }));
jest.mock('../src/hooks/usePageTitle', () => ({ usePageTitle: jest.fn() }));
jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../src/components/CheckInCard', () => ({ __esModule: true, default: ({ item }: { item: { text: string } }) => item.text }));
jest.mock('../src/components/Mascot', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/mobile-app', () => ({ MobileAppDownload: () => null }));

import CheckInPage from '../src/pages/CheckInPage';
import { usePageTitle } from '../src/hooks/usePageTitle';

const initial = { ...mockQuery };
const render = () => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/check-ins/post-id'] },
  createElement(Routes, null, createElement(Route, { path: '/check-ins/:checkInId', element: createElement(CheckInPage) }))));

beforeEach(() => { Object.assign(mockQuery, initial); jest.clearAllMocks(); });

test('a loaded check-in remains readable with its page metadata', () => {
  expect(render()).toContain('Текст публикации');
  expect(usePageTitle).toHaveBeenLastCalledWith('Анна в «Кофейня»', {
    description: 'Текст публикации', canonicalPath: '/check-ins/post-id',
  });
});

test('a 404 after loading removes the cached post from the page and its metadata', () => {
  expect(render()).toContain('Текст публикации');
  Object.assign(mockQuery, { isError: true, error: { status: 404 } });
  const html = render();
  expect(html).toContain('Публикация недоступна');
  expect(html).toContain('href="/feed"');
  expect(html).not.toContain('Текст публикации');
  expect(usePageTitle).toHaveBeenLastCalledWith('Публикация', {
    description: undefined, canonicalPath: '/check-ins/post-id',
  });
});

test('a temporary server error keeps the cached post readable and offers retry', () => {
  Object.assign(mockQuery, { isError: true, error: { status: 503 } });
  const html = render();
  expect(html).toContain('Публикация временно недоступна');
  expect(html).toContain('Повторить');
  expect(html).toContain('Текст публикации');
});
