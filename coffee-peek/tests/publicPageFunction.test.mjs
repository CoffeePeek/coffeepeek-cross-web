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
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/spa-shell.html')) return new Response(shell);
    calls.push({ url, init });
    assert.doesNotMatch(url, /public-address/);
    return typeof body === 'function'
      ? body(new URL(url), init)
      : new Response(JSON.stringify(body), { status, headers: { 'Retry-After': '30' } });
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
  for (const path of ['/shops', '/map', '/coffees', '/roasters', '/feed', '/cities/minsk']) assert.ok(html.includes(`href="${path}"`));
  assert.doesNotMatch(html, /\.remove\(\)/);
});
test('catalog uses inline addresses for links and SEO, in one request', async () => {
  const card = { address, name: shop.name, addressLine: shop.location.address, rating: shop.rating, checkInCount: shop.checkInCount,
    coverPhoto: { fullUrl: '/original.jpg', urls: { card: '/card.jpg' } } };
  await withMock({ isSuccess: true, data: { items: [card], totalPages: 1 } }, async calls => {
    const result = await renderPublicPage(new Request('https://coffeepeek.by/api/public-page?page=shops'));
    assert.equal(result.status, 200);
    assert.match(result.html, /href="\/coffee-shops\/1801"/);
    assert.match(result.html, /1801 кофе/);
    assert.match(result.html, /ItemList/);
    assert.match(result.html, /пр\. Независимости 95/);
    assert.match(result.html, /src="\/card\.jpg"/);
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0].url).pathname, '/api/v1/coffee-shops/search');
    assert.equal(calls[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].init.body), { filters: { city: 'minsk' }, page: 1, pageSize: 20 });
  });
});

for (const [kind, section] of [['shops', 'coffee-shops'], ['coffees', 'coffees']]) {
  test(`${kind}: later catalog pages expose canonical links and crawlable pagination`, async () => {
    await withMock({ isSuccess: true, data: { items: [{
      address: { canonicalPath: `/${section}/sample` }, name: 'Кофе <Sample>',
      roaster: { name: 'Обжарщик' },
    }], totalPages: 3 } }, async calls => {
      const request = new Request(`https://coffeepeek.by/api/public-page?view=catalog&kind=${kind}&page=2`);
      const response = await handler.fetch(request);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.match(html, new RegExp(`rel="canonical" href="https://coffeepeek.by/${kind}\\?page=2"`));
      assert.match(html, new RegExp(`href="/${kind}\\?page=3"`));
      assert.match(html, new RegExp(`href="/${kind}"[^>]*>Назад`));
      assert.match(html, new RegExp(`href="/${section}/sample"`));
      assert.match(html, /Кофе &lt;Sample&gt;/);
      assert.match(html, /name="robots" content="index, follow"/);
      assert.equal(JSON.parse(calls[0].init.body).page, 2);

      const filtered = await handler.fetch(new Request(`https://coffeepeek.by/api/public-page?view=catalog&kind=${kind}&q=coffee`));
      assert.match(await filtered.text(), /name="robots" content="noindex, follow"/);
      for (const page of ['0', '-1', 'NaN', '4']) {
        const missing = await handler.fetch(new Request(`https://coffeepeek.by/api/public-page?view=catalog&kind=${kind}&page=${page}`));
        assert.equal(missing.status, 404);
      }
    });
  });
}

test('roasters catalog links every public profile without linking entries that have no public address', async () => {
  await withMock({ isSuccess: true, data: [
    { name: 'Roast', address: { canonicalPath: '/roasters/roast' } },
    { name: 'Private', address: { canonicalPath: null } },
  ] }, async calls => {
    const result = await renderPublicPage(new Request('https://coffeepeek.by/api/public-page?view=catalog&kind=roasters'));
    assert.equal(result.status, 200);
    assert.match(result.html, /href="\/roasters\/roast"/);
    assert.match(result.html, /rel="canonical" href="https:\/\/coffeepeek.by\/roasters"/);
    assert.doesNotMatch(result.html, /Private/);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/api\/Roasters$/);
  });
});

