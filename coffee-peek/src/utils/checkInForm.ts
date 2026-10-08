import { drinkSelection } from './consumedDrinks';
import type { CreateCheckInRequest, RatingDto } from '../api/coffeeshop';

export const CHECK_IN_LIMITS = { noteMin: 1, noteMax: 1000 };

export interface CheckInDraft {
  drinkSlug?: string;
  customDrinkName?: string;
  coffeeShopId: string;
  isPublic: boolean;
  note: string;
  visitedDate: string;
  rating: RatingDto;
}

export class CheckInValidationError extends Error {}

export function todayInputValue(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Validate before uploading photos; empty optional fields must not disappear from JSON.
export function buildCheckInRequest(draft: CheckInDraft, now = new Date()): CreateCheckInRequest {
  let selection: ReturnType<typeof drinkSelection>;
  try {
    selection = drinkSelection(draft.drinkSlug, draft.customDrinkName);
  } catch (error) {
    throw new CheckInValidationError((error as Error).message);
  }
  const note = draft.note.trim();
  if ([draft.rating.coffee, draft.rating.service, draft.rating.place].some(
        (value) => !Number.isInteger(value) || value < 1 || value > 5
      )) {
    throw new CheckInValidationError('Укажите оценки кофе, сервиса и атмосферы от 1 до 5');
  }
  if (note.length < CHECK_IN_LIMITS.noteMin || note.length > CHECK_IN_LIMITS.noteMax) {
    throw new CheckInValidationError('Текст чекина должен содержать от 1 до 1000 символов');
  }
  if (!draft.coffeeShopId.trim()) throw new CheckInValidationError('Выберите кофейню');

  const date = draft.visitedDate || todayInputValue(now);
  const visitedAt = new Date(`${date}T00:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(visitedAt.getTime()) ||
      todayInputValue(visitedAt) !== date || visitedAt.getFullYear() < 1) {
    throw new CheckInValidationError('Укажите корректную дату посещения');
  }
  if (date > todayInputValue(now)) {
    throw new CheckInValidationError('Дата посещения не может быть в будущем');
  }

  return {
    ...selection,
    coffeeShopSlug: draft.coffeeShopId,
    visibility: draft.isPublic ? 'Public' : 'Private',
    visitedAt: visitedAt.toISOString(),
    text: note,
    photos: [],
    rating: draft.rating,
  };
}

export function formatCheckInDate(item: { visitedAt?: string | null; createdAtUtc: string }, now = new Date()): string {
  const created = parseCheckInDate(item.createdAtUtc);
  const elapsed = created ? now.getTime() - created.getTime() : -1;
  if (elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000) {
    const minutes = Math.floor(elapsed / 60000);
    if (minutes === 0) return 'Только что';
    if (minutes < 60) return `${minutes} ${pluralTime(minutes, ['минуту', 'минуты', 'минут'])} назад`;
    const hours = Math.floor(minutes / 60);
    return `${hours} ${pluralTime(hours, ['час', 'часа', 'часов'])} назад`;
  }
  for (const value of [item.visitedAt, item.createdAtUtc]) {
    const date = parseCheckInDate(value);
    if (!date) continue;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return 'Дата не указана';
}

function parseCheckInDate(value?: string | null): Date | null {
  if (!value) return null;
  // Older server responses omit the zone suffix, but timestamps are still UTC.
  const iso = /T/.test(value) && !/(Z|[+-]\d{2}:\d{2})$/i.test(value) ? `${value}Z` : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) || date.getFullYear() < 1990 ? null : date;
}

function pluralTime(value: number, forms: [string, string, string]): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  const last = value % 10;
  return last === 1 ? forms[0] : last >= 2 && last <= 4 ? forms[1] : forms[2];
}
