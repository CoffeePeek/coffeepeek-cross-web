const mockMarkers: any[] = [];
jest.mock('maplibre-gl', () => ({ Marker: class {
  element: any;
  remove = jest.fn();
  constructor({ element }: { element: any }) { this.element = element; mockMarkers.push(this); }
  setLngLat([x, y]: number[]) { this.element.rect = { left: x - 22, top: y - 22, width: 44, height: 44 }; return this; }
  addTo() { return this; }
  getElement() { return this.element; }
} }), { virtual: true });

import type { Map as MapLibreMap } from 'maplibre-gl';
import { createMapMarkerLayer, findMarkerParent } from '../src/map/markerTransitions';
import type { MapMarkerSpec } from '../src/map/markerTransitions';

class FakeElement {
  className = '';
  style = { zIndex: '' };
  parent: FakeElement | null = null;
  children: FakeElement[] = [];
  rect?: { left: number; top: number; width: number; height: number };
  html = '';
  opacity = '1';
  inert = false;
  onclick: unknown = null;
  onkeydown: unknown = null;
  animate = jest.fn(() => ({ cancel: jest.fn(), onfinish: null as null | (() => void) }));
  get outerHTML() { return this.html; }
  getBoundingClientRect(): any { return this.rect ?? this.parent?.getBoundingClientRect(); }
  append(child: FakeElement) { this.children.push(child); child.parent = this; }
  replaceChildren(child: FakeElement) { this.children = []; this.append(child); }
  focus() { (document as any).activeElement = this; }
}

const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const previousComputedStyle = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
beforeEach(() => {
  mockMarkers.length = 0;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => new FakeElement(), activeElement: null } });
  Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: (element: FakeElement) => ({ opacity: element.opacity }) });
});
afterEach(() => {
  if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
  else Reflect.deleteProperty(globalThis, 'document');
  if (previousComputedStyle) Object.defineProperty(globalThis, 'getComputedStyle', previousComputedStyle);
  else Reflect.deleteProperty(globalThis, 'getComputedStyle');
});

const spec = (key: string, x: number, extra: Partial<MapMarkerSpec> = {}): MapMarkerSpec => {
  const element = new FakeElement();
  element.html = key;
  return { key, position: [x, 0], element: element as unknown as HTMLElement, ...extra };
};
const group = () => spec('group', 10, { bounds: { minLon: 0, maxLon: 20, minLat: 0, maxLat: 0 } });
const motion = (marker: any): FakeElement => marker.element.children[0];
const lastAnimation = (element: FakeElement) => element.animate.mock.results.at(-1)!.value;

test('points converge on the new group and fan out from that group when it splits', () => {
  const layer = createMapMarkerLayer({} as MapLibreMap);
  layer.update([spec('a', 0), spec('b', 20)], false);
  const [a, b] = mockMarkers;
  expect(motion(a).animate).not.toHaveBeenCalled();
  layer.update([group()], false);
  expect(motion(a).animate.mock.calls.at(-1)![0][1]).toMatchObject({ transform: 'translate(10px, 0px) scale(0.5)', opacity: 0 });
  expect(motion(b).animate.mock.calls.at(-1)![0][1]).toMatchObject({ transform: 'translate(-10px, 0px) scale(0.5)', opacity: 0 });
  expect(motion(a).inert).toBe(true);
  expect(a.remove).not.toHaveBeenCalled();
  for (const marker of mockMarkers) lastAnimation(motion(marker)).onfinish?.();
  expect(a.remove).toHaveBeenCalledTimes(1);
  layer.update([spec('a', 0), spec('b', 20)], false);
  expect(motion(mockMarkers[3]).animate.mock.calls[0][0][0].transform).toBe('translate(10px, 0px) scale(0.65)');
  expect(motion(mockMarkers[4]).animate.mock.calls[0][0][0].transform).toBe('translate(-10px, 0px) scale(0.65)');
  layer.clear();
});

test('rapid reverse zoom continues from the visible position and cannot remove a returning point', () => {
  const layer = createMapMarkerLayer({} as MapLibreMap);
  layer.update([spec('a', 0)], false);
  const a = mockMarkers[0];
  layer.update([group()], false);
  const oldFinish = lastAnimation(motion(a)).onfinish!;
  motion(a).rect = { left: -17, top: -22, width: 44, height: 44 };
  motion(a).opacity = '0.6';
  layer.update([spec('a', 0)], false);
  expect(mockMarkers).toHaveLength(2);
  expect(motion(a).animate.mock.calls.at(-1)![0][0]).toMatchObject({ transform: 'translate(5px, 0px) scale(1)', opacity: 0.6 });
  expect(motion(a).inert).toBe(false);
  oldFinish();
  expect(a.remove).not.toHaveBeenCalled();
  layer.clear();
  expect(lastAnimation(motion(a)).onfinish).toBeNull();
  expect(a.remove).toHaveBeenCalledTimes(1);
});

test('selection changes reuse markers, preserve keyboard focus and update click handlers', () => {
  const layer = createMapMarkerLayer({} as MapLibreMap);
  const original = spec('a', 0);
  layer.update([original], false);
  (document as any).activeElement = original.element;
  const selected = spec('a', 0);
  (selected.element as unknown as FakeElement).html = 'selected a';
  selected.element.onclick = jest.fn();
  layer.update([selected], false);
  expect(mockMarkers).toHaveLength(1);
  expect(document.activeElement).toBe(selected.element);
  expect(motion(mockMarkers[0]).children[0].onclick).toBe(selected.element.onclick);
  expect(motion(mockMarkers[0]).animate).not.toHaveBeenCalled();
  layer.clear();
});

test('reduced motion swaps groups immediately and parent matching respects explicit zone membership', () => {
  const layer = createMapMarkerLayer({} as MapLibreMap);
  layer.update([spec('a', 0)], true);
  mockMarkers[0].remove.mockImplementationOnce(() => { throw new Error('Map disposed'); });
  expect(() => layer.update([group()], true)).not.toThrow();
  expect(mockMarkers[0].remove).toHaveBeenCalledTimes(1);
  expect(mockMarkers.every(marker => motion(marker).animate.mock.calls.length === 0)).toBe(true);
  const explicit = { ...group(), key: 'zone:explicit' };
  expect(findMarkerParent(spec('a', 0, { groupKey: explicit.key }), [group(), explicit])).toBe(explicit);
  const compact = spec('compact', 0, { bounds: { minLon: 0, maxLon: 0, minLat: 0, maxLat: 0 } });
  expect(findMarkerParent(spec('a', 0), [group(), compact])).toBe(compact);
  expect(findMarkerParent(spec('outside', 50), [group()])).toBeUndefined();
  layer.clear();
});