test('catalog outages stay 503 with a retry hint and do not become empty successful pages', async () => {
  await withMock(null, async () => {
    const response = await handler.fetch(new Request('https://coffeepeek.by/api/public-page?view=catalog&kind=coffees'));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(await response.text(), /Страница временно недоступна/);
  }, 500);
});
test('Minsk serves city-filtered HTML, crawlable pagination and a safe client snapshot', async () => {
  const name = 'Кофе </script>';
  await withMock({ isSuccess: true, data: { items: [{ ...shop, name }], totalPages: 2 } }, async calls => {
    const base = 'https://coffeepeek.by/api/public-page?page=minsk';
    const first = await renderPublicPage(new Request(base));
    assert.equal(first.status, 200);
    assert.match(first.html, /<h1[^>]*>Кофейни Минска<\/h1>/);
    assert.match(first.html, /rel="canonical" href="https:\/\/coffeepeek.by\/cities\/minsk"/);
    assert.match(first.html, /href="\/cities\/minsk\?p=2"/);
    assert.match(first.html, /href="\/cities\/minsk\/specialty"/);
    assert.match(first.html, /href="\/cities\/minsk\/laptop-friendly"/);
    assert.match(first.html, /href="\/coffee-shops\/1801"/);
    assert.match(first.html, /пр\. Независимости 95/);
    assert.doesNotMatch(first.html, /server-rendered-content'\)\?\.remove/);
    const snapshot = first.html.match(/id="minsk-catalog-data" type="application\/json">(.*?)<\/script>/)?.[1];
    assert.equal(JSON.parse(snapshot).shops[0].name, name);

    const second = await renderPublicPage(new Request(base + '&p=2'));
    assert.equal(second.status, 200);
    assert.match(second.html, /rel="canonical" href="https:\/\/coffeepeek.by\/cities\/minsk\?p=2"/);
    assert.match(second.html, /href="\/cities\/minsk"[^>]*>Назад/);
    assert.equal((await renderPublicPage(new Request(base + '&p=3'))).status, 404);
    assert.equal((await renderPublicPage(new Request(base + '&p=0'))).status, 404);
    assert.deepEqual(calls.map(call => JSON.parse(call.init.body)), [
      { filters: { city: 'minsk' }, sort: 'name_asc', page: 1, pageSize: 24 },
      { filters: { city: 'minsk' }, sort: 'name_asc', page: 2, pageSize: 24 },
      { filters: { city: 'minsk' }, sort: 'name_asc', page: 3, pageSize: 24 },
    ]);
  });
});
test('specialty collection uses the public search and renders verified shop details', async () => {
  const slug = '26-ulyanovskaya-ulitsa-30';
  const address = { slug, canonicalPath: `/coffee-shops/${slug}` };
  const specialty = { ...shop, address, name: '26', city: { slug: 'minsk' },
    brewMethods: [{ name: 'Hario V60' }], roasters: [{ name: 'River Roasters' }],
  };
  await withMock((url, options) => {
    if (url.pathname.endsWith(`/by-slug/${slug}`)) {
      return Response.json({ isSuccess: true, data: specialty });
    }
    assert.equal(url.pathname, '/api/v1/coffee-shops/search');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body).filters, { city: 'minsk', type: 'specialty' });
    return Response.json({ isSuccess: true, data: { items: [{ ...specialty, addressLine: 'Ульяновская улица, 30' }], totalPages: 2 } });
  }, async calls => {
    const response = await handler.fetch(new Request('https://coffeepeek.by/api/public-page?page=minsk-topic&topic=specialty&p=2'));
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /rel="canonical" href="https:\/\/coffeepeek.by\/cities\/minsk\/specialty\?p=2"/);
    assert.match(html, /Спешелти-кофейни Минска/);
    assert.match(html, /Ульяновская улица, 30/);
    assert.match(html, /Способы заваривания: Hario V60/);
    assert.match(html, /Обжарщики: River Roasters/);
    assert.match(html, /Капучино — 7 BYN/);
    assert.match(html, /href="\/cities\/minsk\/specialty"[^>]*>Назад/);
    assert.equal(calls.length, 2);
  });
});
test('laptop collection limits notes to sourced branch details', async () => {
  const slug = 'prostranstvo-ul-belgradskaya-4';
  await withMock((url, options) => {
    assert.equal(url.pathname, '/api/v1/coffee-shops/search');
    assert.deepEqual(JSON.parse(options.body).filters, { city: 'minsk', tags: ['laptop-friendly'] });
    return Response.json({ isSuccess: true, data: { items: [
      { ...shop, address: { slug, canonicalPath: `/coffee-shops/${slug}` }, name: 'Пространство' },
      shop,
    ], totalPages: 1 } });
  }, async calls => {
    const base = 'https://coffeepeek.by/api/public-page?page=minsk-topic&topic=';
    const response = await handler.fetch(new Request(base + 'laptop-friendly'));
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /href="https:\/\/yandex.by\/maps\/org\/prostranstvo\/164667538425\//);
    const snapshot = JSON.parse(html.match(/id="minsk-catalog-data" type="application\/json">(.*?)<\/script>/)[1]);
    assert.match(snapshot.shops[0].details.join(' '), /Wi[‑-]Fi/i);
    assert.equal(snapshot.shops[1].details, undefined);
    assert.equal((await handler.fetch(new Request(base + 'unknown'))).status, 404);
    assert.equal(calls.length, 1);
  });
});
test('other city addresses continue redirecting to the existing catalog filter', async () => {
  await withMock(null, async calls => {
    const result = await handler.fetch(new Request('https://coffeepeek.by/api/public-page?page=city-redirect&slug=brest'));
    assert.equal(result.status, 308);
    assert.equal(result.headers.get('Location'), '/shops?citySlug=brest');
    assert.equal(calls.length, 0);
  });
});
test('shop details are directly in data; menu, photos and structured metadata render', async () => {
  const detail = { ...shop, description: '', city: { slug: 'minsk' }, type: 'Specialty',
    tags: [{ slug: 'laptop-friendly' }],
    menu: { ...shop.menu, items: [...shop.menu.items, { nameRu: 'Неподтверждённый напиток', availability: 'Unknown' }] },
    schedules: [
      { dayOfWeek: 'Monday', intervals: [{ openTime: '05:00:00', closeTime: '20:00:00' }] },
      { dayOfWeek: 'Tuesday', isClosed: true, intervals: [] },
    ],
  };
  await withMock({ isSuccess: true, data: detail }, async calls => {
    const result = await renderPublicPage(new Request('https://coffeepeek.by/api/public-page?page=shop&shopId=1801'));
    assert.equal(result.status, 200);
    assert.match(result.html, /Капучино — 7 BYN/);
    assert.doesNotMatch(result.html, /Неподтверждённый напиток/);
    assert.match(result.html, /property="og:image"/);
    assert.match(result.html, /CafeOrCoffeeShop/);
    assert.match(result.html, /<title>CoffeePeek \| 1801 кофе — Минск, пр\. Независимости 95<\/title>/);
    assert.match(result.html, /meta name="description" content="[^"]*Оценка посетителей: 4,9 из 5/);
    assert.match(result.html, /<h2>Часы работы<\/h2>/);
    assert.match(result.html, /<time datetime="08:00">08:00<\/time>–<time datetime="23:00">23:00<\/time>/);
    assert.match(result.html, /href="\/cities\/minsk\/specialty"/);
    assert.match(result.html, /href="\/cities\/minsk\/laptop-friendly"/);
    const schema = JSON.parse(result.html.match(/type="application\/ld\+json">(.*?)<\/script>/)[1]);
    assert.equal(schema.address.addressLocality, 'Минск');
    assert.equal(schema.address.addressCountry, 'BY');
    assert.equal(schema.aggregateRating, undefined);
    assert.deepEqual(schema.openingHoursSpecification, [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Monday', opens: '08:00', closes: '23:00' },
    ]);
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
      assert.match(calls[0].url, /by-slug\/petr$/);
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
    assert.match(calls[0].url, /\/api\/v1\/coffees\/blend$/);
  });
});

