jest.mock('../src/api/auth', () => ({ googleLogin: jest.fn(), login: jest.fn() }));
const mockUpdateUser = jest.fn();
const mockLogout = jest.fn();
const mockShowToast = jest.fn();
jest.mock('../src/contexts/UserContext', () => ({ useUser: () => ({ updateUserFromToken: mockUpdateUser, logout: mockLogout }) }));
jest.mock('../src/contexts/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: true }) }));
jest.mock('../src/lib/googleIdentity', () => ({ getGoogleClientId: jest.fn(), loadGoogleIdentity: jest.fn() }));
jest.mock('@/src/components/ui/Input', () => require('../src/components/ui/Input'), { virtual: true });

import { act, createElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { JSDOM } from 'jsdom';
import { googleLogin, login } from '../src/api/auth';
import { getGoogleClientId, loadGoogleIdentity } from '../src/lib/googleIdentity';
import type { GoogleAccountsId } from '../src/lib/googleIdentity';

let dom: JSDOM;
let root: ReturnType<typeof import('react-dom/client').createRoot>;
let credentialCallback: Parameters<GoogleAccountsId['initialize']>[0]['callback'];
const mockInitialize = jest.fn();
const mockRenderButton = jest.fn();
const token = (role: string, exp = Math.floor(Date.now() / 1000) + 3600) =>
  ['e30', Buffer.from(JSON.stringify({ roles: [role], exp })).toString('base64url'), 'fixture'].join('.');

beforeEach(() => {
  jest.clearAllMocks();
  dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const { createRoot } = require('react-dom/client');
  root = createRoot(document.getElementById('root')!);
  mockLogout.mockResolvedValue(undefined);
  jest.mocked(getGoogleClientId).mockReturnValue('web-client-id');
  mockInitialize.mockImplementation(config => { credentialCallback = config.callback; });
  mockRenderButton.mockImplementation((parent, options) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Войти через Google';
    expect(options.text).toBe('signin_with');
    parent.appendChild(button);
  });
  jest.mocked(loadGoogleIdentity).mockResolvedValue({ initialize: mockInitialize, renderButton: mockRenderButton });
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
});

async function mount() {
  const { LoginPage } = require('../src/pages/LoginPage');
  await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ['/login'] },
    createElement(Routes, null,
      createElement(Route, { path: '/login', element: createElement(LoginPage) }),
      createElement(Route, { path: '/dashboard', element: createElement('h1', null, 'Dashboard') })))));
}

async function googleCredential(value = 'google-id-token') {
  await act(async () => { credentialCallback({ credential: value }); });
}

test.each(['Admin', 'Moderator', 'Owner'])('Google login accepts %s and uses the existing dashboard session flow', async role => {
  const accessToken = token(role);
  jest.mocked(googleLogin).mockResolvedValue({ data: { accessToken } } as never);
  await mount();
  expect(document.querySelectorAll('form')).toHaveLength(1);
  expect(document.body.textContent).not.toMatch(/регистр/i);
  expect(mockInitialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'web-client-id', ux_mode: 'popup', auto_select: false }));
  await googleCredential();
  expect(googleLogin).toHaveBeenCalledWith('google-id-token');
  expect(mockUpdateUser).toHaveBeenCalledWith(accessToken);
  expect(document.body.textContent).toBe('Dashboard');
  expect(mockLogout).not.toHaveBeenCalled();
});

test.each(['User', 'Employee', 'Roaster'])('Google login revokes a session for %s and never opens the dashboard', async role => {
  jest.mocked(googleLogin).mockResolvedValue({ data: { accessToken: token(role) } } as never);
  await mount();
  await googleCredential();
  expect(mockLogout).toHaveBeenCalledTimes(1);
  expect(mockUpdateUser).not.toHaveBeenCalled();
  expect(mockShowToast).toHaveBeenCalledWith('У этого аккаунта нет доступа к панели', 'error');
  expect(document.querySelector('#admin-email')).not.toBeNull();
});

test('failed Google login supports retry and blocks duplicate callbacks and password submissions while pending', async () => {
  let rejectLogin!: (error: Error) => void;
  jest.mocked(googleLogin).mockReturnValueOnce(new Promise((_, reject) => { rejectLogin = reject; }));
  await mount();
  await googleCredential();
  expect((document.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  expect(document.querySelector('[aria-busy="true"]')?.hasAttribute('inert')).toBe(true);
  await googleCredential();
  expect(googleLogin).toHaveBeenCalledTimes(1);
  await act(async () => { rejectLogin(new Error('Invalid token')); });
  expect(mockShowToast).toHaveBeenCalledWith('Не удалось подтвердить аккаунт Google. Попробуйте ещё раз.', 'error');
  expect((document.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
  jest.mocked(googleLogin).mockResolvedValueOnce({ data: { accessToken: token('Moderator') } } as never);
  await googleCredential('second-google-id-token');
  expect(googleLogin).toHaveBeenCalledTimes(2);
  expect(document.body.textContent).toBe('Dashboard');
});

test('empty Google credentials and expired app tokens never authenticate', async () => {
  await mount();
  await googleCredential('');
  expect(googleLogin).not.toHaveBeenCalled();
  expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Google не вернул'), 'error');
  jest.mocked(googleLogin).mockResolvedValue({ data: { accessToken: token('Admin', 1) } } as never);
  await googleCredential();
  expect(mockLogout).toHaveBeenCalledTimes(1);
  expect(mockUpdateUser).not.toHaveBeenCalled();
});

test('Google script failures offer a retry and leave the password form available', async () => {
  jest.mocked(loadGoogleIdentity).mockRejectedValueOnce(new Error('offline'));
  await mount();
  expect(document.querySelector('[role="alert"]')!.textContent).toContain('Не удалось загрузить');
  expect((document.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Повторить загрузку Google')!.click());
  expect(loadGoogleIdentity).toHaveBeenCalledTimes(2);
  expect(document.querySelector('[role="alert"]')).toBeNull();
  expect(mockRenderButton).toHaveBeenCalledTimes(1);
});

test('password login is preserved and an unconfigured Google client adds no controls', async () => {
  const accessToken = token('Admin');
  jest.mocked(getGoogleClientId).mockReturnValue('');
  jest.mocked(login).mockResolvedValue({ data: { accessToken } } as never);
  await mount();
  expect(loadGoogleIdentity).not.toHaveBeenCalled();
  await act(async () => {
    for (const [id, value] of [['admin-email', 'staff@example.com'], ['admin-password', 'password']]) {
      const input = document.getElementById(id)!;
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }
  });
  await act(async () => { document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  expect(login).toHaveBeenCalledWith({ email: 'staff@example.com', password: 'password' });
  expect(mockUpdateUser).toHaveBeenCalledWith(accessToken);
  expect(document.body.textContent).toBe('Dashboard');
});
