import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCities, type City } from '../api/coffeeshop';
import WobbleRing from '../components/WobbleRing';
import GuestAuthCard from '../components/GuestAuthCard';
import { MobileAppDownload } from '../components/mobile-app';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { useLocalCity } from '../hooks/useLocalCity';
import { usePageTitle } from '../hooks/usePageTitle';
import { getErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import {
  CaretRight, CoffeeBean, Lock, MapPin, Moon, Plus, ShareNetwork,
} from '@phosphor-icons/react';

type Colors = { bg: string; surface: string; border: string; text: string; muted: string; gold: string };

const SettingsPage: React.FC = () => {
  usePageTitle('Настройки');
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, isLoading: isUserLoading } = useUser();
  const { cityId, setCityId } = useLocalCity();
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isUserLoading) return;
    setIsLoading(true);
    getCities()
      .then(citiesResponse => {
        const raw = citiesResponse.data as unknown;
        const list = Array.isArray(raw) ? raw : ((raw as { cities?: City[] })?.cities ?? []);
        setCities(list);
        if (!cityId && list[0]) setCityId(list[0].id);
      })
      .catch(cause => {
        logger.error('Error loading settings:', cause);
        setError(getErrorMessage(cause));
      })
      .finally(() => setIsLoading(false));
  }, [cityId, isUserLoading, setCityId]);

  const isDark = theme === 'dark';
  const colors: Colors = {
    bg: isDark ? '#171210' : '#F5F4F2', surface: isDark ? '#2B211C' : '#FFFFFF',
    border: isDark ? '#46362F' : '#E7E5E4', text: isDark ? '#FFFFFF' : '#1C1917',
    muted: isDark ? '#A39E93' : '#78716C', gold: '#EAB308',
  };

  const showMessage = (value: string) => {
    setError('');
    setMessage(value);
    window.setTimeout(() => setMessage(''), 3500);
  };

  const shareApp = async () => {
    const data = { title: 'CoffeePeek', text: 'Находите лучшие кофейни в CoffeePeek', url: window.location.origin };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.url);
        showMessage('Ссылка скопирована');
      }
    } catch (cause) {
      if ((cause as DOMException).name !== 'AbortError') setError('Не удалось поделиться ссылкой');
    }
  };

  if (isLoading || isUserLoading) {
    return <div className="flex min-h-[70vh] items-center justify-center" style={{ background: colors.bg }}><WobbleRing size={48} /></div>;
  }

  return (
    <main className="min-h-screen px-5 pb-12 pt-8 sm:px-8" style={{ background: colors.bg }}>
      <div className="mx-auto w-full max-w-[680px]">
        <h1 className="mb-6 text-[26px] font-extrabold sm:text-3xl" style={{ color: colors.text }}>Настройки</h1>

        {!user && <div className="mb-6"><GuestAuthCard {...colors} /></div>}

        {(message || error) && <div className="mb-5 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: error ? 'rgba(239,68,68,.45)' : colors.border, color: error ? '#EF4444' : colors.text, background: colors.surface }}>{error || message}</div>}

        {user && <SettingsSection title="Добавить" colors={colors}>
          <SettingsRow title="Добавить кофейню" subtitle="Предложить новое место для CoffeePeek" Icon={Plus} color="#D8A743" iconBg="rgba(202,145,28,.16)" colors={colors} onClick={() => navigate('/coffee-shops/new')} />
          <SettingsRow title="Добавить обжарщика" subtitle="Помогите сообществу открыть новых обжарщиков" Icon={CoffeeBean} color="#74C98B" iconBg="rgba(65,158,88,.18)" colors={colors} onClick={() => navigate('/roasters/new')} />
        </SettingsSection>}

        <SettingsSection title="Настройки" colors={colors}>
          <SettingsRow title="Город" subtitle="Определяет, какие кофейни показывать в первую очередь" Icon={MapPin} color="#71D5D0" iconBg="rgba(38,170,166,.17)" colors={colors}>
            <select aria-label="Город" value={cityId} onChange={event => setCityId(event.target.value)} className="max-w-[145px] cursor-pointer bg-transparent text-right text-base outline-none" style={{ color: colors.muted }}>
              {cities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
            <CaretRight size={20} color={colors.muted} />
          </SettingsRow>
          <SettingsRow title="Тема" subtitle="Настройте внешний вид приложения" value={isDark ? 'Тёмная' : 'Светлая'} Icon={Moon} color="#C594E8" iconBg="rgba(151,85,205,.17)" colors={colors} onClick={() => setTheme(isDark ? 'light' : 'dark')} />
        </SettingsSection>

        <SettingsSection title="Другие настройки" description="Управление полезными дополнениями и настройками конфиденциальности" colors={colors}>
          <SettingsRow title="Политика использования" Icon={Lock} color="#79D2B2" iconBg="rgba(27,155,111,.16)" colors={colors} onClick={() => navigate('/terms')} />
          <SettingsRow title="Поделиться" Icon={ShareNetwork} color="#6CCBE4" iconBg="rgba(32,163,193,.17)" colors={colors} onClick={() => { void shareApp(); }} />
        </SettingsSection>

        <section className="mb-6" aria-labelledby="app-download-title">
          <h2 id="app-download-title" className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: colors.muted }}>Скачать приложение</h2>
          <MobileAppDownload variant="compact" />
        </section>

      </div>
    </main>
  );
};

const SettingsSection: React.FC<{ title: string; description?: string; colors: Colors; children: React.ReactNode }> = ({ title, description, colors, children }) => (
  <section className="mb-5 sm:mb-6">
    <h2 className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: colors.muted }}>{title}</h2>
    {description && <p className="mb-3 text-xs leading-relaxed" style={{ color: colors.muted }}>{description}</p>}
    <div className="overflow-hidden rounded-[20px] border [&>*+*]:border-t [&>*+*]:border-[var(--settings-border)] sm:rounded-3xl" style={{ borderColor: colors.border, background: colors.surface, '--settings-border': colors.border } as React.CSSProperties}>{children}</div>
  </section>
);

interface SettingsRowProps {
  title: string; subtitle?: string; Icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'bold' }>;
  value?: string; color: string; iconBg: string; colors: Colors; onClick?: () => void; children?: React.ReactNode;
}

const SettingsRow: React.FC<SettingsRowProps> = ({ title, subtitle, value, Icon, color, iconBg, colors, onClick, children }) => {
  const content = <><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ color, background: iconBg }}><Icon size={22} /></span><span className="min-w-0 flex-1"><span className="block text-base font-medium" style={{ color: colors.text }}>{title}</span>{subtitle && <span className="mt-0.5 block text-xs leading-snug" style={{ color: colors.muted }}>{subtitle}</span>}</span>{children ?? <>{value && <span className="text-base" style={{ color: colors.muted }}>{value}</span>}{onClick && <CaretRight size={20} color={colors.muted} />}</>}</>;
  return onClick
    ? <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-opacity hover:opacity-80 sm:px-5 sm:py-3.5">{content}</button>
    : <div className="flex w-full items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5">{content}</div>;
};

export default SettingsPage;
