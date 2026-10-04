const DAY_LABELS: Record<string, string> = {
  mo: 'Пн', mon: 'Пн', monday: 'Пн',
  tu: 'Вт', tue: 'Вт', tues: 'Вт', tuesday: 'Вт',
  we: 'Ср', wed: 'Ср', wednesday: 'Ср',
  th: 'Чт', thu: 'Чт', thur: 'Чт', thurs: 'Чт', thursday: 'Чт',
  fr: 'Пт', fri: 'Пт', friday: 'Пт',
  sa: 'Сб', sat: 'Сб', saturday: 'Сб',
  su: 'Вс', sun: 'Вс', sunday: 'Вс',
};

const DAY_PATTERN = /\b(?:Monday|Mon|Mo|Tuesday|Tues|Tue|Tu|Wednesday|Wed|We|Thursday|Thurs|Thur|Thu|Th|Friday|Fri|Fr|Saturday|Sat|Sa|Sunday|Sun|Su)\b/gi;

/** Localize imported day labels for display, preserving the original schedule and times. */
export function formatImportOpeningHours(value: string): string {
  const hours = value.trim();
  if (hours === '24/7') return 'Круглосуточно';
  return hours
    .replace(DAY_PATTERN, (day) => DAY_LABELS[day.toLowerCase()])
    .replace(/\b(?:off|closed)\b/gi, 'выходной')
    .replace(/;\s*/g, '\n');
}
