import {
  CoffeeFocus,
  coordPair,
  looksLikeNameSearch,
} from '../constants/catalogIngest';
import type { ImportCandidate } from '../api/import';

export type WorkspacePanel = 'map' | 'list' | 'stats';

export function parseWorkspacePanel(raw: string | null): WorkspacePanel {
  if (raw === 'list' || raw === 'stats') return raw;
  return 'map';
}

export function hasSignal(signals: string[], ...needles: string[]): boolean {
  return needles.some((needle) => signals.includes(needle));
}

export function displayFacts(candidate: ImportCandidate): string[] {
  if (candidate.facts && candidate.facts.length > 0) return candidate.facts;

  const facts: string[] = [];
  for (const signal of candidate.signals) {
    if (signal === 'name:to-go-chain' || signal === 'name:chain') facts.push('Похоже на сеть');
    else if (signal === 'osm:vending_machine' || signal === 'name:vending-like') {
      facts.push('Похоже на автомат');
    } else if (signal === 'name:canteen') facts.push('Похоже на столовую');
    else if (signal === 'name:specialty-signal') facts.push('Похоже на specialty');
  }
  return facts;
}

export function suggestedFocusFromSignals(candidate: ImportCandidate): CoffeeFocus | undefined {
  if (candidate.coffeeFocus) return undefined;
  if (hasSignal(candidate.signals, 'name:chain', 'name:to-go-chain')) return undefined;
  if (hasSignal(candidate.signals, 'name:coffee')) return 'cafe';
  return undefined;
}

export function dossierSoftWarning(candidate: ImportCandidate): string | undefined {
  if (hasSignal(candidate.signals, 'name:canteen')) {
    return 'Похоже на столовую — сверь вывеску с названием';
  }
  if (hasSignal(candidate.signals, 'osm:vending_machine', 'name:vending-like')) {
    return 'Похоже на автомат, не кофейню';
  }
  return undefined;
}

/** Returns the URL only if it parses as absolute http:/https:, otherwise undefined. */
export function safeHttpUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}

export function pickSafeUrl(url: string | undefined, fallback: string): string {
  const safe = safeHttpUrl(url);
  if (!safe) return fallback;
  if (looksLikeNameSearch(safe)) return fallback;
  return safe;
}

export function mapTabSrc(candidate: ImportCandidate): { embed: string; openUrl: string } {
  const pair = coordPair(candidate.latitude, candidate.longitude);
  const lat = pair?.lat;
  const lon = pair?.lon;
  const fallback =
    lat && lon ? `https://yandex.ru/map-widget/v1/?ll=${lon},${lat}&z=18&pt=${lon},${lat},pm2rdm` : '';
  return {
    embed: pickSafeUrl(candidate.research.yandexEmbed, fallback),
    openUrl: safeHttpUrl(candidate.research.yandexMaps) || fallback,
  };
}

export function parseFacts(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const facts = value.map((item) => String(item)).filter(Boolean);
  return facts.length > 0 ? facts : undefined;
}
