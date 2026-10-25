import type { AppDownloadsConfig } from '../api/mobileApp';
import { LEGAL } from '../constants/legal';

export const APP_DOWNLOAD_PATH = '/download/auto';
export const APP_DOWNLOAD_URL = new URL(APP_DOWNLOAD_PATH, LEGAL.siteUrl).href;

interface DownloadDevice {
  userAgent: string;
  maxTouchPoints?: number;
}

export function getAutoDownloadPath(
  downloads: AppDownloadsConfig,
  { userAgent, maxTouchPoints = 0 }: DownloadDevice,
): '/download/ios' | '/download/android' | null {
  if (/Windows Phone|Googlebot|bingbot|crawler|spider/i.test(userAgent)) return null;

  const isIOS = /iPhone|iPad|iPod/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  if (isIOS) {
    const store = downloads.ios.appStore;
    return store.available && store.url ? '/download/ios' : null;
  }

  if (/Android/i.test(userAgent)) {
    const store = downloads.android.googlePlay;
    return store.available && store.url ? '/download/android' : null;
  }

  return null;
}
