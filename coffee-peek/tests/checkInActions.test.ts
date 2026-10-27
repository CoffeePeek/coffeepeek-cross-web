jest.mock('../src/contexts/UserContext', () => ({ useUser: () => ({ user: null }) }));
jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../src/contexts/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false }),
  useQueryClient: () => ({}),
}));
jest.mock('../src/api/checkInReports', () => ({ reportCheckIn: jest.fn() }));
jest.mock('../src/api/user', () => ({ blockAuthor: jest.fn() }));
jest.mock('../src/lib/photoSession', () => ({ invalidateProtectedPhotos: jest.fn() }));
jest.mock('../src/utils/errorHandler', () => ({ getErrorMessage: () => 'Ошибка' }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), useLocation: () => ({ pathname: '/check-ins/post' }) }));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReportCheckInButton from '../src/components/ReportCheckInButton';

const render = (props: Partial<React.ComponentProps<typeof ReportCheckInButton>> = {}) => {
  jest.mocked(React.useState).mockImplementationOnce(() => [true, jest.fn()]);
  return renderToStaticMarkup(React.createElement(ReportCheckInButton, { checkInId: 'post', authorId: 'author', ...props }));
};

afterEach(() => jest.clearAllMocks());

test('guests see sharing, author blocking and reporting in the post menu', () => {
  const html = render();
  for (const label of ['Поделиться', 'Заблокировать автора', 'Пожаловаться']) expect(html).toContain(label);
});

test('own posts retain owner actions and cannot be blocked or reported', () => {
  const html = render({ actions: () => React.createElement('button', null, 'Изменить') });
  expect(html).toContain('Поделиться');
  expect(html).toContain('Изменить');
  expect(html).not.toContain('Заблокировать автора');
  expect(html).not.toContain('Пожаловаться');
});

test('private own posts cannot be shared and missing author IDs cannot be blocked', () => {
  expect(render({ canShare: false, actions: () => null })).not.toContain('Поделиться');
  expect(render({ authorId: null })).not.toContain('Заблокировать автора');
});
jest.mock('react', () => ({ ...jest.requireActual('react'), useState: jest.fn(jest.requireActual('react').useState) }));
