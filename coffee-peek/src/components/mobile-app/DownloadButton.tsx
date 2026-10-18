import React from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import { captureAnalyticsEvent } from '../../lib/analytics';

interface DownloadButtonProps {
  channel: string;
  href: string;
  label: string;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ channel, href, label }) => (
  <a
    href={href}
    onClick={() => captureAnalyticsEvent('app_download_clicked', { channel })}
    aria-label={label}
    className={`inline-flex h-12 ${channel === 'app-store' ? 'w-[144px]' : 'w-[162px]'} shrink-0 items-center justify-center overflow-hidden rounded-lg ${channel === 'apk' ? 'border border-[#A6A6A6]' : ''} bg-black text-white transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#EAB308]`}
    style={{ color: '#fff' }}
  >
    {channel === 'google-play' ? (
      <img src="/images/stores/google-play.png" alt="" className="h-[72px] w-[186px] max-w-none shrink-0" />
    ) : channel === 'app-store' ? (
      <img src="/images/stores/app-store.svg" alt="" className="h-full w-full" />
    ) : (
      <><DownloadSimple size={26} aria-hidden /><span className="ml-2 text-left font-body"><span className="block text-[10px] leading-3">Скачать для Android</span><span className="block text-xl font-semibold leading-6">APK-файл</span></span></>
    )}
  </a>
);

export default DownloadButton;
