import React, { useMemo, useState } from 'react';
import {
  formatMenuCapturedAt,
  formatMenuPrice,
  type ShopMenuDto,
  type ShopMenuItemDto,
} from '../../api/menu';
import PhotoLightbox from '../PhotoLightbox';
import { getPhotoUrl } from '../../api/coffeeshop';
import { captureAnalyticsEvent } from '../../lib/analytics';
import { useFeatureExposure } from '../../hooks/useFeatureExposure';

interface ShopMenuSectionProps {
  menu: ShopMenuDto | null | undefined;
  textMain: string;
  textMuted: string;
  cardBg: string;
  borderColor: string;
}

function groupPresent(items: ShopMenuItemDto[]) {
  const present = items.filter((item) => item.availability === 'Present');
  return {
    espresso: present.filter((item) => item.category === 'Espresso'),
    filter: present.filter((item) => item.category === 'Filter'),
  };
}

const DrinkGroup: React.FC<{
  title: string;
  items: ShopMenuItemDto[];
  textMain: string;
  textMuted: string;
}> = ({ title, items, textMain, textMuted }) => {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className={`font-bold ${textMain} mb-3`}>{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.slug} className="flex items-baseline justify-between gap-3">
            <span className={textMain}>{item.nameRu}</span>
            <span className={`shrink-0 tabular-nums ${textMuted}`}>
              {item.price != null ? formatMenuPrice(item.price, item.currency || 'BYN') : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ShopMenuSection: React.FC<ShopMenuSectionProps> = ({
  menu,
  textMain,
  textMuted,
  cardBg,
  borderColor,
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const grouped = useMemo(() => groupPresent(menu?.items ?? []), [menu?.items]);
  const photos = (menu?.photos ?? []).filter((photo) => photo.fullUrl);

  // Empty menu → hide the whole section (title included).
  const hasContent = grouped.espresso.length > 0 || grouped.filter.length > 0 || photos.length > 0;
  const exposureRef = useFeatureExposure<HTMLElement>('shop_menu', 'shop_detail', hasContent);
  if (!menu || !hasContent) return null;

  const captured = menu.capturedAtUtc ? formatMenuCapturedAt(menu.capturedAtUtc) : null;
  const updated =
    menu.updatedAtUtc &&
    menu.capturedAtUtc &&
    menu.updatedAtUtc !== menu.capturedAtUtc
      ? formatMenuCapturedAt(menu.updatedAtUtc)
      : null;

  return (
    <section ref={exposureRef} className="min-w-0">
      <h2 className={`mb-3 text-2xl font-bold ${textMain}`}>Меню</h2>
      <div className={`${cardBg} space-y-5 rounded-[24px] border p-4 sm:p-6 ${borderColor}`}>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <DrinkGroup title="Эспрессо" items={grouped.espresso} textMain={textMain} textMuted={textMuted} />
        <DrinkGroup title="Фильтр" items={grouped.filter} textMain={textMain} textMuted={textMuted} />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {photos.map((photo, index) => (
              <button
                key={photo.id ?? photo.storageKey ?? index}
                type="button"
                onClick={() => { captureAnalyticsEvent('shop_content_interacted', { section: 'menu', action: 'open' }); setLightboxIndex(index); }}
                className="relative block aspect-[3/4] overflow-hidden rounded-2xl bg-black/5"
              >
                {/* detail, not card: card is a 4:3 crop and these tiles are portrait */}
                <img src={getPhotoUrl(photo, 'detail')} alt="Фото меню" className="w-full h-full object-cover" />
                {index === 0 && captured && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-8 text-left text-xs text-white">Актуально на {captured}{updated ? <><br />Обновлено {updated}</> : null}</span>}
              </button>
            ))}
        </div>
      )}

      {lightboxIndex !== null && photos.length > 0 && (
        <PhotoLightbox
          images={photos}
          shopName="Меню"
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
      </div>
    </section>
  );
};