test('missing coffee pages preserve HTTP 404', async () => {
  await withMock(null, async () => {
    const response = await handler.fetch(new Request('https://coffeepeek.by/api/public-page?page=address&kind=coffees&segment=missing&path=/coffees/missing'));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
  }, 404);
});

const checkInId = '6966d36f-f903-ccf8-8009-1a651d0c58ad';
const checkInPhoto = `/api/v1/check-ins/${checkInId}/photos/3bc9f4c4-ac3d-4fb8-ad2f-409c8ec3f548`;
const shopCheckIn = {
  kind: 'Shop', home: null, id: checkInId, username: 'Maria', shopName: 'Memories',
  shop: { slug: 'memories', canonicalPath: '/coffee-shops/memories' },
  author: { slug: 'maria', canonicalPath: '/users/maria' },
  text: 'Пробовала тут воронку.\nПока мой фаворит', rating: { coffee: 5, service: 4, place: 5 },
  drinkNameRu: 'V60 / воронка', visibility: 'Public', moderationState: 'Approved',
  photos: [{ sortIndex: 0, url: checkInPhoto, variants: [
    { purpose: 'feed', format: 'jpeg', width: 720, height: 960, url: `${checkInPhoto}/variants/v/1/feed.jpeg` },
    { purpose: 'detail', format: 'webp', width: 1200, height: 1600, url: `${checkInPhoto}/variants/v/1/detail.webp` },
    { purpose: 'detail', format: 'jpeg', width: 1200, height: 1600, url: `${checkInPhoto}/variants/v/1/detail.jpeg` },
  ] }],
};
const checkInRequest = (id = checkInId) => new Request(`https://coffeepeek.by/api/public-page?page=check-in&id=${id}`);

