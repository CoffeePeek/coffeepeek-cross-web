// Explicit OpenAPI/PR #334 mock. This tests frontend behavior, not backend filtering.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const customer = process.env.COFFEE_CUSTOMER_ORIGIN || 'http://127.0.0.1:5173';
const admin = process.env.COFFEE_ADMIN_ORIGIN || 'http://127.0.0.1:5174';
const output = path.resolve('test-results/coffee-catalog');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const pages = [];
const address = (kind, slug) => ({ slug, canonicalPath: `/${kind}/${slug}`, revision: 1 });
const at = '2026-10-05T08:00:00Z';
const classification = { defaultBrewPurposes: ['filter'], caffeine: 'decaf', roastLevel: 'light', acidity: 'balanced', processing: ['washed'], fermentation: [], tasteGroups: ['chocolate'], composition: null };
const offer = { offerKey: 'offer-250', weightGrams: 250, price: 32, currency: 'BYN', brewPurpose: 'filter', grind: null, availability: 'InStock', availabilityScope: 'online', sellerName: 'Пример обжарщика', sourceUrl: 'https://example.test/coffee', checkedAtUtc: at };
const coffee = { address: address('coffees', 'example-decaf'), name: 'Пример декафа', roaster: { address: address('roasters', 'sample-roaster'), name: 'Пример обжарщика', coverPhoto: null }, productKind: 'roasted_beans', productForm: 'whole_beans', classification, countries: [{ code: 'CO', nameRu: 'Колумбия', nameEn: 'Colombia' }], coverPhoto: null, matchingOffers: [offer], sortPrice: null, createdAtUtc: at, catalogCheckedAtUtc: at };
const catalogCoffees = [coffee, ...['Пример шоколадного кофе', 'Пример кофе для фильтра'].map((name, i) => ({ ...coffee, address: address('coffees', `example-coffee-${i + 1}`), name, matchingOffers: [{ ...offer, offerKey: `offer-example-${i + 1}`, price: 42 + i * 10 }] }))];
const tagId = '10000000-0000-4000-8000-000000000001';
let tags = [{ id: tagId, slug: 'online-order', name: 'Онлайн-заказ', description: 'Подтверждён заказ у обжарщика', sortOrder: 10, isActive: true }];
const values = [['brew', 'filter', 'Для фильтра'], ['brew', 'espresso', 'Для эспрессо'], ['caffeine', 'decaf', 'Декаф'], ['caffeine', 'regular', 'Обычный'], ['roast', 'light', 'Светлая'], ['acidity', 'balanced', 'Умеренная'], ['acidity', 'low', 'Низкая'], ['processing', 'washed', 'Мытая'], ['taste', 'chocolate', 'Шоколад'], ['taste', 'tea', 'Чайные ноты']].map(([groupCode, code, name], i) => ({ id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, groupCode, code, name, description: null, sortOrder: i * 10, isActive: true }));
const groups = [...new Set(values.map(value => value.groupCode))].map(code => ({ code, name: ({ brew: 'Назначение', caffeine: 'Кофеин', roast: 'Обжарка', acidity: 'Кислотность', processing: 'Обработка', taste: 'Вкус' })[code], selection: 'or', values: values.filter(value => value.groupCode === code).map(({ code, name, description, sortOrder }) => ({ code, name, description, sortOrder })) }));
const shop = { address: address('coffee-shops', 'sample-shop'), name: 'Пример кофейни', city: address('cities', 'minsk'), addressLine: 'Минск, Пример улицы, 1', coverPhoto: null, rating: 4.3, reviewCount: 12, isOpen: true, isVisited: null, isFavorite: null, distanceMeters: null, tags: [], matchingMenuItems: [{ drinkSlug: 'filter-coffee', name: 'Фильтр-кофе', brewMethod: 'filter', price: 8, currency: 'BYN', volumeMl: 250, checkedAtUtc: at }] };
const roaster = { address: coffee.roaster.address, name: coffee.roaster.name, coverPhoto: null, tags: tags.map(({ id, isActive, ...tag }) => tag), isFavorite: null, availableCoffeeProducts: 14, matchingCoffeeProducts: 2, coffeeCatalogUpdatedAtUtc: at, matchingCoffee: coffee };
const id = '30000000-0000-4000-8000-000000000001';
const variantId = '40000000-0000-4000-8000-000000000001';
let entry = { id, roasterId: id, slug: 'example-decaf', status: 'Draft', content: { name: coffee.name, description: 'Описание источника', productKind: 'roasted_beans', productForm: 'whole_beans', compositionKind: 'unknown', processing: 'исходная обработка', roastLevel: null, acidity: null, body: null, qGraderScoreRaw: null, tasteDescriptors: ['Шоколад'], brewRecommendations: [], grindOptions: [], features: ['Исходная характеристика'] }, countries: coffee.countries, protectedFields: ['Photos'], photos: [], variants: [{ ...offer, roastPurpose: null }], reviewWarnings: ['Проверьте происхождение'], version: 7 };
let adminClass = { id, classification: structuredClone(classification), protectedFields: ['caffeine'], variants: [{ id: variantId, brewPurpose: null, protectFromImport: false }], version: 7 };
let failConflict = false, failure = 0;
const requests = [], errors = [], favorites = new Map();
let assignedTags = [tagId], favoriteFailure = 0;
const token = (roles, identity = 'mock-user') => ['e30', Buffer.from(JSON.stringify({ sub: identity, roles, email: `${identity}@example.test`, email_verified: true, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'mock'].join('.');
const pageResult = (items, page = 1, totalItems = items.length, pageSize = 20) => ({ items, totalItems, totalPages: Math.ceil(totalItems / pageSize), currentPage: page, pageSize });
async function setup(isAdmin = false, roles = ['Admin']) {
  let identity = isAdmin ? 'mock-user' : null;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => { if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'light'); });
  await context.route(/\/api\//, async route => {
    const request = route.request(); const url = new URL(request.url());
    if (!/^\/(?:backend\/)?api\//.test(url.pathname)) return route.continue();
    const api = url.pathname.replace(/^\/backend/, ''); const method = request.method(); const body = request.postDataJSON();
    requests.push({ api, method, body });
    assert(!JSON.stringify(body || {}).includes('userId'), 'client must never send userId');
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ isSuccess: true, message: 'Operation successful', data }) });
    const error = status => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ isSuccess: false, message: `Mock HTTP ${status}`, data: null, errorCode: status === 409 ? 'VERSION_CONFLICT' : 'INVALID_FILTER', errors: status === 400 ? { 'filters.caffeine': ['Неактивный код'] } : undefined }) });
    if (api === '/api/tokens') {
      if (method === 'DELETE') { identity = null; return route.fulfill({ status: 204 }); }
      if (method === 'POST') identity = body.email.split('@')[0];
      return identity ? reply({ accessToken: token(roles, identity) }) : error(401);
    }
    if (api === '/api/users/me') return reply({ id: identity, email: `${identity}@example.test`, userName: identity, roles });
    if (api === '/api/v1/catalogs/coffee-filter-values') return reply(groups);
    if (api === '/api/v1/catalogs/roaster-tags') return reply(tags.filter(tag => tag.isActive).map(({ id, isActive, ...tag }) => tag));
    if (api === '/api/v1/discovery/search') return reply({ q: body.q, coffeeShops: pageResult(body.q === 'empty-shop' ? [] : [{ ...shop, name: body.coffeeShops.page === 2 ? 'Кофейня второй страницы' : shop.name }], body.coffeeShops.page, body.q === 'empty-shop' ? 0 : 20, 10), roasters: pageResult([roaster], body.roasters.page, 1, 10) });
    if (api.endsWith('/facets')) {
      const prefixed = api.includes('roasters');
      const facets = groups.map(group => ({ code: `${prefixed ? 'coffee.' : ''}${group.code}`, name: group.name, selection: group.selection, options: group.values.map(option => ({ code: option.code, name: option.name, count: option.code === 'regular' ? 0 : 1, selected: (prefixed ? body.filters?.coffee : body.filters)?.[group.code]?.includes(option.code) ?? false })) }));
      facets.push(...[{ code: 'weightGrams', name: 'Вес', options: [{ code: '250', name: '250 г', count: 1, selected: body.filters?.weightGrams === 250 }] }, { code: 'currency', name: 'Валюта', options: ['BYN', 'RUB'].map(code => ({ code, name: code, count: 1, selected: body.filters?.currency === code })) }].map(group => ({ ...group, code: `${prefixed ? 'coffee.' : ''}${group.code}`, selection: 'single' })));
      if (prefixed) facets.unshift({ code: 'roasterTags', name: 'Услуги', selection: 'and', options: tags.filter(tag => tag.isActive).map(tag => ({ code: tag.slug, name: tag.name, count: 1, selected: body.filters?.tags?.includes(tag.slug) ?? false })) });
      const totalItems = prefixed && body.filters?.favoritesOnly && !favorites.has(`${identity}:roaster:sample-roaster`) ? 0 : 1;
      if (!totalItems) for (const group of facets) for (const option of group.options) option.count = 0;
      if (!prefixed) for (const group of facets) for (const option of group.options) if (option.count) option.count = catalogCoffees.length;
      return reply({ totalItems: prefixed ? totalItems : catalogCoffees.length, groups: facets, ...(prefixed ? {} : { priceRange: body.filters?.currency && body.filters?.weightGrams ? { currency: body.filters.currency, weightGrams: body.filters.weightGrams, min: 32, max: 62 } : null }) });
    }
    if (api === '/api/v1/coffees/search') return failure ? error(failure) : reply(pageResult(body.q === 'empty' ? [] : catalogCoffees.map(coffee => ({ ...coffee, sortPrice: body.sort?.startsWith('price_') ? coffee.matchingOffers[0].price : null })), body.page));
    if (api === '/api/v1/roasters/search') { const isFavorite = identity ? favorites.has(`${identity}:roaster:sample-roaster`) : null; return reply(pageResult((body.filters?.favoritesOnly && !isFavorite) || body.filters?.coffee?.caffeine?.includes('decaf') && body.filters?.coffee?.roast?.includes('dark') ? [] : [{ ...roaster, isFavorite }], body.page)); }
    if (api === '/api/v1/coffee-shops/search') return reply(pageResult([shop], body.page));
    if (api === '/api/v1/coffees/example-decaf') { const { coverPhoto, matchingOffers, sortPrice, ...details } = coffee; return reply({ ...details, description: 'Описание кофе', tasteDescriptors: ['Шоколад'], photos: [], offers: [offer, { ...offer, offerKey: '100', weightGrams: 100, price: 7, availability: 'OutOfStock' }, { ...offer, offerKey: 'rub', price: 600, currency: 'RUB', weightGrams: null, availability: 'Unknown', sourceUrl: 'javascript:alert(1)' }] }); }
    if (api.startsWith('/api/v1/coffees/')) return error(404);
    if (api === '/api/v1/favorites') return identity ? reply([...favorites.entries()].filter(([key]) => key.startsWith(`${identity}:`)).map(([, value]) => value)) : error(401);
    if (api.startsWith('/api/v1/favorites/')) {
      if (!identity || favoriteFailure) return error(favoriteFailure || 401);
      const [, , , , kind, slug] = api.split('/'); const key = `${identity}:${kind}:${slug}`;
      if (method === 'PUT') favorites.set(key, { kind, address: address(kind === 'roaster' ? 'roasters' : 'coffee-shops', slug), createdAtUtc: at }); else favorites.delete(key);
      return route.fulfill({ status: 204 });
    }
    if (api === `/api/admin/roasters/${id}/tags`) { if (method === 'PUT') { assert(body.tagIds.every(id => tags.some(tag => tag.id === id && tag.isActive))); assignedTags = body.tagIds; return route.fulfill({ status: 204 }); } return reply(tags.filter(tag => assignedTags.includes(tag.id))); }
    if (api === '/api/admin/roaster-tags') { if (method === 'POST') { const created = { id: '10000000-0000-4000-8000-000000000002', ...body, isActive: true }; tags.push(created); return reply(created); } return reply(tags); }
    if (api.startsWith('/api/admin/roaster-tags/')) { const tag = tags.find(tag => tag.id === api.split('/').at(-1)); Object.assign(tag, method === 'DELETE' ? { isActive: false } : body); return reply(tag); }
    if (api === '/api/admin/coffee-filter-values') return reply(values);
    if (api === '/api/admin/coffees') return reply(pageResult([entry]));
    if (api === `/api/admin/coffees/${id}` && method === 'GET') return reply(entry);
    if (api === `/api/admin/coffees/${id}/classification` && method === 'GET') return reply(adminClass);
    if (api.startsWith(`/api/admin/coffees/${id}`) && method === 'PATCH') {
      if (failConflict || body.version !== entry.version) { failConflict = false; entry.version++; adminClass.version = entry.version; return error(409); }
      entry.version++; adminClass.version = entry.version;
      if ('content' in body) Object.assign(entry, { content: body.content, protectedFields: body.protectedFields, status: body.status, countries: body.countryCodes.map(code => coffee.countries.find(country => country.code === code)) });
      else if ('classification' in body) Object.assign(adminClass, { classification: body.classification, protectedFields: body.protectedFields });
      else Object.assign(adminClass.variants[0], { brewPurpose: body.brewPurpose, protectFromImport: body.protectFromImport });
      return reply('content' in body ? entry : adminClass);
    }
    if (api === '/api/admin/coffee-import/runs') return reply([{ id, sourceKey: 'source-one', snapshotId: 'snap-1', status: 'Applied', collectedAtUtc: at, appliedAtUtc: at, products: 2, variants: 3, added: 1, missingAvailabilityApplied: true, error: null }, { id: variantId, sourceKey: 'source-two', snapshotId: 'snap-2', status: 'Failed', collectedAtUtc: at, appliedAtUtc: at, products: 0, variants: 0, added: 0, missingAvailabilityApplied: false, error: 'Ошибка источника' }]);
    if (api.toLowerCase() === '/api/catalogs/coffee-origin-countries') return reply(coffee.countries);
    if (api.toLowerCase().startsWith('/api/catalogs/')) return reply([]);
    if (api.includes('stats/moderation')) return reply({ queues: [] });
    if (api.includes('stats')) return reply({ pending: 0, pendingDuplicates: 0 });
    return reply([]);
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(10000); pages.push(page);
  return { context, page };
}
try {
  const { context, page } = await setup();
  await page.goto(`${customer}/search`); await page.getByRole('heading', { name: 'Кофейни (20)' }).waitFor();
  await page.getByRole('button', { name: 'Отклонить', exact: true }).click();
  await page.getByRole('navigation', { name: 'Страницы: Кофейни' }).getByRole('button', { name: 'Далее' }).click();
  await page.getByRole('heading', { name: 'Кофейня второй страницы' }).waitFor(); assert(new URL(page.url()).searchParams.get('roastersPage') === '1');
  await page.goBack(); await page.getByRole('heading', { name: shop.name }).waitFor();
  await page.getByRole('searchbox', { name: 'Поиск', exact: true }).fill('empty-shop');
  await page.getByText('В этой секции ничего не найдено.').waitFor(); await page.getByRole('heading', { name: 'Обжарщики (1)' }).waitFor();
  await page.goto(`${customer}/coffees?sort=price_asc&filters=${encodeURIComponent(JSON.stringify({ currency: 'BYN', weightGrams: 250, availableOnly: true }))}`);
  await page.getByRole('heading', { name: coffee.name }).waitFor(); assert(!(await page.locator('main').innerText()).includes('100 г'));
  await page.getByRole('button', { name: 'Без яркой кислотности', exact: true }).click(); await page.waitForURL(/balanced/);
  assert.deepEqual(JSON.parse(new URL(page.url()).searchParams.get('filters')).acidity, ['balanced', 'low']);
  assert.equal(new URL(page.url()).searchParams.get('page'), '1');
  await page.getByRole('button', { name: 'Без яркой кислотности', exact: true }).click(); await page.waitForURL(url => !(url.searchParams.get('filters') || '').includes('balanced'));
  await page.setViewportSize({ width: 1264, height: 900 });
  await page.getByText(/^3\s*товара по вашим условиям$/).waitFor();
  const cardTops = await page.locator('main article').evaluateAll(cards => cards.map(card => card.getBoundingClientRect().top));
  assert.equal(cardTops.length, 3); assert(cardTops.every(top => Math.abs(top - cardTops[0]) < 1));
  await page.screenshot({ path: path.join(output, 'customer-desktop-light.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: /^Фильтры/ }).click();
  await page.getByRole('dialog').locator('summary').filter({ hasText: 'Кофеин' }).click();
  await page.getByRole('dialog').getByLabel('Декаф (3)', { exact: true }).check();
  await page.keyboard.press('Escape'); assert(!(new URL(page.url()).searchParams.get('filters') || '').includes('decaf'));
  assert(await page.getByRole('button', { name: /^Фильтры/ }).evaluate(button => button === document.activeElement));
  await page.getByRole('button', { name: /^Фильтры/ }).click(); await page.getByRole('dialog').locator('summary').filter({ hasText: 'Кофеин' }).click(); await page.getByRole('dialog').getByLabel('Декаф (3)', { exact: true }).check(); await page.getByRole('dialog').getByRole('button', { name: 'Применить' }).click();
  await page.waitForURL(/decaf/); await page.reload(); await page.getByRole('heading', { name: coffee.name }).waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(output, 'customer-mobile-light.png'), fullPage: true });
  await page.evaluate(() => localStorage.setItem('theme', 'dark')); await page.reload(); await page.getByRole('heading', { name: coffee.name }).waitFor(); assert(await page.evaluate(() => document.documentElement.classList.contains('dark'))); await page.screenshot({ path: path.join(output, 'customer-mobile-dark.png'), fullPage: true });
  await page.getByRole('heading', { name: coffee.name }).click(); await page.getByRole('heading', { name: 'Варианты покупки' }).waitFor();
  assert((await page.locator('main').innerText()).includes('100 г')); await page.getByText('Наличие не подтверждено', { exact: true }).waitFor(); assert(await page.locator('a[href^="javascript:"]').count() === 0);
  await page.goto(`${customer}/coffees/missing`); await page.getByText('Кофе не найден', { exact: true }).waitFor();
  for (const status of [400, 401, 503]) { failure = status; await page.goto(`${customer}/coffees`); await page.getByText(status === 400 ? /Проверьте фильтры\. Сохранённое/ : 'Каталог временно недоступен.', { exact: status !== 400 }).waitFor(); }
  failure = 0; await context.close();
  const personal = await setup(false, ['User']);
  await personal.page.goto(`${customer}/roasters`); await personal.page.getByRole('button', { name: 'Отклонить', exact: true }).click(); await personal.page.getByRole('button', { name: 'Добавить в избранное', exact: true }).click();
  await personal.page.getByLabel('Email', { exact: true }).fill('A@example.test'); await personal.page.getByLabel('Пароль', { exact: true }).fill('testing123'); await personal.page.getByRole('button', { name: 'Войти', exact: true }).click();
  await personal.page.getByRole('button', { name: 'Убрать из избранного', exact: true }).waitFor(); await personal.page.reload(); await personal.page.getByRole('button', { name: 'Убрать из избранного', exact: true }).waitFor();
  favoriteFailure = 503; await personal.page.getByRole('button', { name: 'Убрать из избранного', exact: true }).click(); await personal.page.getByText('Не удалось сохранить избранное. Повторите нажатие.', { exact: true }).waitFor(); await personal.page.getByRole('button', { name: 'Убрать из избранного', exact: true }).waitFor(); favoriteFailure = 0;
  await personal.page.locator('header').getByRole('button', { name: /A/ }).click(); await personal.page.getByRole('button', { name: 'Выйти', exact: true }).click(); await personal.page.waitForURL(`${customer}/`);
  await personal.page.goto(`${customer}/login`); await personal.page.getByLabel('Email', { exact: true }).fill('B@example.test'); await personal.page.getByLabel('Пароль', { exact: true }).fill('testing123'); await personal.page.getByRole('button', { name: 'Войти', exact: true }).click();
  await personal.page.getByRole('link', { name: 'Обжарщики', exact: true }).first().click(); await personal.page.getByRole('button', { name: 'Добавить в избранное', exact: true }).waitFor();
  await personal.page.goto(`${customer}/roasters?filters=${encodeURIComponent(JSON.stringify({ favoritesOnly: true }))}`); await personal.page.getByText('Результатов: 0', { exact: true }).waitFor(); await personal.context.close();
  const a = await setup(true); await a.page.goto(`${admin}/roaster-tags`); await a.page.getByRole('button', { name: 'Создать тег' }).click();
  const dialog = a.page.getByRole('dialog'); await dialog.getByLabel('Slug', { exact: true }).fill('pickup'); await dialog.getByLabel('Название', { exact: true }).fill('Самовывоз'); await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click(); await a.page.getByRole('heading', { name: /Самовывоз/ }).waitFor();
  const tagCard = a.page.locator('div').filter({ has: a.page.getByRole('heading', { name: /Самовывоз/ }) }).filter({ has: a.page.getByRole('button', { name: 'Деактивировать' }) }).last();
  await tagCard.getByRole('button', { name: 'Деактивировать' }).click(); await a.page.getByRole('alertdialog').getByRole('button', { name: 'Деактивировать', exact: true }).click();
  await a.page.getByRole('button', { name: 'Реактивировать' }).click(); await a.page.getByRole('dialog').getByLabel('Активен', { exact: true }).check(); await a.page.getByRole('dialog').getByRole('button', { name: 'Сохранить', exact: true }).click();
  await a.page.goto(`${admin}/roaster-tags/assignments/${id}`); await a.page.getByLabel('Онлайн-заказ', { exact: true }).uncheck(); await a.page.getByLabel('Самовывоз', { exact: true }).check(); await a.page.getByRole('button', { name: 'Сохранить назначения' }).click(); await a.page.reload(); assert(await a.page.getByLabel('Самовывоз', { exact: true }).isChecked()); assert(!await a.page.getByLabel('Онлайн-заказ', { exact: true }).isChecked());
  await a.page.getByLabel('Самовывоз', { exact: true }).uncheck(); await a.page.getByRole('button', { name: 'Сохранить назначения' }).click(); await a.page.reload(); assert.deepEqual(assignedTags, []);
  await a.page.goto(`${admin}/coffees`); await a.page.getByRole('link', { name: entry.content.name, exact: true }).click(); await a.page.getByLabel('Название', { exact: true }).fill('Исправленный декаф');
  a.page.once('dialog', dialog => dialog.dismiss()); await a.page.getByRole('link', { name: 'Услуги обжарщика', exact: true }).click(); assert(new URL(a.page.url()).pathname === `/coffees/${id}`); assert(await a.page.getByLabel('Название', { exact: true }).inputValue() === 'Исправленный декаф');
  await a.page.getByLabel('Кофеин', { exact: true }).selectOption('regular'); await a.page.getByLabel('Назначение варианта', { exact: true }).selectOption('espresso'); await a.page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await a.page.getByText(/Published · версия/).waitFor(); assert(entry.status === 'Published'); assert(entry.protectedFields.includes('Photos')); assert(adminClass.protectedFields.includes('caffeine'));
  const writes = requests.filter(r => r.method === 'PATCH' && r.api.startsWith(`/api/admin/coffees/${id}`)); assert.deepEqual(writes.map(r => r.body.version), [7, 8, 9, 10]);
  failConflict = true; await a.page.getByLabel('Название', { exact: true }).fill('Локальный черновик'); await a.page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click(); await a.page.getByRole('heading', { name: 'Карточка изменилась' }).waitFor(); assert(await a.page.getByLabel('Название', { exact: true }).inputValue() === 'Локальный черновик');
  await a.page.getByRole('button', { name: 'Загрузить текущие данные / сравнить' }).click(); await a.page.getByRole('button', { name: 'Сохранить мой черновик для повторной попытки' }).click(); await a.page.getByRole('button', { name: 'Сохранить изменения' }).click(); await a.page.getByText(/Published · версия 13/).waitFor();
  await a.page.screenshot({ path: path.join(output, 'admin-desktop.png'), fullPage: true });
  await a.page.setViewportSize({ width: 375, height: 812 }); await a.page.waitForFunction(() => document.querySelector('aside').getBoundingClientRect().right <= 1); assert(await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await a.page.evaluate(() => document.querySelector('main.overflow-y-auto').scrollTop = 0); await a.page.screenshot({ path: path.join(output, 'admin-mobile.png'), fullPage: true });
  await a.page.getByRole('button', { name: 'Переключить тему', exact: true }).click(); await a.page.screenshot({ path: path.join(output, 'admin-mobile-dark.png'), fullPage: true });
  await a.page.getByRole('button', { name: 'Архивировать', exact: true }).click(); await a.page.getByRole('alertdialog').getByRole('button', { name: 'Архивировать', exact: true }).click(); await a.page.getByText(/Archived · версия/).waitFor(); await a.page.getByRole('button', { name: 'Вернуть в Draft' }).click(); await a.page.getByText(/Draft · версия/).waitFor();
  await a.page.goto(`${admin}/coffee-import`); await a.page.getByText(/source-one · Applied/).waitFor(); await a.page.getByText(/source-two · Failed/).waitFor(); assert(await a.page.getByRole('button', { name: /Запустить|rollback/i }).count() === 0);
  await a.context.close(); const moderator = await setup(true, ['Moderator']); await moderator.page.goto(`${admin}/coffees/${id}`); await moderator.page.getByLabel('Название', { exact: true }).waitFor(); assert(await moderator.page.getByRole('heading', { name: /Публичный slug/ }).count() === 0); await moderator.context.close();
  assert.deepEqual(errors, []); console.log(`PASS: OpenAPI mock smoke, ${requests.length} intercepted requests. Screenshots: ${output}`);
} catch (error) {
  for (const page of pages.filter(page => !page.isClosed())) { await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); console.error((await page.locator('body').innerText()).slice(0, 4000)); }
  console.error({ errors, requests: requests.slice(-8) }); throw error;
} finally { await browser.close(); }
