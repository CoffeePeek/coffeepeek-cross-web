import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LngLatLike, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { brand } from '../design-system/tokens';

maplibregl.setWorkerUrl(mapLibreWorkerUrl);

export const MINSK_CENTER: [number, number] = [27.5667, 53.9];

export type MapBoundsBox = {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
};

type MapTheme = 'light' | 'dark';

const STYLE_URLS: Record<MapTheme, string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

const COFFEEPEEK_PALETTE = {
  light: {
    background: '#F8F6F3', residential: '#EFEAE5', park: '#E4E8DF', building: '#E3DDD7',
    water: '#D3DEE1', waterLine: '#B2C5CA', roadCasing: '#D6CEC7', road: '#FFFFFF',
    minorRoad: '#E8E2DC', boundary: '#AA9D94', text: '#625A55', waterText: '#687E84', textHalo: '#FAF8F5',
  },
  dark: {
    background: '#1A1412', residential: '#211B18', park: '#25231D', building: '#302722',
    water: '#26343A', waterLine: '#42545B', roadCasing: '#332A26', road: '#4B403A',
    minorRoad: '#3D342F', boundary: '#66564D', text: '#C8BEB7', waterText: '#9AAFB5', textHalo: '#1A1412',
  },
} as const;

const NOISE_PHRASES = [
  'house-number', 'house_number', 'transit_stop', 'transit-stop', 'bus_stop', 'bus-stop',
  'ferry_terminal', 'ferry-terminal', 'aerodrome_label', 'aerodrome-label', 'airport_label', 'airport-label',
];

function isNoiseLayer(id: string): boolean {
  if (id.startsWith('coffeepeek-')) return false;
  const normalized = id.toLowerCase();
  const segments = normalized.split(/[-_.]/);
  return segments.includes('poi') || segments.includes('housenumber') || segments.includes('oneway')
    || NOISE_PHRASES.some((phrase) => normalized.includes(phrase));
}

function safely(action: () => void): void {
  try { action(); } catch { /* External styles may expose incompatible paint properties. */ }
}

function applyCoffeePeekStyle(map: MapLibreMap, theme: MapTheme): void {
  const palette = COFFEEPEEK_PALETTE[theme];
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id.toLowerCase();
    if (id.startsWith('coffeepeek-')) continue;
    if (isNoiseLayer(id)) {
      safely(() => map.setLayoutProperty(layer.id, 'visibility', 'none'));
      continue;
    }
    if (id.includes('highway_path')) {
      safely(() => map.setLayerZoomRange(layer.id, Math.max(layer.minzoom ?? 0, 15), layer.maxzoom ?? 24));
    }
    if (layer.type === 'background') {
      safely(() => map.setPaintProperty(layer.id, 'background-color', palette.background));
    } else if (layer.type === 'fill') {
      if (id === 'water' || id.startsWith('water_')) {
        safely(() => map.setPaintProperty(layer.id, 'fill-color', palette.water));
        safely(() => map.setPaintProperty(layer.id, 'fill-outline-color', palette.waterLine));
      } else if (id === 'park' || id.includes('landcover_wood') || id.includes('landuse_park')) {
        safely(() => map.setPaintProperty(layer.id, 'fill-color', palette.park));
      } else if (id.includes('building')) {
        safely(() => map.setPaintProperty(layer.id, 'fill-color', palette.building));
        safely(() => map.setPaintProperty(layer.id, 'fill-outline-color', palette.roadCasing));
      } else if (id.includes('residential')) {
        safely(() => map.setPaintProperty(layer.id, 'fill-color', palette.residential));
      }
    } else if (layer.type === 'line') {
      let color: string | undefined;
      if (id.includes('waterway')) color = palette.waterLine;
      else if (id.includes('boundary')) color = palette.boundary;
      else if (id.includes('highway') || id.includes('road') || id.includes('bridge') || id.includes('tunnel')) {
        if (id.includes('casing')) color = palette.roadCasing;
        else if (id.includes('inner') || id.includes('motorway') || id.includes('major')) color = palette.road;
        else color = palette.minorRoad;
      }
      if (color) safely(() => map.setPaintProperty(layer.id, 'line-color', color));
    } else if (layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout) {
      safely(() => map.setPaintProperty(layer.id, 'text-color', id.includes('water') ? palette.waterText : palette.text));
      safely(() => map.setPaintProperty(layer.id, 'text-halo-color', palette.textHalo));
      safely(() => map.setPaintProperty(layer.id, 'text-halo-width', 1.2));
    }
  }
}

