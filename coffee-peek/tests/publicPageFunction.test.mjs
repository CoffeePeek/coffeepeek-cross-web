import assert from 'node:assert/strict';
import test from 'node:test';
import handler, { renderHomePage, renderPublicPage } from '../api/public-page.mjs';
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
    if (url.endsWith('/spa-shell.html')) return new Response(shell);
    calls.push(url);
    assert.doesNotMatch(url, /public-address/);
    return new Response(JSON.stringify(body), { status, headers: { 'Retry-After': '30' } });
  };
  try { await run(calls); } finally { globalThis.fetch = original; }
}
test('home HTML contains useful metadata and crawlable navigation without JavaScript or the API', () => {
  const html = renderHomePage(shell);
  const head = html.split('</head>')[0];
  assert.match(head, /<title>CoffeePeek — кофейни Минска, карта и отзывы<\/title>/);
  assert.match(head, /name="description" content="Кофейни Минска на карте: адреса, часы работы/);
  assert.match(head, /property="og:image" content="https:\/\/coffeepeek.by\/favicon\/android-chrome-512x512.png"/);
  assert.match(head, /name="twitter:card" content="summary_large_image"/);
  assert.match(head, /"@type":"WebSite"/);
  assert.match(html, /<div id="root"><div id="server-rendered-content"/);
  for (const path of ['/shops', '/map', '/coffees', '/roasters', '/feed']) assert.ok(html.includes(`href="${path}"`));
  assert.doesNotMatch(html, /\.remove\(\)/);
});
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
    assert.match(result.html.split('</head>')[0], /"@type":"CafeOrCoffeeShop"/);
    assert.equal(calls.length, 1);
  });
});
test('an empty shop description still shares its address and rating', async () => {
  await withMock({ isSuccess: true, data: { ...shop, description: '  ' } }, async () => {
    const { html } = await renderPublicPage(new Request('https://coffeepeek.by/api/public-page?page=shop&shopId=1801'));
    assert.match(html, /property="og:description" content="Кофейня «1801 кофе». Адрес: пр. Независимости 95. Оценка посетителей: 4,9 из 5./);
    assert.match(html, /name="twitter:description" content="Кофейня «1801 кофе»/);
  });
});
test('sharing uses the primary photo card variant even if other photos precede it', async () => {
  const photos = [
    { fullUrl: 'https://media.example/other.jpg', sortIndex: 0 },
    { isPrimary: true, fullUrl: 'https://media.example/original.jpg', urls: { card: 'https://media.example/card.jpg', detail: 'https://media.example/detail.jpg' } },
  ];
  await withMock({ isSuccess: true, data: { ...shop, photos } }, async () => {
    const { html } = await renderPublicPage(new Request('https://coffeepeek.by/api/public-page?page=shop&shopId=1801'));
    assert.match(html, /property="og:image" content="https:\/\/media.example\/card.jpg"/);
    assert.match(html, /name="twitter:image" content="https:\/\/media.example\/card.jpg"/);
    assert.match(html, /"image":"https:\/\/media.example\/card.jpg"/);
  });
});
test('a photo without a usable URL does not hide a later valid photo', async () => {
  await withMock({ isSuccess: true, data: { ...shop, photos: [{ fullUrl: null }, ...shop.photos] } }, async () => {
    const { html } = await renderPublicPage(new Request('https://coffeepeek.by/api/public-page?page=shop&shopId=1801'));
    assert.match(html, /property="og:image" content="https:\/\/media.example\/shop.jpg"/);
  });
});
test('shops without photos get an absolute public fallback image and no invented rating', async () => {
  await withMock({ isSuccess: true, data: { ...shop, description: '', photos: [], rating: 0, checkInCount: 0 } }, async () => {
    const { html } = await renderPublicPage(new Request('https://coffeepeek.by/api/public-page?page=shop&shopId=1801'));
    assert.match(html, /property="og:image" content="https:\/\/coffeepeek.by\/favicon\/android-chrome-512x512.png"/);
    assert.match(html, /property="og:image:width" content="512"/);
    assert.doesNotMatch(html, /Оценка посетителей|AggregateRating/);
  });
});
test('shell defaults are replaced rather than competing with shop metadata', async () => {
  const original = globalThis.fetch;
  const defaults = shell.replace('</head>', '<meta name="description" content="Default"><meta property="og:image" content="https://example.com/default.png"><meta name="twitter:card" content="summary"><link rel="canonical" href="https://example.com/"></head>');
  globalThis.fetch = async input => String(input).endsWith('/spa-shell.html')
    ? new Response(defaults) : Response.json({ isSuccess: true, data: shop });
  try {
    const { html } = await renderPublicPage(new Request('https://coffeepeek.by/api/public-page?page=shop&shopId=1801'));
    for (const tag of ['name="description"', 'property="og:image"', 'name="twitter:card"', 'rel="canonical"']) {
      assert.equal(html.split(tag).length - 1, 1, tag);
    }
    assert.doesNotMatch(html, /example.com\/default|content="Default"/);
  } finally { globalThis.fetch = original; }
});
for (const kind of ['shops', 'roasters', 'users']) {
  test(`${kind}: response shape supplies canonical path and alias redirect`, async () => {
    const metadata = { ...address, isAlias: true };
    const entity = { name: 'Coffee', userName: 'Petr', address: metadata };
    const body = kind === 'users' ? { data: { userName: 'Petr' }, address: metadata }
      : { isSuccess: true, data: entity };
    await withMock(body, async calls => {
      const response = await handler.fetch(new Request(`https://coffeepeek.by/api/public-page?page=address&kind=${kind}&segment=old&path=/old`));
      assert.equal(response.status, 301);
      assert.equal(response.headers.get('Location'), address.canonicalPath);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal(calls.length, 1);
    });
  });
}
for (const kind of ['cities', 'zones']) {
  test(`${kind}: removed public page does not fetch a catalog entity`, async () => {
    await withMock(null, async calls => {
      const result = await renderPublicPage(new Request(`https://coffeepeek.by/api/public-page?page=address&kind=${kind}&segment=old`));
      assert.equal(result.status, 400);
      assert.equal(calls.length, 0);
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

test('unknown routes return readable 404 HTML and noindex without querying the API', async () => {
  await withMock(null, async calls => {
    const response = await handler.fetch(new Request('https://coffeepeek.by/api/public-page?page=not-found&path=/missing'));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
    assert.match(await response.text(), /Страница не найдена/);
    assert.equal(calls.length, 0);
  });
});

test('legacy shop URLs redirect to their canonical coffee-shop URLs', async () => {
  await withMock({ isSuccess: true, data: shop }, async () => {
    const response = await handler.fetch(new Request('https://coffeepeek.by/api/public-page?page=shop&shopId=1801&path=/shops/1801'));
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('Location'), '/coffee-shops/1801');
  });
});

test('coffee pages resolve the public API and include metadata before JavaScript', async () => {
  const coffee = { name: 'Blend', description: 'Шоколад и орехи', address: { ...address, canonicalPath: '/coffees/blend' }, roaster: { name: 'Roast' } };
  await withMock({ isSuccess: true, data: coffee }, async calls => {
    const response = await handler.fetch(new Request('https://coffeepeek.by/api/public-page?page=address&kind=coffees&segment=blend&path=/coffees/blend'));
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<link rel="canonical" href="https:\/\/coffeepeek.by\/coffees\/blend">/);
    assert.match(calls[0], /\/api\/v1\/coffees\/blend$/);
  });
});

test('missing coffee pages preserve HTTP 404', async () => {
  await withMock(null, async () => {
    const response = await handler.fetch(new Request('https://coffeepeek.by/api/public-page?page=address&kind=coffees&segment=missing&path=/coffees/missing'));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
  }, 404);
});
