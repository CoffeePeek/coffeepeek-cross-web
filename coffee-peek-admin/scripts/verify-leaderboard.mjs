// Local API fixtures only; no real accounts or check-ins are changed.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const origin = process.env.COFFEE_ADMIN_ORIGIN || 'http://127.0.0.1:5174';
const output = path.resolve('test-results/leaderboard');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
const at = '2026-10-26T09:00:00Z';
const actor = '33333333-3333-4333-8333-333333333333';
const original = { id: 'submission', checkInId: 'visit', contentRevision: 1, kind: 'Shop', shopId: 'shop', userName: 'Анна',
  text: 'Утренний кофе', moderationStatus: 'Approved', rejectedReason: null, visitedAtUtc: at, photos: [],
  leaderboardGeoStatus: 'OutsideRadius', shopDistanceMeters: 85.4, locationAccuracyMeters: 12, locationCapturedAtUtc: at,
  leaderboardOverride: null, leaderboardReason: null };
const requests = [], errors = [], audit = [];
let checkIn = { ...original }, failDecision = false, failLeaderboard = false;

async function setup(role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('theme', 'light'));
  await context.route(/\/realtime\//, route => /^\/(?:backend\/)?realtime\//.test(new URL(route.request().url()).pathname) ? route.abort() : route.continue());
  await context.route(/\/api\//, async route => {
    const request = route.request(), url = new URL(request.url());
    if (!/^\/(?:backend\/)?api\//.test(url.pathname)) return route.continue();
    const api = url.pathname.replace(/^\/backend/, ''), method = request.method();
    const body = request.postData() ? request.postDataJSON() : undefined;
    requests.push({ api, method, body, params: Object.fromEntries(url.searchParams), role });
    const reply = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ isSuccess: true, data }) });
    const fail = message => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ isSuccess: false, message }) });
    if (api === '/api/tokens') return reply({ accessToken: ['e30', Buffer.from(JSON.stringify({ sub: actor, email: 'staff@example.test', roles: [role], exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'fixture'].join('.') });
    if (api === '/api/v1/moderation/check-ins') {
      if (method === 'PUT') {
        if (failDecision) { failDecision = false; return fail('Не удалось сохранить тестовое решение'); }
        if ('countsForLeaderboard' in body) {
          assert.equal(role, 'Admin');
          assert.equal(body.moderationStatus, checkIn.moderationStatus);
          checkIn.leaderboardOverride = body.countsForLeaderboard;
          checkIn.leaderboardReason = body.leaderboardReason;
          audit.push({ id: String(audit.length), entityType: 'Review', entityId: checkIn.id, entityName: checkIn.text,
            action: body.countsForLeaderboard ? 3 : 4, moderatorUserId: actor, createdAtUtc: at, comment: body.leaderboardReason });
        }
        checkIn.moderationStatus = body.moderationStatus;
        return reply(checkIn.moderationStatus);
      }
      const items = !url.searchParams.get('status') || url.searchParams.get('status') === checkIn.moderationStatus ? [checkIn] : [];
      return reply({ items, totalItems: items.length, totalPages: 1, currentPage: 1, pageSize: 15 });
    }
    if (api === '/api/admin/audit/moderation') {
      assert(['Review', null].includes(url.searchParams.get('entityType')));
      const action = url.searchParams.get('action');
      const items = audit.filter(item => !action || item.action === (action === 'LeaderboardIncluded' ? 3 : 4));
      return reply({ items, totalItems: items.length, totalPages: 1, currentPage: 1, pageSize: 20 });
    }
    if (api === '/api/v1/leaderboard') {
      if (failLeaderboard) return fail('Рейтинг временно недоступен');
      const period = url.searchParams.get('period'), date = url.searchParams.get('date'), page = Number(url.searchParams.get('page'));
      const empty = date === '2000-01-01';
      const items = empty ? [] : page === 1 ? [
        { rank: 1, authorId: 'anna', username: 'Анна', points: 17, additions: 3, edits: 2, checkIns: 3 },
        { rank: 1, authorId: 'ivan', username: 'Иван', points: 17, additions: 1, edits: 4, checkIns: 5 },
        { rank: 3, authorId: 'olga', username: 'Ольга', points: 2, additions: 0, edits: 0, checkIns: 1 },
      ] : [{ rank: 21, authorId: 'maria', username: 'Мария', points: 1, additions: 0, edits: 1, checkIns: 0 }];
      return reply({ period, startsOn: period === 'month' ? '2026-10-01' : '2026-10-26', endsOnExclusive: period === 'month' ? '2026-11-01' : '2026-11-02', timeZone: 'Europe/Minsk', items, totalCount: empty ? 0 : 41, page, pageSize: 20, me: null });
    }
    if (api === '/api/admin/shops/shop/public-address') return reply({ entityId: 'shop', canonicalPath: '/coffee-shops/test', slug: 'test', revision: 1, isAlias: false });
    return reply({});
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return page;
}

async function screenshot(page, name) {
  if (page.viewportSize().width < 1024) await page.waitForFunction(() => document.getElementById('admin-sidebar').getBoundingClientRect().right <= 1);
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, name + ': viewport overflow');
}

try {
  const admin = await setup('Admin');
  await admin.goto(origin + '/check-ins?status=Approved');
  const block = admin.getByRole('region', { name: 'Участие в рейтинге' });
  await block.getByText('Геопроверка: Дальше 50 м от кофейни').waitFor();
  await block.locator('summary').click();
  await block.getByText('85,4 м', { exact: true }).waitFor();
  await block.getByText('12 м', { exact: true }).waitFor();
  await block.getByRole('button', { name: 'Засчитать', exact: true }).click();
  const dialog = admin.getByRole('dialog');
  const reason = dialog.getByRole('textbox', { name: 'Причина решения' });
  const confirm = dialog.getByRole('button', { name: 'Засчитать', exact: true });
  assert.equal(await reason.getAttribute('maxlength'), '1000');
  for (const text of ['', '   ']) {
    await reason.fill(text);
    await confirm.click();
    await dialog.getByRole('alert').getByText('Укажите причину').waitFor();
    assert.equal(requests.filter(r => r.api.endsWith('/check-ins') && r.method === 'PUT').length, 0);
  }
  const includedReason = 'Посещение подтверждено администратором; GPS определил положение неточно.';
  await reason.fill(includedReason);
  failDecision = true;
  await confirm.click();
  await dialog.getByRole('alert').getByText('Не удалось сохранить тестовое решение').waitFor();
  assert.equal(await reason.inputValue(), includedReason);
  await screenshot(admin, 'decision-dialog');
  await confirm.click();
  await dialog.waitFor({ state: 'hidden' });
  await block.getByText('Ручное решение: Засчитывать', { exact: true }).waitFor();
  await block.getByRole('button', { name: 'Не засчитывать', exact: true }).click();
  const excludedReason = 'Повторный визит ошибочно включён в рейтинг. ' + 'Подтверждено вручную. '.repeat(35);
  await reason.fill(excludedReason);
  await dialog.getByRole('button', { name: 'Не засчитывать', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await block.getByText('Ручное решение: Не засчитывать', { exact: true }).waitFor();
  assert.equal(checkIn.moderationStatus, 'Approved');
  await screenshot(admin, 'check-in-admin-desktop');
  await admin.setViewportSize({ width: 390, height: 844 });
  await screenshot(admin, 'check-in-admin-mobile');
  await admin.setViewportSize({ width: 1440, height: 1000 });

  checkIn = { ...original, contentRevision: 2, moderationStatus: 'Pending' };
  await admin.goto(origin + '/check-ins');
  await block.locator('summary').click();
  await block.getByText('Ручное решение: Нет', { exact: true }).waitFor();
  assert(await block.getByRole('button', { name: 'Засчитать', exact: true }).isDisabled());
  checkIn = { ...original, kind: 'Home', shopId: null, home: { beanName: 'Эфиопия', preparedOn: '2026-10-26' } };
  await admin.goto(origin + '/check-ins?status=Approved');
  await block.getByText('Домашние чекины не участвуют в рейтинге').waitFor();
  await block.locator('summary').click();
  assert(await block.getByRole('button', { name: 'Засчитать', exact: true }).isDisabled());

  await admin.goto(origin + '/audit?entityType=CheckIn');
  await admin.getByRole('cell', { name: includedReason, exact: true }).waitFor();
  await admin.getByRole('cell', { name: excludedReason.trim(), exact: true }).waitFor();
  await admin.getByRole('cell', { name: actor, exact: true }).first().waitFor();
  await Promise.all([
    admin.waitForResponse(response => response.url().includes('action=LeaderboardIncluded')),
    admin.getByRole('button', { name: 'Засчитано в рейтинг', exact: true }).click(),
  ]);
  await admin.getByRole('cell', { name: excludedReason.trim(), exact: true }).waitFor({ state: 'hidden' });
  assert.equal(await admin.locator('tbody tr').count(), 1);
  await screenshot(admin, 'audit-desktop');
  await admin.setViewportSize({ width: 390, height: 844 });
  assert(await admin.getByRole('cell', { name: actor, exact: true }).isVisible());
  assert(await admin.getByRole('cell', { name: includedReason, exact: true }).isVisible());
  await admin.getByRole('cell', { name: includedReason, exact: true }).scrollIntoViewIfNeeded();
  await screenshot(admin, 'audit-mobile');
  await admin.setViewportSize({ width: 1440, height: 1000 });

  await admin.locator('nav a[href="/leaderboard"]').click();
  await admin.getByRole('cell', { name: 'Анна', exact: true }).waitFor();
  assert.deepEqual(await admin.locator('tbody tr td:first-child').allTextContents(), ['1', '1', '3']);
  assert.deepEqual(await admin.locator('thead th').allTextContents(), ['Место', 'Пользователь', 'Баллы', 'Добавления', 'Правки', 'Чекины']);
  await admin.getByRole('button', { name: 'Следующая страница' }).click();
  await admin.getByRole('cell', { name: 'Мария', exact: true }).waitFor();
  await admin.getByRole('button', { name: 'Месяц', exact: true }).click();
  await admin.getByRole('cell', { name: 'Анна', exact: true }).waitFor();
  assert(!new URL(admin.url()).searchParams.has('page'));
  await admin.locator('input[type="date"]').fill('2026-10-01');
  await admin.getByText('01.10.2026 — 31.10.2026', { exact: false }).waitFor();
  await screenshot(admin, 'leaderboard-desktop');
  await admin.setViewportSize({ width: 390, height: 844 });
  await screenshot(admin, 'leaderboard-mobile');
  await admin.locator('input[type="date"]').fill('2000-01-01');
  await admin.getByText('За этот период нет активности', { exact: true }).waitFor();
  failLeaderboard = true;
  await admin.locator('input[type="date"]').fill('2026-09-01');
  await admin.getByRole('alert').getByText('Рейтинг временно недоступен').waitFor();
  failLeaderboard = false;
  await admin.getByRole('button', { name: 'Повторить', exact: true }).click();
  await admin.getByRole('cell', { name: 'Анна', exact: true }).waitFor();
  await admin.goto(origin + '/leaderboard?period=bad&date=2026-02-30&page=-2');
  await admin.getByRole('cell', { name: 'Анна', exact: true }).waitFor();
  const lastRead = requests.filter(r => r.api === '/api/v1/leaderboard').at(-1);
  assert.equal(lastRead.params.period, 'week');
  assert.equal(lastRead.params.page, '1');
  assert.notEqual(lastRead.params.date, '2026-02-30');

  checkIn = { ...original, moderationStatus: 'Pending' };
  const moderator = await setup('Moderator');
  await moderator.goto(origin + '/check-ins');
  await moderator.getByRole('region', { name: 'Участие в рейтинге' }).waitFor();
  assert.equal(await moderator.getByRole('button', { name: 'Засчитать', exact: true }).count(), 0);
  assert.equal(await moderator.getByRole('button', { name: 'Не засчитывать', exact: true }).count(), 0);
  await screenshot(moderator, 'check-in-moderator');
  await moderator.getByRole('button', { name: 'Одобрить', exact: true }).click();
  await moderator.getByRole('alertdialog').getByRole('button', { name: 'Одобрить', exact: true }).click();
  await moderator.getByText('Чекины не найдены', { exact: true }).waitFor();
  const publication = requests.filter(r => r.role === 'Moderator' && r.method === 'PUT' && r.api.endsWith('/check-ins')).at(-1).body;
  assert.deepEqual(publication, { submissionId: 'submission', moderationStatus: 'Approved', comment: null, rejectReason: null });
  await moderator.locator('nav a[href="/leaderboard"]').click();
  await moderator.getByRole('cell', { name: 'Анна', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('Leaderboard UI: admin overrides, reason validation/retry, publication independence, revision reset, home restriction, moderator access, audit, periods/pagination, errors/empty state, mobile layouts passed.');
  console.log('Screenshots: ' + output);
} catch (error) {
  console.error('Fixture requests:', requests);
  console.error('Browser errors:', errors);
  for (const context of browser.contexts()) for (const page of context.pages()) {
    console.error(await page.locator('body').innerText());
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
  }
  throw error;
} finally {
  await browser.close();
}
