import { getBySlug } from '../api/publicAddresses';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { searchCoffeeShops, getCities, getEquipments, getCoffeeBeans, getRoasters, getBrewMethods, getShopTags, type CoffeeShop, type City, type Equipment, type CoffeeBean, type Roaster, type BrewMethod, type CoffeeShopFilters, type ShopTagDto, getPhotoUrl } from '../api/coffeeshop';
import { ShopCardSkeleton } from './skeletons';
import { useTheme } from '../contexts/ThemeContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useLoadMoreOnScroll } from '../hooks/useLoadMoreOnScroll';
import { getErrorMessage } from '../utils/errorHandler';
import { COLORS, getThemeColors } from '../constants/colors';
import { logger } from '../utils/logger';
import ShopCard from './ShopCard';
import ShopSearchBar from './ShopSearchBar';
import ShopFilterPanel from './ShopFilterPanel';
import Mascot from './Mascot';
import { useLocalFavorites } from '../hooks/useLocalFavorites';
import { useLocalCity } from '../hooks/useLocalCity';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { distanceKm } from '../utils/distance';
import { getDeviceLocation, getLocationLifetime } from '../utils/geolocation';

const PAGE_SIZE = 12;

type ShopsPage = Record<string, unknown> & {
  coffeeShops?: Record<string, unknown>[];
  items?: Record<string, unknown>[];
  content?: Record<string, unknown>[];
  totalPages?: number;
  currentPage?: number;
  pageSize?: number;
  totalItems?: number;
  totalCount?: number;
};

function extractList<T>(data: unknown, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    for (const key of keys) {
      const val = (data as Record<string, unknown>)[key];
      if (Array.isArray(val)) return val as T[];
    }
  }
  return [];
}

function normalizeShopPhoto(p: unknown): string {
  if (typeof p === 'string') return p;
  if (p && typeof p === 'object' && ('fullUrl' in p || 'storageKey' in p)) {
    return getPhotoUrl(p as Parameters<typeof getPhotoUrl>[0], 'card');
  }
  return '';
}

function parseShopList(data: unknown): CoffeeShop[] {
  if (Array.isArray(data)) {
    return data.map((shop) => ({
      ...shop,
      rating: shop.rating ?? shop.averageRating ?? 0,
    })) as CoffeeShop[];
  }
  if (!data || typeof data !== 'object') return [];
  const rd = data as ShopsPage;
  const raw = rd.coffeeShops ?? rd.items ?? rd.content;
  if (!Array.isArray(raw)) return [];
  return raw.map((shop) => {
    const orderedPhotos = [...((shop.photos ?? []) as unknown[])].sort((left, right) => {
      const leftIndex = typeof left === 'object' && left !== null && 'sortIndex' in left
        ? Number((left as { sortIndex?: number }).sortIndex ?? Number.MAX_SAFE_INTEGER)
        : Number.MAX_SAFE_INTEGER;
      const rightIndex = typeof right === 'object' && right !== null && 'sortIndex' in right
        ? Number((right as { sortIndex?: number }).sortIndex ?? Number.MAX_SAFE_INTEGER)
        : Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });
    const shopPhotos = orderedPhotos.map(normalizeShopPhoto).filter(Boolean);
    return {
      ...shop,
      shopPhotos,
      photos: orderedPhotos,
      rating: (shop.rating as number) ?? (shop.averageRating as number) ?? 0,
    } as unknown as CoffeeShop;
  });
}

interface CoffeeShopListProps {
  onShopSelect: (shopId: string) => void;
}

