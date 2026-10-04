import { useSearchParams } from 'react-router-dom';
import { usePublicNavigate } from '../hooks/usePublicNavigate';
import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { distanceKm, formatDistance, nearbyBounds } from '../utils/distance';
import { closestCardIndex } from '../utils/carousel';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/theme';
import { getMapShops, getMapZones, getCoffeeShopBySlug, getPhotoUrl } from '../api/coffeeshop';
import type { DetailedCoffeeShop, MapSearchData, MapShop } from '../api/coffeeshop';
import { CaretRight, Star, NavigationArrow, MagnifyingGlass, X, Polygon, MapPin, Minus, Plus } from '@/components/Icon';
import ShopPhotoPlaceholder from './ShopPhotoPlaceholder';
import Mascot from './Mascot';
import {
  applyOsmMapTheme,
  coffeeMapPinIcon,
  coffeeZoneLabelIcon,
  createOsmMap,
  ensureMapPinMascots,
  getMapBoundsBox,
  renderMapZones,
} from '../map/osmMap';
import { getCurrentDayOfWeek, toLocalSchedules } from '../utils/shopUtils';
import { getDeviceLocation, getLocationLifetime } from '../utils/geolocation';
import { useSearchCoffeeShops } from '../hooks/queries/useCoffeeShops';

