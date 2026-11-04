import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPublicPage } from '../api/public-page.mjs';

const bag = '11111111-1111-4111-8111-111111111111';
const photo = '22222222-2222-4222-8222-222222222222';
const shell = '<html><head><title>CoffeePeek</title></head><body><div id="root"></div></body></html>';
const request = new Request('https://coffeepeek.by/api/public-page?page=address&kind=users&segment=author&path=/users/author');
const shelf = { totalCount: 1, items: [{ id: bag, name: 'Coffee <one>', roasterName: 'Roaster & Co', coffeeSlug: 'bean',
  photoUrl: `/api/v1/profiles/author/shelf/bags/${bag}/photos/${photo}`, ownerId: 'private-owner', weightGrams: 250 }] };

async function withShelf(value, callback, { blocked = false, status = 200 } = {}) {
  const original = globalThis.fetch; const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/spa-shell.html')) return new Response(shell);
    calls.push({ url, init });
    if (url.endsWith('/api/Users/by-slug/author')) return new Response(JSON.stringify({ data: { userName: 'Author', isBlockedByViewer: blocked }, address: { slug: 'author', canonicalPath: '/users/author' } }));
    if (url.endsWith('/api/v1/profiles/author/collection')) return new Response(JSON.stringify({ isSuccess: true, data: null }));
    if (url.endsWith('/api/v1/profiles/author/shelf')) return new Response(JSON.stringify({ isSuccess: status === 200, data: value }), { status });
    throw new Error('Unexpected private read');
  };
  try { await callback(calls); } finally { globalThis.fetch = original; }
}

test('profile HTML renders opted-in public cards with escaped text and guarded photo paths only', async () => {
  await withShelf(shelf, async calls => {
    const { status, html } = await renderPublicPage(request);
    assert.equal(status, 200);
    assert.match(html, /Кофейная полка/);
    assert.match(html, /Coffee &lt;one&gt;/);
    assert.match(html, /Roaster &amp; Co/);
    assert.match(html, /href="\/coffees\/bean"/);
    assert.match(html, /api\.coffeepeek\.by\/api\/v1\/profiles\/author\/shelf\/bags\//);
    assert.doesNotMatch(html, /private-owner|weightGrams|\/api\/v1\/shelf\//);
    assert.ok(calls.every(call => call.init.cache === 'no-store' && !call.init.headers.Authorization));
  });
});

test('hidden, malformed and unavailable shelves leave no shelf section or cached card', async () => {
  for (const [value, status] of [[null, 200], [{ items: [], totalCount: 1 }, 200], [shelf, 503]]) {
    await withShelf(value, async () => {
      const result = await renderPublicPage(request);
      assert.equal(result.status, 200);
      assert.doesNotMatch(result.html, /Кофейная полка|Coffee &lt;one&gt;|private-owner/);
    }, { status });
  }
});

test('public HTML never uses private shelf, wrong bag, external or credential-bearing photo URLs', async () => {
  for (const photoUrl of ['/api/v1/shelf/bags/private/photos/photo', `https://evil.example/${photo}`,
    `${shelf.items[0].photoUrl}?token=private`, shelf.items[0].photoUrl.replace(bag, photo)]) {
    await withShelf({ ...shelf, items: [{ ...shelf.items[0], photoUrl }] }, async () => {
      const { html } = await renderPublicPage(request);
      assert.match(html, /Coffee &lt;one&gt;/);
      assert.doesNotMatch(html, /<img[^>]+shelf|evil\.example|token=private/);
    });
  }
});

test('blocked public profile never requests collection or shelf data', async () => {
  await withShelf(shelf, async calls => {
    const { html } = await renderPublicPage(request);
    assert.doesNotMatch(html, /Кофейная полка|Coffee &lt;one&gt;/);
    assert.equal(calls.length, 1);
  }, { blocked: true });
});