export function createOsmMap(
  container: HTMLElement,
  options: {
    center?: LngLatLike;
    zoom?: number;
    dark?: boolean;
    interactive?: boolean;
    zoomControl?: boolean;
  } = {},
): MapLibreMap {
  const interactive = options.interactive !== false;
  const theme: MapTheme = options.dark ? 'dark' : 'light';
  const map = new maplibregl.Map({
    container,
    style: STYLE_URLS[theme],
    center: options.center ?? MINSK_CENTER,
    zoom: options.zoom ?? 12,
    attributionControl: false,
    interactive,
  });
  map.getContainer().style.backgroundColor = COFFEEPEEK_PALETTE[theme].background;
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  const attribution = map.getContainer().querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib');
  attribution?.classList.remove('maplibregl-compact-show');
  attribution?.removeAttribute('open');
  if (options.zoomControl !== false) {
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  }
  map.once('style.load', () => applyCoffeePeekStyle(map, theme));
  updateMapZoneLabels(map);
  map.on('zoom', () => updateMapZoneLabels(map));
  requestAnimationFrame(() => map.resize());

  return map;
}

export function applyOsmMapTheme(map: MapLibreMap, dark: boolean): void {
  const theme: MapTheme = dark ? 'dark' : 'light';
  map.getContainer().style.backgroundColor = COFFEEPEEK_PALETTE[theme].background;
  map.setStyle(STYLE_URLS[theme] as string | StyleSpecification);
  map.once('style.load', () => applyCoffeePeekStyle(map, theme));
}

export function getMapBoundsBox(map: MapLibreMap): MapBoundsBox {
  const bounds = map.getBounds();
  return {
    minLat: bounds.getSouth(),
    minLon: bounds.getWest(),
    maxLat: bounds.getNorth(),
    maxLon: bounds.getEast(),
  };
}

export type MapCoffeeFocus = 'specialty' | 'coffee_bar' | 'cafe';

export function parseCoffeeFocus(value: unknown): MapCoffeeFocus {
  if (value === 1 || value === '1' || value === 'specialty' || value === 'Specialty') {
    return 'specialty';
  }
  if (value === 3 || value === '3' || value === 'cafe' || value === 'Cafe') {
    return 'cafe';
  }
  return 'coffee_bar';
}

const PIN_BY_FOCUS: Record<MapCoffeeFocus, string> = {
  specialty: '/icons/map/bean.png',
  coffee_bar: '/icons/map/cup.png',
  cafe: '/icons/map/fork-knife.png',
};

const PIN_SIZE = 31;
const PIN_SIZE_SELECTED = 41;
const PIN_SIZE_DETAIL = 43;

function pinDiameter(selected: boolean, detail?: boolean): number {
  if (detail) return PIN_SIZE_DETAIL;
  return selected ? PIN_SIZE_SELECTED : PIN_SIZE;
}

function buildPinHtml(
  focus: MapCoffeeFocus,
  selected: boolean,
  detail?: boolean,
): string {
  const size = pinDiameter(selected, detail);
  const selectedClass = selected ? ' coffee-map-pin--selected' : '';
  const detailClass = detail ? ' coffee-map-pin--detail' : '';
  const face = `<span class="coffee-pin-face"><span class="coffee-pin-icon" style="--pin-icon:url('${PIN_BY_FOCUS[focus]}')"></span></span>`;

  return `<div class="coffee-pin-shell${selectedClass}${detailClass}" style="--pin-size:${size}px" aria-hidden="true"><span class="coffee-pin-pulse"></span>${face}</div>`;
}

export function coffeeMapPinIcon(options: { focus?: unknown; selected?: boolean } = {}): HTMLElement {
  const focus = parseCoffeeFocus(options.focus);
  const selected = Boolean(options.selected);
  const element = document.createElement('div');
  element.className = `coffee-map-pin coffee-map-pin--${focus}${selected ? ' coffee-map-pin--selected' : ''}`;
  // Keep a 44px touch target around the smaller Android-sized face.
  element.style.width = '44px';
  element.style.height = '44px';
  element.innerHTML = buildPinHtml(focus, selected);
  return element;
}

/** @deprecated use coffeeMapPinIcon */
export function coffeeCircleIcon(selected: boolean, focus?: unknown): HTMLElement {
  return coffeeMapPinIcon({ selected, focus });
}

/** Pin for shop detail sidebar / address picker (slightly larger). */
export function coffeeDetailIcon(focus?: unknown): HTMLElement {
  const parsed = parseCoffeeFocus(focus);
  const element = document.createElement('div');
  element.className = `coffee-map-pin coffee-map-pin--${parsed} coffee-map-pin--selected coffee-map-pin--detail`;
  element.style.width = '44px';
  element.style.height = '44px';
  element.innerHTML = buildPinHtml(parsed, true, true);
  return element;
}

export function coffeeMapClusterIcon(count: number): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'coffee-map-cluster coffee-map-pin';
  element.style.width = '44px';
  element.style.height = '44px';
  element.setAttribute('aria-label', `Кофеен в группе: ${count}. Приблизить карту`);
  element.innerHTML = count === 1 ? buildPinHtml('specialty', false)
    : `<span class="coffee-pin-shell" aria-hidden="true"><span class="coffee-pin-face coffee-cluster-count">${count > 99 ? '99+' : count}</span></span>`;
  return element;
}

