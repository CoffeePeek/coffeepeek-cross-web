import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEquipments, getCoffeeBeans, getPhotoUrl, getBrewMethods, getShopTags, type CoffeeShopFilters } from '../api/coffeeshop';
import { getRoasterCards } from '../api/discovery';
import { getCatalogScope } from '../lib/catalogSession';
import { shopFiltersSchema, normalizeFilters, type ShopFilters } from '../utils/catalogSearch';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { getThemeColors } from '../constants/colors';
import { getDeviceLocation } from '../utils/geolocation';
import ShopFilterPanel from './ShopFilterPanel';

export default function ShopCatalogFilters({ filters, onApply, mode = 'sidebar', resultCount, onClose }: {
  filters: ShopFilters; onApply: (filters: Record<string, unknown>) => void;
  mode?: 'quick' | 'chips' | 'sidebar'; resultCount?: number; onClose?: () => void;
}) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const deviceLocation = useQuery({ queryKey: ['device-location'],
    queryFn: () => getDeviceLocation({ requestPermission: true, maximumAge: 0 }), enabled: false, retry: false });
  const current = useRef(filters);
  current.current = filters;
  const draft = filters;
  const catalogs = useQuery({ queryKey: ['catalogs', 'shop-filters'], queryFn: async () => {
    const [equipments, beans, methods, tags] = await Promise.allSettled([getEquipments(), getCoffeeBeans(), getBrewMethods(), getShopTags()]);
    const list = <T,>(data: unknown, key: string): T[] => Array.isArray(data) ? data : (data as Record<string, T[]> | null)?.[key] ?? [];
    return { equipments: list<import('../api/coffeeshop').Equipment>(equipments.status === 'fulfilled' ? equipments.value.data : [], 'equipments'), beans: list<import('../api/coffeeshop').CoffeeBean>(beans.status === 'fulfilled' ? beans.value.data : [], 'beans'),
      methods: list<import('../api/coffeeshop').BrewMethod>(methods.status === 'fulfilled' ? methods.value.data : [], 'methods'), tags: list<import('../api/coffeeshop').ShopTagDto>(tags.status === 'fulfilled' ? tags.value.data : [], 'tags') };
  }, retry: false });
  const roasters = useQuery({ queryKey: ['catalog', getCatalogScope(), 'roasters', 'all'], queryFn: ({ signal }) => getRoasterCards(signal), retry: false });
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
        const location = (await deviceLocation.refetch()).data;
        if (location) patch({ origin: { latitude: location.coords.latitude, longitude: location.coords.longitude }, radiusKm: undefined });
        else showToast('Геолокация недоступна. Обычный поиск продолжает работать.', 'warning');
        return;
      }
      const field = ({ open: 'isOpen', new: 'isNew', visited: 'visitedOnly', favorite: 'favoritesOnly' } as const)[key as 'open'];
      if (field) patch({ [field]: draft[field] ? undefined : true });
    },
    shopTags: catalogs.data?.tags ?? [], selectedTagIds: draft.tags ?? [],
    onTagToggle: (tag: string) => patch({ tags: draft.tags?.includes(tag) ? draft.tags.filter(value => value !== tag) : [...(draft.tags ?? []), tag] }),
    filters: { cityId: draft.city, priceRange: draft.priceRange ? draft.priceRange[0].toUpperCase() + draft.priceRange.slice(1) : undefined, coffeeFocus: draft.type?.replace('-', '_') } as CoffeeShopFilters,
    selectedEquipments: draft.equipments ?? [], selectedBeans: draft.beans ?? [], selectedRoasters: draft.roasters ?? [], selectedBrewMethods: draft.brewMethods ?? [],
    equipments: catalogs.data?.equipments ?? [], coffeeBeans: catalogs.data?.beans ?? [],
    roasters: (roasters.data ?? []).flatMap(roaster => roaster.address.slug ? [{ id: roaster.address.slug, name: roaster.name ?? 'Обжарщик', photoUrl: roaster.coverPhoto ? getPhotoUrl(roaster.coverPhoto, 'thumbnail') : roaster.photoUrl }] : []),
    brewMethods: catalogs.data?.methods ?? [],
    colors: getThemeColors(theme), dark: theme === 'dark', canLocate: typeof navigator !== 'undefined' && !!navigator.geolocation && deviceLocation.data !== null,
    onApplyFilters: (values: import('./ShopFilterPanel').AppliedFilters) => patch({ equipments: values.equipments, beans: values.beans, roasters: values.roasters, brewMethods: values.brewMethods,
      priceRange: values.priceRange?.toLowerCase() as ShopFilters['priceRange'], type: values.coffeeFocus?.replace('_', '-') as ShopFilters['type'] }),
    resultCount, onClose,
  };
  return <ShopFilterPanel mode={mode} {...panel} />;
}
