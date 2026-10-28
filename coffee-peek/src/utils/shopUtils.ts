/**
 * Получает текущий день недели (0 = Понедельник, 6 = Воскресенье)
 */
export function getCurrentDayOfWeek(): number {
  const today = new Date();
  // getDay() возвращает 0 (воскресенье) - 6 (суббота)
  // Преобразуем в формат: 0 (понедельник) - 6 (воскресенье)
  const day = today.getDay();
  return day === 0 ? 6 : day - 1;
}

const UI_DAY_TO_DOTNET_NAME = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/**
 * Converts the UI schedule index (0 = Monday) to the wire representation used
 * by System.DayOfWeek. Sending the UI index as a number is unsafe because
 * System.DayOfWeek uses 0 = Sunday.
 */
export function uiDayToDotNetName(
  dayOfWeek: number
): (typeof UI_DAY_TO_DOTNET_NAME)[number] {
  const day = Math.trunc(dayOfWeek);
  return UI_DAY_TO_DOTNET_NAME[day] ?? 'Monday';
}

/**
 * Нормализует день недели к 0 = Пн … 6 = Вс.
 * API может отдать число 0–6, ISO 1–7 или строку ("Monday" / .NET DayOfWeek).
 */
export function normalizeDayOfWeek(
  dayOfWeek: number | string | null | undefined
): number | null {
  if (dayOfWeek === null || dayOfWeek === undefined || dayOfWeek === '') return null;

  if (typeof dayOfWeek === 'string') {
    const named: Record<string, number> = {
      monday: 0,
      mon: 0,
      tuesday: 1,
      tue: 1,
      wednesday: 2,
      wed: 2,
      thursday: 3,
      thu: 3,
      friday: 4,
      fri: 4,
      saturday: 5,
      sat: 5,
      sunday: 6,
      sun: 6,
    };
    const key = dayOfWeek.trim().toLowerCase();
    if (key in named) return named[key];
    const asNum = Number(dayOfWeek);
    if (!Number.isFinite(asNum)) return null;
    dayOfWeek = asNum;
  }

  if (typeof dayOfWeek !== 'number' || !Number.isFinite(dayOfWeek)) return null;
  const n = Math.trunc(dayOfWeek);
  if (n >= 0 && n <= 6) return n;
  // ISO-8601: 1 = Monday … 7 = Sunday
  if (n >= 1 && n <= 7) return n === 7 ? 6 : n - 1;
  return null;
}

/**
 * Переводит время расписания из локального часового пояса браузера в UTC.
 * dayOfWeek сдвигается, если конвертация пересекает полночь.
 */
export function localTimeToUtc(
  dayOfWeek: number,
  time: string,
  offsetMinutes = new Date().getTimezoneOffset()
): { dayOfWeek: number; time: string } {
  return shiftScheduleTime(dayOfWeek, time, offsetMinutes);
}

/** Обратное преобразование к {@link localTimeToUtc}. */
export function utcTimeToLocal(
  dayOfWeek: number,
  time: string,
  offsetMinutes = new Date().getTimezoneOffset()
): { dayOfWeek: number; time: string } {
  return shiftScheduleTime(dayOfWeek, time, -offsetMinutes);
}

