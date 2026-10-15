import { Coffee } from '@phosphor-icons/react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/theme';
import CheckInDrinkPhoto from './CheckInDrinkPhoto';

export default function CheckInDrink({ name, photoUrl, onPhotoOpen }: { name: string; photoUrl?: string | null; onPhotoOpen?: () => void }) {
  const { theme } = useTheme();
  const classes = getThemeClasses(theme);
  if (!name && !photoUrl) return null;
  const label = name || 'Напиток';

  return <div className={`ml-auto flex min-w-0 max-w-[65%] items-center gap-2 text-left text-sm font-medium ${classes.text.secondary}`}>
    <CheckInDrinkPhoto url={photoUrl} alt={label} thumbnail thumbnailSize={80} preview onOpen={onPhotoOpen} fallback={<Coffee aria-hidden="true" size={32} />} />
    <span className="min-w-0 break-words">{label}</span>
  </div>;
}
