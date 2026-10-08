import { useEffect, useState } from 'react';
import { X } from './Icon';

export default function CheckInPhotoThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl">
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Удалить фото"
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
