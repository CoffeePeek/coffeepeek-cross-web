import { useEffect, useState } from 'react';
import { httpClient } from '../api/core/httpClient';
import type { CheckInPhoto } from '../api/coffeeshop';
import { useUser } from '../contexts/UserContext';
import PhotoLightbox from './PhotoLightbox';

export default function CheckInPhotos({ photos, shopName }: { photos: CheckInPhoto[]; shopName: string }) {
  const { user } = useUser();
  const userId = user?.id;
  const [images, setImages] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const urls = JSON.stringify(photos.map(photo => photo.url));

  useEffect(() => {
    const controller = new AbortController();
    const loaded: string[] = [];
    setImages([]);
    setFailed(false);
    setSelected(null);
    void Promise.allSettled((JSON.parse(urls) as string[]).map(async url => {
      const blob = await httpClient.getBlob(url, controller.signal);
      if (controller.signal.aborted) return '';
      const image = URL.createObjectURL(blob);
      loaded.push(image);
      return image;
    })).then(results => {
      if (controller.signal.aborted) return;
      setImages(results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []));
      setFailed(results.some(result => result.status === 'rejected'));
    });
    return () => { controller.abort(); loaded.forEach(URL.revokeObjectURL); };
  }, [urls, retry, userId]);

  if (!photos.length) return null;
  return <div className="mt-4">
    <div className="flex gap-2 overflow-x-auto rounded-2xl">
      {images.map((src, index) => <button key={src} type="button" onClick={() => setSelected(index)} aria-label={`Открыть фото ${index + 1} из чекина`} className={`aspect-square shrink-0 overflow-hidden rounded-2xl ${images.length === 1 ? 'w-full max-w-sm' : 'w-[calc(50%-4px)] max-w-48'}`}><img src={src} alt="" className="h-full w-full object-cover" /></button>)}
    </div>
    {failed && <button type="button" className="mt-2 min-h-11 text-sm underline" onClick={() => setRetry(value => value + 1)}>Не удалось загрузить фото. Повторить</button>}
    {selected !== null && <PhotoLightbox images={images} initialIndex={selected} shopName={shopName} onClose={() => setSelected(null)} />}
  </div>;
}
