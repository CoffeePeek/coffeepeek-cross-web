jest.mock('../src/api/admin', () => ({
  getOverviewStats: jest.fn(), getUsersTimeseries: jest.fn(), getShopsTimeseries: jest.fn(),
  getShopsInsights: jest.fn(), getModerationInsights: jest.fn(),
  getAdminUsers: jest.fn(), getUserStats: jest.fn(), updateUserRole: jest.fn(),
  blockUser: jest.fn(), deleteAdminUser: jest.fn(), getUserSessions: jest.fn(),
  revokeUserSession: jest.fn(), revokeAllUserSessions: jest.fn(),
}));
jest.mock('../src/api/import', () => ({ getImportStats: jest.fn() }));
jest.mock('../src/api/users', () => ({ getUserPublicProfile: jest.fn() }));
let mockRole = 'Moderator';
jest.mock('../src/contexts/UserContext', () => ({ useUser: () => ({
  user: { id: 'current-user', email: 'staff@example.com', roles: [mockRole] },
  isLoading: false, isAdmin: mockRole === 'Admin',
  isModerator: mockRole === 'Moderator' || mockRole === 'Admin', isOwner: mockRole === 'Owner',
}) }));
jest.mock('../src/contexts/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false, toggleTheme: jest.fn() }) }));
jest.mock('../src/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));
jest.mock('@/src/components/ui/DataTable', () => require('../src/components/ui/DataTable'), { virtual: true });
jest.mock('@/src/components/ui/Input', () => require('../src/components/ui/Input'), { virtual: true });

import { act, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { JSDOM } from 'jsdom';
import * as api from '../src/api/admin';
import { getImportStats } from '../src/api/import';
import { getUserPublicProfile } from '../src/api/users';

const listedUser: api.AdminUser = {
  id: 'listed-user', userName: 'Coffee Lover', email: 'coffee@example.com', roles: ['User'],
  createdAtUtc: '2026-10-01T10:00:00Z', checkInCount: 5, addedShopsCount: 2, isBlocked: false,
};
const overview: api.OverviewStats = {
  totalUsers: 42, usersRegisteredToday: 2, activeUsers: 40, blockedUsers: 1, deletedUsers: 1,
  dailyActiveUsers: 10, weeklyActiveUsers: 20, monthlyActiveUsers: 30, emailConfirmedUsers: 35, googleUsers: 10,
  totalCoffeeShops: 12, totalCheckIns: 100, pendingModerationShops: 3, pendingModerationCheckIns: 2,
  newCoffeeShopsToday: 1, newCheckInsToday: 4,
  import: { pending: 0, published: 0, rejected: 0, skipped: 0, inFeed: 0 },
  shopsAvailable: true, moderationAvailable: true,
};
let dom: JSDOM;
let client: QueryClient;
let root: ReturnType<typeof import('react-dom/client').createRoot>;

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'Moderator';
  dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  const { createRoot } = require('react-dom/client');
  root = createRoot(document.getElementById('root')!);
  jest.mocked(api.getAdminUsers).mockImplementation(async (params) => ({
    data: { items: [listedUser], totalItems: 21, totalPages: 2, currentPage: params?.page ?? 1, pageSize: 20 },
  } as never));
  jest.mocked(api.getUserStats).mockResolvedValue({ data: {
    totalUsers: 42, registeredToday: 2, activeUsers: 40, blockedUsers: 1, usersByRole: { User: 40 },
  } } as never);
  jest.mocked(api.getOverviewStats).mockResolvedValue({ data: overview } as never);
  jest.mocked(api.getUsersTimeseries).mockResolvedValue({ data: { days: 30, newUsers: [{ date: '2026-10-24', count: 2 }] } } as never);
  jest.mocked(api.getShopsTimeseries).mockResolvedValue({ data: { days: 30, newShops: [], newCheckIns: [] } } as never);
  jest.mocked(api.getShopsInsights).mockResolvedValue({ data: {
    ratings: { totalCheckIns: 100, averageRating: 4.5, averagePlace: 4, averageService: 5, averageCoffee: 4.5, distribution: [] },
    topShopsByCheckIns30Days: [{ shopId: 'shop-id', name: 'Test Coffee', count: 10 }],
    downloads: { total: 100, last30Days: 20, byChannel: [], topCountries30Days: [] },
  } } as never);
  jest.mocked(api.getModerationInsights).mockResolvedValue({ data: {
    queues: [{ queue: 'shops', pending: 3, oldestPendingHours: 2 }], oldestPendingHours: 2,
    topModerators30Days: [{ moderatorUserId: 'moderator-id', total: 5, approved: 4, rejected: 1 }],
  } } as never);
  jest.mocked(getUserPublicProfile).mockResolvedValue({ data: { userName: 'Test Moderator' } } as never);
  jest.mocked(getImportStats).mockResolvedValue({ data: { pending: 0, pendingDuplicates: 0 } } as never);
  jest.mocked(api.getUserSessions).mockResolvedValue({ data: [{
    id: 'session-id', deviceName: 'Test Browser', isRevoked: false,
  }] } as never);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  dom.window.close();
});

async function settle() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
}

async function mount(path: string) {
  const { AppRoutes } = require('../src/routes/AppRoutes');
  await act(async () => root.render(createElement(QueryClientProvider, { client },
    createElement(MemoryRouter, { initialEntries: [path] }, createElement(AppRoutes)))));
  // Lazy routes and the queries they mount resolve in separate render cycles.
  for (let i = 0; i < 4; i++) await settle();
}

