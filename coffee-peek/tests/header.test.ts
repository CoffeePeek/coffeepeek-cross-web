jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: jest.fn(() => ({ theme: 'dark' })) }));
jest.mock('../src/contexts/UserContext', () => ({ useUser: jest.fn(() => ({ user: null, logout: jest.fn() })) }));
jest.mock('../src/hooks/queries/useCatalogs', () => ({
  useCities: () => ({ data: [{ id: 'grodno', name: 'Гродно' }, { id: 'minsk', name: 'Минск' }] }),
}));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { useTheme } from '../src/contexts/ThemeContext';
import { useUser } from '../src/contexts/UserContext';
import Header from '../src/components/Header';

const render = (route = '/') => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(Header)));

beforeEach(() => jest.clearAllMocks());

test('city picker starts with Minsk regardless of catalog ordering and shows a linked feed city', () => {
  const home = render();
  expect(home).toContain('aria-label="Выбрать город, сейчас Минск"');
  expect(home).toContain('Определить мой город');
  expect(render('/feed?citySlug=grodno')).toContain('aria-label="Выбрать город, сейчас Гродно"');
  expect(render('/cities/minsk/specialty')).toContain('aria-label="Выбрать город, сейчас Минск"');
});

test('mobile menu uses a native disclosure and retains every former navigation destination', () => {
  const html = render();
  const toggle = html.match(/<button\b[^>]*aria-controls="mobile-navigation"[^>]*>/)?.[0];
  expect(toggle).toMatch(/popovertarget="mobile-navigation"/i);
  expect(toggle).toContain('aria-expanded="false"');
  expect(html).toContain('id="mobile-navigation" popover="auto"');
  for (const route of ['/search', '/coffees', '/feed', '/profile', '/settings']) expect(html).toContain(`href="${route}"`);
  expect(html).toContain('Открыть меню');
  expect(html).toContain('Регистрация');
  expect(html).toContain('Войти');
  expect(html).toContain('backdrop-filter:blur(24px)');
});

test('settings stays marked as current for guests, in the light theme', () => {
  (useTheme as jest.Mock).mockReturnValue({ theme: 'light' });
  const html = render('/settings');
  const settings = html.match(/<a\b[^>]*href="\/settings"[^>]*>/)?.[0];
  expect(settings).toContain('aria-current="page"');
  expect(html).toContain('rgba(250,250,249,0.78)');
});

test('signed-in menu keeps account information and logout available', () => {
  (useUser as jest.Mock).mockReturnValueOnce({ user: { userName: 'Coffee Fan', email: 'fan@example.com' }, logout: jest.fn() });
  const html = render('/profile');
  expect(html).toContain('Coffee Fan');
  expect(html).toContain('Выйти');
  expect(html).not.toContain('Регистрация');
});
