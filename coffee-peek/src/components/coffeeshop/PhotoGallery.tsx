import React, { useState } from 'react';
import { type DetailedCoffeeShop, getPhotoUrl } from '../../api/coffeeshop';
import PhotoLightbox from '../PhotoLightbox';
import { AppIcon } from '../icons';
import { captureAnalyticsEvent } from '../../lib/analytics';
import { useFeatureExposure } from '../../hooks/useFeatureExposure';

interface PhotoGalleryProps {
  shop: DetailedCoffeeShop;
  cardBg: string;
  borderColor: string;
  textMuted: string;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ shop }) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const exposureRef = useFeatureExposure<HTMLButtonElement>('shop_photos', 'shop_detail', !!shop.photos?.length);

  if (!shop.photos || shop.photos.length === 0) {
    return null;
  }

  const photos = [...shop.photos].sort(
    (left, right) => (left.sortIndex ?? Number.MAX_SAFE_INTEGER) - (right.sortIndex ?? Number.MAX_SAFE_INTEGER)
  );
  const photoCount = photos.length;

  const openAt = (index: number) => {
    captureAnalyticsEvent('shop_content_interacted', { section: 'photos', action: 'open' });
    setLightboxIndex(index);
  };

  const tile = (index: number, className: string, showAllBadge = false) => (
    <button
      type="button"
      key={photos[index].storageKey ?? photos[index].fullUrl ?? index}
      ref={index === 0 ? exposureRef : undefined}
      onClick={() => openAt(index)}
      className={`${className} overflow-hidden relative group cursor-pointer border-0 p-0 text-left`}
      aria-label={`Открыть фото ${index + 1} в полном размере`}
    >
      <div
        className="w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
        style={{ backgroundImage: `url(${getPhotoUrl(photos[index], 'detail')})` }}
      />
      <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
      {showAllBadge && photoCount > 3 && (
        <span className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md text-[#2D2926] px-4 py-2 rounded-xl font-bold text-sm border border-[#E8E4E1] shadow-xl flex items-center gap-2 pointer-events-none">
          <AppIcon name="grid_view" size={16} />
          Показать все фото ({photoCount})
        </span>
      )}
    </button>
  );

  return (
    <>
      {photoCount === 1 && tile(0, 'col-span-1 md:col-span-12 row-span-1 md:row-span-2 sm:rounded-3xl')}

      {photoCount === 2 && (
        <>
          {tile(0, 'col-span-1 md:col-span-8 row-span-1 md:row-span-2 sm:rounded-3xl')}
          {tile(1, 'hidden md:block col-span-4 row-span-2 rounded-3xl')}
        </>
      )}

      {photoCount === 3 && (
        <>
          {tile(0, 'col-span-1 md:col-span-8 row-span-1 md:row-span-2 sm:rounded-3xl')}
          {tile(1, 'hidden md:block col-span-4 row-span-1 rounded-3xl')}
          {tile(2, 'hidden md:block col-span-4 row-span-1 rounded-3xl')}
        </>
      )}

      {photoCount > 3 && (
        <>
          {tile(0, 'col-span-1 md:col-span-8 row-span-1 md:row-span-2 sm:rounded-3xl')}
          {tile(1, 'hidden md:block col-span-4 row-span-1 rounded-3xl')}
          {tile(2, 'hidden md:block col-span-4 row-span-1 rounded-3xl', true)}
        </>
      )}

      {lightboxIndex !== null && (
        <PhotoLightbox
          images={photos}
          shopName={shop.name}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
};
