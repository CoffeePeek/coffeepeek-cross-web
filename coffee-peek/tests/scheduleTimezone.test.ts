import {
  getCurrentStatus,
  isShopOpenNow,
  localTimeToUtc,
  toLocalSchedules,
  uiDayToDotNetName,
  utcTimeToLocal,
} from '../src/utils/shopUtils';

// offsetMinutes follows Date.getTimezoneOffset(): negative = ahead of UTC (e.g. Minsk UTC+3 = -180).
const MINSK = -180;

test('unknown API hours stay unknown and known API status is used without a schedule', () => {
  expect(isShopOpenNow({ schedules: [], isOpen: null })).toBeUndefined();
  expect(isShopOpenNow({ schedules: [], isOpen: true })).toBe(true);
  expect(isShopOpenNow({ schedules: [], isOpen: false })).toBe(false);
});

test('converts local time to UTC without crossing midnight', () => {
  expect(localTimeToUtc(0, '08:00', MINSK)).toEqual({ dayOfWeek: 0, time: '05:00' });
  expect(localTimeToUtc(0, '22:00', MINSK)).toEqual({ dayOfWeek: 0, time: '19:00' });
});

test('shifts dayOfWeek back when conversion crosses midnight', () => {
  expect(localTimeToUtc(0, '02:00', MINSK)).toEqual({ dayOfWeek: 6, time: '23:00' });
});

test('shifts dayOfWeek forward for timezones behind UTC', () => {
  expect(localTimeToUtc(3, '23:00', 300)).toEqual({ dayOfWeek: 4, time: '04:00' });
});

test('utcTimeToLocal reverses localTimeToUtc', () => {
  for (const [dayOfWeek, time] of [[0, '08:00'], [0, '02:00'], [6, '23:30']] as const) {
    const utc = localTimeToUtc(dayOfWeek, time, MINSK);
    expect(utcTimeToLocal(utc.dayOfWeek, utc.time, MINSK)).toEqual({ dayOfWeek, time });
  }
});

test('serializes schedule days using System.DayOfWeek names', () => {
  expect(uiDayToDotNetName(0)).toBe('Monday');
  expect(uiDayToDotNetName(6)).toBe('Sunday');
});

test('serializes the UTC day when timezone conversion crosses midnight', () => {
  const utc = localTimeToUtc(0, '02:00', MINSK);
  expect(uiDayToDotNetName(utc.dayOfWeek)).toBe('Sunday');
  expect(utc.time).toBe('23:00');
});

describe('getCurrentStatus (UTC-aware, "open right now")', () => {
  // schedules are UTC; getUTC* makes the check independent of the test machine's tz.
  const at = (iso: string) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(iso));
  };
  afterEach(() => jest.useRealTimers());

  // 2026-09-14T..Z is a Monday → dayOfWeek 0 in the Mon=0 scheme.
  test('open during same-day hours', () => {
    at('2026-09-14T09:30:00Z');
    expect(getCurrentStatus({ schedules: [{ dayOfWeek: 0, openTime: '08:00', closeTime: '22:00' }] })?.isOpen).toBe(true);
  });

  test('closed before opening', () => {
    at('2026-09-14T09:30:00Z');
    expect(getCurrentStatus({ schedules: [{ dayOfWeek: 0, openTime: '10:00', closeTime: '22:00' }] })?.isOpen).toBe(false);
  });

  test('overnight span open after midnight belongs to previous day', () => {
    at('2026-09-14T01:00:00Z'); // Monday 01:00 UTC
    expect(getCurrentStatus({ schedules: [{ dayOfWeek: 6, openTime: '22:00', closeTime: '02:00' }] })?.isOpen).toBe(true);
  });

  test('overnight span open before midnight on its own day', () => {
    at('2026-09-14T23:00:00Z'); // Monday 23:00 UTC
    expect(getCurrentStatus({ schedules: [{ dayOfWeek: 0, openTime: '22:00', closeTime: '02:00' }] })?.isOpen).toBe(true);
  });

  test('null when there is no schedule to judge by', () => {
    at('2026-09-14T09:30:00Z');
    expect(getCurrentStatus({ schedules: [] })).toBeNull();
    expect(getCurrentStatus(null)).toBeNull();
  });
});

test('toLocalSchedules shows UTC-stored hours in local time', () => {
  expect(toLocalSchedules([{ dayOfWeek: 0, openTime: '05:00', closeTime: '19:00' }], MINSK))
    .toEqual([{ dayOfWeek: 0, openTime: '08:00', closeTime: '22:00' }]);
  expect(toLocalSchedules([{ dayOfWeek: 6, openTime: '23:00', closeTime: '19:00' }], MINSK))
    .toEqual([{ dayOfWeek: 0, openTime: '02:00', closeTime: '22:00' }]);
});