function button(text: string, scope: ParentNode = document): HTMLButtonElement {
  const result = [...scope.querySelectorAll('button')].find(node => node.textContent === text);
  expect(result).toBeDefined();
  return result!;
}

function expectNoPrivilegedRequests() {
  for (const request of [api.updateUserRole, api.blockUser, api.deleteAdminUser,
    api.getUserSessions, api.revokeUserSession, api.revokeAllUserSessions]) {
    expect(request).not.toHaveBeenCalled();
  }
}

test.each(['Moderator', 'Admin'])('%s can navigate to the complete dashboard and load every statistics section', async role => {
  mockRole = role;
  await mount('/dashboard');
  expect(document.querySelector('nav a[href="/dashboard"]')).not.toBeNull();
  expect(document.querySelector('nav a[href="/users"]')).not.toBeNull();
  expect(api.getOverviewStats).toHaveBeenCalled();
  expect(api.getUsersTimeseries).toHaveBeenCalledWith(30);
  expect(api.getShopsTimeseries).toHaveBeenCalledWith(30);
  expect(api.getShopsInsights).toHaveBeenCalled();
  expect(api.getModerationInsights).toHaveBeenCalled();
  for (const text of ['Аудитория', 'Динамика', 'Кофейни и чекины', 'Средний рейтинг', 'Test Coffee', 'Загрузки приложения: 100', 'Test Moderator']) {
    expect(document.querySelector('main')!.textContent).toContain(text);
  }
  expect(document.querySelector('nav a[href="/shops"]')!.textContent).toContain('3');
  await act(async () => button('7 дн').click());
  await settle();
  expect(api.getUsersTimeseries).toHaveBeenLastCalledWith(7);
  expect(api.getShopsTimeseries).toHaveBeenLastCalledWith(7);
  expectNoPrivilegedRequests();
});

test('moderator opens the users route, searches, filters and paginates without any privileged controls or requests', async () => {
  await mount('/dashboard');
  await act(async () => (document.querySelector('nav a[href="/users"]') as HTMLAnchorElement).click());
  await settle();
  await settle();
  expect(document.querySelector('main h2')!.textContent).toContain('Пользователи');
  expect(api.getUserStats).toHaveBeenCalled();
  expect(document.querySelector('main')!.textContent).toContain('Только чтение');
  expect(document.querySelector('tbody')!.textContent).toContain('Coffee Lover');
  expect(document.querySelectorAll('tbody button, tbody a')).toHaveLength(0);
  expect(document.querySelectorAll('thead th')).toHaveLength(5);
  await act(async () => (document.querySelector('[aria-label="Следующая страница"]') as HTMLButtonElement).click());
  await settle();
  expect(api.getAdminUsers).toHaveBeenLastCalledWith({ page: 2, pageSize: 20, search: undefined, role: undefined });
  await act(async () => button('Admin', document.querySelector('main')!).click());
  await settle();
  expect(api.getAdminUsers).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: undefined, role: 'Admin' });
  await act(async () => {
    const input = document.querySelector('input[placeholder="Email или имя..."]')!;
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, 'coffee');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await act(async () => document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  await settle();
  expect(api.getAdminUsers).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: 'coffee', role: 'Admin' });
  expectNoPrivilegedRequests();
});

test('admin retains all user controls and session access; changing to moderator unmounts the sessions panel', async () => {
  mockRole = 'Admin';
  await mount('/users');
  const row = document.querySelector('tbody tr')!;
  for (const label of ['Роль', 'Блок', 'Оборвать', 'Сессии']) expect(button(label, row)).toBeDefined();
  expect(row.querySelector('button[aria-label="Удалить"]')).not.toBeNull();
  expect(row.querySelector('a[href="/notifications?userId=listed-user"]')).not.toBeNull();
  expect(api.getUserSessions).not.toHaveBeenCalled();
  await act(async () => button('Сессии', row).click());
  await settle();
  expect(api.getUserSessions).toHaveBeenCalledWith(listedUser.id);
  expect(document.querySelector('main')!.textContent).toContain('Test Browser');
  expect(button('Отозвать все')).toBeDefined();
  mockRole = 'Moderator';
  const { AppRoutes } = require('../src/routes/AppRoutes');
  await act(async () => root.render(createElement(QueryClientProvider, { client },
    createElement(MemoryRouter, { initialEntries: ['/users'] }, createElement(AppRoutes)))));
  expect(document.querySelector('#user-sessions-listed-user')).toBeNull();
  expect(document.querySelectorAll('tbody button, tbody a')).toHaveLength(0);
  jest.mocked(api.getUserSessions).mockClear();
  await act(async () => { await client.invalidateQueries({ queryKey: ['admin', 'users'] }); });
  await settle();
  expectNoPrivilegedRequests();
});

test.each(['Owner', 'User'])('%s cannot open users or load dashboard statistics', async role => {
  mockRole = role;
  await mount('/users');
  expect(document.querySelector('main')!.textContent).toContain('Добро пожаловать');
  expect(document.querySelector('nav a[href="/users"]')).toBeNull();
  for (const request of [api.getOverviewStats, api.getUsersTimeseries, api.getShopsTimeseries,
    api.getShopsInsights, api.getModerationInsights, api.getAdminUsers, api.getUserStats]) {
    expect(request).not.toHaveBeenCalled();
  }
  expectNoPrivilegedRequests();
});
