import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getPhotoUrl, type PhotoMetadataDto, type ShortPhotoMetadataDto } from '../api/coffeeshop';
import { CaretLeft, CaretRight, X } from '@/components/Icon';

type PhotoInput = string | PhotoMetadataDto | ShortPhotoMetadataDto;

interface PhotoLightboxProps {
  images: PhotoInput[];
  shopName: string;
  initialIndex?: number;
  onClose: () => void;
}

function toUrl(img: PhotoInput): string {
  if (img && typeof img === 'object' && ('fullUrl' in img || 'storageKey' in img)) {
    return getPhotoUrl(img as PhotoMetadataDto | ShortPhotoMetadataDto, 'fullscreen');
  }
  if (typeof img === 'string') return img.trim();
  return img ? String(img).trim() : '';
}

const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  images,
  shopName,
  initialIndex = 0,
  onClose,
}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const urls = images.map(toUrl).filter((url) => url.length > 0);
  const [index, setIndex] = React.useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(urls.length - 1, 0))
  );

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? urls.length - 1 : i - 1));
  }, [urls.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i >= urls.length - 1 ? 0 : i + 1));
  }, [urls.length]);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    element?.querySelector<HTMLButtonElement>('button[aria-label="Закрыть"]')?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      previousFocus?.focus();
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext]);

  if (urls.length === 0) return null;

  const current = urls[index];

  return createPortal(
    <dialog
      ref={dialog}
      onCancel={onClose}
      className="fixed inset-0 z-[1300] m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-transparent p-3 sm:p-6"
      aria-modal="true"
      aria-label={`Фото: ${shopName}`}
    >
      <button
        type="button"
        className="absolute inset-0 border-0 p-0 cursor-default"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.82)' }}
        onClick={onClose}
        aria-hidden
        tabIndex={-1}
      />

      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-30 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 bg-white/15 p-0 text-white backdrop-blur-md transition hover:bg-white/25"
        aria-label="Закрыть"
      >
        <X size={24} weight="bold" color="#FFFFFF" aria-hidden />
      </button>

      {urls.length > 1 && (
        <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md">
          {index + 1} / {urls.length}
        </div>
      )}

      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-3 top-1/2 z-30 flex h-12 w-12 shrink-0 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-white/15 p-0 text-white backdrop-blur-md transition hover:bg-white/25 sm:left-6"
            aria-label="Предыдущее фото"
          >
            <CaretLeft size={28} weight="bold" color="#FFFFFF" aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-3 top-1/2 z-30 flex h-12 w-12 shrink-0 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-white/15 p-0 text-white backdrop-blur-md transition hover:bg-white/25 sm:right-6"
            aria-label="Следующее фото"
          >
            <CaretRight size={28} weight="bold" color="#FFFFFF" aria-hidden />
          </button>
        </>
      )}

      <div className="relative z-10 flex h-full w-full max-w-6xl items-center justify-center pointer-events-none">
        <img
          src={current}
          alt={`${shopName} — фото ${index + 1}`}
          className="max-h-[min(90vh,900px)] max-w-full object-contain select-none pointer-events-auto"
          draggable={false}
        />
      </div>
    </dialog>,
    document.body
  );
};

export default PhotoLightbox;
