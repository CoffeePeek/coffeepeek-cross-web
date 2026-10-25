import { useEffect, useId, useRef, useState } from 'react';
import { DotsSixVertical } from '@phosphor-icons/react';
import CheckInPhotoThumb from './CheckInPhotoThumb';
import PhotoLightbox from './PhotoLightbox';

function SelectedPhotoViewer({ files, initialIndex, onClose }: {
  files: File[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = files.map(file => URL.createObjectURL(file));
    setUrls(next);
    return () => next.forEach(url => URL.revokeObjectURL(url));
  }, [files]);
  return urls.length > 0 ? <PhotoLightbox images={urls} initialIndex={initialIndex} shopName="Фотографии чекина" onClose={onClose} /> : null;
}

export default function CheckInPhotoGallery({ files, onChange, disabled = false }: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const instructionsId = useId();
  const list = useRef<HTMLUListElement>(null);
  const pointerDrag = useRef<{ file: File; pointerId: number; x: number; y: number; moved: boolean; target: File | null } | null>(null);
  const [draggedFile, setDraggedFile] = useState<File | null>(null);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ files: File[]; index: number } | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const resetDrag = () => {
    pointerDrag.current = null;
    setDraggedFile(null);
    setTargetFile(null);
  };

  const move = (source: File, target: File) => {
    const from = files.indexOf(source);
    const to = files.indexOf(target);
    if (disabled || from < 0 || to < 0 || from === to) return;
    const next = [...files];
    next.splice(from, 1);
    next.splice(to, 0, source);
    onChange(next);
    setAnnouncement(`Фото ${from + 1} перемещено на место ${to + 1} из ${files.length}`);
  };

  return <>
    {files.length > 0 && <p id={instructionsId} className="mt-2 text-xs opacity-70">
      Нажмите на фото для просмотра. {files.length > 1 && 'Меняйте порядок перетаскиванием за ручку «Порядок» или стрелками на клавиатуре.'}
    </p>}
    <ul ref={list} aria-label="Добавленные фотографии" className="mt-3 flex list-none flex-wrap gap-3 p-0">
      {files.map((file, index) => <li
        key={`${file.name}:${file.size}:${file.lastModified}:${files.slice(0, index).filter(other => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified).length}`}
        data-photo-index={index}
        draggable={!disabled && files.length > 1}
        onDragStart={event => {
          if (disabled || pointerDrag.current) { event.preventDefault(); return; }
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', String(index));
          setDraggedFile(file);
        }}
        onDragOver={event => {
          if (!draggedFile || disabled) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setTargetFile(file);
        }}
        onDrop={event => {
          event.preventDefault();
          if (draggedFile) move(draggedFile, file);
          resetDrag();
        }}
        onDragEnd={resetDrag}
        className={`w-24 shrink-0 rounded-2xl ${draggedFile === file ? 'opacity-50' : ''} ${targetFile === file && draggedFile !== file ? 'ring-2 ring-[#EAB308] ring-offset-2 ring-offset-transparent' : ''}`}
      >
        <CheckInPhotoThumb file={file} index={index} total={files.length} disabled={disabled}
          onOpen={() => { if (!draggedFile) setPreview({ files: [...files], index }); }}
          onRemove={() => { onChange(files.filter((_, position) => position !== index)); setAnnouncement(`Фото ${index + 1} удалено`); }} />
        {files.length > 1 && <button
          type="button"
          disabled={disabled}
          aria-label={`Переместить фото ${index + 1}: ${file.name}`}
          aria-describedby={instructionsId}
          className="flex min-h-11 w-full touch-none select-none items-center justify-center gap-1 rounded-xl border-0 bg-transparent p-0 text-xs opacity-70 hover:bg-[#EAB308]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#EAB308] disabled:opacity-40"
          style={{ cursor: draggedFile === file ? 'grabbing' : 'grab' }}
          onKeyDown={event => {
            if (event.key === 'Escape') { resetDrag(); return; }
            const to = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? index - 1
              : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? index + 1
                : event.key === 'Home' ? 0 : event.key === 'End' ? files.length - 1 : null;
            if (to === null) return;
            event.preventDefault();
            if (files[to]) move(file, files[to]);
          }}
          onPointerDown={event => {
            if (disabled || !event.isPrimary || event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            pointerDrag.current = { file, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, target: null };
          }}
          onPointerMove={event => {
            const drag = pointerDrag.current;
            if (!drag || drag.pointerId !== event.pointerId || disabled) return;
            if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
            drag.moved = true;
            setDraggedFile(drag.file);
            const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-photo-index]');
            if (element && list.current?.contains(element)) {
              drag.target = files[Number(element.dataset.photoIndex)];
              setTargetFile(drag.target);
            } else {
              drag.target = null;
              setTargetFile(null);
            }
          }}
          onPointerUp={event => {
            const drag = pointerDrag.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            if (drag.moved && drag.target) move(drag.file, drag.target);
            resetDrag();
          }}
          onPointerCancel={resetDrag}
          onLostPointerCapture={resetDrag}
        ><DotsSixVertical size={18} aria-hidden />Порядок</button>}
      </li>)}
    </ul>
    <p role="status" className="sr-only">{announcement}</p>
    {preview && <SelectedPhotoViewer files={preview.files} initialIndex={preview.index} onClose={() => setPreview(null)} />}
  </>;
}
