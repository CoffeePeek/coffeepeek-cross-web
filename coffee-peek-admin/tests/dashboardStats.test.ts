import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudienceGrowthStats } from '../src/components/dashboard/AudienceGrowthStats';
import { ShopCoverageStats } from '../src/components/dashboard/ShopCoverageStats';
import type { OverviewStats } from '../src/api/admin';

const overview = {
  totalUsers: 100, googleUsers: 40, appleUsers: 25, emailUsers: 35, otherAuthUsers: 0,
  retention: {
    asOfDateUtc: '2026-10-29',
    d1: { eligibleUsers: 80, returnedUsers: 20, ratePercent: 25 },
    d7: { eligibleUsers: 60, returnedUsers: 0, ratePercent: 0 },
    d30: { eligibleUsers: 0, returnedUsers: 0, ratePercent: null },
    afterRegistration: { eligibleUsers: 90, returnedUsers: 30, ratePercent: 33.33 },
  },
} as OverviewStats;

test('shows Google, Apple and email separately and uses the API retention denominators', () => {
  const html = renderToStaticMarkup(createElement(AudienceGrowthStats, { overview }));
  for (const label of ['Google', 'Apple', 'Почта и пароль', '40%', '25%', '35%',
    'Retention D1', 'Retention D7', 'Retention D30', '20 из 80 пользователей',
    '0 из 60 пользователей', '33,33%', '30 из 90 пользователей', 'Пока не вернулись', '>60<']) {
    expect(html).toContain(label);
  }
  expect(html).toContain('Нет пользователей с полным периодом наблюдения');
  expect(html).toContain('>0%<'); // Actual zero retention differs from an immature cohort.
  expect(html).toContain('>—<');
  expect(html).not.toMatch(/NaN|Infinity/);
});

test('missing rollout fields stay unavailable rather than implying zero users or retention', () => {
  const html = renderToStaticMarkup(createElement(AudienceGrowthStats, {
    overview: { totalUsers: 100, googleUsers: 50 } as OverviewStats,
  }));
  expect(html).toContain('Данные недоступны');
  expect(html).toContain('Данные возвращаемости недоступны');
  expect(html).not.toContain('50%');
});

test('an empty audience has no fabricated provider percentages', () => {
  const html = renderToStaticMarkup(createElement(AudienceGrowthStats, {
    overview: { ...overview, totalUsers: 0, googleUsers: 0, appleUsers: 0, emailUsers: 0 },
  }));
  expect(html.match(/— от всех пользователей/g)).toHaveLength(3);
});

test('shop coverage displays counts, decimal completeness and unavailable or empty states', () => {
  const html = renderToStaticMarkup(createElement(ShopCoverageStats, { coverage: {
    totalShops: 8, averageCompletenessPercent: 43.75, shopsWithCheckIns: 3, shopsWithoutCheckIns: 5,
  } }));
  for (const value of ['Всего кофеен', '>8<', '43,75%', 'С чекинами', '>3<', 'Без чекинов', '>5<']) {
    expect(html).toContain(value);
  }
  const empty = renderToStaticMarkup(createElement(ShopCoverageStats, { coverage: {
    totalShops: 0, averageCompletenessPercent: null, shopsWithCheckIns: 0, shopsWithoutCheckIns: 0,
  } }));
  expect(empty).toContain('>—<');
  expect(renderToStaticMarkup(createElement(ShopCoverageStats))).toContain('Данные заполненности и охвата недоступны');
});
