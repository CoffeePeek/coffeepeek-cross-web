import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../design-system';
import { useMobileAppDownloads } from '../hooks/queries/useMobileAppDownloads';
import { usePageTitle } from '../hooks/usePageTitle';
import WobbleRing from '../components/WobbleRing';
import Mascot from '../components/Mascot';
import DownloadButton from '../components/mobile-app/DownloadButton';
import type { AppDownloadsConfig, ApkDownloadChannel } from '../api/mobileApp';

type Platform = 'android' | 'ios' | 'desktop';

interface DownloadOption {
  key: string;
  label: string;
  href: string;
  platform: Platform;
  apk?: ApkDownloadChannel;
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  return 'desktop';
}

function formatBytes(bytes?: number | null): string | null {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${unitIndex === 0 ? value.toFixed(0) : value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getOptions(config: AppDownloadsConfig): DownloadOption[] {
  const options: DownloadOption[] = [];

  if (config.android.googlePlay.available && config.android.googlePlay.url) {
    options.push({
      key: 'google-play',
      label: 'Скачать в Google Play',
      href: '/download/android',
      platform: 'android',
    });
  }

  if (config.android.apk.available && config.android.apk.url) {
    options.push({
      key: 'apk',
      label: 'Скачать APK',
      href: '/download/apk',
      platform: 'android',
      apk: config.android.apk,
    });
  }

  if (config.ios.appStore.available && config.ios.appStore.url) {
    options.push({
      key: 'app-store',
      label: 'Скачать в App Store',
      href: '/download/ios',
      platform: 'ios',
    });
  }

  const platform = detectPlatform();
  if (platform === 'desktop') return options;
  return [...options].sort((left, right) => {
    if (left.platform === platform && right.platform !== platform) return -1;
    if (left.platform !== platform && right.platform === platform) return 1;
    return 0;
  });
}

const DownloadPage: React.FC = () => {
  usePageTitle('Скачать CoffeePeek');
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const isDark = theme === 'dark';
  const { data, isLoading, isError, refetch, isFetching } = useMobileAppDownloads();

  const options = data ? getOptions(data) : [];

  return (
    <main
      className="flex min-h-[100dvh] flex-col justify-center px-4 py-8 sm:px-6 sm:py-12"
      style={{ background: colors.background, color: colors.textPrimary }}
    >
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <img src="/logo/logo.png" alt="" className="h-10 w-10 rounded-xl" />
          <span className="font-extended text-xl font-extrabold">
            Coffee<span className="text-[#EAB308]">Peek</span>
          </span>
        </div>

        <section
          className="rounded-[28px] border p-5 shadow-sm sm:p-8"
          style={{
            borderColor: colors.border,
            background: isDark ? 'rgba(45,36,31,0.68)' : 'rgba(255,255,255,0.82)',
          }}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="shrink-0 self-center" aria-hidden>
              <Mascot pose="happy" size={132} />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="font-extended text-3xl font-extrabold leading-tight sm:text-4xl">
                Скачать CoffeePeek
              </h1>
              <p className="mt-3 font-body text-base leading-relaxed" style={{ color: colors.textSecondary }}>
                Установите приложение через доступный магазин или APK-файл.
              </p>
            </div>
          </div>

          <div className="mt-7">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <WobbleRing size={44} />
              </div>
            ) : isError ? (
              <div className="rounded-2xl border p-5 text-center" style={{ borderColor: colors.border }}>
                <p className="font-body text-sm" style={{ color: colors.textSecondary }}>
                  Не удалось загрузить варианты скачивания. Попробуйте ещё раз.
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#EAB308] px-5 font-extended text-sm font-bold text-[#1A1412] disabled:opacity-60"
                >
                  {isFetching ? 'Обновляем...' : 'Повторить'}
                </button>
              </div>
            ) : options.length === 0 ? (
              <div className="rounded-2xl border p-5 text-center" style={{ borderColor: colors.border }}>
                <p className="font-body text-sm" style={{ color: colors.textSecondary }}>
                  Сейчас нет доступных каналов скачивания.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {options.map((option) => {
                  const size = formatBytes(option.apk?.fileSizeBytes ?? option.apk?.fileSize);
                  const releasedAt = formatDate(option.apk?.releasedAt);
                  return (
                    <div
                      key={option.key}
                      className="rounded-2xl border p-4"
                      style={{ borderColor: colors.border, background: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF' }}
                    >
                      <DownloadButton channel={option.key} href={option.href} label={option.label} />

                      {option.apk && (
                        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2" style={{ color: colors.textSecondary }}>
                          {option.apk.version && (
                            <div>
                              <dt className="font-body text-xs uppercase tracking-wide opacity-70">Версия</dt>
                              <dd className="font-extended font-semibold" style={{ color: colors.textPrimary }}>
                                {option.apk.version}
                              </dd>
                            </div>
                          )}
                          {size && (
                            <div>
                              <dt className="font-body text-xs uppercase tracking-wide opacity-70">Размер файла</dt>
                              <dd className="font-extended font-semibold" style={{ color: colors.textPrimary }}>
                                {size}
                              </dd>
                            </div>
                          )}
                          {releasedAt && (
                            <div>
                              <dt className="font-body text-xs uppercase tracking-wide opacity-70">Дата релиза</dt>
                              <dd className="font-extended font-semibold" style={{ color: colors.textPrimary }}>
                                {releasedAt}
                              </dd>
                            </div>
                          )}
                          {option.apk.sha256 && (
                            <div className="sm:col-span-2">
                              <dt className="font-body text-xs uppercase tracking-wide opacity-70">SHA-256</dt>
                              <dd className="break-all font-mono text-xs" style={{ color: colors.textPrimary }}>
                                {option.apk.sha256}
                              </dd>
                            </div>
                          )}
                        </dl>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default DownloadPage;
