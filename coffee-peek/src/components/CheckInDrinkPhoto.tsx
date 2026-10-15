import { useEffect, useState, type ReactNode } from 'react';
import { getCheckInPhotoBlob } from '../api/photos';
import { useUser } from '../contexts/UserContext';
import PhotoLightbox from './PhotoLightbox';

export default function CheckInDrinkPhoto({ url, alt, thumbnail = false, crop = false, thumbnailSize = 56, fallback, preview = false, onOpen }: { url?: string | null; alt: string; thumbnail?: boolean; crop?: boolean; thumbnailSize?: number; fallback?: ReactNode; preview?: boolean; onOpen?: () => void }) {
  const { user } = useUser();
  const [source, setSource] = useState('');
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setSource(''); setError(false); setOpen(false);
    if (!url) return;
    const controller = new AbortController();
    let objectUrl = '';
    void getCheckInPhotoBlob(url, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, retry, user?.id]);
  if (!url && !fallback) return null;
  const photo = source && <img src={source} alt={alt} className={thumbnail ? `h-full w-full ${crop ? 'rounded-xl object-cover' : 'object-contain'}` : 'max-h-72 w-full rounded-2xl object-contain'} onError={() => { setSource(''); setError(true); }} />;
  return <div className={thumbnail ? 'flex shrink-0 items-center justify-center' : 'mt-3'} style={thumbnail ? { width: thumbnailSize, height: thumbnailSize } : undefined}>
    {source ? preview ? <button type="button" aria-label={`Посмотреть фото напитка: ${alt}`} onClick={() => { setOpen(true); onOpen?.(); }} className="h-full w-full rounded-xl border-0 p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#EAB308]">{photo}</button> : photo : error ? <button type="button" aria-label="Не удалось загрузить фото напитка. Повторить" className="flex min-h-11 items-center justify-center rounded-xl border-0 p-0 text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#EAB308]" onClick={() => setRetry(value => value + 1)}>{fallback || 'Повторить фото'}</button> : fallback}
    {open && source && <PhotoLightbox images={[source]} shopName={alt} onClose={() => setOpen(false)} />}
  </div>;
}
