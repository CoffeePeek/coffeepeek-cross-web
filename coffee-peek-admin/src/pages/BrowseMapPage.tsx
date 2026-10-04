import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import {
  getCoffeeShopsByMapBounds,
  getBrowseCoffeeShopBySlug,
  MapShop,
  BrowseCoffeeShopDetails,
} from '../api/coffeeShops';
import { Button } from '../components/ui/Button';
import { coffeeCircleIcon, createOsmMap, getMapBoundsBox } from '../map/osmMap';

export const BrowseMapPage: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const paintMarkersRef = useRef<(shopsList: MapShop[]) => void>(() => undefined);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shops, setShops] = useState<MapShop[]>([]);
  const [shopsLoaded, setShopsLoaded] = useState(false);
  const [selectedShop, setSelectedShop] = useState<MapShop | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<BrowseCoffeeShopDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Monotonic request ids: only the latest response of each kind may update state.
  const boundsRequestIdRef = useRef(0);
  const detailsRequestIdRef = useRef(0);

  const loadCoffeeShops = async (map: MapLibreMap): Promise<MapShop[] | null> => {
    const requestId = ++boundsRequestIdRef.current;
    try {
      const { minLat, minLon, maxLat, maxLon } = getMapBoundsBox(map);
      const response = await getCoffeeShopsByMapBounds(minLat, minLon, maxLat, maxLon);
      if (requestId !== boundsRequestIdRef.current) return null;
      const shopsList = response.data?.shops ?? [];
      setShops(shopsList);
      setShopsLoaded(true);
      setError(null);
      return shopsList;
    } catch {
      if (requestId !== boundsRequestIdRef.current) return null;
      setShopsLoaded(true);
      setError('Не удалось загрузить кофейни на карте');
      return [];
    }
  };

  const loadShopDetails = async (shopId: string) => {
    const requestId = ++detailsRequestIdRef.current;
    setSelectedDetails(null);
    setIsLoadingDetails(true);
    try {
      const response = await getBrowseCoffeeShopBySlug(shopId);
      if (requestId === detailsRequestIdRef.current && response.data) setSelectedDetails(response.data);
    } catch {
      // Details are optional; the panel falls back to the map summary.
    } finally {
      if (requestId === detailsRequestIdRef.current) setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    const container = mapRef.current;
    if (!container || mapInstanceRef.current) return;

    let cancelled = false;
    let updateTimeout: ReturnType<typeof setTimeout> | undefined;

    const clearMarkers = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };

    const paintMarkers = (shopsList: MapShop[]) => {
      const map = mapInstanceRef.current;
      if (!map) return;
      clearMarkers();
      shopsList.forEach((shop) => {
        if (!Number.isFinite(shop.latitude) || !Number.isFinite(shop.longitude)) return;
        const selected = selectedIdRef.current === shop.id;
        const element = coffeeCircleIcon(selected);
        element.title = shop.title;
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          selectedIdRef.current = shop.id;
          setSelectedShop(shop);
          void loadShopDetails(shop.id);
          paintMarkers(shopsList);
        });
        const marker = new maplibregl.Marker({ element }).setLngLat([shop.longitude, shop.latitude]).addTo(map);
        markersRef.current.push(marker);
      });
    };
    paintMarkersRef.current = paintMarkers;

    const map = createOsmMap(container, {
      zoom: 12,
      dark: true,
    });
    mapInstanceRef.current = map;
    setIsLoading(false);

    const updateShops = () => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        void loadCoffeeShops(map).then((loaded) => {
          if (!cancelled && loaded) paintMarkers(loaded);
        });
      }, 300);
    };

    updateTimeout = setTimeout(updateShops, 400);
    // moveend also fires after zooming.
    map.on('moveend', updateShops);

    return () => {
      cancelled = true;
      clearTimeout(updateTimeout);
      clearMarkers();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (shops.length > 0) paintMarkersRef.current(shops);
  }, [shops, selectedShop?.id]);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">Карта кофеен</h2>
          <p className="text-sm text-text-muted dark:text-stone-400 font-body mt-0.5">
            Просмотр кофеен на карте — без редактирования
          </p>
        </div>
        <Link to="/coffee-shops">
          <Button variant="secondary" size="sm">
            Список кофеен
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div
        className="relative bg-surface-dark border border-border-dark rounded-xl overflow-hidden"
        style={{ height: 'min(70vh, 600px)' }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-primary text-sm">Загрузка карты...</div>
          </div>
        )}

        {shopsLoaded && shops.length === 0 && !isLoading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] px-4 py-2 rounded-full bg-[#2D241F]/90 border border-border-dark text-stone-300 text-sm pointer-events-none">
            Кофейни в этой области не найдены
          </div>
        )}

        <div className="w-full h-full min-h-[400px]">
          <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />
        </div>

        {selectedShop && (
          <div className="absolute bottom-4 left-4 right-4 z-[500] max-w-md mx-auto bg-surface-dark border border-border-dark rounded-xl shadow-2xl p-4">
            {isLoadingDetails ? (
              <p className="text-primary text-sm text-center">Загрузка...</p>
            ) : (
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold truncate">{selectedShop.title}</h3>
                  {selectedDetails?.address && (
                    <p className="text-stone-400 text-xs mt-1 truncate">{selectedDetails.address}</p>
                  )}
                  {selectedDetails?.rating != null && (
                    <p className="text-stone-400 text-xs mt-1">
                      ⭐ {selectedDetails.rating.toFixed(1)}
                      {selectedDetails.reviewCount != null && ` · ${selectedDetails.reviewCount} отзывов`}
                    </p>
                  )}
                </div>
                <Link to={selectedShop.canonicalPath}>
                  <Button variant="primary" size="sm">
                    Открыть
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
