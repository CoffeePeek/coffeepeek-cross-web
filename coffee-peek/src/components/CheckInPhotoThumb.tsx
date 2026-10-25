import { useEffect, useState } from 'react';
import { X } from './Icon';

export default function CheckInPhotoThumb({ file, index, total, onOpen, onRemove, disabled = false }: {
  file: File;
  index: number;
  total: number;
  onOpen: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        aria-label={`Открыть фото ${index + 1} из ${total}: ${file.name}`}
        className="h-full w-full cursor-zoom-in p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#EAB308]"
      >
        {src && <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />}
        <span aria-hidden="true" className="absolute bottom-1 left-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-black/70 px-1 text-xs font-bold text-white">{index + 1}</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Удалить фото ${index + 1}: ${file.name}`}
        className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent p-0 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#EAB308] disabled:opacity-40"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70"><X size={14} weight="bold" /></span>
      </button>
    </div>
  );
}
