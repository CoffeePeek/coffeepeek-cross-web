import { useEffect, useRef, useState } from 'react';
import type { CheckInPhoto } from '../api/coffeeshop';
import { selectCheckInPhoto, type PhotoPurpose } from '../utils/checkInPhotoVariants';
import { useProtectedPhoto } from '../hooks/useProtectedPhoto';

export default function ProtectedPhoto({ photo, purpose, alt = '', className = '', showRetry = false }: {
  photo: Pick<CheckInPhoto, 'url' | 'variants'>; purpose: PhotoPurpose; alt?: string; className?: string; showRetry?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [pixels, setPixels] = useState(960);
  const [decodeFailures, setDecodeFailures] = useState<string[]>([]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)));
    const resize = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 480;
      setPixels(Math.ceil(width * Math.min(window.devicePixelRatio || 1, 3)));
    });
    observer.observe(element);
    resize.observe(element);
    return () => { observer.disconnect(); resize.disconnect(); };
  }, []);
  const candidate = selectCheckInPhoto({ ...photo, variants: photo.variants?.filter(variant => !decodeFailures.includes(variant.url)) }, purpose, pixels);
  const selected = candidate && !decodeFailures.includes(candidate.url) ? candidate : null;
  const image = useProtectedPhoto(selected?.url, visible);
  return <div ref={host} className={`relative ${className}`}>
    {image.src ? <img src={image.src} alt={alt} width={selected?.width} height={selected?.height}
      decoding="async" onError={() => { if (selected) setDecodeFailures(previous => [...previous, selected.url]); }} className="h-full w-full object-contain" />
      : <span role={image.failed ? 'status' : undefined} className="flex h-full min-h-12 items-center justify-center bg-black/5 px-2 text-center text-xs text-stone-500">
        {image.failed || decodeFailures.length > 0 && !selected ? 'Фото недоступно' : selected ? 'Загрузка фото…' : 'Фото готовится'}
      </span>}
    {showRetry && (image.failed || decodeFailures.length > 0) && <button type="button" className="absolute bottom-2 left-2 min-h-11 rounded-lg bg-black/70 px-3 text-xs text-white" onClick={event => { event.stopPropagation(); setDecodeFailures([]); image.retry(); }}>Повторить</button>}
  </div>;
}
