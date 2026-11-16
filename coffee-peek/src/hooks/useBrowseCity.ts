import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import minsk from '../constants/minskCatalog.json';
import { readSearchState, type ShopFilters } from '../utils/catalogSearch';
import { DEFAULT_CITY, type BrowseCity } from '../lib/localCity';
import { useLocalCity } from './useLocalCity';

const discoveryRoutes = ['/search', '/map', '/shops', '/roasters'];
const minskCatalogRoutes = [minsk.path, ...Object.values(minsk.collections).map(section => section.path)];

export function useBrowseCity() {
  const local = useLocalCity();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const path = pathname.replace(/\/$/, '');
  const discovery = discoveryRoutes.includes(path);
  const feed = path === '/feed';
  const minskCatalog = minskCatalogRoutes.includes(path);
  let filters: ShopFilters | undefined;
  if (discovery) {
    try { filters = readSearchState(params, 'shops').filters; } catch { /* The search page handles invalid filters. */ }
  }
  const override = minskCatalog ? minsk.slug : feed ? params.get('citySlug') : filters?.city;
  const city = override && override !== local.city.id
    ? local.catalog.find(item => item.id === override || item.publicAddress?.slug === override)
      ?? (override === DEFAULT_CITY.id ? DEFAULT_CITY : { id: override, name: override })
    : local.city;

  const chooseCity = (nextCity: BrowseCity) => {
    local.setCity(nextCity);
    if (minskCatalog && nextCity.id !== minsk.slug) {
      navigate('/shops');
      return;
    }
    const next = new URLSearchParams(params);
    if (feed) next.delete('citySlug');
    if (discovery) {
      next.delete('city');
      next.delete('citySlug');
      next.delete('lat');
      next.delete('lon');
      if (params.has('filters') && filters) {
        const { city: _city, origin: _origin, radiusKm: _radius, ...remaining } = filters;
        next.set('filters', JSON.stringify(remaining));
      }
      if (params.get('sort') === 'distance_asc') next.delete('sort');
      next.delete('page');
    }
    if (next.toString() !== params.toString()) setParams(next, { replace: true, preventScrollReset: true });
  };

  return { ...local, city, override, chooseCity };
}
