import assert from 'node:assert/strict';
import test from 'node:test';
import handler, { renderPublicPage } from '../api/public-page.mjs';

const id = '123456781234123412341234567890ab';
const shell = '<html><head><title>CoffeePeek</title></head><body><div id="root"></div></body></html>';
const collection = { id, title: 'Мой кофейный Минск', canonicalPath: `/collections/${id}`, items: [
  { kind: 'coffee_shop', name: 'Любимая кофейня', address: { slug: 'place' }, cityName: 'Минск', streetAddress: 'Кофейная, 1', coverPhoto: { urls: { card: 'https://media.example/card.jpg' } } },
  { kind: 'roaster', name: 'Любимый обжарщик', address: { slug: 'roaster' } },
] };

async function mockRead(data, callback, status = 200) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/spa-shell.html')) return new Response(shell);
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ isSuccess: true, data }), { status });
  };
  try { await callback(calls); } finally { globalThis.fetch = original; }
}
const request = value => new Request(`https://coffeepeek.by/api/public-page?page=collection&id=${encodeURIComponent(value ?? id)}`);

test('anonymous collection page includes names, addresses and rich previews before JavaScript', async () => {
  await mockRead(collection, async calls => {
    const result = await renderPublicPage(request());
    assert.equal(result.status, 200);
    assert.match(result.html, /Мой кофейный Минск — CoffeePeek/);
    assert.match(result.html, /property="og:image" content="https:\/\/media.example\/card.jpg"/);
    assert.match(result.html, /href="\/coffee-shops\/place"/);
    assert.match(result.html, /href="\/roasters\/roaster"/);
    assert.match(result.html, /Минск · Кофейная, 1/);
    assert.match(result.html, /name="robots" content="noindex, nofollow"/);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith(`/api/v1/favorite-collections/${id}`));
    assert.equal(calls[0].init.headers.Authorization, undefined);
  });
});

test('revocation is read afresh and the HTTP response never caches the collection', async () => {
  await mockRead(null, async () => {
    const response = await handler.fetch(request());
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(await response.text(), /Ссылка могла быть отключена владельцем/);
  }, 404);
});

test('server-rendered collection groups all shops before roasters as well', async () => {
  await mockRead({ ...collection, items: [...collection.items].reverse() }, async () => {
    const { html } = await renderPublicPage(request());
    assert.ok(html.indexOf('href="/coffee-shops/place"') < html.indexOf('href="/roasters/roaster"'));
  });
});

test('malformed collection addresses do not reach the backend', async () => {
  await mockRead(null, async calls => {
    assert.equal((await renderPublicPage(request('../admin'))).status, 404);
    assert.equal(calls.length, 0);
  });
});

test('shared names are escaped and arbitrary navigation or image protocols are not emitted', async () => {
  const malicious = { ...collection, title: '<script>alert(1)</script>', items: [
    { ...collection.items[0], name: '"><script>bad()</script>', address: { slug: 'place', canonicalPath: 'javascript:bad()' }, coverPhoto: { fullUrl: 'javascript:bad()' } },
    { kind: 'roaster', name: 'Invisible', address: { slug: '../private' } },
  ] };
  await mockRead(malicious, async () => {
    const { html } = await renderPublicPage(request());
    assert.doesNotMatch(html, /<script>|javascript:|Invisible/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  });
});
