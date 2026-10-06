import { useEffect, useId } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { FacetGroup, PublicTag } from '../api/discovery';
import { filterSchemas, normalizeFilters, type CatalogKind } from '../utils/catalogSearch';
import { catalogButton } from './CatalogCards';

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
export function CatalogFilters({ kind, filters, groups = [], tags = [], errors = {}, onApply }: {
  kind: CatalogKind; filters: Record<string, unknown>; groups?: FacetGroup[]; tags?: PublicTag[];
  errors?: Record<string, string>; onApply: (value: Record<string, unknown>) => void;
}) {
  const id = useId();
  const form = useForm<{ filters: Record<string, unknown> }>({
    defaultValues: { filters }, resolver: zodResolver(z.object({ filters: filterSchemas[kind] })) as Resolver<{ filters: Record<string, unknown> }>,
  });
  useEffect(() => { form.reset({ filters }); }, [filters]);
  const draft = form.watch('filters');
  const get = (path: string): unknown => path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, draft);
  const put = (path: string, value: unknown) => {
    const [key, nested] = path.split('.');
    const next = { ...draft };
    if (nested) next[key] = { ...(draft[key] as Record<string, unknown> ?? {}), [nested]: value };
    else next[key] = value;
    form.setValue('filters', normalizeFilters(next), { shouldDirty: true });
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
      {group.options.map(option => <label key={option.code} className="flex min-h-11 items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-yellow-600" checked={selected.includes(option.code)}
        onChange={() => put(path, selected.includes(option.code) ? selected.filter(code => code !== option.code) : [...selected, option.code])} /><span>{option.name} ({option.count})</span></label>)}
      {missing.map(code => <p key={code} role="alert">Значение «{code}» недоступно. <button type="button" className="underline" onClick={() => put(path, selected.filter(value => value !== code))}>Удалить фильтр</button></p>)}{errorNode(path)}
    </fieldset>;
  };
  const coffeePrefix = kind === 'roasters' ? 'coffee.' : '';
  const primary = new Set(['brew', 'caffeine', 'roast', 'acidity', 'roasters', 'weightGrams', 'currency']);
  const coffeeGroups = groups.filter(group => group.code !== 'roasterTags');
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
  return <form onSubmit={form.handleSubmit(values => onApply(normalizeFilters(values.filters)))} className="space-y-5 text-sm">
    {kind === 'coffees' ? <div className="divide-y divide-stone-200 dark:divide-[#3D2F28]">
      {coffeeSections.map(section => <details key={section.name} className="group" open={section.codes.some(code => get(code) != null) || undefined}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-4 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 [&::-webkit-details-marker]:hidden">{section.name}<span aria-hidden="true" className="text-2xl font-light text-stone-500 group-open:rotate-45">+</span></summary>
        <div className="space-y-3 pb-4 [&_legend]:sr-only">{section.codes.map(code => { const group = groups.find(group => group.code === code); return group ? groupControl(group) : null; })}
          {section.codes.includes('acidity') && <button type="button" className={catalogButton} onClick={() => put('acidity', ['low', 'balanced'])}>Неяркая кислотность</button>}
          {section.codes.includes('currency') && budgetFields('')}
          {section.codes.includes('availabilityScope') && <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={get('availableOnly') !== false} onChange={event => put('availableOnly', event.target.checked)} />Только в наличии</label>}
        </div>
      </details>)}
    </div> : kind === 'discovery' ? <>
      <fieldset><legend className="font-semibold">Приготовление</legend>{[{ code: 'espresso', name: 'Эспрессо' }, { code: 'filter', name: 'Фильтр' }].map(option => <label key={option.code} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={(get('brew') as string[] ?? []).includes(option.code)} onChange={event => put('brew', event.target.checked ? [...(get('brew') as string[] ?? []), option.code] : (get('brew') as string[]).filter(value => value !== option.code))} />{option.name}</label>)}</fieldset>
      {selectField('budget.currency', 'Валюта бюджета', [{ code: 'BYN', name: 'BYN' }, { code: 'RUB', name: 'RUB' }])}
      <fieldset className="space-y-3"><legend className="mb-2 font-semibold">Цена напитка</legend>{numberField('budget.minDrinkPrice', 'Напиток: цена от')}{numberField('budget.maxDrinkPrice', 'Напиток: цена до')}{numberField('budget.drinkVolumeMl', 'Объём напитка, мл', 5000)}</fieldset>
      <fieldset className="space-y-3"><legend className="mb-2 font-semibold">Цена пачки кофе</legend>{numberField('budget.minCoffeePrice', 'Пачка: цена от')}{numberField('budget.maxCoffeePrice', 'Пачка: цена до')}{numberField('budget.coffeeWeightGrams', 'Вес пачки, г', 100000)}</fieldset>
    </> : <>
      {kind === 'roasters' && <>
        {groups.find(group => group.code === 'roasterTags') ? groupControl(groups.find(group => group.code === 'roasterTags')!) : <fieldset><legend>Услуги</legend>{tags.map(tag => <label key={tag.slug} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={(get('tags') as string[] ?? []).includes(tag.slug)} onChange={event => put('tags', event.target.checked ? [...(get('tags') as string[] ?? []), tag.slug] : (get('tags') as string[]).filter(value => value !== tag.slug))} />{tag.name}</label>)}</fieldset>}
        <details><summary className="min-h-11 cursor-pointer">Исключить теги услуг</summary>{tags.map(tag => <label key={tag.slug} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={(get('excludeTags') as string[] ?? []).includes(tag.slug)} onChange={event => put('excludeTags', event.target.checked ? [...(get('excludeTags') as string[] ?? []), tag.slug] : (get('excludeTags') as string[]).filter(value => value !== tag.slug))} />Без тега «{tag.name}»</label>)}{errorNode('excludeTags')}</details>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={get('favoritesOnly') === true} onChange={event => put('favoritesOnly', event.target.checked || undefined)} />Избранное</label>
        <h3 className="font-bold">Кофе в ассортименте</h3>
      </>}
      {coffeeGroups.filter(group => primary.has(group.code.replace(/^coffee\./, ''))).map(groupControl)}
      <button type="button" className={catalogButton} onClick={() => put(`${coffeePrefix}acidity`, ['low', 'balanced'])}>Неяркая кислотность</button>
      {budgetFields(coffeePrefix)}
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={get(`${coffeePrefix}availableOnly`) !== false} onChange={event => put(`${coffeePrefix}availableOnly`, event.target.checked)} />Только в наличии</label>
      <details><summary className="min-h-11 cursor-pointer font-semibold">Дополнительные фильтры</summary><div className="space-y-4">{coffeeGroups.filter(group => !primary.has(group.code.replace(/^coffee\./, ''))).map(groupControl)}</div></details>
    </>}
    <div className="flex flex-wrap gap-2"><button type="submit" className={`${catalogButton} ${kind === 'coffees' ? 'bg-stone-950 text-white dark:bg-white dark:text-stone-950' : 'bg-yellow-400 text-stone-950'}`}>Применить</button><button type="button" className={catalogButton} onClick={() => form.reset({ filters: kind === 'coffees' ? { availableOnly: true } : {} })}>Сбросить</button></div>
    {form.formState.errors.filters?.message && <p role="alert">{String(form.formState.errors.filters.message)}</p>}
  </form>;
}