test('shop check-in shares its text, absolute JPEG photo and links before JavaScript', async () => {
  await withMock({ isSuccess: true, data: shopCheckIn }, async calls => {
    const result = await renderPublicPage(checkInRequest());
    const head = result.html.split('</head>')[0];
    assert.equal(result.status, 200);
    assert.deepEqual(calls.map(call => call.url), [`https://api.coffeepeek.by/api/v1/check-ins/${checkInId}`]);
    assert.match(head, /<title>Maria в «Memories» — CoffeePeek<\/title>/);
    assert.match(head, /property="og:description" content="Пробовала тут воронку. Пока мой фаворит"/);
    assert.match(head, /property="og:type" content="article"/);
    assert.match(head, new RegExp(`<link rel="canonical" href="https://coffeepeek.by/check-ins/${checkInId}">`));
    assert.match(head, new RegExp(`property="og:image" content="https://api.coffeepeek.by${checkInPhoto}/variants/v/1/detail.jpeg"`));
    assert.match(head, /property="og:image:width" content="1200"/);
    assert.match(head, /property="og:image:height" content="1600"/);
    assert.match(result.html, /href="\/coffee-shops\/memories"/);
    assert.match(result.html, /href="\/users\/maria"/);
    assert.doesNotMatch(result.html, /href="\/download\//);
    assert.match(result.html, /href="\/feed" aria-label="Вернуться в ленту"/);
  });
});

test('home check-in without text or photos describes the brew and uses the fallback image', async () => {
  const home = { ...shopCheckIn, kind: 'Home', shop: null, shopName: '', text: '', rating: null, photos: [],
    username: 'Андрэй', drinkNameRu: 'капучино х2', home: { beanName: 'Перу Valle Sagrado', tasteScore: 5 } };
  await withMock({ isSuccess: true, data: home }, async () => {
    const { html, status } = await renderPublicPage(checkInRequest());
    assert.equal(status, 200);
    assert.match(html, /<title>Кофе дома — Андрэй — CoffeePeek<\/title>/);
    assert.match(html, /property="og:description" content="Кофе дома — Андрэй. Зерно: Перу Valle Sagrado. Напиток: капучино х2. Оценка: 5 из 5."/);
    assert.match(html, /property="og:image" content="https:\/\/coffeepeek.by\/favicon\/android-chrome-512x512.png"/);
    assert.doesNotMatch(html, /coffee-shops/);
  });
});

test('a check-in without its own photos falls back to the drink photo', async () => {
  await withMock({ isSuccess: true, data: { ...shopCheckIn, photos: [], drinkPhotoUrl: 'https://media.example/drink.jpg' } }, async () => {
    const { html } = await renderPublicPage(checkInRequest());
    assert.match(html, /property="og:image" content="https:\/\/media.example\/drink.jpg"/);
    assert.doesNotMatch(html, /og:image:width/);
  });
});

test('long check-in text is shortened for previews but kept whole on the page', async () => {
  const text = 'кофе '.repeat(80).trim();
  await withMock({ isSuccess: true, data: { ...shopCheckIn, text } }, async () => {
    const { html } = await renderPublicPage(checkInRequest());
    const description = html.match(/property="og:description" content="([^"]*)"/)[1];
    assert.equal(description.length, 200);
    assert.ok(description.endsWith('…'));
    assert.ok(html.includes(text));
  });
});

test('check-in text and names are escaped in metadata and content', async () => {
  await withMock({ isSuccess: true, data: { ...shopCheckIn, username: '"><b>', text: '<script>alert(1)</script>' } }, async () => {
    const { html } = await renderPublicPage(checkInRequest());
    assert.doesNotMatch(html, /<script>alert|"><b>/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  });
});

for (const status of [404, 429, 503]) {
  test(`check-in HTTP ${status} is preserved with a readable page`, async () => {
    await withMock(null, async () => {
      const response = await handler.fetch(checkInRequest());
      assert.equal(response.status, status);
      const html = await response.text();
      assert.match(html, status === 404 ? /Публикация недоступна/ : /Страница временно недоступна/);
      if (status === 404) assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
      else assert.equal(response.headers.get('Retry-After'), '30');
    }, status);
  });
}

test('malformed check-in IDs are 404 without querying the API', async () => {
  await withMock(null, async calls => {
    const result = await renderPublicPage(checkInRequest('..%2F..%2Fapi%2Fadmin'));
    assert.equal(result.status, 404);
    assert.equal(calls.length, 0);
  });
});
