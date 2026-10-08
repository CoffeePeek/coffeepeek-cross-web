import React from 'react';
import type { DetailedCoffeeShop } from '../../api/coffeeshop';
import { COLORS } from '../../constants/colors';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { getThemeClasses } from '../../utils/theme';
import { AppIcon, StarIcon, BeanPriceMarks } from '../icons';
import { getPriceRangeTier } from '../../utils/priceRange';
import { isShopOpenNow } from '../../utils/shopUtils';

interface ShopHeaderProps {
  shop: DetailedCoffeeShop;
  avgRating: number;
  checkInsTotalCount: number;
  isFavorite: boolean;
  isCheckingFavorite: boolean;
  onToggleFavorite: () => void;
  onCheckIn?: () => void;
  onReportIssue?: () => void;
  textMuted: string;
  borderColor: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
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

export const ShopHeader: React.FC<ShopHeaderProps> = ({
  shop,
  avgRating,
  checkInsTotalCount,
  isFavorite,
  isCheckingFavorite,
  onToggleFavorite,
  onCheckIn,
  onReportIssue,
  textMuted,
  borderColor,
}) => {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const themeClasses = getThemeClasses(theme);
  const priceTiers = getPriceRangeTier(shop.priceRange);
  const iconMuted = theme === 'dark' ? '#E7E5E4' : '#44403C';
  const openNow = isShopOpenNow(shop);

  const handleShare = async () => {
    let path: string;
    try { if (!shop.publicAddress) throw new Error('Address unavailable'); path = shop.publicAddress.canonicalPath; }
    catch { showToast('Адрес временно недоступен. Попробуйте ещё раз.', 'error'); return; }
    const url = `https://coffeepeek.by${path}`;
    const text = `Нашёл отличную кофейню «${shop.name}» на CoffeePeek — загляни:\n${url}`;

    const copied = await copyText(text);
    if (copied) {
      showToast('Ссылка скопирована — можно отправить друзьям', 'success');
      return;
    }
    showToast('Не удалось скопировать ссылку', 'error');
  };

  return (
    <div className="mb-4 hidden min-w-0 flex-col gap-4 lg:mb-6 lg:flex lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
      <div className="min-w-0 w-full sm:flex-1">
        <div className="hidden min-w-0 flex-wrap items-center gap-2 text-sm lg:flex lg:gap-3">
          <span className={`${themeClasses.primary.bgLight} ${themeClasses.primary.text} font-bold px-3 py-1 rounded-lg flex items-center gap-1 shrink-0`}>
            <StarIcon filled size={14} />
            {avgRating.toFixed(1)}
          </span>
          <span className={`${textMuted} font-medium border-b border-current/30 shrink-0`}>
            {shop.checkInCount || checkInsTotalCount} чекинов
          </span>
          {shop.isNew && (
            <span className="bg-green-500/20 text-green-400 font-bold px-2 py-1 rounded-lg text-xs uppercase tracking-wider shrink-0">
              Новая
            </span>
          )}
          {openNow && (
            <span className="bg-green-500/20 text-green-400 font-bold px-2 py-1 rounded-lg text-xs uppercase tracking-wider shrink-0">
              Открыта
            </span>
          )}
          {priceTiers && (
            <BeanPriceMarks count={priceTiers} size={14} color={COLORS.primary} />
          )}
        </div>
      </div>

      <div className="hidden gap-2 lg:flex lg:w-auto lg:gap-3">
        {onCheckIn && (
          <button
            onClick={onCheckIn}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-2xl border ${borderColor} flex items-center justify-center gap-2 ${themeClasses.primary.bgLight} hover:opacity-90 transition-all ${themeClasses.primary.text} font-semibold text-sm`}
            style={{ padding: '8px 16px' }}
          >
            <AppIcon name="check_circle" size={18} color="currentColor" />
            Чекиниться
          </button>
        )}
        <button
          type="button"
          onClick={onToggleFavorite}
          disabled={isCheckingFavorite}
          aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border ${borderColor} flex items-center justify-center transition-all shrink-0 ${
            theme === 'dark'
              ? 'bg-white hover:bg-white/90'
              : isFavorite
                ? `${themeClasses.primary.bgLight} ${themeClasses.primary.borderLight}`
                : 'bg-black/5 hover:bg-black/10'
          }`}
          style={{ padding: 0 }}
        >
          <AppIcon
            name="favorite"
            filled={isFavorite}
            size={26}
            color={theme === 'dark' ? '#1A1412' : isFavorite ? '#EAB308' : iconMuted}
          />
        </button>
        <button
          type="button"
          onClick={handleShare}
          aria-label="Поделиться"
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border ${borderColor} flex items-center justify-center transition-all shrink-0 ${
            theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
          }`}
          style={{ padding: 0 }}
        >
          <AppIcon name="share" size={26} color={iconMuted} />
        </button>
        {onReportIssue && (
          <button
            type="button"
            onClick={onReportIssue}
            aria-label="Сообщить о неточности"
            title="Сообщить о неточности"
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border ${borderColor} flex items-center justify-center transition-all shrink-0 ${
              theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
            }`}
            style={{ padding: 0 }}
          >
            <AppIcon name="flag" size={24} color={iconMuted} />
          </button>
        )}
      </div>
    </div>
  );
};
