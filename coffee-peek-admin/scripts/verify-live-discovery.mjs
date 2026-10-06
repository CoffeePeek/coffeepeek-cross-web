// Read-only checks against the deployed API. No tokens, admin writes or API mocks.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const api = process.env.COFFEE_API_ORIGIN || 'https://api.coffeepeek.by';
const customer = process.env.COFFEE_CUSTOMER_ORIGIN || 'http://127.0.0.1:5173';
const output = path.resolve('test-results/coffee-catalog');
await mkdir(output, { recursive: true });
const checks = [];
async function check(name, route, body, status = 200) {
  const response = await fetch(`${api}${route}`, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const text = await response.text();
  const result = text ? JSON.parse(text) : null;
  checks.push({ name, route, status: response.status, expected: status, errorCode: result?.errorCode, errors: result?.errors, totalItems: result?.data?.totalItems });
  assert.equal(response.status, status, `${name}: ${text.slice(0, 500)}`);
  if (status === 200) assert.equal(result.isSuccess, true, name);
  if (status === 400) assert.equal(result.errorCode, 'INVALID_FILTER', name);
  return result?.data;
}
const shopPath = '/api/v1/coffee-shops/search';
const roasterPath = '/api/v1/roasters/search';
const coffeePath = '/api/v1/coffees/search';
const discoveryPath = '/api/v1/discovery/search';
const browserErrors = [], browserRequests = [];
let browser, page;
try {
  const values = await check('coffee dictionary', '/api/v1/catalogs/coffee-filter-values');
  assert.equal(values.length, 8);
  const tags = await check('roaster tags', '/api/v1/catalogs/roaster-tags');
  assert(tags.some(tag => tag.slug === 'online-order'));
  const shops = await check('shop search', shopPath, { q: '', filters: { city: 'minsk' }, sort: 'name_asc', page: 1, pageSize: 5 });
  for (const shop of shops.items) { assert.equal(shop.city.slug, 'minsk'); assert.equal(shop.isFavorite, null); assert.equal(shop.isVisited, null); }
  const roasters = await check('roaster search', roasterPath, { q: '', filters: {}, sort: 'name_asc', page: 1, pageSize: 5 });
  for (const roaster of roasters.items) assert.equal(roaster.isFavorite, null);
  const coffees = await check('coffee search', coffeePath, { q: '', filters: { availableOnly: true }, sort: 'name_asc', page: 1, pageSize: 20 });
  const allCoffees = await check('include unavailable published coffees', coffeePath, { filters: { availableOnly: false } });
  const priced = await check('valid exact-weight price sort', coffeePath, { filters: { weightGrams: 250, currency: 'BYN', availableOnly: true }, sort: 'price_asc' });
  for (const coffee of priced.items) {
    assert(coffee.matchingOffers.length);
    for (const offer of coffee.matchingOffers) { assert.equal(offer.weightGrams, 250); assert.equal(offer.currency, 'BYN'); assert.equal(offer.availability, 'InStock'); }
    assert.equal(coffee.sortPrice, Math.min(...coffee.matchingOffers.map(offer => offer.price)));
  }
  const coffeeFacets = await check('coffee facets', '/api/v1/coffees/facets', { filters: { caffeine: ['decaf'], currency: 'BYN', weightGrams: 250 } });
  assert(coffeeFacets.groups.find(group => group.code === 'caffeine').options.find(option => option.code === 'decaf').selected);
  const roasterFacets = await check('roaster facets', '/api/v1/roasters/facets', {});
  assert.equal(roasterFacets.groups.find(group => group.code === 'roasterTags').selection, 'and');
  const discovery = await check('independent discovery pages', discoveryPath, { coffeeShops: { page: 2, pageSize: 5 }, roasters: { page: 1, pageSize: 5 } });
  assert.equal(discovery.coffeeShops.currentPage, 2); assert.equal(discovery.roasters.currentPage, 1);
  const section = await check('unselected discovery section is null', discoveryPath, { sections: ['roasters'], roasters: { page: 1 } });
  assert.equal(section.coffeeShops, null);
  await check('independent discovery budgets', discoveryPath, { filters: { brew: ['filter'], budget: { currency: 'BYN', maxDrinkPrice: 10, maxCoffeePrice: 50, coffeeWeightGrams: 250 } } });
  await check('roaster coffee criteria', roasterPath, { filters: { coffee: { caffeine: ['decaf'], roast: ['light'], acidity: ['low', 'balanced'] } } });
  await check('empty selections do not restrict', coffeePath, { filters: { caffeine: [], brew: [] } });
  for (const [name, route, body] of [
    ['price sort needs currency and weight', coffeePath, { sort: 'price_asc' }],
    ['price needs currency', coffeePath, { filters: { maxPrice: 50 } }],
    ['min price cannot exceed max', coffeePath, { filters: { currency: 'BYN', minPrice: 60, maxPrice: 50 } }],
    ['unknown code', coffeePath, { filters: { caffeine: ['invalid-live-check'] } }],
    ['wrong-group code', coffeePath, { filters: { brew: ['decaf'] } }],
    ['unknown field', coffeePath, { filters: { invalidField: true } }],
    ['relevance needs query', coffeePath, { sort: 'relevance', q: '' }],
    ['distance needs origin', shopPath, { sort: 'distance_asc' }],
    ['radius needs origin', shopPath, { filters: { radiusKm: 5 } }],
    ['nested roasters forbidden', roasterPath, { filters: { coffee: { roasters: ['daloni-coffee'] } } }],
    ['tag/exclude overlap', roasterPath, { filters: { tags: ['subscription'], excludeTags: ['subscription'] } }],
    ['scoped discovery field forbidden', discoveryPath, { filters: { city: 'minsk' } }],
    ['bag budget needs weight', discoveryPath, { filters: { budget: { currency: 'BYN', maxCoffeePrice: 50 } } }],
  ]) await check(name, route, body, 400);
  for (const [route, body] of [[shopPath, { filters: { visitedOnly: true } }], [shopPath, { filters: { favoritesOnly: true } }], [roasterPath, { filters: { favoritesOnly: true } }], ['/api/v1/favorites', undefined], ['/api/admin/coffees?page=1&pageSize=5', undefined], ['/api/admin/coffee-filter-values', undefined], ['/api/admin/roaster-tags', undefined], ['/api/admin/coffee-import/runs?limit=1', undefined]]) await check('JWT required', route, body, 401);
  await check('missing coffee detail', '/api/v1/coffees/live-check-nonexistent-coffee', undefined, 404);
  if (coffees.items.length) await check('published coffee detail', `/api/v1/coffees/${coffees.items[0].address.slug}`);
  if (roasters.items.length) await check('existing roaster profile', `/api/roasters/${roasters.items[0].address.slug}`);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => { if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'light'); });
  page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('requestfailed', request => console.error('Request failed:', request.url(), request.failure()?.errorText));
  page.on('response', response => { const url = new URL(response.url()); const route = url.pathname.replace(/^\/backend/, ''); if (route.startsWith('/api/v1/')) browserRequests.push({ path: route, status: response.status() }); });
  for (const [route, heading] of [['/search', 'Поиск кофеен и обжарщиков'], ['/roasters', 'Обжарщики'], ['/coffees', /Каталог specialty coffee/]]) {
    await page.goto(`${customer}${route}`); await page.getByRole('heading', { name: heading, exact: typeof heading === 'string' }).waitFor();
    if (route === '/search') await page.getByRole('heading', { name: /Кофейни \(/ }).waitFor();
    else await page.getByText(/Результатов: \d+/).waitFor();
    assert.equal(await page.getByText('Каталог временно недоступен.', { exact: true }).count(), 0);
  }
  const consent = page.getByRole('button', { name: 'Отклонить', exact: true }); if (await consent.count()) await consent.click();
  await page.screenshot({ path: path.join(output, 'customer-live-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: /^Фильтры/ }).click();
  await page.getByRole('dialog').locator('summary').filter({ hasText: 'Кофеин' }).click();
  await page.getByRole('dialog').getByLabel('Декаф (0)', { exact: true }).check();
  await page.getByRole('dialog').getByRole('button', { name: 'Применить', exact: true }).click();
  await page.waitForURL(/decaf/); await page.reload(); await page.getByText(/Результатов: \d+/).waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(output, 'customer-live-mobile.png'), fullPage: true });
  await page.evaluate(() => localStorage.setItem('theme', 'dark')); await page.reload(); await page.getByText(/Результатов: \d+/).waitFor();
  assert(await page.evaluate(() => document.documentElement.classList.contains('dark')));
  await page.screenshot({ path: path.join(output, 'customer-live-mobile-dark.png'), fullPage: true });
  assert.deepEqual(browserErrors, []);
  assert(browserRequests.some(request => request.path === coffeePath && request.status === 200));
  assert(browserRequests.every(request => request.status === 200));
  console.log(JSON.stringify({ apiChecks: checks.length, shops: shops.totalItems, roasters: roasters.totalItems, availableCoffees: coffees.totalItems, allPublishedCoffees: allCoffees.totalItems, browserRequests: browserRequests.length, positiveCoffeeChecks: coffees.totalItems ? 'checked' : 'not exercised: no published coffee' }, null, 2));
} catch (error) {
  if (page) { await page.screenshot({ path: path.join(output, 'live-failure.png'), fullPage: true }); console.error((await page.locator('body').innerText()).slice(0, 2500)); }
  throw error;
} finally {
  await writeFile(path.join(output, 'live-verification.json'), JSON.stringify({ at: new Date().toISOString(), api, checks, browserErrors, browserRequests }, null, 2));
  await browser?.close();
}
