import { useEffect, useState, useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getCities, getEquipments, getCoffeeBeans, getRoasters, getBrewMethods, getShopTags, type CoffeeShopFilters } from '../api/coffeeshop';
import { shopFiltersSchema, normalizeFilters, type ShopFilters } from '../utils/catalogSearch';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../constants/colors';
import { getDeviceLocation } from '../utils/geolocation';
import ShopFilterPanel from './ShopFilterPanel';
import { catalogButton } from './CatalogCards';
import { catalogInput } from './CatalogFilters';

export default function ShopCatalogFilters({ filters, onApply }: { filters: ShopFilters; onApply: (filters: Record<string, unknown>) => void }) {
  const { theme } = useTheme();
  const id = useId();
  const [locationError, setLocationError] = useState('');
  const form = useForm<ShopFilters>({ defaultValues: filters, resolver: zodResolver(shopFiltersSchema) });
  useEffect(() => { form.reset(filters); }, [filters]);
  const draft = form.watch();
  const catalogs = useQuery({ queryKey: ['catalogs', 'shop-filters'], queryFn: async () => {
    const [cities, equipments, beans, roasters, methods, tags] = await Promise.all([getCities(), getEquipments(), getCoffeeBeans(), getRoasters(), getBrewMethods(), getShopTags()]);
    const list = <T,>(data: unknown, key: string): T[] => Array.isArray(data) ? data : (data as Record<string, T[]>)[key] ?? [];
    return { cities: list<import('../api/coffeeshop').City>(cities.data, 'cities'), equipments: list<import('../api/coffeeshop').Equipment>(equipments.data, 'equipments'), beans: list<import('../api/coffeeshop').CoffeeBean>(beans.data, 'beans'),
      roasters: list<import('../api/coffeeshop').Roaster>(roasters.data, 'roasters'), methods: list<import('../api/coffeeshop').BrewMethod>(methods.data, 'methods'), tags: list<import('../api/coffeeshop').ShopTagDto>(tags.data, 'tags') };
  }, retry: false });
  const patch = (values: Partial<ShopFilters>) => form.reset({ ...draft, ...values }, { keepDefaultValues: true });
  const activeQuick = [draft.isOpen && 'open', draft.isNew && 'new', draft.visitedOnly && 'visited', draft.favoritesOnly && 'favorite', draft.origin && 'nearby'].filter(Boolean) as string[];
  const panel = {
    activeQuick: activeQuick.length ? activeQuick : ['all'],
    onQuickChange: async (key: string) => {
      if (key === 'all') { patch({ isOpen: undefined, isNew: undefined, visitedOnly: undefined, favoritesOnly: undefined, origin: undefined, radiusKm: undefined, type: undefined }); return; }
      if (key === 'nearby') {
        if (draft.origin) { patch({ origin: undefined, radiusKm: undefined }); return; }
        const location = await getDeviceLocation({ requestPermission: true, maximumAge: 0 });
        if (location) { setLocationError(''); patch({ origin: { latitude: location.coords.latitude, longitude: location.coords.longitude }, radiusKm: 5 }); }
        else setLocationError('Геолокация недоступна. Обычный поиск продолжает работать.');
        return;
      }
      const field = ({ open: 'isOpen', new: 'isNew', visited: 'visitedOnly', favorite: 'favoritesOnly' } as const)[key as 'open'];
      if (field) patch({ [field]: draft[field] ? undefined : true });
    },
    shopTags: catalogs.data?.tags ?? [], selectedTagIds: draft.tags ?? [],
    onTagToggle: (tag: string) => patch({ tags: draft.tags?.includes(tag) ? draft.tags.filter(value => value !== tag) : [...(draft.tags ?? []), tag] }),
    filters: { cityId: draft.city, priceRange: draft.priceRange ? draft.priceRange[0].toUpperCase() + draft.priceRange.slice(1) : undefined, coffeeFocus: draft.type?.replace('-', '_') } as CoffeeShopFilters,
    selectedEquipments: draft.equipments ?? [], selectedBeans: draft.beans ?? [], selectedRoasters: draft.roasters ?? [], selectedBrewMethods: draft.brewMethods ?? [],
    equipments: catalogs.data?.equipments ?? [], coffeeBeans: catalogs.data?.beans ?? [], roasters: catalogs.data?.roasters ?? [], brewMethods: catalogs.data?.methods ?? [],
    colors: getThemeColors(theme), dark: theme === 'dark', canLocate: typeof navigator !== 'undefined' && !!navigator.geolocation,
    onApplyFilters: (values: import('./ShopFilterPanel').AppliedFilters) => patch({ equipments: values.equipments, beans: values.beans, roasters: values.roasters, brewMethods: values.brewMethods,
      priceRange: values.priceRange?.toLowerCase() as ShopFilters['priceRange'], type: values.coffeeFocus?.replace('_', '-') as ShopFilters['type'] }),
  };
  return <form className="space-y-4" onSubmit={form.handleSubmit(values => onApply(normalizeFilters(values)))}>
    {catalogs.isError && <p role="alert">Не удалось загрузить справочники. <button type="button" onClick={() => void catalogs.refetch()} className="underline">Повторить</button></p>}
    <label className="block">Город<select className={catalogInput} {...form.register('city')}><option value="">Все города</option>{catalogs.data?.cities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}{draft.city && !catalogs.data?.cities.some(city => city.id === draft.city) && <option value={draft.city}>{draft.city}</option>}</select></label>
    <ShopFilterPanel mode="quick" {...panel} />
    <ShopFilterPanel mode="sidebar" {...panel} />
    <label className="block">Минимальный рейтинг<input type="number" className={catalogInput} min={0} max={5} step="0.1" value={draft.minRating ?? ''} onChange={event => patch({ minRating: event.target.value ? Number(event.target.value) : undefined })} /></label>
    {draft.origin && <label className="block">Радиус, км<input className={catalogInput} type="number" min="0.1" max={100} step="0.1" value={draft.radiusKm ?? ''} onChange={event => patch({ radiusKm: event.target.value ? Number(event.target.value) : undefined })} /></label>}
    <details><summary className="min-h-11 cursor-pointer">Напитки в меню</summary><div className="space-y-3">
      {['espresso', 'filter'].map(brew => <label key={brew} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={draft.menu?.brew?.includes(brew as 'filter') ?? false} onChange={event => patch({ menu: { ...draft.menu, brew: event.target.checked ? [...(draft.menu?.brew ?? []), brew as 'filter'] : draft.menu?.brew?.filter(value => value !== brew) } })} />{brew === 'espresso' ? 'Эспрессо' : 'Фильтр'}</label>)}
      <label className="block">Валюта<select className={catalogInput} value={draft.menu?.currency ?? ''} onChange={event => patch({ menu: { ...draft.menu, currency: event.target.value as 'BYN' || undefined } })}><option value="">Любая</option><option>BYN</option><option>RUB</option></select></label>
      {(['minPrice', 'maxPrice', 'volumeMl'] as const).map((field, index) => <label key={field} className="block" htmlFor={`${id}-${field}`}>{['Цена напитка от', 'Цена напитка до', 'Объём, мл'][index]}<input id={`${id}-${field}`} className={catalogInput} type="number" min={field === 'volumeMl' ? 1 : 0} step={field === 'volumeMl' ? 1 : '.01'} value={draft.menu?.[field] ?? ''} onChange={event => patch({ menu: { ...draft.menu, [field]: event.target.value ? Number(event.target.value) : undefined } })} /></label>)}
    </div></details>
    {locationError && <p role="status">{locationError}</p>}
    {Object.values(form.formState.errors).map((error, index) => <p key={index} role="alert" className="text-red-700 dark:text-red-300">{error.message ?? 'Проверьте параметры фильтров'}</p>)}
    <div className="flex flex-wrap gap-2"><button className={`${catalogButton} bg-yellow-400 text-stone-950`} type="submit">Применить</button><button className={catalogButton} type="button" onClick={() => form.reset({})}>Сбросить</button></div>
  </form>;
}
