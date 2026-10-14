import type { CheckInVisibility } from '../api/coffeeshop';
import type { HomeCheckInRequest } from '../api/homeCheckIns';
import { todayInputValue } from './checkInForm';

export interface HomeDraft {
  date: string;
  time: string;
  brewMethodCode: string;
  coffeeProductSlug: string;
  coffeeProductId: string;
  customBeanName: string;
  doseGrams: string;
  minutes: string;
  seconds: string;
  tasteScore: number;
  text: string;
  drinkSlug: string;
  customDrinkName: string;
  visibility: CheckInVisibility | '';
}

export const newHomeDraft = (now = new Date()): HomeDraft => ({
  date: todayInputValue(now), time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
  brewMethodCode: '', coffeeProductSlug: '', coffeeProductId: '', customBeanName: '',
  doseGrams: '', minutes: '', seconds: '', tasteScore: 5, text: '', drinkSlug: '', customDrinkName: '', visibility: 'Private',
});

export function validateHomeDraft(draft: HomeDraft, editing = false, now = new Date()): { request?: HomeCheckInRequest; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const preparedAt = new Date(`${draft.date}T${draft.time}:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !/^\d{2}:\d{2}$/.test(draft.time) ||
    !Number.isFinite(preparedAt.getTime()) || todayInputValue(preparedAt) !== draft.date ||
    `${String(preparedAt.getHours()).padStart(2, '0')}:${String(preparedAt.getMinutes()).padStart(2, '0')}` !== draft.time ||
    preparedAt.getTime() > now.getTime() + 5 * 60_000) errors.date = 'Укажите корректную дату и время не позднее текущего';
  if (draft.brewMethodCode && (draft.brewMethodCode.length > 100 || (!editing && !/^[a-z0-9][a-z0-9-]*$/.test(draft.brewMethodCode)))) errors.brewMethodCode = 'Некорректный код способа заваривания';
  const selectedBeans = [draft.coffeeProductSlug.trim(), draft.coffeeProductId.trim(), draft.customBeanName.trim()].filter(Boolean);
  if (selectedBeans.length > 1 || (!editing && draft.coffeeProductId)) errors.bean = 'Выберите один вид зерна';
  if (draft.customBeanName.trim().length > 250) errors.bean = 'Название зерна не длиннее 250 символов';
  const dose = draft.doseGrams.trim() ? Number(draft.doseGrams.replace(',', '.')) : null;
  if (dose !== null && (!Number.isFinite(dose) || dose < 0.01 || dose > 10000 || !/^\d+(?:[.,]\d{1,2})?$/.test(draft.doseGrams.trim()))) errors.doseGrams = 'Введите от 0,01 до 10 000 г, не более двух знаков после запятой';
  const minutes = draft.minutes.trim() ? Number(draft.minutes) : 0;
  const seconds = draft.seconds.trim() ? Number(draft.seconds) : 0;
  const duration = draft.minutes.trim() || draft.seconds.trim() ? minutes * 60 + seconds : null;
  if (duration !== null && (!Number.isInteger(minutes) || !Number.isInteger(seconds) || seconds < 0 || seconds > 59 || duration < 1 || duration > 604800)) errors.duration = 'Укажите время от 1 секунды до 7 дней';
  if (!Number.isInteger(draft.tasteScore) || draft.tasteScore < 1 || draft.tasteScore > 5) errors.tasteScore = 'Оценка должна быть от 1 до 5';
  if (draft.text.trim().length > 1000) errors.text = 'Заметка не длиннее 1000 символов';
  if (draft.drinkSlug === 'other' && (draft.customDrinkName.trim().length < 1 || draft.customDrinkName.trim().length > 100)) errors.customDrinkName = 'Введите название напитка от 1 до 100 символов';
  if (!draft.visibility) errors.visibility = 'Выберите видимость записи';
  if (Object.keys(errors).length) return { errors };
  return { errors, request: {
    preparedAt: preparedAt.toISOString(), preparedOn: draft.date,
    brewMethodCode: draft.brewMethodCode || null,
    coffeeProductSlug: draft.coffeeProductSlug || null,
    coffeeProductId: draft.coffeeProductId || null,
    customBeanName: draft.customBeanName.trim() || null,
    doseGrams: dose, brewDurationSeconds: duration, tasteScore: draft.tasteScore,
    text: draft.text.trim(), drinkSlug: draft.drinkSlug || null,
    customDrinkName: draft.drinkSlug === 'other' ? draft.customDrinkName.trim() : null,
    photos: [], drinkPhoto: null, visibility: draft.visibility as CheckInVisibility,
  } };
}
