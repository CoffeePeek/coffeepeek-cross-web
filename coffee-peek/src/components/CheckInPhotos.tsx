import { useEffect, useState } from 'react';
import { getCheckInPhotoBlob } from '../api/photos';
import type { CheckInPhoto } from '../api/coffeeshop';
import { useUser } from '../contexts/UserContext';
import PhotoLightbox from './PhotoLightbox';
import Shimmer from './skeletons/Shimmer';

export default function CheckInPhotos({ photos, shopName, feed = false }: { photos: CheckInPhoto[]; shopName: string; feed?: boolean }) {
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
      const blob = await getCheckInPhotoBlob(url, controller.signal);
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
    {!images.length && !failed && <Shimmer width="100%" height="auto" className={`${feed ? 'aspect-[2/1] sm:aspect-[3/2]' : 'aspect-[3/2]'} rounded-xl`} />}
    {images.length > 0 && <div className={`grid gap-1 overflow-hidden rounded-xl ${images.length === 1 ? feed ? 'aspect-[2/1]' : 'aspect-[3/2]' : 'aspect-[4/3] grid-cols-2 grid-rows-2'} ${images.length === 2 ? 'grid-rows-1' : ''}`}>
      {images.slice(0, 3).map((src, index) => <button key={src} type="button" onClick={() => setSelected(index)} aria-label={`Открыть фото ${index + 1} из ${images.length} в чекине`} className={`relative min-h-0 min-w-0 overflow-hidden rounded-lg border-0 p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#EAB308] ${images.length >= 3 && index === 0 ? 'row-span-2' : ''}`}>
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
        {index === 2 && images.length > 3 && <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/45 text-2xl font-bold text-white">+{images.length - 3}</span>}
      </button>)}
    </div>}
    {failed && <button type="button" className="mt-2 min-h-11 text-sm underline" onClick={() => setRetry(value => value + 1)}>Не удалось загрузить фото. Повторить</button>}
    {selected !== null && <PhotoLightbox images={images} initialIndex={selected} shopName={shopName} onClose={() => setSelected(null)} />}
  </div>;
}
