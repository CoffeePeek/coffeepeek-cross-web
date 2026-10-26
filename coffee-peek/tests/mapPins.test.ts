jest.mock('maplibre-gl', () => ({ setWorkerUrl: jest.fn() }), { virtual: true });
jest.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => 'worker', { virtual: true });
jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}), { virtual: true });

import { existsSync } from 'node:fs';
import path from 'node:path';
import { coffeeDetailIcon, coffeeMapPinIcon } from '../src/map/osmMap';

test('map and detail pins resolve API types to Android assets and preserve touch targets', () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => ({ style: {} }) },
  });
  try {
    for (const [types, image] of [
      [['Specialty', 'specialty', 1, '1'], 'bean.png'],
      [['CoffeeBar', 'coffee_bar', 2, '2', null, 'unknown', '__proto__'], 'cup.png'],
      [['Cafe', 'cafe', 3, '3'], 'fork-knife.png'],
    ] as const) {
      expect(existsSync(path.join(process.cwd(), 'public/icons/map', image))).toBe(true);
      for (const focus of types) {
        const pin = coffeeMapPinIcon({ focus });
        expect(pin.innerHTML).toContain(`/icons/map/${image}`);
        expect(pin.innerHTML).toContain('--pin-size:31px');
        expect(pin.style).toEqual({ width: '44px', height: '44px' });
        const selected = coffeeMapPinIcon({ focus, selected: true });
        expect(selected.innerHTML).toContain('--pin-size:41px');
        expect(selected.className).toContain('coffee-map-pin--selected');
        const detail = coffeeDetailIcon(focus);
        expect(detail.innerHTML).toContain(`/icons/map/${image}`);
        expect(detail.innerHTML).toContain('--pin-size:43px');
        expect(detail.style).toEqual({ width: '44px', height: '44px' });
      }
    }
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
