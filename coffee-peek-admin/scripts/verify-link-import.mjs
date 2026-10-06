import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const origin = process.env.LINK_IMPORT_TEST_ORIGIN || 'http://127.0.0.1:5174';
const temporary = await mkdtemp(path.join(tmpdir(), 'coffeepeek-link-import-'));
const extension = path.join(temporary, 'extension');
await cp(path.join(root, 'browser-extension/dist'), extension, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
// Fixture permission only: the distributed extension obtains it from its popup.
manifest.host_permissions.push('http://127.0.0.1/*', 'http://localhost/*');
await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
const context = await chromium.launchPersistentContext(path.join(temporary, 'profile'), {
  headless: true,
  ...(process.env.LINK_IMPORT_CHROMIUM ? { executablePath: process.env.LINK_IMPORT_CHROMIUM } : { channel: 'chromium' }),
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  viewport: { width: 1440, height: 1000 },
});
const errors = [], mutations = [];
const candidates = [{ id: 'fixture-a', source: 'Osm', externalId: 'node/1', name: 'Исходная кофейня', address: 'Минск, Тестовая 1', latitude: 53.9, longitude: 27.5, phone: '+375291111111', tagSlugs: [], queueStatus: 'Pending', signals: [] }];
const token = ['e30', Buffer.from(JSON.stringify({ roles: ['Admin'], email: 'fixture@example.test', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'test'].join('.');
const yandex = await readFile(path.join(root, 'tests/fixtures/link-import-yandex.html'), 'utf8');
const instagram = await readFile(path.join(root, 'tests/fixtures/link-import-instagram.html'), 'utf8');
let ignorePatch = false, delaySource = false;
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await worker.evaluate(async (adminOrigin) => {
    await chrome.storage.local.set({ adminOrigin });
    await chrome.scripting.registerContentScripts([{ id: 'coffeepeek-admin', matches: ['http://127.0.0.1/*', 'http://localhost/*'], js: ['bridge.js'], runAt: 'document_idle' }]);
    // Let Playwright attach network interception before an extension-created tab starts navigating.
    const create = chrome.tabs.create.bind(chrome.tabs);
    chrome.tabs.create = async ({ url, ...options }) => {
      const tab = await create({ ...options, url: 'about:blank' });
      await new Promise((resolve) => setTimeout(resolve, 300));
      return chrome.tabs.update(tab.id, { url });
    };
  }, origin);
  await context.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.protocol === 'chrome-extension:') return route.continue();
    if (/yandex\.(by|ru)$/.test(url.hostname)) {
      if (delaySource) await new Promise((resolve) => setTimeout(resolve, 4000));
      return route.fulfill({ contentType: 'text/html', body: yandex });
    }
    if (url.hostname === 'www.instagram.com') return route.fulfill({ contentType: 'text/html', body: instagram });
    if (url.origin !== origin) return route.fulfill({ contentType: 'text/html', body: '<html>Внешний ресурс</html>' });
    if (!url.pathname.startsWith('/backend/')) return route.continue();
    const json = (data) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    if (url.pathname === '/backend/api/tokens') return json({ accessToken: token });
    if (url.pathname === '/backend/api/admin/import/file') {
      mutations.push({ kind: 'create', payload: request.postDataJSON() });
      return json({ parsed: 1, inserted: 1, enriched: 0, unchanged: 0, invalid: 0 });
    }
    if (url.pathname === '/backend/api/admin/import/candidates') return json({ items: candidates, totalCount: candidates.length, page: 1, totalPages: 1 });
    if (url.pathname === '/backend/api/admin/import/candidates/fixture-a') {
      if (request.method() === 'PATCH') {
        const fields = request.postDataJSON(); mutations.push({ kind: 'patch', fields });
        if (!ignorePatch) Object.assign(candidates[0], fields);
      }
      return json(candidates[0]);
    }
    if (url.pathname.endsWith('/import/stats')) return json({ pending: 1, pendingDuplicates: 0, publishedByFocus: {}, byBucket: {} });
    return json([]);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/import/fixture-a?panel=list`);
  await page.getByRole('heading', { name: 'Исходная кофейня' }).waitFor();
  const popup = await context.newPage();
  popup.on('pageerror', (error) => console.log('Popup JavaScript:', error.message));
  popup.on('console', (message) => { if (message.type() === 'error') console.log('Popup console:', message.text()); });
  await worker.evaluate(async (adminOrigin) => {
    const tab = (await chrome.tabs.query({})).find((item) => item.url?.startsWith(adminOrigin));
    await chrome.tabs.update(tab.id, { active: true });
  }, origin);
  await popup.goto(`chrome-extension://${worker.url().split('/')[2]}/popup.html`);
  popup.setDefaultTimeout(10000);
  await popup.getByRole('button', { name: 'Подключить эту админку' }).click();
  try { await popup.getByRole('status').filter({ hasText: 'Подключено' }).waitFor(); }
  catch (error) { console.log('Popup:', await popup.locator('body').innerText()); throw error; }
  await popup.close();
  console.log('OK: popup connects the admin host, including localhost with a port');
  const openRead = async (url) => {
    await page.getByRole('button', { name: 'По ссылке', exact: true }).click();
    await page.getByLabel('Ссылка для импорта').fill(url);
    await page.getByRole('button', { name: 'Получить данные', exact: true }).click();
    try { await page.getByLabel('Сохранить: Сайт', { exact: true }).waitFor({ timeout: 15000 }); }
    catch (error) {
      console.log('Dialog:', await page.getByRole('dialog').innerText());
      console.log('Tabs:', context.pages().map((tab) => tab.url()));
      console.log('Worker:', await worker.evaluate(() => chrome.tabs.query({}).then((tabs) => tabs.map(({ id, url, status }) => ({ id, url, status })) )));
      throw error;
    }
    return page.getByRole('dialog');
  };
  let dialog = await openRead('https://yandex.by/maps/org/blasercafe/86729516416/?ll=1,2');
  assert.equal(await dialog.getByLabel('Сохранить: Телефон', { exact: true }).isChecked(), false);
  assert.equal(await dialog.getByLabel('Сохранить: Сайт', { exact: true }).isChecked(), true);
  assert.equal(await dialog.getByLabel('Сохранить: Название', { exact: true }).isDisabled(), true);
  assert((await dialog.getByLabel('Расписание', { exact: true }).inputValue()).includes('Пн'));
  assert(!(await dialog.innerText()).includes('Соседняя кофейня'));
  await page.screenshot({ path: path.join(temporary, 'desktop.png') });
  await dialog.getByRole('button', { name: 'Сохранить выбранное' }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(candidates[0].phone, '+375291111111');
  assert.equal(mutations[0].fields.phone, undefined);
  assert.equal(mutations[0].fields.website, 'https://www.blasercafe.by/');
  assert(mutations[0].fields.openingHours.includes('Пн'));
  console.log('OK: real extension → Yandex DOM → preview → selected PATCH, existing phone preserved');

  dialog = await openRead('https://www.instagram.com/blasercafe.by/');
  assert((await dialog.innerText()).includes('Зерно / Сотрудничество'));
  assert.equal(await dialog.getByLabel('Расписание', { exact: true }).inputValue(), 'Пн-Сб 11:00 - 20:00');
  assert.equal(await dialog.getByLabel('Сохранить: Сайт', { exact: true }).isChecked(), false);
  await dialog.getByRole('radio', { name: 'Новая кофейня' }).check();
  assert.equal(await dialog.getByRole('button', { name: 'Добавить в очередь' }).isDisabled(), true);
  await dialog.getByLabel('Адрес', { exact: true }).fill('Минск, улица Немига, 5');
  await dialog.getByLabel('Широта', { exact: true }).fill('53.901993');
  await dialog.getByLabel('Долгота', { exact: true }).fill('27.549524');
  await dialog.getByRole('button', { name: 'Добавить в очередь' }).click();
  await dialog.waitFor({ state: 'hidden' });
  const created = mutations.find((item) => item.kind === 'create').payload[0];
  assert.equal(created.externalId, 'instagram:blasercafe.by');
  assert.equal(created.latitude, 53.901993); assert.equal(created.longitude, 27.549524);
  assert(!('description' in created)); assert(!('tagSlugs' in created));
  console.log('OK: Instagram bio/site/hours, missing coordinates required, candidate created without automatic publication');

  ignorePatch = true;
  dialog = await openRead('https://www.instagram.com/blasercafe.by/');
  await dialog.getByLabel('Сохранить: Телефон', { exact: true }).count().then((count) => assert.equal(count, 0));
  await dialog.getByLabel('Сохранить: Расписание', { exact: true }).check();
  await dialog.getByLabel('Расписание', { exact: true }).fill('Пн-Пт 10:00-18:00');
  await dialog.getByRole('button', { name: 'Сохранить выбранное' }).click();
  await dialog.getByRole('alert').filter({ hasText: 'Не сохранено: Расписание' }).waitFor();
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  console.log('OK: ignored backend field produces an error, no false success');

  delaySource = true;
  const before = mutations.length;
  await page.getByRole('button', { name: 'По ссылке', exact: true }).click();
  await page.getByLabel('Ссылка для импорта').fill('https://yandex.by/maps/org/86729516416/');
  await page.getByRole('button', { name: 'Получить данные', exact: true }).click();
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.waitForTimeout(4500);
  assert.equal(mutations.length, before);
  assert.equal(context.pages().filter((tab) => tab.url().includes('yandex.by')).length, 0);
  delaySource = false;
  console.log('OK: cancelling extraction closes its tab and ignores late results');

  await page.setViewportSize({ width: 390, height: 844 });
  dialog = await openRead('https://www.instagram.com/blasercafe.by/');
  const bounds = await dialog.boundingBox();
  assert(bounds.width <= 390 && bounds.x >= 0);
  const scroll = await dialog.evaluate((node) => ({ width: node.clientWidth, scroll: node.scrollWidth }));
  assert(scroll.scroll <= scroll.width + 1);
  await page.screenshot({ path: path.join(temporary, 'mobile.png') });
  assert.deepEqual(errors, []);
  console.log('OK: mobile dialog fits viewport; no JavaScript errors');
  if (process.env.LINK_IMPORT_SCREENSHOTS) {
    await mkdir(process.env.LINK_IMPORT_SCREENSHOTS, { recursive: true });
    await cp(path.join(temporary, 'desktop.png'), path.join(process.env.LINK_IMPORT_SCREENSHOTS, 'desktop.png'));
    await cp(path.join(temporary, 'mobile.png'), path.join(process.env.LINK_IMPORT_SCREENSHOTS, 'mobile.png'));
  }
} finally {
  await context.close();
  await rm(temporary, { recursive: true, force: true });
}
