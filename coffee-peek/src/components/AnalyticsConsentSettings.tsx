import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { LEGAL_ROUTES } from '../constants/legalRoutes';
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_KEY,
  getAnalyticsConsent,
  setAnalyticsConsent,
} from '../lib/analyticsConsent';
import Button from './Button';

const AnalyticsConsentSettings: React.FC = () => {
  const { theme } = useTheme();
  const [consent, updateConsent] = useState(getAnalyticsConsent);
  const isDark = theme === 'dark';
  const linkClass = `${isDark ? 'text-[#EAB308]' : 'text-amber-700'} hover:underline font-medium`;

  useEffect(() => {
    const syncConsent = () => updateConsent(getAnalyticsConsent());
    const onStorage = (event: StorageEvent) => {
      if (event.key === ANALYTICS_CONSENT_KEY || event.key === null) syncConsent();
    };
    window.addEventListener(ANALYTICS_CONSENT_EVENT, syncConsent);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, syncConsent);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return (
    <div id="analytics-settings" className={`mt-4 scroll-mt-6 rounded-xl border p-4 ${isDark ? 'border-[#3D2F28]' : 'border-gray-200'}`}>
      <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Настройки аналитики PostHog</h3>
      <p className={`mt-2 mb-3 ${isDark ? 'text-[#A39E93]' : 'text-gray-600'}`} role="status">
        {consent === 'accepted'
          ? 'Аналитика разрешена. Вы можете выключить её и отозвать согласие в любой момент.'
          : consent === 'declined'
            ? 'Аналитика выключена. События о посещениях и действиях в PostHog не отправляются.'
            : 'Аналитика выключена, пока вы не дадите согласие.'}
      </p>
      <Button
        variant="secondary"
        className="w-full sm:w-auto"
        onClick={() => setAnalyticsConsent(consent === 'accepted' ? 'declined' : 'accepted')}
      >
        {consent === 'accepted' ? 'Выключить аналитику и отозвать согласие' : 'Включить аналитику PostHog'}
      </Button>
      <p className={`mt-3 text-sm leading-relaxed ${isDark ? 'text-[#A39E93]' : 'text-gray-600'}`}>
        Выбор действует для этого браузера. Настройки аналитики мобильного приложения
        управляются отдельно. Выключение не ограничивает функции Сервиса и не удаляет
        ранее переданные события.
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <a className={linkClass} href={`${LEGAL_ROUTES.privacy}#posthog`}>Какие данные собираются</a>
        <a className={linkClass} href={`${LEGAL_ROUTES.privacy}#data-deletion`}>Как удалить данные</a>
      </div>
    </div>
  );
};

export default AnalyticsConsentSettings;
