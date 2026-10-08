import { useEffect, useState } from 'react';
import type { PhotoMetadataDto } from '../api/admin';
import { httpClient } from '../api/core/httpClient';
import { Dialog, DialogContent, DialogTitle } from './ui/Dialog';

export default function ModerationPhotos({ photos }: { photos: PhotoMetadataDto[] }) {
  const [images, setImages] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const urls = JSON.stringify([...photos].sort((a, b) => a.sortIndex - b.sortIndex).flatMap(photo => photo.fullUrl ? [photo.fullUrl] : []));
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
  }, [urls, retry]);
  return <div className="mt-2">
    <div className="flex flex-wrap gap-2">{images.map((src, index) => <button key={src} type="button" aria-label={`Открыть фотографию ${index + 1}`} onClick={() => setSelected(src)}><img src={src} alt="" className="h-20 w-20 rounded-lg object-cover" /></button>)}</div>
    {failed && <button type="button" className="mt-2 min-h-11 text-xs underline" onClick={() => setRetry(value => value + 1)}>Фото недоступны. Повторить</button>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent><DialogTitle>Фотография чекина</DialogTitle>{selected && <img src={selected} alt="Фотография посещения" className="max-h-[70vh] w-full object-contain" />}</DialogContent></Dialog>
  </div>;
}
