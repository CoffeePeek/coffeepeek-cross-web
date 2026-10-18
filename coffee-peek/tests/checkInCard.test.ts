jest.mock('../src/contexts/UserContext', () => ({ useUser: () => ({ user: null }) }));
jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../src/contexts/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/hooks/queries/useCheckIns', () => ({
  useCheckInHelpful: () => ({ error: null, isPending: false }),
  useCheckInVisibility: () => ({ error: null, isPending: false }),
  useDeleteCheckIn: () => ({ error: null, isPending: false }),
}));
jest.mock('../src/components/CheckInPhotos', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/CheckInDrinkPhoto', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/HomeCheckInCard', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/PhotoLightbox', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/ReportCheckInButton', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/utils/errorHandler', () => ({ getErrorMessage: () => 'Ошибка' }));

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CheckInCard from '../src/components/CheckInCard';
import type { CheckInDto } from '../src/api/coffeeshop';

const item = {
  id: 'check-in-id', shop: null, author: null, username: 'Анна', shopName: 'Кофейня',
  text: 'Хороший кофе', rating: null, visitedAt: '2026-09-01T12:00:00Z',
  createdAtUtc: '2026-09-01T12:00:00Z', visibility: 'Private', moderationState: 'NotSubmitted',
  contentRevision: 1, rejectionReason: null, photos: [], helpfulCount: 0, isHelpfulByCurrentUser: false,
} as CheckInDto;

test('renders an unrated check-in without inventing stars or crashing', () => {
  const html = renderToStaticMarkup(createElement(CheckInCard, { item, own: true }));
  expect(html).toContain('Хороший кофе');
  expect(html).toContain('Без оценки');
  expect(html).not.toContain('Оценка NaN');
  expect(html).not.toContain('role="img"');
});

test('retains the rating display for rated check-ins', () => {
  const html = renderToStaticMarkup(createElement(CheckInCard, { item: { ...item, rating: { coffee: 5, service: 4, place: 3 } } }));
  expect(html).toContain('Оценка 4.0 из 5');
  expect(html).not.toContain('Без оценки');
});
