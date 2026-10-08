import DrinkSelector from './DrinkSelector';
import React, { useEffect, useState, type ChangeEvent } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { brand, getThemeColors } from '../design-system/tokens';
import Mascot, { type MascotPose } from './Mascot';
import { StarIcon } from './icons';
import { CalendarBlank, Camera, CaretDown, MapPin, X } from './Icon';
import WobbleRing from './WobbleRing';
import { CHECK_IN_LIMITS, todayInputValue } from '../utils/checkInForm';
import { MAX_CHECKIN_PHOTOS } from '../api/photos';

interface RatingColumn {
  key: 'coffee' | 'service' | 'place';
  label: string;
  pose: MascotPose;
  value: number;
  onChange: (value: number) => void;
}

interface CheckInFormProps {
  drinkSlug: string;
  customDrinkName: string;
  onDrinkChange: (slug: string, name: string) => void;
  shopName: string;
  note: string;
  onNoteChange: (value: string) => void;
  isPublic: boolean;
  onPublicChange: (value: boolean) => void;
  visitedDate: string;
  onVisitedDateChange: (value: string) => void;
  ratingCoffee: number;
  ratingService: number;
  ratingPlace: number;
  onRatingCoffee: (value: number) => void;
  onRatingService: (value: number) => void;
  onRatingPlace: (value: number) => void;
  selectedFiles: File[];
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  uploadingPhotos?: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
}

const StarRow: React.FC<{
  value: number;
  onChange: (value: number) => void;
  label: string;
  emptyColor: string;
}> = ({ value, onChange, label, emptyColor }) => (
  <div className="flex items-center justify-center gap-0.5" role="radiogroup" aria-label={label}>
    {[1, 2, 3, 4, 5].map((star) => {
      const filled = star <= value;
      return (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={filled && star === value}
          aria-label={`${star} из 5`}
          onClick={() => onChange(star)}
          className="rounded-md p-1 transition-transform hover:scale-110"
        >
          <StarIcon
            filled={filled}
            size={34}
            color={filled ? brand.primary : emptyColor}
          />
        </button>
      );
    })}
  </div>
);

export const PhotoThumb: React.FC<{ file: File; onRemove: () => void }> = ({ file, onRemove }) => {
  const [src, setSrc] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl">
      {src && <img src={src} alt="" className="w-full h-full object-cover" />}
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
};

