jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('../src/hooks/queries/useMobileAppDownloads', () => ({ useMobileAppDownloads: jest.fn() }));
jest.mock('../src/components/Footer.css', () => ({}));
jest.mock('react-router-dom', () => {
  const router = jest.requireActual('react-router-dom');
  const react = jest.requireActual('react');
  return { ...router, Link: jest.fn((props: object) => react.createElement(router.Link, props)) };
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link, MemoryRouter } from 'react-router-dom';
import Footer from '../src/components/Footer';
import { useMobileAppDownloads } from '../src/hooks/queries/useMobileAppDownloads';

const downloads = useMobileAppDownloads as jest.Mock;
const render = () => renderToStaticMarkup(React.createElement(MemoryRouter, {}, React.createElement(Footer)));

beforeEach(() => {
  jest.clearAllMocks();
  downloads.mockReturnValue({ data: {
    android: { googlePlay: { available: true, url: 'https://play.google.com/store/apps/details?id=by.coffeepeek' } },
    ios: { appStore: { available: false } },
  } });
});

test('same footer renders all four sections in the app and on standalone support', () => {
  const html = render();
  for (const title of ['Открывай', 'Приложение', 'Контакты', 'Документы']) expect(html).toContain(`aria-label="${title}"`);
  expect(html).toContain('href="/privacy#analytics-settings"');
  expect(html).not.toContain('mailto:');
  expect(html).not.toContain('Написать нам');
  expect(html.indexOf('Твой кофейный Минск.')).toBeLessThan(html.indexOf('© 2026'));
  expect(html.indexOf('© 2026')).toBeLessThan(html.indexOf('Открывай'));
  (Link as unknown as jest.Mock).mockClear();
  const supportHtml = renderToStaticMarkup(React.createElement(Footer));
  expect(supportHtml.replace(/<[^>]+>/g, '')).toBe(html.replace(/<[^>]+>/g, ''));
  expect(supportHtml.match(/href="[^"]+"/g)).toEqual(html.match(/href="[^"]+"/g));
  expect(Link).not.toHaveBeenCalled();
});

test('app links keep client navigation except server downloads and support', () => {
  render();
  const links = (Link as unknown as jest.Mock).mock.calls.map(([props]) => props);
  for (const to of ['/shops', '/map', '/coffees', '/roasters', '/feed', '/coffee-shops/new', '/terms', '/privacy', '/privacy#analytics-settings']) {
    expect(links).toContainEqual(expect.objectContaining({ to, reloadDocument: false }));
  }
  for (const to of ['/download/android', '/support']) {
    expect(links).toContainEqual(expect.objectContaining({ to, reloadDocument: true }));
  }
  expect(links).toContainEqual(expect.objectContaining({ to: 'https://www.instagram.com/coffeepeek.by/', target: '_blank', rel: 'noopener noreferrer' }));
});

test('unavailable stores lead to installation options and preserve loading and error labels', () => {
  expect(render()).toContain('App Store<span class="site-footer-store-status">Скоро</span>');
  expect(render()).not.toContain('href="/download/ios"');
  expect(render()).toContain('href="/settings#app-download-title"');
  downloads.mockReturnValue({ isPending: true });
  expect(render().match(/Загрузка…/g)).toHaveLength(2);
  downloads.mockReturnValue({ isError: true });
  expect(render().match(/Недоступно/g)).toHaveLength(2);
});