export function zoomToMapBounds(map: MapLibreMap, bounds: MapBoundsBox): void {
  const duration = 350;
  if (bounds.minLat === bounds.maxLat && bounds.minLon === bounds.maxLon) {
    map.easeTo({ center: [bounds.minLon, bounds.minLat], zoom: Math.min(map.getZoom() + 1, 22), duration });
  } else {
    const container = map.getContainer();
    const camera = map.cameraForBounds([[bounds.minLon, bounds.minLat], [bounds.maxLon, bounds.maxLat]], {
      padding: Math.min(container.clientWidth, container.clientHeight) * 0.25,
      maxZoom: Math.min(map.getZoom() + 2, 22),
    });
    map.easeTo({
      ...camera,
      center: camera?.center ?? [(bounds.minLon + bounds.maxLon) / 2, (bounds.minLat + bounds.maxLat) / 2],
      // A large zone can already fit the viewport; repeated taps must still unfold it.
      zoom: Math.min(22, Math.max(map.getZoom() + 1, camera?.zoom ?? map.getZoom() + 1)),
      duration,
    });
  }
}

export type MapZoneLike = {
  id: string;
  name: string;
  color?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  shopCount: number;
  polygon?: { latitude: number; longitude: number }[];
};

const ZONES_SOURCE_ID = 'coffeepeek-zones';
const ZONES_FILL_LAYER_ID = 'coffeepeek-zones-fill';
const ZONES_LINE_LAYER_ID = 'coffeepeek-zones-line';

export function updateMapZoneLabels(map: MapLibreMap): void {
  map.getContainer().classList.toggle('coffee-map--zoomed-out', map.getZoom() < 11);
}

function zonePolygon(zone: MapZoneLike): [number, number][] {
  if (zone.polygon && zone.polygon.length >= 3) {
    const ring = zone.polygon.map((p): [number, number] => [Number(p.longitude), Number(p.latitude)]);
    return [...ring, ring[0]];
  }
  const earthRadiusMeters = 6_371_008.8;
  const angularDistance = Math.max(0, zone.radiusMeters) / earthRadiusMeters;
  const latitude = zone.latitude * Math.PI / 180;
  const longitude = zone.longitude * Math.PI / 180;
  const coordinates: [number, number][] = [];

  for (let step = 0; step <= 64; step += 1) {
    const bearing = step / 64 * Math.PI * 2;
    const targetLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(angularDistance)
      + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const targetLongitude = longitude + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(targetLatitude),
    );
    coordinates.push([
      ((targetLongitude * 180 / Math.PI + 540) % 360) - 180,
      targetLatitude * 180 / Math.PI,
    ]);
  }

  return coordinates;
}

export function getMapZoneBounds(zone: MapZoneLike): MapBoundsBox {
  const coordinates = zonePolygon(zone);
  return {
    minLat: Math.min(...coordinates.map(point => point[1])),
    minLon: Math.min(...coordinates.map(point => point[0])),
    maxLat: Math.max(...coordinates.map(point => point[1])),
    maxLon: Math.max(...coordinates.map(point => point[0])),
  };
}

/** Adds or updates zone outlines (polygon, or bounding circle for legacy data) below the HTML markers. */
export function renderMapZones(map: MapLibreMap, zones: MapZoneLike[], isDark: boolean): void {
  if (!map.isStyleLoaded()) return;
  const data = {
    type: 'FeatureCollection' as const,
    features: zones.map((zone) => ({
      type: 'Feature' as const,
      properties: { id: zone.id, name: zone.name, shopCount: zone.shopCount, color: zone.color ?? brand.primary },
      geometry: { type: 'Polygon' as const, coordinates: [zonePolygon(zone)] },
    })),
  };
  const source = map.getSource(ZONES_SOURCE_ID) as GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
  } else {
    map.addSource(ZONES_SOURCE_ID, { type: 'geojson', data });
  }

  if (!map.getLayer(ZONES_FILL_LAYER_ID)) {
    map.addLayer({
      id: ZONES_FILL_LAYER_ID,
      type: 'fill',
      source: ZONES_SOURCE_ID,
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': isDark ? 0.16 : 0.12 },
    });
  } else {
    map.setPaintProperty(ZONES_FILL_LAYER_ID, 'fill-opacity', isDark ? 0.16 : 0.12);
  }
  if (!map.getLayer(ZONES_LINE_LAYER_ID)) {
    map.addLayer({
      id: ZONES_LINE_LAYER_ID,
      type: 'line',
      source: ZONES_SOURCE_ID,
      paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.8 },
    });
  }
}

export function coffeeZoneLabelIcon(zone: MapZoneLike): HTMLElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'coffee-map-zone-label';
  element.setAttribute('aria-label', `Зона ${zone.name}, кофеен: ${zone.shopCount}. Приблизить карту`);
  element.style.setProperty('--zone-color', zone.color ?? brand.primary);
  const name = document.createElement('strong');
  name.textContent = zone.name;
  const count = document.createElement('span');
  count.textContent = `· ${zone.shopCount}`;
  count.title = `Кофеен в зоне: ${zone.shopCount}`;
  element.append(name, count);
  return element;
}