const CheckInForm: React.FC<CheckInFormProps> = ({
  drinkSlug,
  customDrinkName,
  onDrinkChange,
  shopName,
  note,
  onNoteChange,
  isPublic,
  onPublicChange,
  visitedDate,
  onVisitedDateChange,
  ratingCoffee,
  ratingService,
  ratingPlace,
  onRatingCoffee,
  onRatingService,
  onRatingPlace,
  selectedFiles,
  onFileSelect,
  onRemoveFile,
  uploadingPhotos,
  isSubmitting,
  onSubmit,
}) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const gold = brand.primary;
  const isDark = theme === 'dark';
  const emptyStar = isDark ? '#5C544F' : '#D6D3D1';
  const cardShadow = isDark ? 'none' : '0 4px 16px rgba(28, 25, 23, 0.08)';
  const fieldBorder = `1px solid ${colors.border}`;

  const columns: RatingColumn[] = [
    { key: 'coffee', label: 'Кофе', pose: 'cup', value: ratingCoffee, onChange: onRatingCoffee },
    { key: 'service', label: 'Сервис', pose: 'dessert', value: ratingService, onChange: onRatingService },
    { key: 'place', label: 'Атмосфера', pose: 'dance', value: ratingPlace, onChange: onRatingPlace },
  ];

  const formattedDate = new Date(`${visitedDate}T12:00:00`).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <fieldset disabled={isSubmitting} className="m-0 flex min-w-0 flex-col gap-7 border-0 p-0">
      <header className="space-y-2">
        <h2
          className="font-extended text-[28px] font-bold leading-none tracking-tight"
          style={{ color: colors.textPrimary }}
        >
          Чекин
        </h2>
        <p className="flex items-center gap-1.5 min-w-0">
          <MapPin size={18} className="shrink-0" />
          <span
            className="truncate font-body text-base"
            style={{ color: colors.textSecondary }}
          >
            {shopName}
          </span>
        </p>
      </header>

      <DrinkSelector drinkSlug={drinkSlug} customDrinkName={customDrinkName} onChange={onDrinkChange} />

      <section aria-labelledby="checkin-ratings-title">
        <h3 id="checkin-ratings-title" className="font-extended text-xl font-bold" style={{ color: colors.textPrimary }}>Ваши оценки</h3>
        <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>Нажмите на звёзды, чтобы изменить оценку</p>
        <div className="mt-3 space-y-2.5">
          {columns.map((col) => (
            <div key={col.key} className="grid min-h-[112px] grid-cols-[72px_1fr] items-center gap-2 rounded-2xl px-3 py-3" style={{ backgroundColor: isDark ? colors.surface : '#FFFFFF', boxShadow: cardShadow }}>
              <Mascot pose={col.pose} size={68} eager />
              <div className="min-w-0">
                <span className="block font-extended text-xl font-semibold" style={{ color: colors.textPrimary }}>{col.label}</span>
                <div className="mt-2 flex justify-start">
                  <StarRow value={col.value} onChange={col.onChange} label={col.label} emptyColor={emptyStar} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-2">
        <label
          htmlFor="checkin-date"
          className="block font-body text-base"
          style={{ color: colors.textSecondary }}
        >
          Дата посещения
        </label>
        <div className="relative">
          <div className="flex min-h-14 items-center gap-3 rounded-2xl px-4" style={{ backgroundColor: isDark ? colors.input : '#FFFFFF', color: colors.textPrimary, border: fieldBorder }}>
            <CalendarBlank size={22} color={colors.textSecondary} />
            <span className="min-w-0 flex-1 text-base">{formattedDate}</span>
            <CaretDown size={20} color={colors.textSecondary} />
          </div>
          <input
            id="checkin-date"
            type="date"
            max={todayInputValue()}
            value={visitedDate}
            onChange={(e) => onVisitedDateChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            style={{ colorScheme: theme }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-extended text-xl font-bold" style={{ color: colors.textPrimary }}>Сделать публичным</p>
          <p className="mt-1 font-body text-sm leading-relaxed" style={{ color: colors.textSecondary }}>Публичный чекин появится в ленте после модерации. Личный виден только вам.</p>
        </div>
        <button type="button" role="switch" aria-label="Сделать чекин публичным" aria-checked={isPublic} onClick={() => onPublicChange(!isPublic)} className="inline-flex h-10 w-16 shrink-0 appearance-none items-center rounded-full border-0 p-1" style={{ backgroundColor: isPublic ? gold : isDark ? '#4A3830' : '#D6D3D1' }}>
          <span className="block h-8 w-8 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out" style={{ transform: isPublic ? 'translateX(24px)' : 'translateX(0)' }} />
        </button>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="checkin-note"
          className="block font-body text-base"
          style={{ color: colors.textSecondary }}
        >
          Текст чекина (обязательно)
        </label>
        <textarea
          id="checkin-note"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Расскажите о вашем визите..."
          required
          minLength={CHECK_IN_LIMITS.noteMin}
          maxLength={CHECK_IN_LIMITS.noteMax}
          aria-describedby="checkin-note-hint"
          rows={4}
          className="w-full resize-none rounded-3xl px-4 py-4 font-body text-base outline-none placeholder:opacity-50"
          style={{
            backgroundColor: isDark ? colors.input : '#FFFFFF',
            color: colors.textPrimary,
            border: fieldBorder,
          }}
        />
        <p id="checkin-note-hint" className="font-body text-xs" style={{ color: colors.textSecondary }}>
            От 1 до 1000 символов
          </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="font-extended text-xl font-bold" style={{ color: colors.textPrimary }}>Фото (необязательно)</p>
          <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>Добавьте до {MAX_CHECKIN_PHOTOS} фото вашего визита.</p>
          <p className="mt-2 text-base font-semibold" style={{ color: colors.textPrimary }}>Добавлено: {selectedFiles.length}/{MAX_CHECKIN_PHOTOS}</p>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {selectedFiles.length < MAX_CHECKIN_PHOTOS && <label htmlFor="checkin-photos" className="flex h-28 w-24 shrink-0 cursor-pointer items-center justify-center rounded-2xl border" style={{ borderColor: colors.border, backgroundColor: isDark ? colors.surface : '#FFFFFF', color: colors.textSecondary }} aria-label="Добавить фото"><Camera size={30} /></label>}
          <input id="checkin-photos" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/avif" multiple className="hidden" onChange={onFileSelect} />
          {selectedFiles.map((file, index) => <PhotoThumb key={`${file.name}-${file.size}-${index}`} file={file} onRemove={() => onRemoveFile(index)} />)}
        </div>
        {uploadingPhotos && <div className="flex items-center gap-2 py-1" style={{ color: colors.textSecondary }}><WobbleRing size={16} /><span className="font-body text-xs">Загрузка фотографий...</span></div>}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="flex min-h-14 w-full items-center justify-center rounded-full font-extended text-lg font-bold text-[#1A1412] transition-all active:scale-[0.98] disabled:opacity-50"
        style={{ backgroundColor: gold }}
      >
        {isSubmitting ? (
          <>
            <WobbleRing size={18} color="#1A1412" />
            Создание...
          </>
        ) : (
          'Чекин'
        )}
      </button>
    </fieldset>
  );
};

export default CheckInForm;
