jest.mock('../src/api/notifications', () => ({ getNotificationTemplates: jest.fn(), saveNotificationTemplate: jest.fn(), sendNotification: jest.fn(), getNotificationAudience: jest.fn(), getNotificationBroadcasts: jest.fn(), sendNotificationBroadcast: jest.fn() }));
jest.mock('../src/components/ui/ConfirmDialog', () => ({ ConfirmDialog: (props: any) => props.isOpen ? require('react').createElement('div', { role: 'alertdialog' }, props.message,
  require('react').createElement('button', { onClick: props.onCancel }, 'Отмена'),
  require('react').createElement('button', { onClick: props.onConfirm }, props.confirmLabel)) : null }));
jest.mock('../src/contexts/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));

import { act, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { JSDOM } from 'jsdom';

test('admin saves templates and retries individual and confirmed broadcast messages with original IDs and payloads', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = require('react-dom/client');
  const { NotificationsPage } = require('../src/pages/NotificationsPage');
  const api = require('../src/api/notifications');
  const userId = '7541b7b9-b589-4c61-97b2-a6fe7962e3b9';
  const templates = [{ category: 'Moderation', title: 'Решение модерации', body: 'Проверка {subject}: {status}.', updatedAtUtc: null },
    { category: 'Inactivity', title: 'Время для кофе?', body: 'Давно не виделись!', updatedAtUtc: null },
    { category: 'NewShop', title: 'Новая кофейня на карте', body: 'Загляните в «{name}»!', updatedAtUtc: null }];
  api.getNotificationTemplates.mockResolvedValue({ data: templates });
  api.getNotificationAudience.mockResolvedValue({ data: { users: 205, pushUsers: 1 } });
  api.getNotificationBroadcasts.mockResolvedValue({ data: [] });
  api.sendNotificationBroadcast.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({ data: {} });
  api.saveNotificationTemplate.mockResolvedValue({ data: templates[0] });
  api.sendNotification.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({ data: {} });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData(['admin', 'notification-templates'], templates);
  const root = createRoot(document.getElementById('root'));
  const flush = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); }); };
  const set = async (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    await act(async () => {
      const prototype = field.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value);
      field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      field.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };
  const submit = async (form: HTMLFormElement) => { await act(async () => { form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }); await flush(); };
  try {
    await act(async () => { root.render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: ['/notifications?userId=' + userId] }, createElement(NotificationsPage)))); });
    await flush();
    const forms = document.querySelectorAll('form');
    const custom = forms[0]; const broadcast = forms[1]; const moderation = forms[2];
    expect(custom.querySelector('input')!.value).toBe(userId);
    expect(document.body.textContent).toContain('Проверка чекина: одобрено.');
    await set(moderation.querySelector('textarea')!, 'Результат {subject}: {status}');
    await submit(moderation);
    expect(api.saveNotificationTemplate).toHaveBeenCalledWith('Moderation', { title: 'Решение модерации', body: 'Результат {subject}: {status}' });
    const newShop = forms[4];
    expect(document.body.textContent).toContain('Загляните в «Территория кофе»!');
    await set(newShop.querySelector('textarea')!, 'Попробуйте кофе в «{name}»!');
    await submit(newShop);
    expect(api.saveNotificationTemplate).toHaveBeenCalledWith('NewShop', { title: 'Новая кофейня на карте', body: 'Попробуйте кофе в «{name}»!' });
    await set(custom.querySelectorAll('input')[1], 'Новости');
    await set(custom.querySelector('textarea')!, 'Загляните в CoffeePeek');
    await submit(custom);
    expect(api.sendNotification).toHaveBeenCalledTimes(1);
    expect(custom.querySelector('fieldset')!.disabled).toBe(true);
    const first = api.sendNotification.mock.calls[0];
    await act(async () => { [...custom.querySelectorAll('button')].find(button => button.textContent === 'Повторить отправку')!.click(); });
    await flush();
    expect(api.sendNotification.mock.calls[1]).toEqual(first);
    expect(document.body.textContent).toContain('Сообщение поставлено в очередь. Это ещё не подтверждение доставки');
    await act(async () => { [...custom.querySelectorAll('button')].find(button => button.textContent === 'Новое сообщение')!.click(); });
    expect(custom.querySelector('fieldset')!.disabled).toBe(false);
    await act(async () => { [...document.querySelectorAll('button')].find(button => button.textContent === 'Всем пользователям')!.click(); });
    expect(document.body.textContent).toContain('Получателей в приложении — 205. Доступен push — 1.');
    await set(broadcast.querySelector('input')!, '   ');
    await submit(broadcast);
    expect(document.querySelector('[role=alertdialog]')).toBeNull();
    expect(api.sendNotificationBroadcast).not.toHaveBeenCalled();
    await set(broadcast.querySelector('input')!, '  Новости  ');
    await set(broadcast.querySelector('textarea')!, '  Всем привет  ');
    await submit(broadcast);
    expect(document.querySelector('[role=alertdialog]')!.textContent).toContain('Новости');
    expect(api.sendNotificationBroadcast).not.toHaveBeenCalled();
    await act(async () => { [...document.querySelectorAll('[role=alertdialog] button')].find(button => button.textContent === 'Отмена')!.click(); });
    expect(api.sendNotificationBroadcast).not.toHaveBeenCalled();
    await submit(broadcast);
    await act(async () => { [...document.querySelectorAll('[role=alertdialog] button')].find(button => button.textContent === 'Отправить всем')!.click(); });
    await flush();
    expect(broadcast.querySelector('fieldset')!.disabled).toBe(true);
    expect(api.sendNotificationBroadcast).toHaveBeenCalledTimes(1);
    const broadcastAttempt = api.sendNotificationBroadcast.mock.calls[0];
    expect(broadcastAttempt[1]).toEqual({ title: 'Новости', body: 'Всем привет' });
    await act(async () => { [...broadcast.querySelectorAll('button')].find(button => button.textContent === 'Повторить отправку')!.click(); });
    await flush();
    expect(api.sendNotificationBroadcast.mock.calls[1]).toEqual(broadcastAttempt);
    expect(broadcast.textContent).toContain('Рассылка поставлена в очередь');
    await act(async () => { [...broadcast.querySelectorAll('button')].find(button => button.textContent === 'Новая рассылка')!.click(); });
    expect(broadcast.querySelector('fieldset')!.disabled).toBe(false);
  } finally { await act(async () => root.unmount()); client.clear(); dom.window.close(); }
});
