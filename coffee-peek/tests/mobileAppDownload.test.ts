jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../src/hooks/queries/useMobileAppDownloads', () => ({ useMobileAppDownloads: jest.fn() }));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useMobileAppDownloads } from '../src/hooks/queries/useMobileAppDownloads';
import MobileAppDownload from '../src/components/mobile-app/MobileAppDownload';

const downloads = useMobileAppDownloads as jest.Mock;
const config = {
  android: { googlePlay: { available: true, url: 'https://play.google.com/store/apps/details?id=by.coffeepeek' }, apk: { available: false } },
  ios: { appStore: { available: false } },
};
const render = (variant: 'inline' | 'compact' = 'inline') => renderToStaticMarkup(React.createElement(MobileAppDownload, { variant }));

test('inline store badges retain available channels and identify iOS as coming soon', () => {
  downloads.mockReturnValue({ data: config });
  const html = render();
  expect(html).toContain('href="/download/android"');
  expect(html).toContain('App Store — скоро');
  expect(html).toContain('aria-disabled="true"');
  expect(html).not.toContain('href="/download/ios"');
  expect(html).not.toContain('href="/download/apk"');
  expect(render('compact')).not.toContain('App Store — скоро');
});

test('App Store becomes an active link only when the configured channel has a URL', () => {
  downloads.mockReturnValue({ data: { ...config, ios: { appStore: { available: true, url: 'https://apps.apple.com/app/coffeepeek' } } } });
  expect(render()).toContain('href="/download/ios"');
  downloads.mockReturnValue({ data: { ...config, ios: { appStore: { available: true, url: null } } } });
  expect(render()).not.toContain('href="/download/ios"');
});

test('loading and failures do not claim that downloads are available', () => {
  downloads.mockReturnValue({ isLoading: true });
  expect(render()).not.toContain('href="/download/');
  downloads.mockReturnValue({ isError: true, refetch: jest.fn() });
  expect(render()).toContain('Не удалось загрузить способы установки.');
  expect(render()).toContain('Попробовать ещё раз');
  expect(render()).not.toContain('href="/download/');
});
