import { useSyncExternalStore } from 'react';
import { DEFAULT_CITY, getCitySelection, setSelectedCity, subscribeCity, type BrowseCity } from '../lib/localCity';
import { useCities } from './queries/useCatalogs';

export function useLocalCity() {
  const selection = useSyncExternalStore(subscribeCity, getCitySelection, () => '');
  const [id, name] = (selection ? JSON.parse(selection) : []) as [string?, string?];
  const query = useCities();
  const catalog = query.data ?? [];
  const cityId = id ?? DEFAULT_CITY.id;
  const city = catalog.find(item => item.id === cityId || item.publicAddress?.slug === cityId)
    ?? (cityId === DEFAULT_CITY.id ? DEFAULT_CITY : { id: cityId, name: name ?? cityId });
  const cities: BrowseCity[] = catalog.some(item => item.id === city.id) ? catalog : [city, ...catalog];

  return { city, cities, catalog, hasSavedCity: !!id, query, setCity: setSelectedCity };
}
