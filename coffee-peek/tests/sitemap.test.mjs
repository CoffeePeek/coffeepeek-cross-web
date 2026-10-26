import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/sitemap.mjs';

const item = canonicalPath => ({ address: { canonicalPath } });
const publicFetch = async (input, init) => {
  const url = new URL(input);
  assert.equal(url.origin, 'https://api.coffeepeek.by');
  assert.equal(init.headers.Authorization, undefined);
  if (url.pathname === '/api/v1/coffee-shops/search' || url.pathname === '/api/v1/coffees/search') {
    assert.equal(init.method, 'POST');
    const body = JSON.parse(init.body);
    assert.deepEqual(body, { q: '', filters: {}, sort: 'name_asc', page: body.page, pageSize: 100 });
    const path = url.pathname.includes('coffee-shops') ? `/coffee-shops/shop-${body.page}` : `/coffees/coffee-${body.page}`;
    return Response.json({ isSuccess: true, data: { totalPages: 2, items: [item(path)] } });
  }
  assert.equal(url.pathname, '/api/Roasters');
  return Response.json({ isSuccess: true, data: [item('/roasters/roast&coffee'), item('/roasters/roast&coffee'), item(null)] });
};

async function withFetch(mock, run) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { await run(); } finally { globalThis.fetch = original; }
}

test('sitemap includes every catalog page, unique canonical URLs and escaped XML', async () => {
  const calls = [];
  await withFetch(async (...args) => { calls.push(args); return publicFetch(...args); }, async () => {
    const response = await handler.fetch();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'application/xml; charset=utf-8');
    assert.match(response.headers.get('Cache-Control'), /s-maxage=300/);
    const xml = await response.text();
    assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
    for (const path of ['/', '/shops', '/coffees', '/roasters', '/coffee-shops/shop-1', '/coffee-shops/shop-2', '/coffees/coffee-1', '/coffees/coffee-2']) {
      assert.ok(xml.includes(`<loc>https://coffeepeek.by${path}</loc>`), path);
    }
    assert.equal(xml.match(/roast&amp;coffee/g)?.length, 1);
    assert.doesNotMatch(xml, /\/login|\/settings|\/api\/|\/users\/|undefined|null/);
    assert.equal(calls.length, 5);
  });
});

test('an API failure returns an uncached 503 instead of a partial sitemap', async () => {
  await withFetch(async (input, init) => String(input).includes('/coffees/search') ? new Response(null, { status: 503 }) : publicFetch(input, init), async () => {
    const response = await handler.fetch();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.doesNotMatch(await response.text(), /<urlset/);
  });
});

for (const totalPages of [undefined, -1, 501, '2']) {
  test(`invalid pagination (${totalPages}) does not publish an incomplete sitemap`, async () => {
    await withFetch(async () => Response.json({ isSuccess: true, data: { totalPages, items: [] } }), async () => {
      assert.equal((await handler.fetch()).status, 503);
    });
  });
}

for (const canonicalPath of [undefined, 'https://other.example/coffee-shops/shop', '/login', '/coffee-shops/../login', '/coffee-shops/shop?private=true', '/coffee-shops/..']) {
  test(`invalid public address (${canonicalPath}) is not included`, async () => {
    await withFetch(async () => Response.json({ isSuccess: true, data: { totalPages: 1, items: [item(canonicalPath)] } }), async () => {
      assert.equal((await handler.fetch()).status, 503);
    });
  });
}

test('empty public catalogs still produce the public section URLs', async () => {
  await withFetch(async input => Response.json({ isSuccess: true, data: String(input).endsWith('/api/Roasters') ? [] : { totalPages: 0, items: [] } }), async () => {
    const response = await handler.fetch();
    assert.equal(response.status, 200);
    assert.equal((await response.text()).match(/<loc>/g)?.length, 9);
  });
});
