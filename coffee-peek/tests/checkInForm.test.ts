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
  expect(formatCheckInDate({ visitedAt: '2026-09-01T12:00:00Z', createdAtUtc: now.toISOString() })).toBe('1 сентября 2026 г.');
});
