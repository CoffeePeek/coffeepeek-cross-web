import React from 'react';
import type { DetailedCoffeeShop } from '../../api/coffeeshop';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { getThemeClasses } from '../../utils/theme';
import { instagramHandle, instagramUrl, toWebsiteHref } from '../../utils/shopUtils';
import { AppIcon } from '../icons';
import { Globe, InstagramLogo } from '@/components/Icon';
import { captureAnalyticsEvent } from '../../lib/analytics';
import { useFeatureExposure } from '../../hooks/useFeatureExposure';

interface ContactButtonsProps {
  shop: DetailedCoffeeShop;
  cardBg: string;
  borderColor: string;
  textMain: string;
  textMuted: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export const ContactButtons: React.FC<ContactButtonsProps> = ({
  shop,
  cardBg,
  borderColor,
  textMain,
  textMuted,
}) => {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const themeClasses = getThemeClasses(theme);
  const contact = shop.shopContact;
  const exposureRef = useFeatureExposure<HTMLElement>('shop_contacts', 'shop_detail');
  if (!contact?.phone && !contact?.email && !contact?.website && !contact?.instagram) {
    return null;
  }

  const websiteHref = contact.website ? toWebsiteHref(contact.website) : undefined;

  const copyPhone = async () => {
    if (!contact.phone) return;
    captureAnalyticsEvent('shop_action_clicked', { action: 'phone_copy', entry_point: 'shop_contacts' });
    const ok = await copyText(contact.phone);
    showToast(ok ? 'Номер скопирован' : 'Не удалось скопировать', ok ? 'success' : 'error');
  };

  const iconBtn = `inline-flex items-center justify-center w-10 h-10 rounded-full border ${borderColor} ${textMain} hover:border-[#D4A84B]/50 transition-all`;
  const chipBtn = `inline-flex items-center gap-2 h-10 px-3.5 rounded-full font-semibold border ${borderColor} ${textMain} hover:border-[#D4A84B]/50 transition-all`;

  return (
    <section ref={exposureRef} className="min-w-0">
      <h2 className={`mb-3 text-2xl font-bold ${textMain}`}>Контакты</h2>
      <div className={`${cardBg} flex flex-wrap items-center gap-3 rounded-[24px] border p-4 sm:p-5 ${borderColor}`}>
        {contact.phone && (
          <div
            className={`inline-flex items-center h-10 max-w-full min-w-0 rounded-full border ${borderColor} overflow-hidden`}
          >
            <AppIcon name="call" size={18} color="#D4A84B" className="ml-3 shrink-0" />
            <span
              className={`px-2 font-medium ${textMain} select-text truncate min-w-0`}
              style={{ userSelect: 'text' }}
            >
              {contact.phone}
            </span>
            <button
              type="button"
              onClick={copyPhone}
              aria-label="Скопировать номер"
              title="Скопировать"
              className={`inline-flex items-center justify-center w-10 h-10 shrink-0 ${textMuted} hover:text-[#D4A84B] transition-colors`}
              style={{ padding: 0, border: 'none', borderRadius: 0, background: 'transparent', boxShadow: 'none' }}
            >
              <AppIcon name="content_copy" size={16} />
            </button>
          </div>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`} onClick={() => captureAnalyticsEvent('shop_action_clicked', { action: 'email', entry_point: 'shop_contacts' })} className={`inline-flex items-center gap-2 ${textMuted} hover:text-[#D4A84B]`}>
            <AppIcon name="mail" size={20} color="#D4A84B" />
            <span className="font-medium break-all">{contact.email}</span>
          </a>
        )}
        {websiteHref && (
          <a
            href={websiteHref}
            onClick={() => captureAnalyticsEvent('shop_action_clicked', { action: 'website', entry_point: 'shop_contacts' })}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Веб-сайт"
            title="Веб-сайт"
            className={iconBtn}
          >
            <Globe size={20} className={themeClasses.primary.text} />
          </a>
        )}
        {contact.instagram && (
          <a
            href={instagramUrl(contact.instagram)}
            onClick={() => captureAnalyticsEvent('shop_action_clicked', { action: 'instagram', entry_point: 'shop_contacts' })}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Instagram ${instagramHandle(contact.instagram)}`}
            className={`${chipBtn} max-w-full min-w-0`}
          >
            <InstagramLogo size={18} className={`${themeClasses.primary.text} shrink-0`} />
            <span className="truncate">{instagramHandle(contact.instagram)}</span>
          </a>
        )}
      </div>
    </section>
  );
};
