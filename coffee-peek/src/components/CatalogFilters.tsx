import { useEffect, useId, useRef } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { FacetGroup } from '../api/discovery';
import { filterSchemas, normalizeFilters, type CatalogKind } from '../utils/catalogSearch';
import { catalogButton } from './CatalogCards';
import { FilterAccordion, OptionRow } from './ShopFilterPanel';
import { useTheme } from '../contexts/ThemeContext';
import { COLORS, getThemeColors } from '../constants/colors';

export const catalogInput = 'mt-1 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:border-[#4A3D35] dark:bg-[#1A1412]';
const filterNames: Record<string, string> = { city: 'Город', tags: 'Тег', excludeTags: 'Без тега', roasters: 'Обжарщик', isOpen: 'Открыто сейчас', minRating: 'Рейтинг от', isNew: 'Новые кофейни', equipments: 'Оборудование', beans: 'Зёрна', brewMethods: 'Приготовление', priceRange: 'Уровень цен', type: 'Тип кофейни', visitedOnly: 'Посещённые', favoritesOnly: 'Избранное', radiusKm: 'Радиус, км', latitude: 'Широта', longitude: 'Долгота', brew: 'Приготовление', currency: 'Валюта', minPrice: 'Цена от', maxPrice: 'Цена до', volumeMl: 'Объём, мл', minDrinkPrice: 'Напиток от', maxDrinkPrice: 'Напиток до', drinkVolumeMl: 'Напиток, мл', minCoffeePrice: 'Пачка от', maxCoffeePrice: 'Пачка до', coffeeWeightGrams: 'Пачка, г', weightGrams: 'Вес, г', availableOnly: 'Только в наличии' };
export function activeFilterCount(filters: Record<string, unknown>): number {
  return Object.values(filters).reduce<number>((count, value) => count + (Array.isArray(value) ? value.length : value && typeof value === 'object' ? activeFilterCount(value as Record<string, unknown>) : value === undefined || value === false ? 0 : 1), 0);
}
export function FilterChips({ filters, groups, onChange }: { filters: Record<string, unknown>; groups: FacetGroup[]; onChange: (next: Record<string, unknown>) => void }) {
  const entries = Object.entries(filters).flatMap(([key, value]) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.entries(value).map(([nested, child]) => [`${key}.${nested}`, child] as const) : [[key, value] as const]);
  return <div className="my-4 flex flex-wrap gap-2">{entries.flatMap(([path, value]) => (Array.isArray(value) ? value : value === undefined || value === false ? [] : [value]).map(code => {
    const group = groups.find(group => group.code === path || (path === 'tags' && group.code === 'roasterTags'));
    const option = group?.options.find(option => option.code === String(code));
    return <button type="button" key={`${path}:${code}`} className={`${catalogButton} text-sm`} onClick={() => {
      const [key, nested] = path.split('.');
      const next = { ...filters };
      const container = nested ? { ...(next[key] as Record<string, unknown>) } : next;
      const target = nested ?? key;
      container[target] = Array.isArray(value) ? value.filter(item => item !== code) : target === 'availableOnly' ? false : undefined;
      if (nested) next[key] = container;
      onChange(normalizeFilters(next));
    }}>{path === 'excludeTags' ? 'Без тега ' : ''}{option?.name ?? (code === true ? filterNames[path] ?? 'Выбрано' : `${filterNames[path.split('.').at(-1)!] ?? group?.name ?? 'Значение'}: ${code}`)} ×</button>;
  }))}</div>;
}
export function CatalogFilters({ kind, filters, groups = [], errors = {}, onApply }: {
  kind: CatalogKind; filters: Record<string, unknown>; groups?: FacetGroup[];
  errors?: Record<string, string>; onApply: (value: Record<string, unknown>) => void;
}) {
  const id = useId();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const dark = theme === 'dark';
  const borderColor = dark ? '#3D2F28' : colors.border;
  const optionColors = { gold: COLORS.primary, textPrimary: dark ? '#fff' : '#1C1917' };
  const form = useForm<{ filters: Record<string, unknown> }>({
    defaultValues: { filters }, resolver: zodResolver(z.object({ filters: filterSchemas[kind] })) as Resolver<{ filters: Record<string, unknown> }>,
  });
  const filtersKey = JSON.stringify(filters);
  useEffect(() => { form.reset({ filters }); }, [filtersKey]);
  const draft = form.watch('filters');
  const draftKey = JSON.stringify(draft);
  const apply = useRef(onApply);
  apply.current = onApply;
  useEffect(() => {
    if (kind !== 'coffees' || draftKey === filtersKey) return;
    const timer = setTimeout(() => { void form.handleSubmit(values => apply.current(normalizeFilters(values.filters)))(); }, 350);
    return () => clearTimeout(timer);
  }, [draftKey, filtersKey, kind]);
  const get = (path: string): unknown => path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, draft);
  const put = (path: string, value: unknown) => {
    const [key, nested] = path.split('.');
    const current = form.getValues('filters');
    const next = { ...current };
    if (nested) next[key] = { ...(current[key] as Record<string, unknown> ?? {}), [nested]: value };
    else next[key] = value;
    const normalized = normalizeFilters(next);
    form.setValue('filters', normalized, { shouldDirty: true, shouldValidate: kind === 'coffees' });
  };
  const fieldError = (path: string) => {
    const local = path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, form.formState.errors.filters);
    return errors[path] ?? errors[`filters.${path}`] ?? (local as { message?: string } | undefined)?.message;
  };
  const errorNode = (path: string) => fieldError(path) ? <p id={`${id}-${path}-error`} role="alert" className="text-sm text-red-700 dark:text-red-300">{fieldError(path)}</p> : null;
  const numberField = (path: string, label: string, max?: number) => <div key={path}><label htmlFor={`${id}-${path}`}>{label}</label>
    <input id={`${id}-${path}`} className={catalogInput} type="number" min={path.includes('Price') ? 0 : 1} max={max} step={path.includes('Price') ? '0.01' : '1'}
      aria-invalid={!!fieldError(path)} aria-describedby={fieldError(path) ? `${id}-${path}-error` : undefined}
      value={get(path) as number ?? ''} onChange={event => put(path, event.target.value === '' ? undefined : Number(event.target.value))} />{errorNode(path)}</div>;
  const selectField = (path: string, label: string, options: { code: string; name: string; count?: number }[], numeric = false) => <div key={path}><label htmlFor={`${id}-${path}`}>{label}</label>
    <select id={`${id}-${path}`} className={catalogInput} value={String(get(path) ?? '')} aria-invalid={!!fieldError(path)} onChange={event => put(path, event.target.value ? numeric ? Number(event.target.value) : event.target.value : undefined)}>
      <option value="">Любой</option>{options.map(option => <option key={option.code} value={option.code}>{option.name}{option.count !== undefined ? ` (${option.count})` : ''}</option>)}
      {get(path) != null && !options.some(option => option.code === String(get(path))) && <option value={String(get(path))}>{String(get(path))} — сохранённое значение</option>}
    </select>{errorNode(path)}</div>;
  const groupControl = (group: FacetGroup) => {
    const path = group.code === 'roasterTags' ? 'tags' : group.code;
    if (group.selection === 'single') return selectField(path, group.name, group.options, path.endsWith('weightGrams'));
    const selected = get(path) as string[] | undefined ?? [];
    const missing = selected.filter(code => !group.options.some(option => option.code === code));
    return <fieldset key={group.code} className="space-y-1"><legend className="mb-2 font-semibold">{group.code === 'roasterTags' ? 'Услуги' : group.name}</legend>
      {group.options.map(option => kind === 'coffees' ? <OptionRow key={option.code} label={<span className="flex items-center justify-between gap-2"><span>{option.name}</span><span className="text-stone-600 dark:text-stone-300">({option.count})</span></span>} checked={selected.includes(option.code)} onClick={() => put(path, selected.includes(option.code) ? selected.filter(code => code !== option.code) : [...selected, option.code])} {...optionColors} /> : <label key={option.code} className="flex min-h-11 items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-yellow-600" checked={selected.includes(option.code)}
        onChange={() => put(path, selected.includes(option.code) ? selected.filter(code => code !== option.code) : [...selected, option.code])} /><span>{option.name} ({option.count})</span></label>)}
      {missing.map(code => <p key={code} role="alert">Значение «{code}» недоступно. <button type="button" className="underline" onClick={() => put(path, selected.filter(value => value !== code))}>Удалить фильтр</button></p>)}{errorNode(path)}
    </fieldset>;
  };
  const budgetFields = (prefix: string) => <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    {numberField(`${prefix}minPrice`, 'Цена от')}{numberField(`${prefix}maxPrice`, 'Цена до')}
  </div>;
  const coffeeSections = [
    { name: 'Тип продукта', codes: ['productKind', 'productForm'] }, { name: 'Степень обжарки', codes: ['roast'] },
    { name: 'Вкусовые ноты', codes: ['taste'] }, { name: 'Обжарщики', codes: ['roasters'] },
    { name: 'Способ обработки', codes: ['processing'] }, { name: 'Кислотность', codes: ['acidity'] },
    { name: 'Страны', codes: ['countries'] }, { name: 'Приготовление', codes: ['brew'] },
    { name: 'Кофеин', codes: ['caffeine'] }, { name: 'Ферментация', codes: ['fermentation'] },
    { name: 'Состав', codes: ['composition'] }, { name: 'Вес, валюта и цена', codes: ['weightGrams', 'currency'] },
    { name: 'Наличие', codes: ['availabilityScope'] },
  ];
  return <form onSubmit={kind === 'coffees' ? event => event.preventDefault() : form.handleSubmit(values => onApply(normalizeFilters(values.filters)))} className="space-y-5 text-sm">
    {kind === 'coffees' ? <div className="overflow-hidden rounded-[18px] border bg-white/80 shadow-sm backdrop-blur-[20px] dark:bg-white/[.035]" style={{ borderColor }}>
      {coffeeSections.map(section => <FilterAccordion key={section.name} title={section.name} count={section.codes.reduce((count, code) => count + (Array.isArray(get(code)) ? (get(code) as unknown[]).length : get(code) != null ? 1 : 0), 0)} defaultOpen={section.codes.some(code => get(code) != null)} muted={dark ? '#A39E93' : '#78716C'} textPrimary={optionColors.textPrimary} borderColor={borderColor}>
        <div className="space-y-3 [&_legend]:sr-only">{section.codes.map(code => { const group = groups.find(group => group.code === code); return group ? groupControl(group) : null; })}
          {section.codes.includes('acidity') && <button type="button" className={catalogButton} onClick={() => put('acidity', ['low', 'balanced'])}>Неяркая кислотность</button>}
          {section.codes.includes('currency') && budgetFields('')}
          {section.codes.includes('availabilityScope') && <OptionRow label="Только в наличии" checked={get('availableOnly') !== false} onClick={() => put('availableOnly', get('availableOnly') === false)} {...optionColors} />}
        </div>
      </FilterAccordion>)}
    </div> : kind === 'discovery' ? <>
      <fieldset><legend className="font-semibold">Приготовление</legend>{[{ code: 'espresso', name: 'Эспрессо' }, { code: 'filter', name: 'Фильтр' }].map(option => <label key={option.code} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={(get('brew') as string[] ?? []).includes(option.code)} onChange={event => put('brew', event.target.checked ? [...(get('brew') as string[] ?? []), option.code] : (get('brew') as string[]).filter(value => value !== option.code))} />{option.name}</label>)}</fieldset>
      {selectField('budget.currency', 'Валюта бюджета', [{ code: 'BYN', name: 'BYN' }, { code: 'RUB', name: 'RUB' }])}
      <fieldset className="space-y-3"><legend className="mb-2 font-semibold">Цена напитка</legend>{numberField('budget.minDrinkPrice', 'Напиток: цена от')}{numberField('budget.maxDrinkPrice', 'Напиток: цена до')}{numberField('budget.drinkVolumeMl', 'Объём напитка, мл', 5000)}</fieldset>
      <fieldset className="space-y-3"><legend className="mb-2 font-semibold">Цена пачки кофе</legend>{numberField('budget.minCoffeePrice', 'Пачка: цена от')}{numberField('budget.maxCoffeePrice', 'Пачка: цена до')}{numberField('budget.coffeeWeightGrams', 'Вес пачки, г', 100000)}</fieldset>
    </> : null}
    {kind !== 'coffees' && <div className="flex flex-wrap gap-2"><button type="submit" className={`${catalogButton} bg-yellow-400 text-stone-950`}>Применить</button><button type="button" className={catalogButton} onClick={() => form.reset({ filters: {} })}>Сбросить</button></div>}
    {form.formState.errors.filters?.message && <p role="alert">{String(form.formState.errors.filters.message)}</p>}
  </form>;
}
