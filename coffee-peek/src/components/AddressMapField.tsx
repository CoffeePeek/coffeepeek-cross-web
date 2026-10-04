import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/theme';
import { createOsmMap, coffeeDetailIcon, MINSK_CENTER } from '../map/osmMap';
import { MapPin, Compass, MapTrifold, NavigationArrow } from '@/components/Icon';

export type LatLng = { lat: number; lng: number };

interface AddressMapFieldProps {
  value: string;
  onChange: (address: string) => void;
  onCoordsChange?: (coords: LatLng | null) => void;
  error?: string;
  inputClassName?: string;
  compact?: boolean;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'json');
    url.searchParams.set('accept-language', 'ru');
    url.searchParams.set('addressdetails', '1');
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const a = data.address ?? {};
    const street = a.road || a.pedestrian || a.footway || a.residential || a.path;
    const house = a.house_number;
    const city = a.city || a.town || a.village || a.municipality;
    if (street) {
      const parts = [street + (house ? ` ${house}` : ''), city].filter(Boolean);
      return parts.join(', ');
    }
    return data.display_name?.split(',').slice(0, 3).join(',').trim() || null;
  } catch {
    return null;
  }
}

function readDevicePosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Геолокация недоступна'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    );
  });
}

export const AddressMapField: React.FC<AddressMapFieldProps> = ({
  value,
  onChange,
  onCoordsChange,
  error,
  inputClassName = '',
  compact = false,
}) => {
  const inputId = useId();
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const isDark = theme === 'dark';
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);

  const [coords, setCoords] = useState<LatLng | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoHint, setGeoHint] = useState<string | null>(null);

  const geocodeSeqRef = useRef(0);
  useEffect(() => () => { ++geocodeSeqRef.current; }, []);
  const applyCoords = useCallback(
    async (next: LatLng, fillAddress: boolean) => {
      setCoords(next);
      onCoordsChange?.(next);
      if (!fillAddress) return;
      // Поздний ответ по старой точке не должен перезаписать адрес новой.
      const seq = ++geocodeSeqRef.current;
      const address = await reverseGeocode(next.lat, next.lng);
      if (address && seq === geocodeSeqRef.current) onChange(address);
    },
    [onChange, onCoordsChange],
  );

  const locateMe = useCallback(
    async () => {
      setLocating(true);
      setGeoHint(null);
      const seq = ++geocodeSeqRef.current;
      try {
        const pos = await readDevicePosition();
        if (seq !== geocodeSeqRef.current) return;
        await applyCoords(pos, true);
      } catch {
        if (seq !== geocodeSeqRef.current) return;
        setGeoHint('Не удалось определить местоположение — укажите адрес или выберите на карте');
        setCoords((prev) => prev ?? { lat: MINSK_CENTER[1], lng: MINSK_CENTER[0] });
      } finally {
        setLocating(false);
      }
    },
    [applyCoords],
  );

  useEffect(() => {
    if (!mapOpen || !mapRef.current) return;

    const center: [number, number] = coords
      ? [coords.lng, coords.lat]
      : MINSK_CENTER;

    const map = createOsmMap(mapRef.current, {
      center,
      zoom: 15,
      dark: isDark,
      interactive: true,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    const markerElement = coffeeDetailIcon();
    markerElement.title = 'Адрес кофейни';
    const marker = new maplibregl.Marker({
      element: markerElement,
      anchor: 'center',
      draggable: true,
    }).setLngLat(center).addTo(map);
    markerRef.current = marker;

    const syncFromLatLng = (ll: { lat: number; lng: number }) => {
      void applyCoords({ lat: ll.lat, lng: ll.lng }, true);
    };

    marker.on('dragend', () => {
      const ll = marker.getLngLat();
      syncFromLatLng(ll);
    });

    map.on('click', (e) => {
      marker.setLngLat(e.lngLat);
      syncFromLatLng(e.lngLat);
    });

    requestAnimationFrame(() => map.resize());

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
    // Recreate map when opened / theme changes; coords updates move marker below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapOpen, isDark]);

  useEffect(() => {
    if (!mapOpen || !coords || !markerRef.current || !mapInstanceRef.current) return;
    const marker = markerRef.current;
    const map = mapInstanceRef.current;
    const current = marker.getLngLat();
    if (Math.abs(current.lat - coords.lat) < 1e-7 && Math.abs(current.lng - coords.lng) < 1e-7) {
      return;
    }
    marker.setLngLat([coords.lng, coords.lat]);
    map.panTo([coords.lng, coords.lat]);
  }, [coords, mapOpen]);

  const muted = themeClasses.text.secondary;
  const primary = themeClasses.text.primary;

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className={compact ? 'shop-wizard-label' : `${muted} text-sm mb-2 block font-medium`}>Адрес *</label>
      <div className={compact ? 'shop-wizard-address-row' : ''}>
        <div className={compact ? 'shop-wizard-address-input' : ''}>
          {compact && <button type="button" className="shop-wizard-locate" aria-label="Моё местоположение" title="Моё местоположение" disabled={locating} onClick={() => void locateMe()}><NavigationArrow size={24} weight="light" /></button>}
          <input
            id={inputId}
            type="text"
            required
            value={value}
            onChange={(e) => { ++geocodeSeqRef.current; onChange(e.target.value); }}
            className={inputClassName}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            placeholder="Улица и дом"
          />
        </div>
        {compact && <button type="button" className="shop-wizard-map-button" aria-label={mapOpen ? 'Скрыть карту' : 'Выбрать на карте'} aria-expanded={mapOpen} onClick={() => setMapOpen((open) => !open)}><MapTrifold size={23} weight="light" /></button>}
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
      )}

      {!compact && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={locating}
            onClick={() => void locateMe()}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border ${themeClasses.border.default} ${themeClasses.bg.input} ${primary} hover:border-[#EAB308] transition-colors disabled:opacity-50`}
          >
            <Compass size={16} className="text-[#EAB308]" />
            {locating ? 'Определяем…' : 'Моё местоположение'}
          </button>
          <button
            type="button"
            onClick={() => setMapOpen((open) => !open)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border ${
              mapOpen ? 'border-[#EAB308] bg-[#EAB308]/10' : themeClasses.border.default
            } ${themeClasses.bg.input} ${primary} hover:border-[#EAB308] transition-colors`}
          >
            <MapTrifold size={16} className="text-[#EAB308]" />
            {mapOpen ? 'Скрыть карту' : 'Выбрать на карте'}
          </button>
        </div>
      )}

      {geoHint && <p className={`text-xs ${muted}`}>{geoHint}</p>}

      {mapOpen && (
        <div className="space-y-1.5">
          <p className={`text-xs ${muted} flex items-center gap-1`}>
            <MapPin size={12} />
            Нажмите на карту или перетащите маркер
          </p>
          <div
            className={`h-56 sm:h-72 w-full rounded-2xl overflow-hidden border ${themeClasses.border.default}`}
          >
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressMapField;
