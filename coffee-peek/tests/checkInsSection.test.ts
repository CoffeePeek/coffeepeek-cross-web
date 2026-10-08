jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../src/components/CheckInCard', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/PhotoLightbox', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/skeletons', () => ({ CheckInCardSkeleton: () => null }));
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CheckInsSection } from '../src/components/coffeeshop/CheckInsSection';
import type { CheckInDto } from '../src/api/coffeeshop';

const checkIn = { id: 'check-in', author: { slug: 'author' }, text: 'Хороший кофе', rating: { coffee: 5, service: 4, place: 3 }, createdAtUtc: '2026-09-08T12:00:00Z', photos: [] } as unknown as CheckInDto;
const props = { checkIns: [checkIn], isLoading: false, onCreateCheckIn: () => {}, coffeeShopName: 'Coffee', averageRating: 4.3, totalCount: 2 };

test('summary uses shop totals and category averages from the displayed reviews', () => {
  const html = renderToStaticMarkup(createElement(CheckInsSection, props));
  expect(html).toContain('4.3 · Чекины: 2');
  expect(html).toContain('aria-label="Кофе" aria-valuemin="0" aria-valuemax="5" aria-valuenow="5"');
  expect(html).toContain('aria-label="Сервис" aria-valuemin="0" aria-valuemax="5" aria-valuenow="4"');
  expect(html).toContain('aria-label="Аура" aria-valuemin="0" aria-valuemax="5" aria-valuenow="3"');
  expect(html).toContain('Оценки категорий — по последним посещениям авторов среди показанных чекинов');
});

test('empty reviews show the empty state without invalid category ratings', () => {
  const html = renderToStaticMarkup(createElement(CheckInsSection, { ...props, checkIns: [], totalCount: 0 }));
  expect(html).toContain('Станьте первым');
  expect(html).not.toContain('role="meter"');
  expect(html).not.toContain('NaN');
});

test('repeated visits remain cards, but category summary uses the latest visit of each author', () => {
  const html = renderToStaticMarkup(createElement(CheckInsSection, { ...props, checkIns: [checkIn, { ...checkIn, id: 'older', createdAtUtc: '2026-09-01T12:00:00Z', rating: { coffee: 1, service: 1, place: 1 } }] }));
  expect(html).toContain('aria-label="Кофе" aria-valuemin="0" aria-valuemax="5" aria-valuenow="5"');
});
