import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import { getMapShops, type MapSearchData } from '../api/coffeeshop';
import { getShopCheckInCounts } from '../api/discovery';
import { useTheme } from '../contexts/ThemeContext';
import { getMapBoundsBox, type MapBoundsBox } from '../map/osmMap';
import { getThemeClasses } from '../utils/theme';
import { Flame } from './Icon';

const HEATMAP_ID = 'coffeepeek-check-in-heatmap';
const HEATMAP_COLORS = ['#3B82F6', '#22D3EE', '#FACC15', '#F97316', '#DC2626'];

function coverViewport(viewport: MapBoundsBox, bounds?: MapBoundsBox): MapBoundsBox {
  if (bounds && viewport.minLat >= bounds.minLat && viewport.maxLat <= bounds.maxLat
    && viewport.minLon >= bounds.minLon && viewport.maxLon <= bounds.maxLon) {
    return bounds;
  }
  const latPadding = (viewport.maxLat - viewport.minLat) / 2;
  const lonPadding = (viewport.maxLon - viewport.minLon) / 2;
  return {
    minLat: viewport.minLat - latPadding,
    maxLat: viewport.maxLat + latPadding,
    minLon: viewport.minLon - lonPadding,
    maxLon: viewport.maxLon + lonPadding,
  };
}

export default function MapCheckInHeatmap({ map }: { map: MapLibreMap }) {
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const [visible, setVisible] = useState(false);
  const [bounds, setBounds] = useState(() => coverViewport(getMapBoundsBox(map)));

  useEffect(() => {
    if (!visible) return;
    let timer: ReturnType<typeof setTimeout>;
    const updateBounds = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const viewport = getMapBoundsBox(map);
        setBounds(current => coverViewport(viewport, current));
      }, 300);
    };
    map.on('moveend', updateBounds);
    return () => {
      clearTimeout(timer);
      map.off('moveend', updateBounds);
    };
  }, [map, visible]);

  const counts = useQuery({
    queryKey: ['map', 'shop-check-in-counts'],
    queryFn: ({ signal }) => getShopCheckInCounts(signal),
    staleTime: 5 * 60_000,
    enabled: visible,
  });
  const viewport = useQuery<MapSearchData>({
    queryKey: ['map', 'heatmap-shops', bounds],
    queryFn: ({ signal }) => getMapShops(bounds, signal).then(response => response.data),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    enabled: visible,
  });
  const shops = viewport.data?.shops;
  const checkIns = counts.data;
  const hasCheckIns = shops?.some(shop => (checkIns?.[shop.id] ?? 0) > 0);

  useEffect(() => {
    if (visible && (!shops || !checkIns)) return;

    const data: FeatureCollection<Point, { count: number }> = {
      type: 'FeatureCollection',
      features: [],
    };
    if (visible && shops && checkIns) {
      for (const shop of shops) {
        const count = checkIns[shop.id];
        if (!count) continue;
        data.features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [shop.longitude, shop.latitude] },
          properties: { count },
        });
      }
    }

    const render = () => {
      map.off('idle', render);
      const source = map.getSource<GeoJSONSource>(HEATMAP_ID);
      if (source) {
        void source.setData(data);
        return;
      }
      if (!data.features.length) return;
      map.addSource(HEATMAP_ID, { type: 'geojson', data });
      const firstLabel = map.getStyle().layers.find(layer => layer.type === 'symbol');
      map.addLayer({
        id: HEATMAP_ID,
        type: 'heatmap',
        source: HEATMAP_ID,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'count'], 0, 0, 1, 0.12, 10, 0.48, 50, 0.9, 150, 1.5],
          'heatmap-intensity': 4,
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 7, 18, 12, 34, 17, 48],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(59,130,246,0)', 0.12, HEATMAP_COLORS[0], 0.28, HEATMAP_COLORS[1],
            0.5, HEATMAP_COLORS[2], 0.75, HEATMAP_COLORS[3], 1, HEATMAP_COLORS[4]],
          'heatmap-opacity': 0.8,
        },
      }, firstLabel?.id);
    };

    map.on('style.load', render);
    if (map.getSource(HEATMAP_ID) || map.isStyleLoaded()) render();
    else map.once('idle', render);
    return () => {
      map.off('style.load', render);
      map.off('idle', render);
    };
  }, [map, visible, shops, checkIns]);

  let status: string | undefined;
  if (counts.isError || viewport.isError) status = 'Не удалось обновить данные о чекинах';
  else if (counts.isPending || viewport.isPending) status = 'Загружаем чекины…';
  else if (!viewport.isPlaceholderData) {
    if (viewport.data?.isTruncated) status = 'Показана часть кофеен. Приблизьте карту';
    else if (!hasCheckIns) status = 'В этой области пока нет чекинов';
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!visible) {
            const viewport = getMapBoundsBox(map);
            setBounds(current => coverViewport(viewport, current));
          }
          setVisible(!visible);
        }}
        aria-label="Тепловая карта чекинов"
        aria-pressed={visible}
        title="Тепловая карта чекинов"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border p-0 shadow-lg active:scale-95 aria-pressed:text-orange-700 dark:aria-pressed:text-orange-500 ${themeClasses.bg.card} ${themeClasses.border.default} ${themeClasses.text.secondary}`}
      >
        <Flame aria-hidden="true" size={24} className="h-6 w-6 shrink-0" weight={visible ? 'fill' : 'bold'} />
      </button>
      {visible && (
        <div className={`absolute right-0 bottom-full mb-2 w-52 rounded-xl border px-3 py-2 text-xs shadow-lg ${themeClasses.bg.card} ${themeClasses.border.default} ${themeClasses.text.primary}`}>
          <p className="font-semibold">Чекины в кофейнях</p>
          {hasCheckIns && (
            <>
              <div aria-hidden="true" className="my-1.5 h-1.5 rounded-full" style={{ background: `linear-gradient(to right, ${HEATMAP_COLORS.join(', ')})` }} />
              <div className={`flex justify-between ${themeClasses.text.secondary}`}><span>Меньше</span><span>Больше</span></div>
            </>
          )}
          {status && <p role="status" className={`mt-1 ${themeClasses.text.secondary}`}>{status}</p>}
        </div>
      )}
    </>
  );
}
