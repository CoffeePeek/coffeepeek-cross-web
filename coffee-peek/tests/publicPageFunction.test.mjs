import assert from 'node:assert/strict';
import test from 'node:test';
import handler, { renderPublicPage } from '../api/public-page.mjs';
const shell = '<html><head><title>CoffeePeek</title></head><body><div id="root"></div></body></html>';
const address = { slug: '1801', canonicalPath: '/coffee-shops/1801', revision: 1, isAlias: false };
const shop = { address, name: '1801 кофе', description: 'Спешелти кофейня', rating: 4.9, checkInCount: 20,
  location: { address: 'пр. Независимости 95', latitude: 53.9, longitude: 27.6 },
  photos: [{ fullUrl: 'https://media.example/shop.jpg' }],
  menu: { currency: 'BYN', items: [{ nameRu: 'Капучино', availability: 'Present', price: 7 }] },
};
async function withMock(body, run, status = 200) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.endsWith('/index.html')) return new Response(shell);
    calls.push(url);
    assert.doesNotMatch(url, /public-address/);
    return new Response(JSON.stringify(body), { status, headers: { 'Retry-After': '30' } });
  };
  try { await run(calls); } finally { globalThis.fetch = original; }
}
test('catalog uses inline addresses for links and SEO, in one request', async () => {
  await withMock({ isSuccess: true, data: { coffeeShops: [shop] } }, async calls => {
    const result = await renderPublicPage(new Request('https://coffeepeek.by/api/public-page?page=shops'));
    assert.equal(result.status, 200);
    assert.match(result.html, /href="\/coffee-shops\/1801"/);
    assert.match(result.html, /1801 кофе/);
    assert.match(result.html, /ItemList/);
    assert.equal(calls.length, 1);
  });
});
test('shop details are directly in data; menu, photos and structured metadata render', async () => {
  await withMock({ isSuccess: true, data: shop }, async calls => {
    const result = await renderPublicPage(new Request('https://coffeepeek.by/api/public-page?page=shop&shopId=1801'));
    assert.equal(result.status, 200);
    assert.match(result.html, /Капучино — 7 BYN/);
    assert.match(result.html, /property="og:image"/);
    assert.match(result.html, /CafeOrCoffeeShop/);
    assert.match(result.html, /1801 кофе — CoffeePeek/);
    assert.equal(calls.length, 1);
  });
});
for (const kind of ['shops', 'roasters', 'users', 'cities', 'zones']) {
  test(`${kind}: response shape supplies canonical path and alias redirect`, async () => {
    const metadata = { ...address, isAlias: true };
    const entity = { name: 'Coffee', userName: 'Petr', address: metadata };
    const body = kind === 'users' ? { data: { userName: 'Petr' }, address: metadata }
      : ['cities', 'zones'].includes(kind) ? entity : { isSuccess: true, data: entity };
    await withMock(body, async calls => {
      const response = await handler.fetch(new Request(`https://coffeepeek.by/api/public-page?page=address&kind=${kind}&segment=old&path=/old`));
      assert.equal(response.status, 301);
      assert.equal(response.headers.get('Location'), address.canonicalPath);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal(calls.length, 1);
    });
  });
}
for (const status of [400, 404, 429, 503]) {
  test(`HTTP ${status} is preserved without fallback`, async () => {
    await withMock(null, async calls => {
      const result = await renderPublicPage(new Request('https://coffeepeek.by/api/public-page?page=address&kind=users&segment=petr&path=/users/petr'));
      assert.equal(result.status, status);
      assert.equal(result.retryAfter, '30');
      assert.equal(calls.length, 1);
      assert.match(calls[0], /by-slug\/petr$/);
    }, status);
  });
}
test('canonical user renders the user envelope without internal IDs', async () => {
  const userAddress = { ...address, canonicalPath: '/users/petr', slug: 'petr' };
  await withMock({ data: { userName: 'Petr', checkInCount: 12 }, address: userAddress }, async () => {
    const result = await renderPublicPage(new Request('https://coffeepeek.by/api/public-page?page=address&kind=users&segment=petr&path=/users/petr'));
    assert.equal(result.status, 200);
    assert.match(result.html, /Petr/);
    assert.match(result.html, /Чекинов: 12/);
  });
});
test('replacement patterns in names remain literal', async () => {
  await withMock({ isSuccess: true, data: { ...shop, name: "Кофе $` $' $&" } }, async () => {
    const result = await renderPublicPage(new Request('https://coffeepeek.by/api/public-page?page=shop&shopId=1801'));
    assert.match(result.html, /Кофе \$` \$&#39; \$&amp;/);
    assert.equal(result.html.match(/<head>/g)?.length, 1);
    assert.equal(result.html.match(/<body>/g)?.length, 1);
  });
});
