import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, X } from '../Icon';

interface PhotoUploadFieldProps {
  id: string;
  title: string;
  description: string;
  files: File[];
  maxFiles: number;
  onSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
}

export function PhotoUploadField({ id, title, description, files, maxFiles, onSelect, onRemove }: PhotoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.some((file) => !file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif|gif|avif)$/i.test(file.name))) {
      setError('Выберите файлы изображений');
    } else {
      setError(selected.length + files.length > maxFiles ? `Можно добавить до ${maxFiles} фотографий` : null);
      onSelect(event);
    }
    event.target.value = '';
  };

  return (
    <section className="shop-wizard-photo-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      <p className="shop-wizard-muted">{description}</p>
      <p className="shop-wizard-photo-count" aria-live="polite">Добавлено: {files.length}/{maxFiles}</p>
      <input ref={inputRef} id={id} type="file" accept="image/*" multiple onChange={selectFiles} hidden />
      <div className="shop-wizard-photo-grid">
        {files.map((file, index) => (
          <div className="shop-wizard-photo" key={`${file.name}-${file.lastModified}-${index}`}>
            {previews[index] && <img src={previews[index]} alt={`${title}: ${index + 1}`} />}
            <button type="button" className="shop-wizard-remove-photo" onClick={() => onRemove(index)} aria-label={`Удалить фото ${index + 1} из раздела «${title}»`}><X size={16} /></button>
          </div>
        ))}
        {files.length < maxFiles && (
          <button type="button" className="shop-wizard-add-photo" onClick={() => inputRef.current?.click()} aria-label={`Добавить ${title.toLowerCase()}`}>
            <Camera size={30} weight="light" />
          </button>
        )}
      </div>
      {error && <p className="shop-wizard-error" role="alert">{error}</p>}
    </section>
  );
}
