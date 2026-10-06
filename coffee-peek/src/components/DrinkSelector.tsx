import { useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getConsumedDrinks } from '../api/consumedDrinks';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../design-system/tokens';
import { AppIcon } from './icons';

interface Props {
  drinkSlug: string;
  customDrinkName: string;
  onChange: (slug: string, name: string) => void;
  savedName?: string;
  disabled?: boolean;
}

export default function DrinkSelector({ drinkSlug, customDrinkName, onChange, savedName, disabled }: Props) {
  const id = useId();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { data: drinks = [], isPending, isError, refetch } = useQuery({ queryKey: ['catalogs', 'consumed-drinks'], queryFn: getConsumedDrinks });
  const isEnglish = typeof document !== 'undefined' && document.documentElement.lang.toLowerCase().startsWith('en');
  const style = { backgroundColor: colors.input, color: colors.textPrimary, borderColor: colors.border };
  return (
    <div className="space-y-2" style={{ color: colors.textPrimary }}>
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold"><AppIcon name="coffee" size={18} />Напиток (необязательно)</label>
      <div className="relative"><select id={id} value={drinkSlug} disabled={disabled || isPending} onChange={e => onChange(e.target.value, '')} className="min-h-14 w-full appearance-none rounded-2xl border pl-4 pr-12 focus-visible:outline focus-visible:outline-2" style={style}>
        <option value="">Без напитка</option>
        {drinkSlug && !drinks.some(drink => drink.slug === drinkSlug) && <option value={drinkSlug}>{savedName || (drinkSlug === 'other' ? 'Другое' : drinkSlug)}</option>}
        {drinks.map(drink => <option key={drink.slug} value={drink.slug}>{isEnglish ? drink.nameEn || drink.nameRu : drink.nameRu || drink.nameEn}</option>)}
        {isError && drinkSlug !== 'other' && <option value="other">Другое</option>}
      </select><AppIcon name="caret-up-down" size={20} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" /></div>
      {isPending && <p className="text-sm" role="status">Загрузка напитков…</p>}
      {isError && <p className="text-sm" role="status">Не удалось загрузить напитки. <button type="button" disabled={disabled} onClick={() => void refetch()} className="underline">Повторить</button></p>}
      {drinkSlug === 'other' && <>
        <label htmlFor={`${id}-name`} className="block text-sm">Название напитка</label>
        <input id={`${id}-name`} value={customDrinkName} disabled={disabled} onChange={e => onChange(drinkSlug, e.target.value)} maxLength={100} required placeholder="Например, эспрессо-тоник" className="min-h-14 w-full rounded-2xl border px-4 focus-visible:outline focus-visible:outline-2" style={style} />
        <p className="text-xs" style={{ color: colors.textSecondary }}>От 1 до 100 символов</p>
      </>}
    </div>
  );
}
