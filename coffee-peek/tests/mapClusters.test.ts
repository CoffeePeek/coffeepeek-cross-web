jest.mock('maplibre-gl', () => ({ setWorkerUrl: jest.fn() }), { virtual: true });
jest.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => 'worker', { virtual: true });
jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}), { virtual: true });

import type { Map as MapLibreMap } from 'maplibre-gl';
import { coffeeMapClusterIcon, getMapZoneBounds, zoomToMapBounds } from '../src/map/osmMap';

test('cluster buttons keep exact accessible counts and compact faces within 44px touch targets', () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: (tag: string) => ({ tagName: tag.toUpperCase(), style: {}, setAttribute: jest.fn() }),
  } });
  try {
    for (const [count, label] of [[2, '2'], [9, '9'], [10, '10'], [99, '99'], [100, '99+'], [500, '99+']] as const) {
      const icon = coffeeMapClusterIcon(count);
      expect(icon.type).toBe('button');
      expect(icon.innerHTML).toContain(`coffee-cluster-count">${label}</span>`);
      expect(icon.className).toContain('coffee-map-pin');
      expect(icon.style).toEqual({ width: '44px', height: '44px' });
      expect(icon.setAttribute).toHaveBeenCalledWith('aria-label', `Кофеен в группе: ${count}. Приблизить карту`);
    }
    const single = coffeeMapClusterIcon(1);
    expect(single.innerHTML).toContain('/icons/map/bean.png');
    expect(single.style.width).toBe('44px');
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('cluster taps fit their extent and coincident shops zoom in without a fit-to-point jump', () => {
  const map = { getZoom: jest.fn(() => 10), getContainer: () => ({ clientWidth: 390, clientHeight: 780 }),
    cameraForBounds: jest.fn(() => ({ center: [27, 53], zoom: 11.5 })), easeTo: jest.fn() };
  zoomToMapBounds(map as unknown as MapLibreMap, { minLat: 52, minLon: 26, maxLat: 54, maxLon: 28 });
  expect(map.cameraForBounds).toHaveBeenCalledWith([[26, 52], [28, 54]], { padding: 97.5, maxZoom: 12 });
  expect(map.easeTo).toHaveBeenLastCalledWith({ center: [27, 53], zoom: 11.5, duration: 350 });
  map.cameraForBounds.mockReturnValue({ center: [27, 53], zoom: 9 });
  zoomToMapBounds(map as unknown as MapLibreMap, { minLat: 52, minLon: 26, maxLat: 54, maxLon: 28 });
  expect(map.easeTo).toHaveBeenLastCalledWith({ center: [27, 53], zoom: 11, duration: 350 });
  zoomToMapBounds(map as unknown as MapLibreMap, { minLat: 53, minLon: 27, maxLat: 53, maxLon: 27 });
  expect(map.easeTo).toHaveBeenLastCalledWith({ center: [27, 53], zoom: 11, duration: 350 });
  map.getZoom.mockReturnValue(22);
  zoomToMapBounds(map as unknown as MapLibreMap, { minLat: 53, minLon: 27, maxLat: 53, maxLon: 27 });
  expect(map.easeTo).toHaveBeenLastCalledWith({ center: [27, 53], zoom: 22, duration: 350 });
  expect(map.cameraForBounds).toHaveBeenCalledTimes(2);
});

test('zone groups fit their polygon or legacy radius rather than just their centre', () => {
  const zone = { id: 'zone', name: 'Zone', latitude: 53, longitude: 27, radiusMeters: 1000, shopCount: 10 };
  expect(getMapZoneBounds({ ...zone, polygon: [{ latitude: 52, longitude: 26 }, { latitude: 54, longitude: 28 }, { latitude: 53, longitude: 29 }] }))
    .toEqual({ minLat: 52, minLon: 26, maxLat: 54, maxLon: 29 });
  const bounds = getMapZoneBounds(zone);
  expect(bounds.minLat).toBeLessThan(zone.latitude);
  expect(bounds.maxLat).toBeGreaterThan(zone.latitude);
  expect(bounds.minLon).toBeLessThan(zone.longitude);
  expect(bounds.maxLon).toBeGreaterThan(zone.longitude);
});
