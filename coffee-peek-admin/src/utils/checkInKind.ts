export type CheckInKind = 'Shop' | 'Home';

export interface HomeCheckInRecipe {
  preparedAtUtc?: string | null;
  preparedOn?: string | null;
  brewMethodCode?: string | null;
  beanName?: string | null;
  doseGrams?: number | null;
  brewDurationSeconds?: number | null;
  tasteScore?: number | null;
}

export interface CheckInKindFields extends HomeCheckInRecipe {
  kind?: CheckInKind | null;
  drinkPhotoUrl?: string | null;
  shopId?: string | null;
  visitedAtUtc?: string | null;
  visitedAt?: string | null;
  home?: HomeCheckInRecipe | null;
}

/** Explicit kind wins. The fallback keeps older shop responses readable. */
export function checkInKind(item: CheckInKindFields): CheckInKind | 'Unknown' {
  if (item.kind === 'Home' || item.kind === 'Shop') return item.kind;
  if (item.home || item.preparedOn || item.preparedAtUtc) return 'Home';
  return item.shopId ? 'Shop' : 'Unknown';
}

export function homeRecipe(item: CheckInKindFields): HomeCheckInRecipe {
  return {
    preparedAtUtc: item.home?.preparedAtUtc ?? item.preparedAtUtc,
    preparedOn: item.home?.preparedOn ?? item.preparedOn,
    brewMethodCode: item.home?.brewMethodCode ?? item.brewMethodCode,
    beanName: item.home?.beanName ?? item.beanName,
    doseGrams: item.home?.doseGrams ?? item.doseGrams,
    brewDurationSeconds: item.home?.brewDurationSeconds ?? item.brewDurationSeconds,
    tasteScore: item.home?.tasteScore ?? item.tasteScore,
  };
}

export function checkInDate(item: CheckInKindFields): string {
  const recipe = homeRecipe(item);
  const value = checkInKind(item) === 'Home'
    ? recipe.preparedAtUtc || (recipe.preparedOn ? `${recipe.preparedOn}T12:00:00` : null)
    : item.visitedAtUtc || item.visitedAt;
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru-RU');
}
