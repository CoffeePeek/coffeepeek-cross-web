import { useEffect, useState } from 'react';
import { getCheckInPhotoBlob } from '../api/photos';
import { useUser } from '../contexts/UserContext';

export default function CheckInDrinkPhoto({ url, alt, thumbnail = false, crop = false }: { url?: string | null; alt: string; thumbnail?: boolean; crop?: boolean }) {
  const { user } = useUser();
  const [source, setSource] = useState('');
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let objectUrl = '';
    setSource(''); setError(false);
    void getCheckInPhotoBlob(url, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, retry, user?.id]);
  if (!url) return null;
  return <div className={thumbnail ? 'h-14 w-14 shrink-0' : 'mt-3'}>{source && <img src={source} alt={alt} className={thumbnail ? `h-14 w-14 rounded-xl ${crop ? 'object-cover' : 'object-contain'}` : 'max-h-72 w-full rounded-2xl object-contain'} />}{error && <button type="button" className="min-h-11 text-sm underline" onClick={() => setRetry(value => value + 1)}>Повторить фото</button>}</div>;
}