const CoffeeShopList: React.FC<CoffeeShopListProps> = ({ onShopSelect }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, requireAuth } = useRequireAuth();
  const colors = getThemeColors(theme);
  const { favoriteIds } = useLocalFavorites();
  const [allShops, setAllShops] = useState<CoffeeShop[]>([]); // Все кофейни с сервера (нефильтрованные)
  const [shops, setShops] = useState<CoffeeShop[]>([]); // Отфильтрованные кофейни для отображения
  const [totalItems, setTotalItems] = useState<number>(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);
  const [cities, setCities] = useState<City[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [coffeeBeans, setCoffeeBeans] = useState<CoffeeBean[]>([]);
  const [roasters, setRoasters] = useState<Roaster[]>([]);
  const [brewMethods, setBrewMethods] = useState<BrewMethod[]>([]);
  const [shopTags, setShopTags] = useState<ShopTagDto[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [filters, setFilters] = useState<CoffeeShopFilters>({});
  const addressPaths = new Map(shops.map(shop => [shop.id, shop.canonicalPath]));
  const [filterResolutionError, setFilterResolutionError] = useState('');
  const [resolvingFilter, setResolvingFilter] = useState(() => !!(searchParams.get('citySlug') || searchParams.get('roasterSlug')));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeQuick, setActiveQuick] = useState<string[]>(() => searchParams.get('filter') === 'favorite' ? ['favorite'] : ['all']);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const locationExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationRequestRef = useRef(0);

  const clearUserLocation = useCallback(() => {
    if (locationExpiryRef.current) clearTimeout(locationExpiryRef.current);
    locationExpiryRef.current = null;
    setUserLocation(null);
    setActiveQuick(prev => {
      if (!prev.includes('nearby')) return prev;
      const next = prev.filter(id => id !== 'nearby');
      return next.length > 0 ? next : ['all'];
    });
  }, []);

  const requestLocation = useCallback(async (activateNearby = true) => {
    const request = ++locationRequestRef.current;
    clearUserLocation();
    const position = await getDeviceLocation({ requestPermission: activateNearby, ...(activateNearby ? { maximumAge: 0 } : {}) });
    if (request !== locationRequestRef.current) return;
    if (position) {
      const { coords, timestamp } = position;
      const lifetime = getLocationLifetime(timestamp);
      if (lifetime === 0) return;
      setUserLocation({ latitude: coords.latitude, longitude: coords.longitude });
      if (activateNearby) setActiveQuick(prev => [...prev.filter(id => id !== 'all' && id !== 'nearby'), 'nearby']);
      locationExpiryRef.current = setTimeout(clearUserLocation, lifetime);
    }
  }, [clearUserLocation]);

  useEffect(() => () => {
    ++locationRequestRef.current;
    if (locationExpiryRef.current) clearTimeout(locationExpiryRef.current);
  }, []);

  useEffect(() => {
    void requestLocation(false);
  }, [requestLocation]);

  const handleQuickChange = (id: string) => {
    if (id === 'visited' && !requireAuth()) return;
    if (id === 'nearby' && !userLocation) {
      void requestLocation();
      return;
    }
    setActiveQuick(prev => {
      if (id === 'all') return ['all'];
      const without = prev.filter(x => x !== 'all');
      const next = without.includes(id) ? without.filter(x => x !== id) : [...without, id];
      return next.length === 0 ? ['all'] : next;
    });
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(x => x !== tagId) : [...prev, tagId]
    );
  };

  const { cityId: storedCityId } = useLocalCity();
  const [selectedCity, setSelectedCity] = useState<string>(searchParams.get('city') || storedCityId);
  useEffect(() => {
    let cancelled = false;
    const city = searchParams.get('citySlug');
    const roaster = searchParams.get('roasterSlug');
    if (!city && !roaster) { setResolvingFilter(false); return; }
    setResolvingFilter(true);
    void Promise.all([
      city ? getBySlug('cities', city) : null,
      roaster ? getBySlug('roasters', roaster) : null,
    ]).then(([cityResult, roasterResult]) => {
      if (cancelled) return;
      setFilterResolutionError('');
      if (cityResult) setSelectedCity(cityResult.address.slug);
      if (roasterResult) setSelectedRoasters([roasterResult.address.slug]);
    }).catch((cause: { status?: number }) => { if (!cancelled) setFilterResolutionError(cause.status === 404 ? 'Фильтр не найден.' : cause.status === 400 ? 'Некорректный адрес фильтра.' : 'Не удалось загрузить фильтр. Обновите страницу для повтора.'); }).finally(() => { if (!cancelled) setResolvingFilter(false); });
    return () => { cancelled = true; };
  }, [searchParams]);
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>([]);
  const [selectedBeans, setSelectedBeans] = useState<string[]>([]);
  const [selectedRoasters, setSelectedRoasters] = useState<string[]>([]);
  const [selectedBrewMethods, setSelectedBrewMethods] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  useEffect(() => {
    loadInitialData().then(() => {
      setInitialDataLoaded(true);
    });
  }, [user]);

  // City is chosen in Settings; sync when it changes (also cross-tab).
  useEffect(() => {
    if (storedCityId && !searchParams.get('citySlug') && !searchParams.get('city')) setSelectedCity(storedCityId);
  }, [storedCityId, searchParams]);

  // Fall back to the first city if none has been chosen in Settings yet.
  useEffect(() => {
    if (cities.length > 0 && !selectedCity && initialDataLoaded) {
      setSelectedCity(cities[0].id);
    }
  }, [cities, selectedCity, initialDataLoaded]);
  
  // Load shops once when initial data is loaded and default city is set
  useEffect(() => {
    if (initialDataLoaded && selectedCity && !filters.cityId) {
      setFilters((prev) => ({
        ...prev,
        cityId: selectedCity,
      }));
    }
  }, [initialDataLoaded, selectedCity, filters.cityId]);
  
  // Debouncing для поискового запроса (задержка 600ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 600); // Запрос отправится через 600ms после последнего ввода

    return () => clearTimeout(timer);
  }, [searchQuery]);


  useEffect(() => {
    const updatedFilters: CoffeeShopFilters = {
      cityId: selectedCity || undefined,
      equipmentIds: selectedEquipments.length ? selectedEquipments : undefined,
      coffeeBeanIds: selectedBeans.length ? selectedBeans : undefined,
      roasterIds: selectedRoasters.length ? selectedRoasters : undefined,
      brewMethodIds: selectedBrewMethods.length ? selectedBrewMethods : undefined,
      priceRange: filters.priceRange,
      coffeeFocus: filters.coffeeFocus,
      isOpen: activeQuick.includes('open') ? true : undefined,
      isNew: activeQuick.includes('new') ? true : undefined,
      isVisited: activeQuick.includes('visited') ? true : undefined,
      tagIds: selectedTagIds.length ? selectedTagIds : undefined,
    };

    if (JSON.stringify(filters) !== JSON.stringify(updatedFilters)) {
      setFilters(updatedFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity, selectedEquipments, selectedBeans, selectedRoasters, selectedBrewMethods, activeQuick, selectedTagIds]);

  useEffect(() => {
    if (initialDataLoaded && filters.cityId && !resolvingFilter && !filterResolutionError) {
      void loadShops(1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    resolvingFilter,
    filterResolutionError,
    filters.cityId,
    filters.priceRange,
    filters.coffeeFocus,
    filters.equipmentIds?.length ?? 0,
    filters.coffeeBeanIds?.length ?? 0,
    filters.roasterIds?.length ?? 0,
    filters.brewMethodIds?.length ?? 0,
    filters.tagIds?.join(',') ?? '',
    filters.isOpen,
    filters.isNew,
    filters.isVisited,
    debouncedSearchQuery,
    initialDataLoaded,
  ]);

  const applyClientFilters = useCallback((shopsToFilter: CoffeeShop[]): CoffeeShop[] => {
    const filtered = activeQuick.includes('favorite')
      ? shopsToFilter.filter(shop => favoriteIds.has(shop.id))
      : [...shopsToFilter];
    if (!activeQuick.includes('nearby') || !userLocation) return filtered;
    return filtered.sort((left, right) => {
      const leftLat = left.location?.latitude ?? left.latitude;
      const leftLon = left.location?.longitude ?? left.longitude;
      const rightLat = right.location?.latitude ?? right.latitude;
      const rightLon = right.location?.longitude ?? right.longitude;
      const leftDistance = leftLat === undefined || leftLon === undefined ? Infinity : distanceKm(userLocation.latitude, userLocation.longitude, leftLat, leftLon);
      const rightDistance = rightLat === undefined || rightLon === undefined ? Infinity : distanceKm(userLocation.latitude, userLocation.longitude, rightLat, rightLon);
      return leftDistance - rightDistance;
    });
  }, [activeQuick, favoriteIds, userLocation]);

  // Favorite is local-only — re-apply after load or when favorite chip / ids change
  useEffect(() => {
    const filtered = applyClientFilters(allShops);
    setShops(filtered);
    if (activeQuick.includes('favorite')) setTotalItems(filtered.length);
  }, [applyClientFilters, allShops, activeQuick]);

  const loadInitialData = async () => {
    try {
      const [citiesRes, equipmentsRes, beansRes, roastersRes, methodsRes, tagsRes] = await Promise.all([
        getCities(),
        getEquipments(),
        getCoffeeBeans(),
        getRoasters(),
        getBrewMethods(),
        getShopTags(),
      ]);

      const citiesData = extractList<City>(citiesRes.data, 'cities');
      const equipmentsData = extractList<Equipment>(equipmentsRes.data, 'equipments');
      const beansData = extractList<CoffeeBean>(beansRes.data, 'beans');
      const roastersData = extractList<Roaster>(roastersRes.data, 'roasters');
      const methodsData = extractList<BrewMethod>(methodsRes.data, 'methods');
      const tagsData = extractList<ShopTagDto>(tagsRes.data, 'tags', 'shopTags', 'items');

      setCities(Array.isArray(citiesData) ? citiesData : []);
      setEquipments(Array.isArray(equipmentsData) ? equipmentsData : []);
      setCoffeeBeans(Array.isArray(beansData) ? beansData : []);
      setRoasters(Array.isArray(roastersData) ? roastersData : []);
      setBrewMethods(Array.isArray(methodsData) ? methodsData : []);
      setShopTags(Array.isArray(tagsData) ? tagsData : (Array.isArray(tagsRes.data) ? tagsRes.data : []));
    } catch (err) {
      logger.error('Error loading initial data:', err);
      // Set empty arrays to prevent errors
      setCities([]);
      setEquipments([]);
      setCoffeeBeans([]);
      setRoasters([]);
      setBrewMethods([]);
      setShopTags([]);
    }
  };

  const loadShops = async (pageToLoad: number, append: boolean) => {
    if (append && loadingRef.current) return;
    const requestId = ++requestIdRef.current;
    loadingRef.current = true;
    if (append) setIsLoadingMore(true);
    else {
      setIsLoading(true);
      setError(null);
      setHasMore(true);
    }

    try {
      const response = await searchCoffeeShops(debouncedSearchQuery, filters, pageToLoad, PAGE_SIZE);
      if (requestId !== requestIdRef.current) return;

      const list = parseShopList(response.data);
      const rd = (response.data && typeof response.data === 'object' ? response.data : {}) as ShopsPage;
      const totalPages = Number(rd.totalPages ?? response.pagination?.totalPages ?? 0);
      const apiTotal = Number(rd.totalItems ?? (rd as { totalCount?: number }).totalCount ?? response.pagination?.totalItems ?? 0);

      setAllShops((prev) => {
        if (!append) return list;
        const seen = new Set(prev.map((s) => s.id));
        return [...prev, ...list.filter((shop) => !seen.has(shop.id))];
      });
      setHasMore(
        list.length > 0 && (
          totalPages > 0
            ? pageToLoad < totalPages
            : apiTotal > 0
              ? pageToLoad * PAGE_SIZE < apiTotal
              : list.length >= PAGE_SIZE
        ),
      );
      if (!activeQuick.includes('favorite') && apiTotal > 0) setTotalItems(apiTotal);
      setPage(pageToLoad);
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      logger.error('CoffeeShopList: Ошибка при загрузке кофеен:', err);
      // Иначе observer сразу перезапустит упавший запрос и будет долбить API в цикле.
      setHasMore(false);
      if (!append) {
        setAllShops([]);
        setShops([]);
        setTotalItems(0);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        loadingRef.current = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  };

  const loadMoreRef = useLoadMoreOnScroll(
    hasMore && !isLoading && !isLoadingMore && !!filters.cityId,
    () => { void loadShops(page + 1, true); },
  );

  const handleApplyFilters = (applied: { priceRange?: string; coffeeFocus?: string; equipments: string[]; beans: string[]; roasters: string[]; brewMethods: string[] }) => {
    setSelectedEquipments(applied.equipments);
    setSelectedBeans(applied.beans);
    setSelectedRoasters(applied.roasters);
    setSelectedBrewMethods(applied.brewMethods);
    setFilters(prev => ({ ...prev, priceRange: applied.priceRange, coffeeFocus: applied.coffeeFocus }));
  };

  const openShopDetails = (shopId: string) => {
    const path = addressPaths.get(shopId);
    if (path) navigate(path); else onShopSelect(shopId);
  };

  const isDark = theme === 'dark';
  const activeFilterCount =
    selectedEquipments.length + selectedBeans.length +
    selectedRoasters.length + selectedBrewMethods.length +
    selectedTagIds.length +
    (filters.priceRange ? 1 : 0);

  const filterPanelProps = {
    activeQuick,
    onQuickChange: handleQuickChange,
    shopTags,
    selectedTagIds,
    onTagToggle: handleTagToggle,
    filters,
    equipments,
    coffeeBeans,
    roasters,
    brewMethods,
    selectedEquipments,
    selectedBeans,
    selectedRoasters,
    selectedBrewMethods,
    colors,
    dark: isDark,
    onApplyFilters: handleApplyFilters,
    resultCount: totalItems || shops.length,
    canLocate: userLocation !== null || (typeof navigator !== 'undefined' && !!navigator.geolocation),
  };

  if (resolvingFilter) return <div className="p-8">Загрузка…</div>;
  if (filterResolutionError) return <p className="p-8 text-center">{filterResolutionError}</p>;

  return (
    <>
    <div className="min-h-screen pb-20" style={{ backgroundColor: colors.background, position: 'relative' }}>
      {/* Dotted bg pattern */}
      {isDark && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(#2D241F 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.5, pointerEvents: 'none', zIndex: 0 }} />
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        <ShopSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showFilters={showFilters}
          onFilterToggle={() => setShowFilters(f => !f)}
          activeFilterCount={activeFilterCount}
          colors={colors}
          dark={isDark}
        />

        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
          <div className="hidden lg:block">
            <ShopFilterPanel mode="quick" {...filterPanelProps} />
          </div>
          <div className="lg:flex lg:gap-10 lg:items-start">
            <aside
              className="hidden lg:block w-[260px] xl:w-[280px] shrink-0 sticky top-20 self-start max-h-[calc(100vh-5.5rem)] overflow-y-auto no-scrollbar pb-8 pr-6"
              style={{ borderRight: `1px solid ${colors.border}` }}
            >
              <ShopFilterPanel mode="sidebar" {...filterPanelProps} />
            </aside>

            <div className="flex-1 min-w-0">
              <div className="lg:hidden">
                <ShopFilterPanel mode="chips" {...filterPanelProps} />
              </div>

        {error && (
          <div role="alert" className="mb-6 p-4 border rounded-2xl"
               style={{ backgroundColor: `${COLORS.error}10`, borderColor: `${COLORS.error}30` }}>
            <p className="text-sm" style={{ color: COLORS.error }}>{error}</p>
          </div>
        )}

        {/* ── Shop grid: 1 / 2 / 3 / 4 cols beside sidebar ── */}
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-5 pb-12 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <ShopCardSkeleton count={8} />
            </div>
          ) : shops.length === 0 ? (
            <div
              className="rounded-2xl px-6 py-16 border flex flex-col items-center justify-center text-center min-h-[240px]"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
              <Mascot pose="search" size={132} />
              <p style={{ margin: '12px 0 0', fontFamily: '"Manrope"', fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
                Ничего не найдено. Попробуйте другой фильтр.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 pb-12 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 sm:pb-12">
              {shops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} colors={colors} userLocation={userLocation} onSelect={openShopDetails} />
              ))}
            </div>
          )}
          <div ref={loadMoreRef} className="pb-8">
            {error && allShops.length > 0 && !isLoadingMore && (
              <div className="flex justify-center">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm font-medium border"
                  style={{ borderColor: `${COLORS.error}30`, color: COLORS.error }}
                  onClick={() => void loadShops(page + 1, true)}
                >
                  Повторить загрузку
                </button>
              </div>
            )}
            {isLoadingMore && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <ShopCardSkeleton count={4} />
              </div>
            )}
          </div>
        </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {showFilters && (
      <div className="lg:hidden fixed inset-0 z-50">
        <button
          type="button"
          aria-label="Закрыть фильтры"
          className="absolute inset-0 bg-black/50 border-0 cursor-pointer"
          onClick={() => setShowFilters(false)}
        />
        <aside
          className="absolute inset-x-0 bottom-0 max-h-[min(86dvh,760px)] overflow-y-auto rounded-t-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          style={{ background: colors.surface, borderTop: `1px solid ${colors.border}`, boxShadow: '0 -16px 48px rgba(0,0,0,.18)' }}
        >
          <ShopFilterPanel
            mode="sidebar"
            {...filterPanelProps}
            onClose={() => setShowFilters(false)}
          />
        </aside>
      </div>
    )}
    </>
  );
};

export default CoffeeShopList;
