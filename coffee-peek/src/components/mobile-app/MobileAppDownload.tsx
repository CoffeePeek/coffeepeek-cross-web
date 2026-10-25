import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeColors } from '../../design-system';
import { useMobileAppDownloads } from '../../hooks/queries/useMobileAppDownloads';
import Shimmer from '../skeletons/Shimmer';
import DownloadButton from './DownloadButton';
import Button from '../Button';

export type MobileAppDownloadVariant = 'full' | 'compact' | 'inline';

interface MobileAppDownloadProps {
  variant?: MobileAppDownloadVariant;
  className?: string;
}

const MobileAppDownload: React.FC<MobileAppDownloadProps> = ({ variant = 'full', className = '' }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const c = getThemeColors(theme);
  const { data, isLoading, isError, refetch } = useMobileAppDownloads();

  if (isLoading) {
    return <Shimmer height={variant === 'full' ? 176 : 88} className={`rounded-2xl ${className}`} />;
  }

  if (isError || !data) return variant === 'inline' ? <div className={`space-y-3 ${className}`} role="status">
    <p>Не удалось загрузить способы установки.</p>
    <Button variant="secondary" className="mx-auto" onClick={() => void refetch()}>Попробовать ещё раз</Button>
  </div> : null;

  const channels = [
    {
      key: 'app-store',
      label: 'Скачать в App Store',
      href: '/download/ios',
      available: data.ios.appStore.available && Boolean(data.ios.appStore.url),
    },
    {
      key: 'google-play',
      label: 'Скачать в Google Play',
      href: '/download/android',
      available: data.android.googlePlay.available && Boolean(data.android.googlePlay.url),
    },
    {
      key: 'apk',
      label: 'Скачать APK',
      href: '/download/apk',
      available: data.android.apk.available && Boolean(data.android.apk.url),
    },
  ].filter((channel) => channel.available || (variant === 'inline' && channel.key === 'app-store'));

  if (!channels.length) return null;

  if (variant === 'inline') return <div className={`flex flex-wrap items-start justify-center gap-3 ${className}`}>
    {channels.every(channel => !channel.available) && <p className="w-full text-sm" role="status">Установка временно недоступна. Попробуй зайти позже.</p>}
    {channels.map(channel => <div key={channel.key} className="flex flex-col items-center gap-1">
      <DownloadButton channel={channel.key} href={channel.href} label={channel.available ? channel.label : 'App Store — скоро'} disabled={!channel.available} />
      {!channel.available && <span className="text-xs">Скоро в App Store</span>}
    </div>)}
  </div>;

  return (
    <div
      className={`rounded-[18px] border p-4 ${variant === 'full' ? 'lg:p-6' : ''} ${className}`}
      style={{ borderColor: c.border, background: isDark ? 'rgba(45,36,31,0.55)' : 'rgba(255,255,255,0.72)' }}
    >
      {variant === 'full' && (
        <div className="mb-4">
          <h3 className="font-extended font-bold text-[20px] tracking-[-0.01em]" style={{ color: c.textPrimary }}>
            CoffeePeek в телефоне
          </h3>
          <p className="mt-1 font-body text-sm" style={{ color: c.textSecondary }}>
            Выберите удобный способ установки.
          </p>
        </div>
      )}
      <div className={`flex flex-wrap gap-3`}>
        {channels.map((channel) => (
          <DownloadButton key={channel.key} channel={channel.key} href={channel.href} label={channel.label} />
        ))}
      </div>
    </div>
  );
};

export default MobileAppDownload;
