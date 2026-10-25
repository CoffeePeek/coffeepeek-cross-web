import React, { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import MobileAppDownload from '../components/mobile-app/MobileAppDownload';
import { useTheme } from '../contexts/ThemeContext';
import { brand, getThemeColors, light } from '../design-system';
import { useMobileAppDownloads } from '../hooks/queries/useMobileAppDownloads';
import { usePageTitle } from '../hooks/usePageTitle';
import { APP_DOWNLOAD_URL, getAutoDownloadPath } from '../utils/appDownload';

const AppDownloadPage: React.FC = () => {
  usePageTitle('Скачать приложение');
  const { theme } = useTheme();
  const c = getThemeColors(theme);
  const { data, isError } = useMobileAppDownloads();
  const redirectStarted = useRef(false);

  useEffect(() => {
    if (!data || isError || redirectStarted.current) return;
    const target = getAutoDownloadPath(data, navigator);
    if (!target) return;
    redirectStarted.current = true;
    window.location.replace(target);
  }, [data, isError]);

  return (
    <div className="min-h-screen" style={{ background: c.background, color: c.textPrimary }}>
      <Header />
      <main id="main-content" className="flex justify-center px-4 py-8 sm:py-12">
        <section className="w-full max-w-[480px] rounded-[28px] border px-5 py-10 text-center shadow-xl sm:px-10 sm:py-12" aria-labelledby="app-download-title" style={{ background: c.card, borderColor: c.border }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: c.textSecondary }}>Приложение CoffeePeek</p>
          <h1 id="app-download-title" className="mt-5 font-extended text-[32px] font-bold leading-tight tracking-tight sm:text-4xl">Хороший кофе.<br /><span style={{ color: brand.primary }}>Всегда под рукой.</span></h1>
          <p className="mt-5 text-sm leading-relaxed" style={{ color: c.textSecondary }}>Выбери удобный способ установки CoffeePeek.</p>
          <div className="mx-auto my-7 hidden w-fit rounded-[24px] border p-4 sm:block" style={{ background: light.surface, borderColor: c.border }}>
            <QRCodeSVG value={APP_DOWNLOAD_URL} size={192} title="Сканируй, чтобы скачать CoffeePeek" />
          </div>
          <p className="mb-7 hidden text-sm leading-relaxed sm:block" style={{ color: c.textSecondary }}>Наведи камеру телефона на QR-код — откроется магазин приложений или страница со способами установки.</p>
          <MobileAppDownload variant="inline" className="mt-7 sm:mt-0" />
          <div className="mt-7 border-t pt-5" style={{ borderColor: c.border }}>
            <Link to="/" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4" style={{ color: c.textSecondary }}>На главную CoffeePeek</Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AppDownloadPage;
