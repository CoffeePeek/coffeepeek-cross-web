import { Marker } from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapBoundsBox } from './osmMap';

export type MapMarkerSpec = {
  key: string;
  position: [number, number];
  element: HTMLElement;
  bounds?: MapBoundsBox;
  groupKey?: string;
};

type MarkerEntry = {
  spec: MapMarkerSpec;
  marker: Marker;
  motion: HTMLElement;
  element: HTMLElement;
  html: string;
  animation: Animation | null;
  exiting: boolean;
};

export function findMarkerParent(spec: MapMarkerSpec, candidates: MapMarkerSpec[]): MapMarkerSpec | undefined {
  const groups = candidates.filter(candidate => candidate.key !== spec.key && candidate.bounds);
  const extent = (group: MapMarkerSpec) => group.bounds!.maxLon - group.bounds!.minLon + group.bounds!.maxLat - group.bounds!.minLat;
  return groups.find(group => group.key === spec.groupKey) ?? groups.sort((a, b) => extent(a) - extent(b)).find(({ bounds }) => bounds
    && spec.position[0] >= bounds.minLon && spec.position[0] <= bounds.maxLon
    && spec.position[1] >= bounds.minLat && spec.position[1] <= bounds.maxLat);
}

function visualPosition(entry: MarkerEntry) {
  const rect = entry.motion.getBoundingClientRect();
  const anchor = entry.marker.getElement().getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
    anchorX: anchor.left + anchor.width / 2, anchorY: anchor.top + anchor.height / 2,
    opacity: Number(getComputedStyle(entry.motion).opacity),
    scale: anchor.width ? rect.width / anchor.width : 1,
  };
}

function cancelAnimation(entry: MarkerEntry): void {
  if (!entry.animation) return;
  entry.animation.onfinish = null;
  entry.animation.cancel();
  entry.animation = null;
}

function animateMarker(entry: MarkerEntry, frames: Keyframe[], enabled: boolean, finish: () => void): void {
  cancelAnimation(entry);
  if (!enabled || typeof entry.motion.animate !== 'function') { finish(); return; }
  const animation = entry.motion.animate(frames, {
    duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both',
  });
  entry.animation = animation;
  animation.onfinish = () => {
    if (entry.animation !== animation) return;
    entry.animation = null;
    animation.cancel();
    finish();
  };
}

export function createMapMarkerLayer(map: MapLibreMap) {
  const entries = new Map<string, MarkerEntry>();
  const remove = (entry: MarkerEntry) => {
    cancelAnimation(entry);
    try { entry.marker.remove(); } catch { /* The map may already be disposed during navigation. */ }
    entries.delete(entry.spec.key);
  };

  return {
    update(specs: MapMarkerSpec[], reducedMotion: boolean): void {
      const previous = [...entries.values()];
      const snapshots = new Map(previous.map(entry => [entry.spec.key, visualPosition(entry)]));
      const oldSpecs = previous.map(entry => entry.spec);
      const nextKeys = new Set(specs.map(spec => spec.key));
      const enabled = previous.length > 0 && !reducedMotion;
      const incoming: Array<{ entry: MarkerEntry; from: ReturnType<typeof visualPosition> | undefined; retained: boolean }> = [];

      for (const spec of specs) {
        let entry = entries.get(spec.key);
        const retained = !!entry;
        const from = snapshots.get(spec.key) ?? snapshots.get(findMarkerParent(spec, oldSpecs)?.key ?? '');
        const moved = entry && (entry.spec.position[0] !== spec.position[0] || entry.spec.position[1] !== spec.position[1]);
        const returning = entry?.exiting;
        const html = spec.element.outerHTML;
        if (entry) {
          if (entry.html !== html) {
            const focused = document.activeElement === entry.element;
            entry.motion.replaceChildren(spec.element);
            entry.element = spec.element;
            entry.html = html;
            if (focused) entry.element.focus({ preventScroll: true });
          }
          entry.element.onclick = spec.element.onclick;
          entry.element.onkeydown = spec.element.onkeydown;
          entry.motion.inert = false;
          entry.exiting = false;
          entry.spec = spec;
          if (moved) entry.marker.setLngLat(spec.position);
        } else {
          const anchor = document.createElement('div');
          const motion = document.createElement('div');
          motion.className = 'coffee-map-marker-motion';
          motion.append(spec.element);
          anchor.append(motion);
          entry = { spec, motion, element: spec.element, html, animation: null, exiting: false,
            marker: new Marker({ element: anchor, anchor: 'center', subpixelPositioning: true }).setLngLat(spec.position).addTo(map) };
          entries.set(spec.key, entry);
        }
        entry.marker.getElement().style.zIndex = spec.element.style.zIndex;
        if (!retained || moved || returning) incoming.push({ entry, from, retained });
        else if (reducedMotion) cancelAnimation(entry);
      }

      // Measure after all DOM updates, so a dense viewport needs one layout pass.
      const targets = new Map(specs.map(spec => {
        const rect = entries.get(spec.key)!.marker.getElement().getBoundingClientRect();
        return [spec.key, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }];
      }));
      for (const { entry, from, retained } of incoming) {
        const target = targets.get(entry.spec.key)!;
        animateMarker(entry, [
          { transform: `translate(${from ? from.x - target.x : 0}px, ${from ? from.y - target.y : 0}px) scale(${retained ? from?.scale ?? 1 : 0.65})`, opacity: retained ? from?.opacity ?? 1 : 0 },
          { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
        ], enabled, () => {});
      }

      for (const entry of previous) {
        if (nextKeys.has(entry.spec.key)) continue;
        const from = snapshots.get(entry.spec.key)!;
        const target = targets.get(findMarkerParent(entry.spec, specs)?.key ?? '') ?? from;
        entry.exiting = true;
        entry.motion.inert = true;
        animateMarker(entry, [
          { transform: `translate(${from.x - from.anchorX}px, ${from.y - from.anchorY}px) scale(${from.scale})`, opacity: from.opacity },
          { transform: `translate(${target.x - from.anchorX}px, ${target.y - from.anchorY}px) scale(0.5)`, opacity: 0 },
        ], enabled, () => remove(entry));
      }
    },
    clear(): void { for (const entry of entries.values()) remove(entry); },
  };
}
