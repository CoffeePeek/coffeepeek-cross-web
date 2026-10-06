import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEquipments, getCoffeeBeans, getRoasters, getBrewMethods, getShopTags, type CoffeeShopFilters } from '../api/coffeeshop';
import { shopFiltersSchema, normalizeFilters, type ShopFilters } from '../utils/catalogSearch';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../constants/colors';
import { getDeviceLocation } from '../utils/geolocation';
import ShopFilterPanel from './ShopFilterPanel';

export default function ShopCatalogFilters({ filters, onApply, mode = 'sidebar', resultCount, onClose }: {
  filters: ShopFilters; onApply: (filters: Record<string, unknown>) => void;
  mode?: 'quick' | 'chips' | 'sidebar'; resultCount?: number; onClose?: () => void;
}) {
  const { theme } = useTheme();
  const [locationError, setLocationError] = useState('');
  const current = useRef(filters);
  current.current = filters;
  const draft = filters;
  const catalogs = useQuery({ queryKey: ['catalogs', 'shop-filters'], queryFn: async () => {
    const [equipments, beans, roasters, methods, tags] = await Promise.all([getEquipments(), getCoffeeBeans(), getRoasters(), getBrewMethods(), getShopTags()]);
    const list = <T,>(data: unknown, key: string): T[] => Array.isArray(data) ? data : (data as Record<string, T[]>)[key] ?? [];
    return { equipments: list<import('../api/coffeeshop').Equipment>(equipments.data, 'equipments'), beans: list<import('../api/coffeeshop').CoffeeBean>(beans.data, 'beans'),
      roasters: list<import('../api/coffeeshop').Roaster>(roasters.data, 'roasters'), methods: list<import('../api/coffeeshop').BrewMethod>(methods.data, 'methods'), tags: list<import('../api/coffeeshop').ShopTagDto>(tags.data, 'tags') };
  }, retry: false });
  const patch = (values: Partial<ShopFilters>) => {
    const next = normalizeFilters({ ...current.current, ...values });
    if (!shopFiltersSchema.safeParse(next).success) return;
    current.current = next;
    onApply(next);
  };
  const activeQuick = [draft.isOpen && 'open', draft.isNew && 'new', draft.visitedOnly && 'visited', draft.favoritesOnly && 'favorite', draft.origin && 'nearby'].filter(Boolean) as string[];
  const panel = {
    activeQuick: activeQuick.length ? activeQuick : ['all'],
    onQuickChange: async (key: string) => {
      if (key === 'all') { patch({ isOpen: undefined, isNew: undefined, visitedOnly: undefined, favoritesOnly: undefined, origin: undefined, radiusKm: undefined, type: undefined }); return; }
      if (key === 'nearby') {
        if (draft.origin) { patch({ origin: undefined, radiusKm: undefined }); return; }
        const location = await getDeviceLocation({ requestPermission: true, maximumAge: 0 });
        if (location) { setLocationError(''); patch({ origin: { latitude: location.coords.latitude, longitude: location.coords.longitude }, radiusKm: undefined }); }
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
    resultCount, onClose,
  };
  return <>
    {catalogs.isError && <p role="alert">Не удалось загрузить справочники. <button type="button" onClick={() => void catalogs.refetch()} className="underline">Повторить</button></p>}
    <ShopFilterPanel mode={mode} {...panel} />
    {locationError && <p role="status">{locationError}</p>}
  </>;
}
