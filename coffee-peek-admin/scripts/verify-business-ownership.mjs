// Frontend contract fixtures for backend PR #364. No production requests or account changes.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const origin = process.env.COFFEE_ADMIN_ORIGIN || 'http://127.0.0.1:5174';
assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname), 'Use a local preview');
const output = path.resolve('test-results/business-ownership');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const actor = '11111111-1111-4111-8111-111111111111';
const applicant = '22222222-2222-4222-8222-222222222222';
const shopId = '33333333-3333-4333-8333-333333333333';
const roasterId = '44444444-4444-4444-8444-444444444444';
const claimId = '55555555-5555-4555-8555-555555555555';
const at = '2026-10-28T12:00:00Z';
const requests = [], errors = [], contexts = [];
let claims, changes, failDecision = 0, failList = false, competingApproval = false;
function reset() {
  claims = [
    { id: claimId, businessType: 'Roaster', businessId: roasterId, businessNameSnapshot: 'Белый Кит', businessSlugSnapshot: 'white-whale',
      applicantUserId: applicant, contact: 'owner@example.test', evidence: 'Управляю обжаркой. Готов подтвердить полномочия через официальную почту.\nhttps://example.test/roastery',
      status: 'Pending', createdAtUtc: at, reviewedByUserId: null, reviewedAtUtc: null, decisionReason: null, hasCurrentAccess: false, currentOwnerUserId: null },
    { id: '66666666-6666-4666-8666-666666666666', businessType: 'CoffeeShop', businessId: shopId, businessNameSnapshot: 'Место кофе', businessSlugSnapshot: 'coffee-place',
      applicantUserId: applicant, contact: 'manager@example.test', evidence: 'Представитель кофейни', status: 'Pending', createdAtUtc: at,
      reviewedByUserId: null, reviewedAtUtc: null, decisionReason: null, hasCurrentAccess: false, currentOwnerUserId: null },
  ];
  changes = []; failDecision = 0; failList = false; competingApproval = false;
}
reset();
const pageResult = (items, params, totalCount = items.length) => ({ items, totalCount, page: Number(params.get('page') || 1), pageSize: 20 });
async function setup(role = 'Admin') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  contexts.push(context);
  await context.addInitScript(() => localStorage.setItem('theme', 'light'));
  await context.route(/\/realtime\//, route => /^\/(?:backend\/)?realtime\//.test(new URL(route.request().url()).pathname) ? route.abort() : route.continue());
  await context.route(/\/api\//, async route => {
    const req = route.request(), url = new URL(req.url());
    if (!/^\/(?:backend\/)?api\//.test(url.pathname)) return route.continue();
    assert.equal(url.origin, origin, 'Fixtures must not contact a remote API');
    const api = url.pathname.replace(/^\/backend/, ''), method = req.method();
    const body = req.postData() ? req.postDataJSON() : undefined;
    requests.push({ api, method, body, params: Object.fromEntries(url.searchParams), role });
    const reply = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ isSuccess: true, message: '', data }) });
    const fail = (status, message) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ isSuccess: false, message, data: null }) });
    if (api === '/api/tokens') return reply({ accessToken: ['e30', Buffer.from(JSON.stringify({ sub: actor, email: 'staff@example.test', roles: [role], exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'fixture'].join('.') });
    if (api === '/api/admin/ownership-claims') {
      assert.equal(role, 'Admin');
      if (failList) return fail(503, 'Очередь временно недоступна');
      assert(['Pending', 'Approved', 'Rejected'].includes(url.searchParams.get('status')));
      const items = claims.filter(c => c.status === url.searchParams.get('status') && (!url.searchParams.get('businessType') || c.businessType === url.searchParams.get('businessType')) && (!url.searchParams.get('businessId') || c.businessId === url.searchParams.get('businessId')));
      return reply(pageResult(items, url.searchParams, 41));
    }
    if (api.startsWith('/api/admin/ownership-claims/')) {
      assert.equal(role, 'Admin');
      const [id, action] = api.slice('/api/admin/ownership-claims/'.length).split('/');
      const claim = claims.find(item => item.id === id);
      if (!claim) return fail(404, 'Заявка не найдена');
      if (method === 'GET') return reply(claim);
      assert.equal(method, 'POST');
      assert(['approve', 'reject'].includes(action));
      assert.deepEqual(Object.keys(body), body.reason ? ['reason'] : []);
      if (failDecision) { const status = failDecision; failDecision = 0; return fail(status, 'Временная ошибка сохранения'); }
      if (competingApproval) { competingApproval = false; claim.currentOwnerUserId = actor; return fail(409, 'Бизнес уже занят'); }
      if (action === 'reject') assert(body.reason.trim().length > 0);
      assert((body.reason?.length ?? 0) <= 2000);
      claim.status = action === 'approve' ? 'Approved' : 'Rejected';
      claim.decisionReason = body.reason ?? null; claim.reviewedByUserId = actor; claim.reviewedAtUtc = at;
      claim.hasCurrentAccess = action === 'approve'; claim.currentOwnerUserId = action === 'approve' ? applicant : null;
      if (action === 'approve') changes.push({ id: String(changes.length), businessType: claim.businessType, businessId: claim.businessId,
        previousOwnerUserId: null, newOwnerUserId: applicant, actorUserId: actor, reason: body.reason ?? null, claimId: claim.id, createdAtUtc: at });
      return reply(claim);
    }
    if (api === '/api/admin/ownership-changes') {
      assert.equal(role, 'Admin');
      return reply(pageResult(changes.filter(c => (!url.searchParams.get('businessId') || c.businessId === url.searchParams.get('businessId')) && (!url.searchParams.get('businessType') || c.businessType === url.searchParams.get('businessType'))), url.searchParams));
    }
    if (/\/api\/admin\/(shops|roasters)\/.+\/owner$/.test(api)) {
      assert.equal(role, 'Admin'); assert.equal(method, 'PATCH');
      assert.deepEqual(Object.keys(body).sort(), ['ownerUserId', 'reason']); assert(body.reason.trim());
      const id = api.split('/').at(-2), claim = claims.find(c => c.businessId === id);
      const previousOwnerUserId = claim.currentOwnerUserId;
      claim.currentOwnerUserId = body.ownerUserId; claim.hasCurrentAccess = body.ownerUserId === applicant;
      changes.push({ id: String(changes.length), businessType: claim.businessType, businessId: id, previousOwnerUserId,
        newOwnerUserId: body.ownerUserId, actorUserId: actor, reason: body.reason, claimId: null, createdAtUtc: at });
      return reply({ businessId: id, ownerUserId: body.ownerUserId });
    }
    if (api === `/api/admin/roasters/${roasterId}`) return reply({ id: roasterId, name: 'Белый Кит', photos: [], shops: [] });
    if (api === `/api/admin/shops/${shopId}`) return reply({ id: shopId, name: 'Место кофе', photos: [], schedules: [], tags: [], catalogs: {}, location: {}, contacts: {}, ownerUserId: claims[1].currentOwnerUserId });
    if (api === '/api/admin/stats/overview') return reply({ totalUsers: 0, usersRegisteredToday: 0, activeUsers: 0, blockedUsers: 0, deletedUsers: 0,
      dailyActiveUsers: 0, weeklyActiveUsers: 0, monthlyActiveUsers: 0, emailConfirmedUsers: 0, googleUsers: 0,
      totalCoffeeShops: 0, totalCheckIns: 0, pendingModerationShops: 0, pendingModerationCheckIns: 0, newCoffeeShopsToday: 0, newCheckInsToday: 0,
      import: { pending: 0, published: 0, rejected: 0, skipped: 0, inFeed: 0 }, shopsAvailable: true, moderationAvailable: true });
    if (api === '/api/admin/stats/users/timeseries') return reply({ days: 30, newUsers: [], dailyActiveUsers: [] });
    if (api === '/api/admin/stats/shops/timeseries') return reply({ days: 30, newShops: [], newCheckIns: [] });
    if (api === '/api/admin/stats/shops/insights') return reply({ ratings: { totalCheckIns: 0, averageRating: 0, averagePlace: 0, averageService: 0, averageCoffee: 0, distribution: [] },
      topShopsByCheckIns30Days: [], downloads: { total: 0, last30Days: 0, byChannel: [], topCountries30Days: [] } });
    if (api === '/api/admin/stats/moderation/insights') return reply({ queues: [], oldestPendingHours: null, topModerators30Days: [] });
    if (api.includes('coffee-dictionary') || api.endsWith('/tags')) return reply([]);
    if (api.endsWith('/tags/assignments') || api.endsWith('/roaster-tags')) return reply([]);
    return reply({});
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  return page;
}
async function screenshot(page, name) {
  if (page.viewportSize().width < 1024) await page.waitForFunction(() => document.getElementById('admin-sidebar').getBoundingClientRect().right <= 1);
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name}: viewport overflow`);
  assert.equal(await page.locator('main').evaluate(element => element.scrollWidth > element.clientWidth + 1), false, `${name}: main content overflow`);
}
try {
  const page = await setup();
  await page.goto(origin + '/ownership-claims');
  await page.getByRole('heading', { name: 'Заявки на владение', exact: true }).waitFor();
  await page.getByRole('cell', { name: /Белый Кит/ }).waitFor();
  await screenshot(page, 'queue-desktop');
  await page.getByRole('button', { name: 'Следующая страница' }).click();
  await page.waitForURL(/page=2/);
  await page.getByLabel('Тип бизнеса').selectOption('Roaster');
  await page.waitForURL(/page=1/);
  await page.getByRole('cell', { name: /Место кофе/ }).waitFor({ state: 'hidden' });
  await page.getByRole('row').filter({ hasText: 'Белый Кит' }).getByRole('link', { name: 'Рассмотреть', exact: true }).click();
  await page.getByRole('heading', { name: 'Белый Кит', exact: true }).waitFor();
  await screenshot(page, 'claim-desktop');
  await page.getByRole('button', { name: 'Отклонить', exact: true }).click();
  await page.getByRole('alert').getByText('Укажите причину отказа').waitFor();
  assert.equal(await page.getByRole('alertdialog').count(), 0);
  const reason = page.getByRole('textbox', { name: 'Причина решения' });
  await reason.fill('Подтверждено через официальную почту');
  failDecision = 503;
  await page.getByRole('button', { name: 'Одобрить', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Одобрить заявку', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('alert').getByText('Временная ошибка сохранения').waitFor();
  assert.equal(await page.locator('textarea[name="reason"]').inputValue(), 'Подтверждено через официальную почту');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Одобрить заявку', exact: true }).click();
  await page.getByRole('heading', { name: 'Решение администратора' }).waitFor();
  await page.getByText('Заявитель сейчас управляет бизнесом.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Одобрить', exact: true }).count(), 0);
  await page.getByRole('link', { name: 'Управление бизнесом' }).click();
  await page.getByRole('heading', { name: 'Владелец бизнеса' }).waitFor();
  await page.getByRole('textbox', { name: 'Причина изменения доступа' }).fill('Аккаунт владельца удалён');
  await page.getByRole('button', { name: 'Отозвать доступ', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Отозвать', exact: true }).click();
  await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
  await page.goto(origin + `/ownership-claims/${claimId}`);
  await page.getByText('У заявителя сейчас нет доступа к бизнесу.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Одобрить', exact: true }).count(), 0);
  await page.goto(origin + `/ownership-changes?businessType=Roaster&businessId=${roasterId}`);
  await page.getByRole('cell', { name: 'Аккаунт владельца удалён', exact: true }).waitFor();
  await screenshot(page, 'audit-desktop');
  await page.goto(origin + `/ownership-claims/${claims[1].id}`);
  await page.getByRole('textbox', { name: 'Причина решения' }).fill('Не удалось подтвердить полномочия');
  await page.getByRole('button', { name: 'Отклонить', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Отклонить заявку', exact: true }).click();
  await page.getByRole('heading', { name: 'Решение администратора' }).waitFor();
  await page.getByText('Не удалось подтвердить полномочия', { exact: true }).waitFor();
  await page.goto(origin + `/published-shops/${shopId}`);
  await page.getByRole('heading', { name: 'Владелец бизнеса' }).waitFor();
  await page.getByRole('textbox', { name: 'ID нового владельца' }).fill(applicant);
  await page.getByRole('textbox', { name: 'Причина изменения доступа' }).fill('Назначен представитель кофейни');
  await page.getByRole('button', { name: 'Назначить владельца', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Назначить', exact: true }).click();
  await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
  await page.getByText(`Текущий владелец: ${applicant}`, { exact: true }).waitFor();
  await page.getByRole('textbox', { name: 'Причина изменения доступа' }).fill('Аккаунт владельца кофейни удалён');
  await page.getByRole('button', { name: 'Отозвать доступ', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Отозвать', exact: true }).click();
  await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
  await page.getByText('Текущий владелец: не назначен', { exact: true }).waitFor();
  reset();
  await page.goto(origin + `/ownership-claims/${claimId}`);
  competingApproval = true;
  await page.getByRole('button', { name: 'Одобрить', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Одобрить заявку', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('alert').waitFor();
  await page.getByText('У бизнеса уже есть владелец.', { exact: false }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Одобрить', exact: true, includeHidden: true }).isDisabled(), true);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Отмена', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, 'claim-mobile');
  await page.goto(origin + '/ownership-claims');
  await page.getByRole('cell', { name: /Белый Кит/ }).waitFor();
  await screenshot(page, 'queue-mobile');
  failList = true;
  await page.reload();
  await page.getByRole('alert').getByText('Не удалось загрузить заявки на владение.').waitFor();
  assert.equal(await page.getByText('Заявок с такими фильтрами нет', { exact: true }).count(), 0);
  failList = false;
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await page.getByRole('cell', { name: /Белый Кит/ }).waitFor();
  for (const role of ['Moderator', 'User', 'Owner']) {
    const other = await setup(role);
    for (const route of ['/ownership-claims', `/ownership-claims/${claimId}`, '/ownership-changes']) {
      await other.goto(origin + route);
      await other.waitForURL(origin + '/dashboard');
      assert.equal(await other.locator('nav a[href="/ownership-claims"]').count(), 0);
      assert.equal(await other.getByText('owner@example.test', { exact: true }).count(), 0);
    }
    assert.equal(requests.filter(r => r.role === role && r.api.includes('/ownership-')).length, 0, `${role} must not fetch ownership PII`);
  }
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log('Ownership browser fixtures passed: queue/filter/pagination, approve/reject, retry, revoke, audit, 409, mobile, Admin-only routes.');
} catch (error) {
  console.error('Fixture browser errors:', errors);
  console.error('Recent fixture requests:', requests.slice(-8).map(({ api, method }) => ({ api, method })));
  for (const context of contexts) for (const page of context.pages()) {
    console.error('Page:', page.url(), (await page.locator('body').innerText()).slice(0, 1000));
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
  }
  throw error;
} finally {
  await Promise.all(contexts.map(context => context.close()));
  await browser.close();
}
