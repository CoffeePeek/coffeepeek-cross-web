jest.mock('../src/api/businessOwnership', () => ({
  ...jest.requireActual('../src/api/businessOwnership'),
  getOwnershipClaim: jest.fn(), getOwnershipClaims: jest.fn(), getOwnershipChanges: jest.fn(),
  reviewOwnershipClaim: jest.fn(), assignBusinessOwner: jest.fn(),
}));
jest.mock('../src/api/core/httpClient', () => ({ httpClient: {} }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: {} }));
let mockIsAdmin = true;
const mockToast = jest.fn();
jest.mock('../src/contexts/UserContext', () => ({ useUser: () => ({ isAdmin: mockIsAdmin }) }));
jest.mock('../src/contexts/ToastContext', () => ({ useToast: () => ({ showToast: mockToast }) }));
jest.mock('../src/components/ui/ConfirmDialog', () => ({ ConfirmDialog: ({ isOpen, onConfirm, onCancel, error, confirmLabel }: any) => {
  const React = require('react');
  return isOpen ? React.createElement('div', { role: 'alertdialog' }, error && React.createElement('p', { role: 'alert' }, error),
    React.createElement('button', { onClick: onConfirm }, confirmLabel), React.createElement('button', { onClick: onCancel }, 'Отмена')) : null;
} }));
import { act, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { JSDOM } from 'jsdom';
import * as api from '../src/api/businessOwnership';

const claim: api.OwnershipClaim = {
  id: 'claim-id', businessType: 'Roaster', businessId: '11111111-1111-4111-8111-111111111111',
  businessNameSnapshot: 'Тестовый обжарщик', businessSlugSnapshot: 'test-roaster', applicantUserId: 'applicant',
  contact: 'owner@example.test', evidence: '<script>alert(1)</script> Официальная почта', status: 'Pending',
  createdAtUtc: '2026-10-28T12:00:00Z', reviewedByUserId: null, reviewedAtUtc: null, decisionReason: null,
  hasCurrentAccess: false, currentOwnerUserId: null,
};
let dom: JSDOM, client: QueryClient, root: ReturnType<typeof import('react-dom/client').createRoot>;
beforeEach(() => {
  jest.clearAllMocks(); mockIsAdmin = true;
  dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  root = require('react-dom/client').createRoot(document.getElementById('root')!);
  jest.mocked(api.getOwnershipClaim).mockResolvedValue({ ...claim });
  jest.mocked(api.getOwnershipClaims).mockImplementation(async params => ({ items: [claim], totalCount: 41, page: params?.page ?? 1, pageSize: 20 }));
  jest.mocked(api.getOwnershipChanges).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 });
  jest.mocked(api.reviewOwnershipClaim).mockImplementation(async (_id, decision, reason) => ({ ...claim, status: decision === 'approve' ? 'Approved' : 'Rejected', decisionReason: reason }));
  jest.mocked(api.assignBusinessOwner).mockResolvedValue({});
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); dom.window.close(); });
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); }); }
async function mount(kind = 'detail', path = '/ownership-claims/claim-id') {
  const { OwnershipClaimDetailPage } = require('../src/pages/OwnershipClaimDetailPage');
  const { OwnershipClaimsPage } = require('../src/pages/OwnershipClaimsPage');
  const { BusinessOwnerPanel } = require('../src/components/ownership/BusinessOwnerPanel');
  const element = kind === 'detail' ? createElement(OwnershipClaimDetailPage) : kind === 'list' ? createElement(OwnershipClaimsPage) :
    createElement(BusinessOwnerPanel, { businessType: 'Roaster', businessId: claim.businessId });
  await act(async () => root.render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null, createElement(Route, { path: kind === 'detail' ? '/ownership-claims/:id' : '*', element }))))));
  await settle();
}
function button(text: string, scope: ParentNode = document) {
  const element = [...scope.querySelectorAll('button')].find(node => node.textContent === text);
  expect(element).toBeDefined(); return element!;
}
async function fill(selector: string, value: string) {
  await act(async () => {
    const element = document.querySelector(selector)!;
    const proto = element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, value);
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
async function click(text: string, scope?: ParentNode) { await act(async () => button(text, scope).click()); await settle(); }

test('detail shows escaped evidence and validates required rejection reason before confirmation', async () => {
  await mount();
  expect(document.body.textContent).toContain(claim.evidence);
  expect(document.querySelector('script')).toBeNull();
  await click('Отклонить');
  expect(document.body.textContent).toContain('Укажите причину отказа');
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  expect(api.reviewOwnershipClaim).not.toHaveBeenCalled();
  await fill('textarea', 'Не удалось подтвердить полномочия');
  await click('Отклонить');
  expect(api.reviewOwnershipClaim).not.toHaveBeenCalled();
  await click('Отклонить заявку');
  expect(api.reviewOwnershipClaim).toHaveBeenCalledWith('claim-id', 'reject', 'Не удалось подтвердить полномочия');
});
test('failed decisions keep comment and dialog; retry does not send client actor or status fields', async () => {
  await mount();
  await fill('textarea', 'Проверено вручную');
  jest.mocked(api.reviewOwnershipClaim).mockRejectedValueOnce(new Error('Ошибка сети'));
  await click('Одобрить'); await click('Одобрить заявку');
  expect(document.querySelector('[role="alertdialog"]')!.textContent).toContain('Ошибка сети');
  expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Проверено вручную');
  expect(api.reviewOwnershipClaim).toHaveBeenCalledTimes(1);
  await click('Одобрить заявку');
  expect(api.reviewOwnershipClaim).toHaveBeenCalledTimes(2);
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
});
test('409 refreshes current owner and prevents overwriting a competing approval', async () => {
  await mount();
  jest.mocked(api.getOwnershipClaim).mockResolvedValue({ ...claim, currentOwnerUserId: 'other-owner' });
  jest.mocked(api.reviewOwnershipClaim).mockRejectedValueOnce({ status: 409 });
  await click('Одобрить'); await click('Одобрить заявку');
  expect(document.body.textContent).toContain('other-owner');
  expect(document.body.textContent).toContain('Состояние изменилось');
  expect(button('Одобрить').disabled).toBe(true);
  await click('Одобрить заявку');
  expect(api.reviewOwnershipClaim).toHaveBeenCalledTimes(1);
});
test('approved claim with revoked access has no review actions and does not imply current ownership', async () => {
  jest.mocked(api.getOwnershipClaim).mockResolvedValue({ ...claim, status: 'Approved', hasCurrentAccess: false });
  await mount();
  expect(document.body.textContent).toContain('У заявителя сейчас нет доступа');
  expect([...document.querySelectorAll('button')].some(node => node.textContent === 'Одобрить')).toBe(false);
});
test('queue has no unsupported All status and computes pagination from totalCount; filters reset page', async () => {
  await mount('list', '/ownership-claims?page=2&status=Approved');
  expect(api.getOwnershipClaims).toHaveBeenCalledWith(expect.objectContaining({ page: 2, status: 'Approved' }), expect.anything());
  expect(document.querySelectorAll('select')[0].querySelectorAll('option')).toHaveLength(3);
  await act(async () => (document.querySelector('[aria-label="Следующая страница"]') as HTMLButtonElement).click()); await settle();
  expect(api.getOwnershipClaims).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }), expect.anything());
  await act(async () => { const select = document.querySelector('select')!; select.value = 'Rejected'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); }); await settle();
  expect(api.getOwnershipClaims).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, status: 'Rejected' }), expect.anything());
});
test('manual revocation requires audit reason, confirms and works without knowing a deleted account', async () => {
  await mount('panel');
  await click('Отозвать доступ');
  expect(api.assignBusinessOwner).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain('Укажите причину');
  await fill('textarea', 'Аккаунт удалён'); await click('Отозвать доступ');
  await click('Отозвать', document.querySelector('[role="alertdialog"]')!);
  expect(api.assignBusinessOwner).toHaveBeenCalledWith('Roaster', claim.businessId, null, 'Аккаунт удалён');
});
test.each(['detail', 'list', 'panel'])('non-admin never fetches or renders ownership contacts and controls: %s', async kind => {
  mockIsAdmin = false; await mount(kind);
  expect(api.getOwnershipClaim).not.toHaveBeenCalled(); expect(api.getOwnershipClaims).not.toHaveBeenCalled();
  expect(api.getOwnershipChanges).not.toHaveBeenCalled(); expect(document.body.textContent).not.toContain(claim.contact);
  expect(api.reviewOwnershipClaim).not.toHaveBeenCalled(); expect(api.assignBusinessOwner).not.toHaveBeenCalled();
});


test.each(['CoffeeShop', 'Roaster'] as const)('a decision invalidates a previously cached %s profile immediately', async businessType => {
  const key = ['admin', businessType === 'CoffeeShop' ? 'published-shop' : 'roaster', claim.businessId];
  client.setQueryData(key, { id: claim.businessId, ownerUserId: null });
  jest.mocked(api.getOwnershipClaim).mockResolvedValue({ ...claim, businessType });
  jest.mocked(api.reviewOwnershipClaim).mockResolvedValue({ ...claim, businessType, status: 'Approved', currentOwnerUserId: claim.applicantUserId, hasCurrentAccess: true });
  await mount();
  await click('Одобрить'); await click('Одобрить заявку');
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
});
