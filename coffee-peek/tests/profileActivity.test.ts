import { checkInCountLabel, profileMonthCells, profileToday, profileWeek, shiftProfileMonth } from '../src/utils/profileActivity';

test('activity uses the Minsk calendar date regardless of the browser timezone', () => {
  expect(profileToday(new Date('2026-10-24T21:30:00Z'))).toBe('2026-10-25');
});

test('a Monday-first week retains days from both months and years', () => {
  expect(profileWeek('2027-01-01')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  expect(profileWeek('2026-10-25')[0]).toBe('2026-10-19');
  expect(profileWeek('2026-10-26')[0]).toBe('2026-10-26');
});

test('calendar pads weekdays and supports leap years and year navigation', () => {
  const leap = profileMonthCells('2024-02');
  expect(leap.slice(0, 4)).toEqual([null, null, null, '2024-02-01']);
  expect(leap.at(-1)).toBe('2024-02-29');
  expect(profileMonthCells('2026-02').filter(Boolean)).toHaveLength(28);
  expect(shiftProfileMonth('2026-12', 1)).toBe('2027-01');
  expect(shiftProfileMonth('2026-01', -1)).toBe('2025-12');
});

test.each([[0, 'чекинов'], [1, 'чекин'], [2, 'чекина'], [11, 'чекинов'], [14, 'чекинов'], [21, 'чекин'], [24, 'чекина']])('Russian check-in count %s', (count, word) => {
  expect(checkInCountLabel(Number(count))).toBe(`${count} ${word}`);
});
