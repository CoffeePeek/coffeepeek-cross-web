import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LEGAL_ROUTES } from '../constants/legalRoutes';
import { useTheme } from '../contexts/ThemeContext';

const CookieBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    setShowBanner(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookieConsent', 'declined');
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    // Очищаем необязательные данные (но оставляем токены, если пользователь авторизован)
    // Токены будут очищены при следующем логине, если пользователь не примет согласие
    setShowBanner(false);
  };

  if (!showBanner) return null;

  const isDark = theme === 'dark';
  const buttonClass = 'min-h-[44px] rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EAB308]';

  return (
    <section
      aria-label="Использование данных"
      className={`fixed bottom-[calc(88px+env(safe-area-inset-bottom))] left-4 right-4 z-[1250] max-h-[calc(100dvh-120px-env(safe-area-inset-bottom))] overflow-y-auto rounded-3xl border p-5 shadow-xl lg:bottom-6 lg:left-6 lg:right-auto lg:w-[380px] ${isDark ? 'border-[#3D2F28] bg-[#2D241F] text-white' : 'border-gray-200 bg-white text-gray-900'}`}
    >
      <p className={`font-body text-sm leading-[1.5] ${isDark ? 'text-stone-300' : 'text-slate-500'}`}>
        <strong className={isDark ? 'text-white' : 'text-black'}>Использование данных. </strong>
        Сохраняем настройки и согласие в браузере; избранное — в вашем аккаунте.
        Используем технические метрики хостинга.{' '}
        <Link
          to={LEGAL_ROUTES.privacy}
          className={`underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#EAB308] ${isDark ? 'text-white' : 'text-black'}`}
        >
          Политика конфиденциальности
        </Link>
        .
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={handleDecline} className={buttonClass}>Отклонить</button>
        <button type="button" onClick={handleAccept} className={buttonClass}>Принять</button>
      </div>
    </section>
  );
};

export default CookieBanner;
