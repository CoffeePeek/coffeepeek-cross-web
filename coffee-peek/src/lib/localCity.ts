export interface BrowseCity {
  id: string;
  name: string;
}

export const DEFAULT_CITY: BrowseCity = { id: 'minsk', name: 'Минск' };

const STORAGE_KEY = 'coffeepeek.selectedCitySlug';
const NAME_KEY = 'coffeepeek.selectedCityName';
const CHANGE_EVENT = 'coffeepeek:city-changed';
let inMemoryCity: BrowseCity | null = null;

export function getCitySelection(): string {
  try {
    if (!inMemoryCity && typeof window !== 'undefined') {
      const id = window.localStorage.getItem(STORAGE_KEY);
      if (!id) return '';
      const stored = window.localStorage.getItem(NAME_KEY);
      if (stored?.startsWith(id + '\n')) return JSON.stringify([id, stored.slice(id.length + 1)]);
      return JSON.stringify([id]);
    }
  } catch { /* Storage can be unavailable. */ }
  return inMemoryCity ? JSON.stringify([inMemoryCity.id, inMemoryCity.name]) : '';
}

export function setSelectedCity(city: BrowseCity): void {
  inMemoryCity = city;
  try {
    window.localStorage.setItem(STORAGE_KEY, city.id);
    window.localStorage.setItem(NAME_KEY, city.id + '\n' + city.name);
    inMemoryCity = null;
  } catch { /* Keep the selection for this visit. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeCity(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === NAME_KEY || event.key === null) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
