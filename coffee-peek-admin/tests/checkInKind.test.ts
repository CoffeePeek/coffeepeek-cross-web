import { checkInDate, checkInKind, homeRecipe } from '../src/utils/checkInKind';

test('uses explicit kind and keeps legacy shop submissions readable', () => {
  expect(checkInKind({ kind: 'Home', shopId: 'stale-shop-id' })).toBe('Home');
  expect(checkInKind({ kind: 'Shop', preparedOn: '2026-10-14' })).toBe('Shop');
  expect(checkInKind({ shopId: 'shop-id', visitedAtUtc: '2026-10-14T12:00:00Z' })).toBe('Shop');
  expect(checkInKind({ preparedOn: '2026-10-14', shopId: null })).toBe('Home');
  expect(checkInKind({ shopId: null })).toBe('Unknown');
});

test('reads home recipe from nested or flat DTO fields', () => {
  expect(homeRecipe({ kind: 'Home', home: { beanName: 'Руанда', tasteScore: 5 }, doseGrams: 18 })).toMatchObject({
    beanName: 'Руанда', tasteScore: 5, doseGrams: 18,
  });
  expect(homeRecipe({ kind: 'Home', brewMethodCode: 'hario-v60', brewDurationSeconds: 180 })).toMatchObject({
    brewMethodCode: 'hario-v60', brewDurationSeconds: 180,
  });
});

test('uses preparation date for home and visit date for shop', () => {
  expect(checkInDate({ kind: 'Home', preparedOn: '2026-10-14' })).toBe('14.10.2026');
  expect(checkInDate({ kind: 'Shop', visitedAtUtc: '2026-10-14T12:00:00Z' })).toBe('14.10.2026');
  expect(checkInDate({ kind: 'Home' })).toBe('—');
});
