import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LngLatLike, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { brand, dark, light } from '../design-system/tokens';

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

const PIN_BY_FOCUS: Record<
  MapCoffeeFocus,
  { fill: string; ring: string; mascot: string }
> = {
  specialty: {
    fill: brand.primary,
    ring: brand.primaryDark,
    mascot: '/maskot-props/maskot-with-bean.png',
  },
  coffee_bar: {
    fill: dark.background,
    ring: dark.border,
    mascot: '/maskot-props/maskot-wthi-cup.png',
  },
  cafe: {
    fill: light.textSecondary,
    ring: dark.borderHover,
    mascot: '/maskot-props/maskot-with-dessert.png',
  },
};

const PIN_SIZE = 44;
const PIN_SIZE_SELECTED = 54;
const PIN_SIZE_DETAIL = 43;

const mascotCanvases = new Map<string, HTMLCanvasElement>();
let mascotsPromise: Promise<void> | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function knockOutBlack(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  const width = canvas.width;
  const height = canvas.height;
  const isBg = (i: number) => {
    const luma = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    return luma < 40 && pixels[i + 3] > 8;
  };
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (seen[p]) return;
    seen[p] = 1;
    if (isBg(p * 4)) stack.push(p);
  };
  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const i = p * 4;
    pixels[i + 3] = 0;
    const x = p % width;
    const y = (p - x) / width;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function ensureMapPinMascots(): Promise<void> {
  if (!mascotsPromise) {
    mascotsPromise = Promise.all(
      Object.values(PIN_BY_FOCUS).map(async ({ mascot }) => {
        const img = await loadImage(mascot);
        mascotCanvases.set(mascot, knockOutBlack(img));
      }),
    ).then(
      () => {},
      (err) => {
        // Не кэшируем провал: следующий вызов попробует снова, иначе пинов не будет до перезагрузки.
        mascotsPromise = null;
        throw err;
      },
    );
  }
  return mascotsPromise;
}

ensureMapPinMascots().catch(() => {});

function pinDiameter(selected: boolean, detail?: boolean): number {
  if (detail) return PIN_SIZE_DETAIL;
  return selected ? PIN_SIZE_SELECTED : PIN_SIZE;
}

function renderMascotAvatarDataUrl(
  focus: MapCoffeeFocus,
  size: number,
  selected: boolean,
): string {
  const { fill, ring, mascot } = PIN_BY_FOCUS[focus];
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = (size * dpr) / 2;
  const cy = (size * dpr) / 2;
  const radius = (size * dpr) / 2 - 1;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();

  const mascotCanvas = mascotCanvases.get(mascot);
  if (mascotCanvas) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2 * dpr, 0, Math.PI * 2);
    ctx.clip();
    const drawSize = size * dpr * 1.72;
    const offsetY = size * dpr * 0.08;
    ctx.drawImage(
      mascotCanvas,
      cx - drawSize / 2,
      cy - drawSize * 0.58 + offsetY,
      drawSize,
      drawSize,
    );
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, radius - dpr, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5 * dpr;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius - 0.5 * dpr, 0, Math.PI * 2);
  ctx.strokeStyle = ring;
  ctx.lineWidth = (selected ? 1.6 : 1.1) * dpr;
  ctx.globalAlpha = selected ? 0.95 : 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (selected) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 1.5 * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = `${brand.primary}99`;
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();
    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}

function buildPinHtml(
  focus: MapCoffeeFocus,
  selected: boolean,
  detail?: boolean,
): string {
  const size = pinDiameter(selected, detail);
  const selectedClass = selected ? ' coffee-map-pin--selected' : '';
  const detailClass = detail ? ' coffee-map-pin--detail' : '';
  const avatar = renderMascotAvatarDataUrl(focus, size, selected);

  const face = avatar
    ? `<img class="coffee-pin-face" src="${avatar}" alt="" draggable="false" width="${size}" height="${size}" />`
    : `<span class="coffee-pin-dot coffee-pin-dot--placeholder" style="--pin-fill:${PIN_BY_FOCUS[focus].fill}"></span>`;

  return `<div class="coffee-pin-shell${selectedClass}${detailClass}" style="--pin-size:${size}px" aria-hidden="true"><span class="coffee-pin-pulse"></span>${face}</div>`;
}

export function coffeeMapPinIcon(options: { focus?: unknown; selected?: boolean } = {}): HTMLElement {
  const focus = parseCoffeeFocus(options.focus);
  const selected = Boolean(options.selected);
  const size = pinDiameter(selected);
  const element = document.createElement('div');
  element.className = `coffee-map-pin coffee-map-pin--${focus}${selected ? ' coffee-map-pin--selected' : ''}`;
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
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
  const size = PIN_SIZE_DETAIL;
  const element = document.createElement('div');
  element.className = `coffee-map-pin coffee-map-pin--${parsed} coffee-map-pin--selected coffee-map-pin--detail`;
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
  element.innerHTML = buildPinHtml(parsed, true, true);
  return element;
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
  const element = document.createElement('div');
  element.className = 'coffee-map-zone-label';
  element.style.setProperty('--zone-color', zone.color ?? brand.primary);
  const name = document.createElement('strong');
  name.textContent = zone.name;
  const count = document.createElement('span');
  count.textContent = `· ${zone.shopCount}`;
  count.title = `Кофеен в зоне: ${zone.shopCount}`;
  element.append(name, count);
  return element;
}
