jest.mock('maplibre-gl', () => ({ setWorkerUrl: jest.fn() }), { virtual: true });
jest.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => 'worker', { virtual: true });
jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}), { virtual: true });

import type { Map as MapLibreMap } from 'maplibre-gl';
import { renderMapZones, updateMapZoneLabels } from '../src/map/osmMap';
import { brand } from '../src/design-system/tokens';

test('district labels hide below zoom 11 and return when zooming in', () => {
  const toggle = jest.fn();
  const map = { getZoom: jest.fn(), getContainer: () => ({ classList: { toggle } }) };
  for (const [zoom, hidden] of [[12, false], [10.99, true], [9, true], [11, false]] as const) {
    map.getZoom.mockReturnValue(zoom);
    updateMapZoneLabels(map as unknown as MapLibreMap);
    expect(toggle).toHaveBeenLastCalledWith('coffee-map--zoomed-out', hidden);
  }
});

test('zones use their own colors for fill and outline; hiding zones clears the source', () => {
  const source = { setData: jest.fn() };
  const map = {
    isStyleLoaded: () => true, getSource: jest.fn(), getLayer: jest.fn(),
    addSource: jest.fn(), addLayer: jest.fn(), setPaintProperty: jest.fn(),
  };
  const base = { name: 'Zone', latitude: 53, longitude: 27, radiusMeters: 100, shopCount: 5 };
  renderMapZones(map as unknown as MapLibreMap, [
    { ...base, id: 'red', color: '#EF4444' },
    { ...base, id: 'blue', color: '#60A5FA' },
    { ...base, id: 'legacy' },
  ], true);
  expect(map.addSource.mock.calls[0][1].data.features.map((feature: { properties: { color: string } }) => feature.properties.color)).toEqual(['#EF4444', '#60A5FA', brand.primary]);
  expect(map.addLayer.mock.calls.map(([layer]) => layer.paint)).toEqual([
    { 'fill-color': ['get', 'color'], 'fill-opacity': 0.16 },
    { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.8 },
  ]);
  map.getSource.mockReturnValue(source);
  map.getLayer.mockReturnValue({});
  renderMapZones(map as unknown as MapLibreMap, [], false);
  expect(source.setData).toHaveBeenLastCalledWith({ type: 'FeatureCollection', features: [] });
});
