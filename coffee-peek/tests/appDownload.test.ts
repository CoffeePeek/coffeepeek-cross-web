import type { AppDownloadsConfig } from '../src/api/mobileApp';
import { APP_DOWNLOAD_PATH, APP_DOWNLOAD_URL, getAutoDownloadPath } from '../src/utils/appDownload';

const downloads: AppDownloadsConfig = {
  android: {
    googlePlay: { available: true, url: '/download/android' },
    apk: { available: true, url: '/download/apk' },
  },
  ios: { appStore: { available: true, url: '/download/ios' } },
};

test('the QR code and shared link use the public automatic download route', () => {
  expect(APP_DOWNLOAD_PATH).toBe('/download/auto');
  expect(APP_DOWNLOAD_URL).toBe('https://coffeepeek.by/download/auto');
});

test.each([
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5, '/download/ios'],
  ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 5, '/download/ios'],
  ['Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)', 5, '/download/ios'],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15', 5, '/download/ios'],
  ['Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/130.0 Mobile', 5, '/download/android'],
  ['Mozilla/5.0 (Linux; Android 14; Tablet) Chrome/130.0', 5, '/download/android'],
  ['Mozilla/5.0 (Linux; Android 14; CUBOT X90) Chrome/130.0 Mobile', 5, '/download/android'],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15', 0, null],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0', 10, null],
  ['Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0', 0, null],
  ['Mozilla/5.0 (Windows Phone 10.0; Android 6.0; Microsoft; Lumia)', 5, null],
  ['Mozilla/5.0 (Linux; Android 6.0.1) Googlebot/2.1', 0, null],
  ['', 0, null],
])('selects the appropriate store or keeps the installation page for %s', (userAgent, maxTouchPoints, expected) => {
  expect(getAutoDownloadPath(downloads, { userAgent, maxTouchPoints })).toBe(expected);
});

test.each([
  { available: false, url: '/download/ios' },
  { available: true, url: null },
  { available: true },
])('keeps iOS on the installation page when its store is unavailable: %j', appStore => {
  expect(getAutoDownloadPath({ ...downloads, ios: { appStore } }, { userAgent: 'iPhone' })).toBeNull();
});

test.each([
  { available: false, url: '/download/android' },
  { available: true, url: null },
  { available: true },
])('keeps Android on the installation page without automatically downloading an APK: %j', googlePlay => {
  expect(getAutoDownloadPath({ ...downloads, android: { ...downloads.android, googlePlay } }, { userAgent: 'Android' })).toBeNull();
});