function shiftScheduleTime(
  dayOfWeek: number,
  time: string,
  offsetMinutes: number
): { dayOfWeek: number; time: string } {
  const [hours, minutes] = time.split(':').map(Number);
  const raw = hours * 60 + minutes + offsetMinutes;
  const dayDelta = Math.floor(raw / 1440);
  const totalMinutes = ((raw % 1440) + 1440) % 1440;
  return {
    dayOfWeek: ((dayOfWeek + dayDelta) % 7 + 7) % 7,
    time: `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`,
  };
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Расписание с бэкенда хранится в UTC — для отображения переводим в локальное
 * время браузера. getCurrentStatus работает с UTC-версией напрямую.
 */
export function toLocalSchedules<T extends { dayOfWeek: number | string; openTime?: string; closeTime?: string }>(
  schedules: T[] | undefined,
  offsetMinutes = new Date().getTimezoneOffset()
): Array<{ dayOfWeek: number; openTime?: string; closeTime?: string }> {
  return (schedules ?? []).flatMap((s) => {
    const day = normalizeDayOfWeek(s.dayOfWeek);
    if (day === null) return [];
    if (!s.openTime || !s.closeTime) return [{ dayOfWeek: day, openTime: s.openTime, closeTime: s.closeTime }];
    const open = utcTimeToLocal(day, s.openTime, offsetMinutes);
    const close = utcTimeToLocal(day, s.closeTime, offsetMinutes);
    return [{ dayOfWeek: open.dayOfWeek, openTime: open.time, closeTime: close.time }];
  });
}

/**
 * Открыта ли кофейня прямо сейчас на основе расписания.
 * Время расписания и dayOfWeek хранятся в UTC, поэтому сравниваем с текущим
 * временем в UTC — getUTC*() уже переводит локальное время ПК в UTC, т.е.
 * часовой пояс пользователя учитывается автоматически.
 * Обрабатывает интервалы через полночь (например, 22:00–02:00).
 * Возвращает null, если расписания нет.
 */
export function getCurrentStatus(shop: { schedules?: Array<{ dayOfWeek: number | string; openTime?: string; closeTime?: string }> } | null): {
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
} | null {
  if (!shop?.schedules || shop.schedules.length === 0) return null;

  const now = new Date();
  const nowDay = (now.getUTCDay() + 6) % 7; // getUTCDay: 0=Вс…6=Сб → 0=Пн…6=Вс
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  for (const s of shop.schedules) {
    const day = normalizeDayOfWeek(s.dayOfWeek);
    if (day === null || !s.openTime || !s.closeTime) continue;
    const open = timeToMinutes(s.openTime);
    const close = timeToMinutes(s.closeTime);
    const openNow = close <= open
      // Через полночь: [open, 24:00) в этот день и [00:00, close) в следующий.
      ? (day === nowDay && nowMinutes >= open) || ((day + 1) % 7 === nowDay && nowMinutes < close)
      : day === nowDay && nowMinutes >= open && nowMinutes < close;
    if (openNow) return { isOpen: true, openTime: s.openTime, closeTime: s.closeTime };
  }

  const today = shop.schedules.find((s) => normalizeDayOfWeek(s.dayOfWeek) === nowDay);
  return { isOpen: false, openTime: today?.openTime, closeTime: today?.closeTime };
}

/**
 * Открыта ли кофейня прямо сейчас. Считаем по расписанию (UTC-aware),
 * при отсутствии расписания откатываемся на флаг isOpen из API.
 */
export function isShopOpenNow(
  shop: {
    schedules?: Array<{ dayOfWeek: number | string; openTime?: string; closeTime?: string }>;
    isOpen?: boolean | null;
  } | null
): boolean | undefined {
  return getCurrentStatus(shop)?.isOpen ?? shop?.isOpen ?? undefined;
}

/**
 * Дефолтное расписание работы кофейни
 * Пн-Пт: 8:00-22:00, Сб-Вс: 10:00-22:00
 */
export function getDefaultSchedules(): Array<{
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}> {
  return [
    { dayOfWeek: 0, openTime: '08:00', closeTime: '22:00' }, // Понедельник
    { dayOfWeek: 1, openTime: '08:00', closeTime: '22:00' }, // Вторник
    { dayOfWeek: 2, openTime: '08:00', closeTime: '22:00' }, // Среда
    { dayOfWeek: 3, openTime: '08:00', closeTime: '22:00' }, // Четверг
    { dayOfWeek: 4, openTime: '08:00', closeTime: '22:00' }, // Пятница
    { dayOfWeek: 5, openTime: '10:00', closeTime: '22:00' }, // Суббота
    { dayOfWeek: 6, openTime: '10:00', closeTime: '22:00' }, // Воскресенье
  ];
}

/**
 * Форматирует день недели для отображения (0 = Пн … 6 = Вс)
 */
export function formatDayOfWeek(dayOfWeek: number | string): string {
  const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  const idx = normalizeDayOfWeek(dayOfWeek);
  return idx === null ? '' : days[idx];
}

/** Короткие названия: Пн, Вт, … Вс */
export function formatDayOfWeekShort(dayOfWeek: number | string): string {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const idx = normalizeDayOfWeek(dayOfWeek);
  return idx === null ? '' : days[idx];
}

/** `https://instagram.com/alt.minsk` → `@alt.minsk` */
export function instagramHandle(value: string): string {
  const trimmed = value.trim();
  try {
    const href = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : trimmed.includes('instagram.com')
        ? `https://${trimmed}`
        : '';
    if (href) {
      const path = new URL(href).pathname.split('/').filter(Boolean)[0] || '';
      return path ? `@${path}` : trimmed;
    }
  } catch {
    // fall through
  }
  const handle = trimmed.replace(/^@/, '').split('/')[0];
  return handle ? `@${handle}` : trimmed;
}

export function instagramUrl(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes('instagram.com')) return `https://${trimmed.replace(/^\/+/, '')}`;
  return `https://instagram.com/${trimmed.replace(/^@/, '')}`;
}

export function toWebsiteHref(url: string): string {
  return url.startsWith('http') ? url : `https://${url}`;
}