const MapPage: React.FC<{ embedded?: boolean; autoPreview?: boolean; reduceMotion?: boolean }> = ({ embedded = false, autoPreview = false, reduceMotion = false }) => {
  const openPublic = usePublicNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [carouselItems, setCarouselItems] = useState<MapShop[]>([]);
  const loopedItems = carouselItems.length > 1 ? [carouselItems[carouselItems.length - 1], ...carouselItems, carouselItems[0]] : carouselItems;
  const mapDataRef = useRef<MapSearchData>({ shops: [], clusters: [], zones: [] });
  const paintMapRef = useRef<(data: MapSearchData) => void>(() => undefined);
  const mapRequestRef = useRef<AbortController | null>(null);
  const themeRef = useRef(theme);
  const previewShopsRef = useRef<MapShop[]>([]);
  const [previewPaused, setPreviewPaused] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [mapData, setMapData] = useState<MapSearchData>({ shops: [], clusters: [], zones: [] });
  const [shopsLoaded, setShopsLoaded] = useState(false);
  const [selectedShop, setSelectedShop] = useState<MapShop | null>(null);
  const [selectedShopDetails, setSelectedShopDetails] = useState<DetailedCoffeeShop | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const userPosRef = useRef<{ lat: number; lon: number } | null>(null);
  const [userPosition, setUserPosition] = useState<{ lat: number; lon: number } | null>(null);
  const nearby = useQuery({
    queryKey: ['map', 'nearby', userPosition],
    queryFn: ({ signal }) => getMapShops(nearbyBounds(userPosition!.lat, userPosition!.lon), signal).then(response => response.data),
    enabled: !!userPosition,
  });
  const nearbyShops = userPosition ? (nearby.data?.shops ?? [])
    .map(shop => ({ shop, distance: distanceKm(userPosition.lat, userPosition.lon, shop.latitude, shop.longitude) }))
    .filter(item => item.distance <= 5).sort((a, b) => a.distance - b.distance) : [];
  const carouselShops = userPosition ? nearbyShops.map(item => item.shop) : mapData.shops;
  const userMarkerRef = useRef<MapLibreMarker | null>(null);
  const locationExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const search = useSearchCoffeeShops(searchQuery, undefined, 1, 3);
  const searchResults = searchQuery && query.trim() === searchQuery ? (search.data?.coffeeShops ?? []).slice(0, 3) : [];
  const [showZones, setShowZones] = useState(() => localStorage.getItem('mapShowZones') !== 'false');
  const showZonesRef = useRef(showZones);

  const loadCoffeeShops = async (map: MapLibreMap) => {
    mapRequestRef.current?.abort();
    const controller = new AbortController();
    mapRequestRef.current = controller;
    try {
      const bounds = getMapBoundsBox(map);
      // Shops and zones come from different server zoom bands, so fetch both to show every pin plus zones at any zoom.
      const [response, zones] = await Promise.all([
        getMapShops(bounds, controller.signal),
        showZonesRef.current ? getMapZones(bounds, controller.signal).catch(() => []) : [],
      ]);
      if (mapRequestRef.current !== controller) return null;
      const nextData: MapSearchData = {
        shops: response.data?.shops ?? [],
        clusters: response.data?.clusters ?? [],
        zones,
        isTruncated: response.data?.isTruncated === true,
      };

      mapDataRef.current = nextData;
      if (!previewShopsRef.current.length) previewShopsRef.current = nextData.shops.slice(0, 3);
      setMapData(nextData);
      setShopsLoaded(true);
      return nextData;
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return null;
      return null;
    }
  };

  const detailsRequestRef = useRef<string | null>(null);
  const loadShopDetails = async (shopId: string) => {
    // Быстрый клик A→B: ответ A не должен попасть в карточку B.
    detailsRequestRef.current = shopId;
    setSelectedShopDetails(null);
    try {
      const response = await getCoffeeShopBySlug(shopId);
      if (detailsRequestRef.current === shopId && response.success && response.data) {
        setSelectedShopDetails(response.data);
      }
    } catch {
      /* name-only card is enough */

    }
  };

  const selectShop = (shop: MapShop, moveToShop = false, showDetails = true) => {
    selectedIdRef.current = shop.id;

    setSelectedShop(showDetails ? shop : null);
    if (showDetails) void loadShopDetails(shop.id);
    else detailsRequestRef.current = null;
    if (moveToShop) {
      setQuery('');
      mapInstanceRef.current?.flyTo({ center: [shop.longitude, shop.latitude], zoom: 16, duration: 700 });
    }
    paintMapRef.current(mapDataRef.current);
  };

  useEffect(() => {
    setCarouselItems(current => {
      if (!selectedShop) return carouselShops;
      if (!current.length) return carouselShops.some(shop => shop.id === selectedShop.id) ? carouselShops : [selectedShop, ...carouselShops];
      return current.some(shop => shop.id === selectedShop.id) ? current : [...current, selectedShop];
    });
  }, [mapData.shops, nearby.data, userPosition, selectedShop?.id]);

  useEffect(() => {
    if (!carouselItems.length) return;
    if (!selectedShop) { selectShop(carouselItems[0]); return; }
    const list = carouselRef.current;
    const index = carouselItems.findIndex(shop => shop.id === selectedShop.id);
    const card = list?.children[index + (carouselItems.length > 1 ? 1 : 0)] as HTMLElement | undefined;
    if (list && card) list.scrollTo({ left: card.offsetLeft + card.offsetWidth / 2 - list.clientWidth / 2, behavior: 'smooth' });
  }, [carouselItems, selectedShop?.id]);

  useEffect(() => () => { if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current); }, []);

  const handleLocate = async (requestPermission = true) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setIsLocating(true);
    const pos = await getDeviceLocation({ requestPermission, enableHighAccuracy: true, timeout: 10000, ...(requestPermission ? { maximumAge: 0 } : {}) });
    if (map !== mapInstanceRef.current) return;
    if (pos && getLocationLifetime(pos.timestamp) > 0) {
      const { latitude, longitude } = pos.coords;
      userPosRef.current = { lat: latitude, lon: longitude };
      setUserPosition({ lat: latitude, lon: longitude });
      map.flyTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 15), duration: 700 });
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([longitude, latitude]);
      } else {
        const el = document.createElement('div');
        el.style.cssText = 'width:18px;height:18px;border-radius:50%;background:#2F80ED;border:3px solid #fff;box-shadow:0 0 0 4px rgba(47,128,237,0.25);';
        userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
      }
      if (locationExpiryRef.current) clearTimeout(locationExpiryRef.current);
      locationExpiryRef.current = setTimeout(() => {
        userPosRef.current = null;
        setUserPosition(null);
        userMarkerRef.current?.remove();
        userMarkerRef.current = null;
      }, getLocationLifetime(pos.timestamp));
    }
    setIsLocating(false);
  };

  useEffect(() => {
    const container = mapRef.current;
    if (!container || mapInstanceRef.current) return;

    let cancelled = false;
    let updateTimeout: ReturnType<typeof setTimeout> | undefined;
    let paintVersion = 0;

    const clearMarkers = () => {
      markersRef.current.forEach((marker) => {
        try {
          marker.remove();
        } catch {
          /* ignore */
        }
      });
      markersRef.current = [];
    };

    const paintMap = (data: MapSearchData) => {
      const map = mapInstanceRef.current;
      if (!map) return;
      const version = ++paintVersion;
      clearMarkers();
      const zones = showZonesRef.current ? data.zones ?? [] : [];
      renderMapZones(map, zones, themeRef.current === 'dark');

      zones.forEach((zone) => {
        const marker = new maplibregl.Marker({ element: coffeeZoneLabelIcon(zone), anchor: 'center' })
          .setLngLat([zone.longitude, zone.latitude])
          .addTo(map);
        markersRef.current.push(marker);
      });

      const visible = data.shops;
      void ensureMapPinMascots().catch(() => {}).then(() => {
        if (mapInstanceRef.current !== map || version !== paintVersion) return;
        visible.forEach((shop) => {
          const selected = selectedIdRef.current === shop.id;
          const element = coffeeMapPinIcon({ focus: shop.type, selected });
          element.title = shop.title;
          element.style.zIndex = selected ? '1000' : '0';
          element.tabIndex = 0;
          element.setAttribute('role', 'button');
          element.setAttribute('aria-label', shop.title);
          const select = () => selectShop(shop);
          element.addEventListener('click', select);
          element.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              select();
            }
          });
          const marker = new maplibregl.Marker({ element, anchor: 'center' })
            .setLngLat([shop.longitude, shop.latitude])
            .addTo(map);
          markersRef.current.push(marker);
        });
      });
    };
    paintMapRef.current = paintMap;

    const latitude = Number(searchParams.get('lat'));
    const longitude = Number(searchParams.get('lon'));
    const hasCenter = !embedded && searchParams.has('lat') && searchParams.has('lon') && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
    const map = createOsmMap(container, {
      center: hasCenter ? [longitude, latitude] : undefined,
      zoom: hasCenter ? 14 : embedded ? 13 : 12,
      dark: theme === 'dark',
      zoomControl: false,
    });
    mapInstanceRef.current = map;
    setIsLoading(false);
    if (!hasCenter && !embedded) void handleLocate(false);
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);
    map.on('style.load', () => paintMap(mapDataRef.current));

    const updateCoffeeShops = () => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        void loadCoffeeShops(map).then((loaded) => {
          if (!cancelled && loaded) paintMap(loaded);
        });
      }, 300);
    };

    updateTimeout = setTimeout(updateCoffeeShops, 400);
    map.on('moveend', updateCoffeeShops);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      clearTimeout(updateTimeout);
      if (locationExpiryRef.current) clearTimeout(locationExpiryRef.current);
      mapRequestRef.current?.abort();
      clearMarkers();
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    themeRef.current = theme;
    const map = mapInstanceRef.current;
    if (!map) return;
    applyOsmMapTheme(map, theme === 'dark');
  }, [theme]);

  useEffect(() => {
    showZonesRef.current = showZones;
    localStorage.setItem('mapShowZones', String(showZones));
    const map = mapInstanceRef.current;
    if (!map) return;
    paintMapRef.current(mapDataRef.current);
    if (showZones && (mapDataRef.current.zones?.length ?? 0) === 0) {
      void loadCoffeeShops(map).then((loaded) => {
        if (loaded) paintMapRef.current(loaded);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showZones]);

  useEffect(() => {
    if (!autoPreview || !shopsLoaded || previewPaused) return;
    let index = 0;
    const showNext = () => {
      const shops = previewShopsRef.current;
      if (!shops.length) return;
      const shop = shops[index++ % shops.length];
      selectShop(shop);
      mapInstanceRef.current?.flyTo({ center: [shop.longitude, shop.latitude], zoom: 15, duration: reduceMotion ? 0 : 720 });
    };
    showNext();
    if (reduceMotion) return;
    const timer = window.setInterval(showNext, 2800);
    return () => window.clearInterval(timer);
  }, [autoPreview, shopsLoaded, previewPaused, reduceMotion]);

  const formatWorkingHours = (
    schedules?: Array<{ dayOfWeek: number | string; openTime?: string; closeTime?: string }>,
  ) => {
    if (!schedules || schedules.length === 0) return 'Часы работы не указаны';
    const today = getCurrentDayOfWeek();
    const todaySchedule = toLocalSchedules(schedules).find((s) => s.dayOfWeek === today);
    if (todaySchedule?.openTime && todaySchedule?.closeTime) {
      return `${todaySchedule.openTime} - ${todaySchedule.closeTime}`;
    }
    return 'Часы работы не указаны';
  };

  return (
    <div
      className={`relative z-0 isolate overflow-hidden ${themeClasses.bg.primary}`}
      style={{ height: embedded ? 480 : 'var(--app-content-height, 100dvh)', clipPath: embedded ? 'inset(0 round 28px 28px 0 0)' : undefined }}
      onMouseEnter={() => autoPreview && setPreviewPaused(true)}
      onMouseLeave={() => autoPreview && setPreviewPaused(false)}
      onFocusCapture={() => autoPreview && setPreviewPaused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPreviewPaused(false); }}
    >
      {!isLoading && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[550] w-[calc(100%-1.5rem)] max-w-xl">
          <div className={`flex items-center gap-3 h-14 px-5 rounded-full border shadow-lg ${themeClasses.bg.card} ${themeClasses.border.default}`}>
            <MagnifyingGlass size={24} weight="regular" className={`h-6 w-6 shrink-0 ${themeClasses.text.secondary}`} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск кофейни…"
              aria-label="Поиск кофейни по названию"
              aria-controls="map-search-results"
              className={`flex-1 min-w-0 bg-transparent outline-none text-base ${themeClasses.text.primary}`}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Очистить" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${themeClasses.text.secondary}`}>
                <X size={16} weight="bold" />
              </button>
            )}
          </div>
          {searchResults.length > 0 && (
            <div id="map-search-results" className={`mt-2 overflow-hidden rounded-2xl border shadow-xl ${themeClasses.bg.card} ${themeClasses.border.default}`}>
              {searchResults.map((shop, index) => (
                <button
                  type="button"
                  key={shop.id}
                  onClick={async () => {
                    try {
                      const location = shop.location;
                      const details = location?.latitude == null || location?.longitude == null
                        ? (await getCoffeeShopBySlug(shop.id)).data : shop;
                      const coordinates = details.location;
                      if (coordinates?.latitude == null || coordinates?.longitude == null) return;
                      selectShop({ id: shop.id, publicAddress: shop.publicAddress, title: shop.name,
                        latitude: coordinates.latitude, longitude: coordinates.longitude, type: null, primaryZoneId: null }, true);
                    } catch { /* Keep the map unchanged if the shop cannot be located. */ }
                  }}
                  className={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${index ? `border-t ${themeClasses.border.default}` : ''}`}
                >
                  <MapPin size={21} weight="bold" className="shrink-0 text-[#EAB308]" />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-semibold ${themeClasses.text.primary}`}>{shop.name}</span>
                    <span className={`block truncate text-sm ${themeClasses.text.secondary}`}>{shop.location?.address}</span>
                  </span>
                  <CaretRight size={20} className={`shrink-0 ${themeClasses.text.secondary}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-[#EAB308] text-xl">Загрузка карты...</div>
        </div>
      )}

      {shopsLoaded
        && mapData.shops.length === 0
        && mapData.clusters.length === 0
        && (mapData.zones?.length ?? 0) === 0
        && !isLoading && (
        <div
          className="absolute top-[68px] left-4 right-4 z-[500] px-3.5 py-2.5 rounded-2xl shadow-lg border flex items-center gap-2.5 pointer-events-none"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(45,36,31,0.94)' : 'rgba(255,255,255,0.96)',
            borderColor: theme === 'dark' ? '#3D2F28' : '#E7E5E4',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Mascot pose="search" size={40} className="shrink-0" />
          <span
            className="min-w-0 flex-1 text-[13px] sm:text-sm font-medium leading-snug"
            style={{ color: theme === 'dark' ? '#fff' : '#1C1917' }}
          >
            Кофейни в этой области не найдены
          </span>
        </div>
      )}

      {mapData.isTruncated && !isLoading && (
        <div className="absolute top-[68px] left-4 right-4 z-[500] px-3.5 py-2.5 rounded-2xl bg-amber-500/90 text-[#1A1412] text-center text-sm font-medium shadow-lg pointer-events-none">
          Показана часть кофеен — приблизьте карту
        </div>
      )}

      <div
        style={{ width: '100%', height: '100%' }}
        className={isLoading ? 'opacity-0' : 'opacity-100'}
      >
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <div className="absolute right-4 z-[500] flex flex-col gap-3" style={{ bottom: carouselItems.length ? 164 : 16 }}>
        <div className={`mb-3 flex flex-col overflow-hidden rounded-full border shadow-lg ${themeClasses.bg.card} ${themeClasses.border.default}`}>
          <button type="button" onClick={() => mapInstanceRef.current?.zoomIn()} aria-label="Приблизить карту" className={`flex h-14 w-14 items-center justify-center ${themeClasses.text.primary}`}><Plus size={28} className="h-7 w-7 shrink-0" /></button>
          <button type="button" onClick={() => mapInstanceRef.current?.zoomOut()} aria-label="Отдалить карту" className={`flex h-14 w-14 items-center justify-center border-t ${themeClasses.border.default} ${themeClasses.text.primary}`}><Minus size={28} className="h-7 w-7 shrink-0" /></button>
        </div>
        <button type="button" onClick={() => setShowZones(value => !value)} aria-label={showZones ? 'Скрыть кофейные зоны' : 'Показать кофейные зоны'} aria-pressed={showZones} title="Кофейные зоны" className={`flex h-14 w-14 items-center justify-center rounded-full border shadow-lg active:scale-95 ${themeClasses.bg.card} ${themeClasses.border.default} ${showZones ? 'text-[#EAB308]' : themeClasses.text.secondary}`}><Polygon size={28} className="h-7 w-7 shrink-0" weight="regular" /></button>
        <button type="button" onClick={() => void handleLocate()} disabled={isLocating} aria-label="Моё местоположение" className={`flex h-14 w-14 items-center justify-center rounded-full border shadow-lg active:scale-95 disabled:opacity-60 ${themeClasses.bg.card} ${themeClasses.border.default} ${themeClasses.text.primary}`}>
          {isLocating ? <span className="h-7 w-7 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <NavigationArrow size={30} className="h-8 w-8 shrink-0" />}
        </button>
      </div>
      {carouselItems.length > 0 && <section aria-label={userPosition ? 'Кофейни рядом' : 'Кофейни на карте'} className="absolute inset-x-0 bottom-4 z-[500]">
        <div ref={carouselRef} onScroll={() => {
          if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
          scrollTimerRef.current = setTimeout(() => {
            const list = carouselRef.current;
            if (!list) return;
            const center = list.scrollLeft + list.clientWidth / 2;
            const cards = Array.from(list.children) as HTMLElement[];
            const index = closestCardIndex(cards, center);
            const shop = loopedItems[index];
            if (carouselItems.length > 1 && (index === 0 || index === loopedItems.length - 1)) {
              const target = cards[index === 0 ? carouselItems.length : 1];
              list.scrollTo({ left: target.offsetLeft + target.offsetWidth / 2 - list.clientWidth / 2 });
            }
            if (shop && selectedIdRef.current !== shop.id) selectShop(shop, true);
          }, 150);
        }} className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ paddingInline: 'max(8vw, calc((100% - 448px) / 2))' }}>
          {loopedItems.map((shop, index) => {
            const active = selectedShop?.id === shop.id;
            const details = active ? selectedShopDetails : null;
            return <article key={`${shop.id}-${index}`} data-shop-id={shop.id} aria-label={shop.title} style={{ height: 128 }} className={`flex w-[min(448px,84vw)] shrink-0 snap-center items-center gap-4 rounded-[28px] border p-4 shadow-lg ${themeClasses.bg.card} ${themeClasses.border.default}`}>
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl"><MapShopThumb alt="" src={details?.photos?.[0] ? getPhotoUrl(details.photos[0], 'thumbnail') : undefined} /></div>
              <div className="min-w-0 flex-1">
                <p className={`mb-1 flex h-5 items-center gap-1 truncate text-sm ${themeClasses.text.secondary}`}><Star size={16} weight="fill" color="#EAB308" />{details ? details.reviewCount ? `${details.rating.toFixed(1)} · ${details.reviewCount} отзывов` : 'Нет отзывов' : userPosition ? 'Кофейня рядом' : 'Кофейня на карте'}</p>
                <button type="button" onClick={() => openPublic('shops', shop.publicAddress ?? shop.id)} style={{ textAlign: 'left', padding: 0 }} className={`block h-7 w-full truncate text-lg font-bold leading-7 hover:underline ${themeClasses.text.primary}`}>{shop.title}</button>
                <p className={`mt-1 h-5 truncate text-sm leading-5 ${themeClasses.text.secondary}`}>{details ? formatWorkingHours(details.schedules) : userPosition ? formatDistance(distanceKm(userPosition.lat, userPosition.lon, shop.latitude, shop.longitude)) : '\u00a0'}</p>
              </div>
            </article>;
          })}
        </div>
      </section>}
    </div>
  );
};

const MapShopThumb: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <ShopPhotoPlaceholder fontSize={10} />;
  return (
    <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => setFailed(true)} />
  );
};

export default MapPage;
