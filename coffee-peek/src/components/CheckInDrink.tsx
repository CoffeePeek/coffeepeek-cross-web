import { Coffee } from '@phosphor-icons/react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/theme';
import CheckInDrinkPhoto from './CheckInDrinkPhoto';
import type { CheckInPhotoVariant } from '../api/coffeeshop';

export default function CheckInDrink({ name, photoUrl, variants, onPhotoOpen }: { name: string; photoUrl?: string | null; variants?: CheckInPhotoVariant[] | null; onPhotoOpen?: () => void }) {
  const { theme } = useTheme();
  const classes = getThemeClasses(theme);
  if (!name && !photoUrl) return null;
  const label = name || 'Напиток';

  return <div className={`ml-auto flex min-w-0 max-w-[65%] items-center gap-2 text-left text-sm font-medium ${classes.text.secondary}`}>
    <CheckInDrinkPhoto url={photoUrl} variants={variants} alt={label} thumbnail thumbnailSize={photoUrl ? 80 : 32} preview onOpen={onPhotoOpen} fallback={<Coffee aria-hidden="true" size={32} />} />
    <span className="min-w-0 break-words">{label}</span>
  </div>;
}
