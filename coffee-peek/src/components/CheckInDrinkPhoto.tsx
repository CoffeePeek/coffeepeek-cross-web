import { useState, type ReactNode } from 'react';
import type { CheckInPhotoVariant } from '../api/coffeeshop';
import { CheckInPhotoViewer } from './CheckInPhotos';
import ProtectedPhoto from './ProtectedPhoto';

export default function CheckInDrinkPhoto({ url, variants, alt, thumbnail = false, crop = false, thumbnailSize = 56, fallback, preview = false, onOpen }: { url?: string | null; variants?: CheckInPhotoVariant[] | null; alt: string; thumbnail?: boolean; crop?: boolean; thumbnailSize?: number; fallback?: ReactNode; preview?: boolean; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  if (!url) return fallback || null;
  return <div className={thumbnail ? 'relative flex shrink-0 items-center justify-center' : 'relative mt-3'} style={thumbnail ? { width: thumbnailSize, height: thumbnailSize } : { height: 288 }}>
    <ProtectedPhoto key={url} photo={{ url, variants }} purpose={thumbnail ? 'thumb' : 'feed'} alt={alt}
      className={`h-full w-full ${crop ? 'overflow-hidden rounded-xl [&_img]:object-cover' : ''}`} />
    {preview && <button type="button" aria-label={`Посмотреть фото напитка: ${alt}`} onClick={() => { setOpen(true); onOpen?.(); }} className="absolute inset-0 rounded-xl border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#EAB308]" />}
    {open && preview && <CheckInPhotoViewer photos={[{ url, variants }]} title={alt} onClose={() => setOpen(false)} />}
  </div>;
}
