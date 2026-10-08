// Runs against local Vite servers with the supplied October 8 contracts mocked.
// All API requests are intercepted; this never changes real backend records.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const customer = process.env.COFFEE_CUSTOMER_ORIGIN || 'http://127.0.0.1:5173';
const admin = process.env.COFFEE_ADMIN_ORIGIN || 'http://127.0.0.1:5174';
const output = path.resolve('test-results/check-ins');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const address = (kind, slug) => ({ slug, canonicalPath: `/${kind}/${slug}`, revision: 1, isAlias: false });
const at = new Date().toISOString();
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=', 'base64');
const photo = { id: 'photo-id', fileName: 'coffee.png', contentType: 'image/png', storageKey: 'never-build-this-url', sizeBytes: png.length, sortIndex: 0, url: '/api/v1/check-ins/own/photos/photo-id' };
let own = { id: 'own', shop: address('coffee-shops', 'sample'), author: address('users', 'me'), username: 'Я', shopName: 'Тестовая кофейня', text: 'Мой личный визит', rating: { coffee: 5, service: 4, place: 5 }, visitedAt: at, createdAtUtc: at, visibility: 'Private', moderationState: 'NotSubmitted', contentRevision: 1, rejectionReason: null, drinkSlug: 'cappuccino', customDrinkName: null, drinkNameRu: 'Капучино', drinkNameEn: 'Cappuccino', photos: [photo], helpfulCount: 0, isHelpfulByCurrentUser: false };
let published = { ...own, id: 'published', author: address('users', 'other'), username: 'Другой автор', text: 'Публичный визит с хорошим кофе', visibility: 'Public', moderationState: 'Approved', photos: [] };
const second = { ...published, id: 'second', text: 'Повторное посещение на второй странице' };
let submission = { id: 'submission-id', checkInId: 'published', contentRevision: 4, visitedAtUtc: at, createdAt: at, text: 'Новая ревизия публичного визита', rating: own.rating, userId: 'other-id', userName: 'Другой автор', shopId: 'shop-id', drinkSlug: 'cappuccino', drinkNameRu: 'Капучино', drinkNameEn: 'Cappuccino', customDrinkName: null, rejectedReason: null, moderatedBy: null, moderatedAt: null, moderationStatus: 'Pending', photos: [{ ...photo, fullUrl: '/api/v1/check-ins/published/moderation-photos/photo-id?revision=4', urls: null, ownerId: 'other-id', uploadedAt: at }] };
let report = { id: 'report-id', checkInId: null, reportedByUserId: 'me-id', text: 'Историческая жалоба', status: 'Pending', createdAtUtc: at, resolvedByAdminId: null, resolvedAtUtc: null };
const requests = [], errors = [];
const token = roles => ['e30', Buffer.from(JSON.stringify({ sub: 'me-id', roles, email: 'me@example.test', email_verified: true, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'fixture'].join('.');
async function setup(isAdmin = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => { localStorage.setItem('theme', 'light'); });
  await context.route(/\/realtime\//, route => /^\/(?:backend\/)?realtime\//.test(new URL(route.request().url()).pathname) ? route.abort() : route.continue());
  await context.route('**/fixture-upload/photo', route => {
    const request = route.request();
    assert.equal(request.method(), 'PUT');
    assert.equal(request.headers()['content-type'], 'image/png');
    assert.equal(request.headers()['x-amz-tagging'], 'is_permanent=False');
    return route.fulfill({ status: 200 });
  });
  await context.route(/\/api\//, async route => {
    const request = route.request(), url = new URL(request.url());
    if (!/^\/(?:backend\/)?api\//.test(url.pathname)) return route.continue();
    const api = url.pathname.replace(/^\/backend/, ''), method = request.method();
    const body = request.postData() ? request.postDataJSON() : undefined;
    requests.push({ api, method, body, params: Object.fromEntries(url.searchParams), headers: request.headers() });
    const reply = (data, extra = {}) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, isSuccess: true, message: '', statusCode: null, ...extra }) });
    if (api === '/api/tokens') return reply({ accessToken: token(isAdmin ? ['Admin'] : ['User']) });
    if (api === '/api/users/me') return reply({ address: address('users', 'me'), userName: 'Я', email: 'me@example.test', checkInCount: 1, coffeeShopsCount: 0 });
    if (api === '/api/catalogs/drinks') return reply([{ slug: 'cappuccino', nameRu: 'Капучино', nameEn: 'Cappuccino', category: null }, { slug: 'other', nameRu: 'Другое', nameEn: 'Other', category: null }]);
    if (api === '/api/Photos/check-in') {
      assert.deepEqual(body, [{ fileName: 'visit.png', sizeBytes: png.length, contentType: 'image/png' }]);
      return reply([{ photoId: 'uploaded-photo', storageKey: 'check-ins/uploaded', uploadUrl: `${customer}/fixture-upload/photo` }]);
    }
    if (api.includes('/photos/') || api.includes('/moderation-photos/')) {
      assert(request.headers().authorization?.startsWith('Bearer '), 'protected photos must carry Bearer');
      return route.fulfill({ contentType: 'image/png', body: png });
    }
    if (api === '/api/v1/feed') return reply({ items: [{ publishedAtUtc: at, checkIn: url.searchParams.has('cursor') ? second : published }], nextCursor: url.searchParams.has('cursor') ? null : 'feed-cursor' });
    if (api === '/api/v1/check-ins/mine') return reply({ items: own ? [own] : [], totalCount: own ? 1 : 0 });
    if (api === '/api/v1/check-ins/published/helpful') { published = { ...published, isHelpfulByCurrentUser: method === 'PUT', helpfulCount: method === 'PUT' ? 1 : 0 }; return reply({ isHelpful: method === 'PUT', helpfulCount: published.helpfulCount }); }
    if (api === '/api/v1/check-ins/published/reports') return reply({ ...report, checkInId: 'published', text: body.text });
    if (api === '/api/v1/check-ins/own/visibility') { own = { ...own, visibility: body.visibility, moderationState: body.visibility === 'Public' ? 'Pending' : 'NotSubmitted' }; return reply(own); }
    if (api === '/api/v1/check-ins/own') {
      if (method === 'DELETE') { own = null; return reply(null); }
      if (method === 'PUT') own = { ...own, ...body, contentRevision: own.contentRevision + 1, moderationState: own.visibility === 'Public' ? 'Pending' : 'NotSubmitted' };
      return reply(own);
    }
    if (api === '/api/v1/check-ins' && method === 'POST') return reply({ ...published, ...body, id: 'new' });
    if (api === '/api/CoffeeShops/by-slug/sample') return reply({ shopDto: { address: address('coffee-shops', 'sample'), name: 'Тестовая кофейня', description: 'Кофе для теста', location: { address: 'Минск, Тестовая, 1' }, checkInCount: 1, rating: 4.7, checkIns: [published], userCheckIns: own ? [own] : [], photos: [], equipments: [], beans: [], roasters: [], brewMethods: [], schedules: [], menu: { items: [], photos: [] } } });
    if (api === '/api/admin/shops/shop-id/public-address') return reply({ entityId: 'shop-id', ...address('coffee-shops', 'sample') });
    if (api === '/api/v1/moderation/check-ins') {
      if (method === 'PUT') { assert.equal(body.submissionId, 'submission-id'); submission = { ...submission, moderationStatus: body.moderationStatus }; return reply(body.moderationStatus, { oldEntity: 'Pending' }); }
      assert.equal(url.searchParams.get('status'), 'Pending');
      return reply({ items: submission.moderationStatus === 'Pending' ? [submission] : [], totalItems: submission.moderationStatus === 'Pending' ? 1 : 0, totalPages: 1, currentPage: 1, pageSize: 15 });
    }
    if (api === '/api/admin/check-in-reports') { assert.equal(url.searchParams.get('status'), 'Pending'); return reply({ items: report.status === 'Pending' ? [report] : [], totalCount: report.status === 'Pending' ? 1 : 0, page: 1, pageSize: 20 }); }
    if (api === '/api/admin/check-in-reports/report-id') return reply({ report, checkIn: null });
    if (api === '/api/admin/check-in-reports/report-id/resolution') { assert.deepEqual(body, { deleteCheckIn: false }); report = { ...report, status: 'Dismissed', resolvedAtUtc: at }; return reply(report); }
    // Secondary catalogs and telemetry stay inside the fixture environment too.
    return reply([]);
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return page;
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  assert(!overflow, `${name}: horizontal viewport overflow`);
}
try {
  const page = await setup();
  await page.goto(`${customer}/feed`);
  await page.getByText(published.text, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Отклонить', exact: true }).click();
  await page.getByRole('button', { name: 'Полезно · 0' }).click();
  await page.getByRole('button', { name: 'Полезно · 1' }).waitFor();
  await page.getByRole('button', { name: 'Действия с чекином' }).click();
  await page.getByRole('button', { name: 'Пожаловаться', exact: true }).click();
  await page.getByLabel('Причина жалобы').fill('  Неточный текст  ');
  await page.getByRole('button', { name: 'Отправить жалобу' }).click();
  await page.getByRole('button', { name: 'Загрузить ещё' }).click();
  await page.getByText(second.text, { exact: true }).waitFor();
  await screenshot(page, 'feed-desktop');
  await page.getByRole('button', { name: 'Обновить', exact: true }).click();
  await page.getByRole('button', { name: 'Загрузить ещё' }).waitFor();
  assert(!requests.filter(r => r.api === '/api/v1/feed').at(-1).params.cursor, 'refresh must start without cursor');
  await page.goto(`${customer}/feed?citySlug=minsk`);
  await page.getByText(published.text, { exact: true }).waitFor();
  const filtered = requests.filter(r => r.api === '/api/v1/feed').at(-1);
  assert.equal(filtered.params.citySlug, 'minsk');
  assert(!filtered.params.cursor, 'filter changes must start without cursor');
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, 'feed-mobile');
  await page.goto(`${customer}/check-ins`);
  await page.getByText('Мой личный визит', { exact: true }).waitFor();
  await page.locator('article img').waitFor();
  await screenshot(page, 'history-mobile');
  await page.getByRole('button', { name: 'Сделать публичным', exact: true }).click();
  await page.getByText('На модерации', { exact: false }).waitFor();
  await page.getByRole('link', { name: 'Изменить', exact: true }).click();
  await page.getByLabel('Описание', { exact: true }).fill('Обновлённый текст визита');
  assert.equal(await page.locator('input[type=file]').count(), 0, 'edit cannot replace photos');
  await screenshot(page, 'editor-mobile');
  await page.setViewportSize({ width: 320, height: 740 });
  const starsFit = await page.getByRole('button', { name: 'Кофе: 5 из 5' }).evaluate(button => button.getBoundingClientRect().right <= button.closest('section').getBoundingClientRect().right);
  assert(starsFit, 'all five rating buttons must fit on small phones');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await page.waitForURL('**/coffee-shops/sample');
  const edit = requests.find(r => r.api === '/api/v1/check-ins/own' && r.method === 'PUT');
  assert.deepEqual(edit.body, { text: 'Обновлённый текст визита', rating: { coffee: 5, service: 4, place: 5 }, drinkSlug: 'cappuccino' });
  await page.getByRole('button', { name: 'Чекин', exact: true }).click();
  await page.waitForURL('**/coffee-shops/sample/check-ins/new');
  await page.getByLabel('Описание', { exact: true }).fill('Личный чекин из формы');
  await page.locator('input[type=file]').setInputFiles({ name: 'visit.png', mimeType: 'image/png', buffer: png });
  await screenshot(page, 'create-mobile');
  await page.getByRole('button', { name: 'Создать чекин' }).click();
  await page.waitForURL('**/coffee-shops/sample');
  const create = requests.find(r => r.api === '/api/v1/check-ins' && r.method === 'POST');
  assert.equal(create.body.coffeeShopSlug, 'sample');
  assert.equal(create.body.visibility, 'Private');
  assert.deepEqual(create.body.photos, [{ fileName: 'visit.png', contentType: 'image/png', storageKey: 'check-ins/uploaded', size: png.length }]);
  assert(!('header' in create.body) && !('isPublic' in create.body) && !('coffeeShopId' in create.body));
  await page.goto(`${customer}/check-ins`);
  await page.getByRole('button', { name: 'Удалить', exact: true }).waitFor();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.getByText('Пока нет чекинов', { exact: true }).waitFor();
  assert.equal(requests.find(r => r.api.endsWith('/reports') && r.method === 'POST').body.text, 'Неточный текст');

  const mod = await setup(true);
  await mod.goto(`${admin}/check-ins`);
  await mod.getByText(submission.text, { exact: true }).waitFor();
  await mod.locator('td img').waitFor();
  await screenshot(mod, 'moderation-desktop');
  await mod.getByRole('button', { name: 'Отклонить', exact: true }).click();
  const dialog = mod.getByRole('alertdialog');
  await dialog.getByRole('button', { name: 'Отклонить', exact: true }).click();
  await dialog.getByRole('alert').waitFor();
  assert(!requests.some(r => r.api === '/api/v1/moderation/check-ins' && r.method === 'PUT'), 'empty reject reason must not reach server');
  await dialog.getByRole('textbox').fill('Недостаточно информации о посещении');
  await dialog.getByRole('button', { name: 'Отклонить', exact: true }).click();
  await mod.getByText('Чекины не найдены', { exact: true }).waitFor();
  await mod.goto(`${admin}/check-in-reports`);
  await mod.getByRole('button', { name: 'Рассмотреть', exact: true }).click();
  await mod.getByText('Чекин недоступен', { exact: true }).waitFor();
  assert(await mod.getByRole('button', { name: 'Принять и удалить чекин' }).isDisabled());
  await mod.setViewportSize({ width: 390, height: 844 });
  await screenshot(mod, 'historical-report-mobile');
  await mod.getByRole('button', { name: 'Отклонить жалобу', exact: true }).click();
  await mod.getByRole('button', { name: 'Да, отклонить жалобу', exact: true }).click();
  await mod.getByText('Жалоба отклонена. Чекин сохранён.', { exact: true }).waitFor();
  assert.equal(errors.length, 0, errors.join('\n'));
  assert(!requests.some(r => /ModerationReviews|review-reports|\/reviews\b|Photos\/review/.test(r.api)), 'obsolete review endpoints must not be called');
  console.log(`Check-in browser flows passed; screenshots: ${output}`);
} catch (error) {
  for (const context of browser.contexts()) for (const page of context.pages()) {
    console.error('Failure page:', page.url(), (await page.locator('body').innerText()).slice(0, 1800));
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
  }
  console.error('Browser errors:', errors);
  console.error('API calls:', requests.map(({ api, method }) => `${method} ${api}`));
  throw error;
} finally { await browser.close(); }
