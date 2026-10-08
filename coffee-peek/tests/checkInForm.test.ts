import { buildCheckInRequest, formatCheckInDate, todayInputValue, type CheckInDraft } from '../src/utils/checkInForm';

const now = new Date('2026-09-05T12:00:00Z');
const draft: CheckInDraft = { coffeeShopId: 'coffee-slug', isPublic: false, note: 'Посещение', visitedDate: '2026-09-05', rating: { coffee: 5, service: 4, place: 3 } };

test.each([false, true])('both visibility modes require trimmed text, with no review fields: %s', isPublic => {
  const request = buildCheckInRequest({ ...draft, isPublic, note: ' Хороший кофе ' }, now);
  expect(request).toMatchObject({ coffeeShopSlug: 'coffee-slug', visibility: isPublic ? 'Public' : 'Private', text: 'Хороший кофе', rating: draft.rating, photos: [] });
  for (const key of ['shop', 'header', 'note', 'isPublic', 'reviewId']) expect(request).not.toHaveProperty(key);
  for (const note of ['', '   ', 'a'.repeat(1001)]) expect(() => buildCheckInRequest({ ...draft, isPublic, note }, now)).toThrow(/1 до 1000/);
  for (const note of ['a', 'a'.repeat(1000)]) expect(buildCheckInRequest({ ...draft, isPublic, note }, now).text).toBe(note);
});

test.each([0, 6, 1.5, NaN])('rejects non-integer or out-of-range ratings: %s', coffee => {
  expect(() => buildCheckInRequest({ ...draft, rating: { ...draft.rating, coffee } }, now)).toThrow(/оценки/);
});

test.each(['2026-09-06', '2026-02-30', 'not-a-date'])('rejects invalid or future visit dates: %s', visitedDate => {
  expect(() => buildCheckInRequest({ ...draft, visitedDate }, now)).toThrow();
});

test('visit dates have a timezone, default to today, and display independently of creation', () => {
  const request = buildCheckInRequest({ ...draft, visitedDate: '' }, now);
  expect(request.visitedAt).toMatch(/Z$/);
  expect(todayInputValue(new Date(request.visitedAt!))).toBe(todayInputValue(now));
  expect(formatCheckInDate({ visitedAt: '2026-09-01T12:00:00Z', createdAtUtc: now.toISOString() }, new Date('2026-09-07T12:00:00Z'))).toBe('1 сентября 2026 г.');
});

test.each([
  [0, 'Только что'], [59, 'Только что'], [60, '1 минуту назад'],
  [120, '2 минуты назад'], [300, '5 минут назад'], [660, '11 минут назад'],
  [900, '15 минут назад'], [1260, '21 минуту назад'], [1440, '24 минуты назад'],
  [3540, '59 минут назад'], [3600, '1 час назад'], [14400, '4 часа назад'],
  [18000, '5 часов назад'], [39600, '11 часов назад'], [75600, '21 час назад'],
  [82800, '23 часа назад'], [86399, '23 часа назад'],
])('formats recent check-ins with Russian plural forms at %s seconds', (seconds, expected) => {
  const createdAtUtc = new Date(now.getTime() - seconds * 1000).toISOString();
  expect(formatCheckInDate({ createdAtUtc, visitedAt: '2026-09-01T00:00:00Z' }, now)).toBe(expected);
});

test('switches to the visit date at exactly 24 hours', () => {
  const item = { createdAtUtc: '2026-09-04T12:00:00Z', visitedAt: '2026-09-01T00:00:00Z' };
  expect(formatCheckInDate(item, now)).toBe('1 сентября 2026 г.');
});

test('handles legacy UTC timestamps, invalid dates and future creation times', () => {
  expect(formatCheckInDate({ createdAtUtc: '2026-09-05T08:00:00' }, now)).toBe('4 часа назад');
  expect(formatCheckInDate({ createdAtUtc: '2026-09-05T10:00:00+02:00' }, now)).toBe('4 часа назад');
  expect(formatCheckInDate({ createdAtUtc: 'invalid' }, now)).toBe('Дата не указана');
  expect(formatCheckInDate({ createdAtUtc: '2026-09-06T12:00:00Z' }, now)).not.toContain('назад');
});
