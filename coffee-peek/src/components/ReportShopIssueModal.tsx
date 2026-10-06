import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors, brand } from '../design-system/tokens';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useToast } from '../contexts/ToastContext';
import { useCreateShopIssueReport } from '../hooks/queries/useShopReports';
import { getErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import {
  SHOP_ISSUE_CATEGORIES,
  SHOP_ISSUE_CATEGORY_LABELS,
  buildShopIssueReportRequest,
  ShopIssueReportValidationError,
  type ShopIssueCategory,
} from '../utils/shopIssueReportForm';
import { WarningCircle, X } from './Icon';
import WobbleRing from './WobbleRing';

interface ReportShopIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  shopName: string;
}

const ReportShopIssueModal: React.FC<ReportShopIssueModalProps> = ({ isOpen, onClose, shopId, shopName }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const isDark = theme === 'dark';
  const { requireAuth } = useRequireAuth();
  const { showToast } = useToast();
  const { mutateAsync: submitReport, isPending } = useCreateShopIssueReport();

  const [category, setCategory] = useState<ShopIssueCategory | null>(null);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setCategory(null);
    setDescription('');
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isPending) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!requireAuth()) return;

    let request;
    try {
      request = buildShopIssueReportRequest({ shopId, category, description });
    } catch (err) {
      showToast(err instanceof ShopIssueReportValidationError ? err.message : 'Проверьте данные', 'error');
      return;
    }

    try {
      await submitReport(request);
      showToast('Спасибо! Мы проверим информацию о кофейне', 'success');
      onClose();
    } catch (err) {
      logger.error('Error submitting shop issue report:', err);
      showToast(getErrorMessage(err), 'error');
    }
  };

  const fieldBorder = `1px solid ${colors.border}`;

  return (
    <div className="fixed inset-0 z-[1200] sm:flex sm:items-center sm:justify-center sm:p-4">
      <button type="button" aria-label="Закрыть" className="absolute inset-0 bg-black/45 sm:bg-black/60" onClick={handleClose} />
      <div
        className="absolute inset-x-0 bottom-0 sm:relative sm:inset-auto w-full sm:max-w-[420px] flex flex-col min-h-0 overflow-hidden max-h-[min(85dvh,calc(100dvh-4.5rem))] sm:max-h-[90vh] rounded-t-[28px] sm:rounded-[28px] shadow-[0_-8px_40px_rgba(0,0,0,0.18)]"
        style={{ backgroundColor: colors.card }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden shrink-0 pt-2.5 pb-1">
          <div className="mx-auto h-1 w-10 rounded-full" style={{ backgroundColor: colors.border }} />
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Закрыть"
          className="hidden sm:flex absolute top-4 right-4 z-10 w-8 h-8 items-center justify-center rounded-full"
          style={{ color: colors.textSecondary }}
        >
          <X size={18} />
        </button>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <fieldset disabled={isPending} className="flex flex-col gap-5 border-0 p-0 m-0 min-w-0">
            <header className="space-y-1.5">
              <h2 className="font-extended font-bold text-[24px] leading-none tracking-tight flex items-center gap-2" style={{ color: colors.textPrimary }}>
                <WarningCircle size={22} weight="fill" color={brand.primary} />
                Сообщить о неточности
              </h2>
              <p className="font-body text-[13px]" style={{ color: colors.textSecondary }}>
                {shopName}
              </p>
            </header>

            <div className="space-y-1.5" role="radiogroup" aria-label="Тип проблемы">
              {SHOP_ISSUE_CATEGORIES.map((value) => {
                const selected = category === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setCategory(value)}
                    className="w-full text-left rounded-2xl px-4 py-3 font-body text-sm transition-colors"
                    style={{
                      border: selected ? `1.5px solid ${brand.primary}` : fieldBorder,
                      backgroundColor: selected ? `${brand.primary}1A` : isDark ? colors.input : '#FFFFFF',
                      color: colors.textPrimary,
                    }}
                  >
                    {SHOP_ISSUE_CATEGORY_LABELS[value]}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="report-description" className="block font-body text-[13px]" style={{ color: colors.textSecondary }}>
                {category === 'Other' ? 'Описание (обязательно)' : 'Описание (необязательно)'}
              </label>
              <textarea
                id="report-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Расскажите подробнее..."
                rows={3}
                maxLength={1000}
                className="w-full rounded-2xl px-4 py-3 font-body text-sm resize-none outline-none placeholder:opacity-50"
                style={{ backgroundColor: isDark ? colors.input : '#FFFFFF', color: colors.textPrimary, border: fieldBorder }}
              />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="w-full rounded-[18px] py-3.5 font-extended font-bold text-[16px] flex items-center justify-center gap-2 text-[#1A1412] transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: brand.primary }}
            >
              {isPending ? (
                <>
                  <WobbleRing size={18} color="#1A1412" />
                  Отправка...
                </>
              ) : (
                'Отправить'
              )}
            </button>
          </fieldset>
        </div>
      </div>
    </div>
  );
};

export default ReportShopIssueModal;
