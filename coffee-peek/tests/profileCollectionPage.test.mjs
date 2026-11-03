import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPublicPage } from '../api/public-page.mjs';

const id = '123456781234123412341234567890ab';
const shell = '<html><head><title>CoffeePeek</title></head><body><div id="root"></div></body></html>';
const request = new Request('https://coffeepeek.by/api/public-page?page=address&kind=users&segment=author&path=/users/author');
const featured = { id, mode: 'list', visibility: 'public', title: 'My <places>', description: 'A public list',
  canonicalPath: `/collections/${id}`, items: [] };

async function withProfileCollection(collection, callback) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/spa-shell.html')) return new Response(shell);
    calls.push({ url, init });
    if (url.endsWith('/api/Users/by-slug/author')) return new Response(JSON.stringify({
      data: { userName: 'Author', checkInCount: 3 }, address: { slug: 'author', canonicalPath: '/users/author' },
    }));
    if (url.endsWith('/api/v1/profiles/author/collection')) return new Response(JSON.stringify({ isSuccess: true, data: collection }));
    throw new Error('Unexpected profile read');
  };
  try { await callback(calls); } finally { globalThis.fetch = original; }
}

test('profile HTML includes only the explicitly featured public list and escapes metadata', async () => {
  await withProfileCollection(featured, async calls => {
    const { status, html } = await renderPublicPage(request);
    assert.equal(status, 200);
    assert.match(html, /href="\/collections\/123456781234123412341234567890ab"/);
    assert.match(html, /My &lt;places&gt;/);
    assert.match(html, /A public list/);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => !call.url.endsWith('/favorites') && !call.init.headers.Authorization));
  });
});

test('none, private and snapshot responses never fall back to global favorites', async () => {
  for (const value of [null, { ...featured, visibility: 'private' }, { ...featured, mode: 'snapshot' }]) {
    await withProfileCollection(value, async calls => {
      const { status, html } = await renderPublicPage(request);
      assert.equal(status, 200);
      assert.doesNotMatch(html, /My &lt;places&gt;|A public list|href="\/collections\//);
      assert.ok(calls.every(call => !call.url.endsWith('/favorites')));
    });
  }
});

test('profile HTML refuses an unexpected collection address or unsafe cover', async () => {
  await withProfileCollection({ ...featured, canonicalPath: '//other.invalid' }, async () => {
    const { html } = await renderPublicPage(request);
    assert.doesNotMatch(html, /other.invalid|My &lt;places&gt;/);
  });
  await withProfileCollection({ ...featured, coverPhoto: { fullUrl: 'javascript:bad()' } }, async () => {
    const { html } = await renderPublicPage(request);
    assert.match(html, /My &lt;places&gt;/);
    assert.doesNotMatch(html, /javascript:/);
  });
});
