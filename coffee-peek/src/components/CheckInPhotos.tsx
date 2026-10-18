import { useState } from 'react';
import type { CheckInPhoto } from '../api/coffeeshop';
import PhotoLightbox from './PhotoLightbox';
import ProtectedPhoto from './ProtectedPhoto';

type Photo = Pick<CheckInPhoto, 'url' | 'variants'>;

export function CheckInPhotoViewer({ photos, initialIndex = 0, title, onClose }: {
  photos: Photo[]; initialIndex?: number; title: string; onClose: () => void;
}) {
  const [original, setOriginal] = useState<number | null>(null);
  return <PhotoLightbox images={photos.map(photo => photo.url)} initialIndex={initialIndex} shopName={title} onClose={onClose}
    onOriginal={setOriginal} renderImage={index => <ProtectedPhoto key={`${index}:${original === index}`} photo={original === index ? { url: photos[index].url } : photos[index]}
      purpose="detail" showRetry alt={`${title} — фото ${index + 1}`} className="h-full w-full" />} />;
}

export default function CheckInPhotos({ photos, shopName }: { photos: CheckInPhoto[]; shopName: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  if (!photos.length) return null;
  return <div className="mt-4">
    <div className={`grid gap-1 overflow-hidden rounded-xl ${photos.length === 1 ? 'aspect-[3/2]' : photos.length > 3 ? 'aspect-[5/4] grid-cols-2 grid-rows-2' : 'aspect-[5/3] grid-cols-2'} ${photos.length === 3 ? 'grid-rows-2' : ''}`}>
      {photos.slice(0, 4).map((photo, index) => <div key={photo.id} className={`relative min-h-0 min-w-0 overflow-hidden rounded-lg ${photos.length === 3 && index === 0 ? 'row-span-2' : ''}`}>
        <ProtectedPhoto photo={photo} purpose="feed" className="h-full w-full [&_img]:object-cover" />
        <button type="button" onClick={() => setSelected(index)} aria-label={`Открыть фото ${index + 1} из ${photos.length} в чекине`} className="absolute inset-0 border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#EAB308]">
          {index === 3 && photos.length > 4 && <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/45 text-2xl font-bold text-white">+{photos.length - 4}</span>}
        </button>
      </div>)}
    </div>
    {selected !== null && <CheckInPhotoViewer photos={photos} initialIndex={selected} title={shopName} onClose={() => setSelected(null)} />}
  </div>;
}
