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

export function formatCheckInDate(item: { visitedAt?: string | null; createdAtUtc: string }): string {
  for (const value of [item.visitedAt, item.createdAtUtc]) {
    if (!value) continue;
    // The server's CreatedAt is UTC, including older responses without a zone suffix.
    const iso = /T/.test(value) && !/(Z|[+-]\d{2}:\d{2})$/i.test(value) ? `${value}Z` : value;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()) || date.getFullYear() < 1990) continue;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return 'Дата не указана';
}
