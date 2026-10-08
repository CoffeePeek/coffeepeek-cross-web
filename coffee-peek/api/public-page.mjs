const SITE_URL = 'https://coffeepeek.by';
const DEFAULT_API_URL = 'https://api.coffeepeek.by';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const stripTrailingSlash = (value) => value.replace(/\/$/, '');

function apiUrl(path) {
  const configured = process.env.PUBLIC_API_URL || process.env.VITE_API_URL || DEFAULT_API_URL;
  return `${stripTrailingSlash(configured)}${path}`;
}

async function fetchJson(path, direct = false) {
  try {
    const response = await fetch(apiUrl(path), {
      headers: { Accept: 'application/json' }, cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ok: false, status: response.status, body: null, retryAfter: response.headers.get('Retry-After') };
    const body = await response.json();
    return { ok: direct || body?.isSuccess === true, status: response.status, body };
  } catch {
    return { ok: false, status: 503, body: null };
  }
}

async function loadSpaShell(request) {
  const requestUrl = new URL(request.url);
  const shellUrl = new URL('/index.html', requestUrl.origin);
  const response = await fetch(shellUrl, { headers: { Accept: 'text/html' } });
  if (!response.ok) throw new Error(`SPA shell returned ${response.status}`);
  return response.text();
}

function replaceMeta(html, { title, description, canonical, type = 'website', image }) {
  const tags = [
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="CoffeePeek">`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}">` : '',
  ].filter(Boolean).join('\n    ');

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(title)}</title>`)
    .replace('</head>', () => `    ${tags}\n</head>`);
}

function serverContent(content) {
  return `<div id="server-rendered-content" style="min-height:100vh;background:#1A1412;color:#fff;font-family:'Manrope',sans-serif">
    <header style="border-bottom:1px solid #3D2F28;padding:16px clamp(20px,5vw,64px)"><a href="/" style="color:#fff;text-decoration:none;font-size:20px;font-weight:700">Coffee<span style="color:#EAB308">Peek</span></a></header>
    ${content}
  </div>
  <script>document.getElementById('server-rendered-content')?.remove()</script>`;
}

function injectContent(html, content) {
  // Функции-замены: `$&` / `$'` / "$`" в названиях кофеен иначе раскрываются в куски шаблона.
  return html.replace('<body>', () => `<body>\n${serverContent(content)}`);
}

function pageLayout(title, intro, body) {
  return `<main style="max-width:1120px;margin:0 auto;padding:48px 20px 72px">
    <h1 style="font-family:'Manrope',sans-serif;font-size:clamp(32px,5vw,52px);margin:0 0 12px">${escapeHtml(title)}</h1>
    <p style="color:#A39E93;font-size:18px;line-height:1.6;margin:0 0 32px">${escapeHtml(intro)}</p>
    ${body}
  </main>`;
}

function renderHome() {
  return pageLayout(
    'Кофейни Беларуси',
    'CoffeePeek помогает находить интересные кофейни, изучать меню и выбирать место для следующей чашки кофе.',
    '<p><a href="/shops" style="display:inline-block;background:#EAB308;color:#1A1412;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700">Смотреть кофейни</a></p>',
  );
}

function renderShopCards(shops) {
  return `<ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;padding:0;list-style:none">${shops.map((shop) => {
    const address = shop.location?.address || 'Адрес уточняется';
    const photo = shop.photos?.[0]?.urls?.card || shop.photos?.[0]?.fullUrl;
    return `<li style="border:1px solid #3D2F28;border-radius:16px;overflow:hidden;background:#2D241F">
      ${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(shop.name)}" width="640" height="360" style="display:block;width:100%;height:180px;object-fit:cover">` : ''}
      <div style="padding:18px"><h2 style="font-size:20px;margin:0 0 8px">${shop.canonicalPath ? `<a href="${escapeHtml(shop.canonicalPath)}" style="color:#fff">${escapeHtml(shop.name)}</a>` : escapeHtml(shop.name)}</h2>
      <p style="color:#A39E93;margin:0 0 8px">${escapeHtml(address)}</p>
      <p style="margin:0">${shop.checkInCount ? `${escapeHtml(shop.rating)} ★ · ${escapeHtml(shop.checkInCount)} чекинов` : 'Пока без чекинов'}</p></div>
    </li>`;
  }).join('')}</ul>`;
}

function renderShopDetails(shop) {
  const address = shop.location?.address || 'Адрес уточняется';
  const coordinates = shop.location?.latitude != null && shop.location?.longitude != null
    ? `<a href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(shop.location.latitude)}&mlon=${encodeURIComponent(shop.location.longitude)}" style="color:#EAB308">Открыть на карте</a>`
    : '';
  const menuItems = (shop.menu?.items || []).filter((item) => item.availability !== 'Absent').slice(0, 12);
  const menu = menuItems.length
    ? `<section><h2>Меню</h2><ul>${menuItems.map((item) => `<li>${escapeHtml(item.nameRu || item.nameEn || item.slug)}${item.price != null ? ` — ${escapeHtml(item.price)} ${escapeHtml(item.currency || shop.menu.currency || 'BYN')}` : ''}</li>`).join('')}</ul></section>`
    : '';
  return pageLayout(
    shop.name,
    shop.description || `${shop.name} — кофейня на CoffeePeek. Адрес: ${address}.`,
    `<article>
      <p><strong>Адрес:</strong> ${escapeHtml(address)}</p>
      ${shop.checkInCount ? `<p><strong>Рейтинг:</strong> ${escapeHtml(shop.rating)} из 5 · ${escapeHtml(shop.checkInCount)} чекинов</p>` : '<p>Пока без чекинов</p>'}
      ${coordinates ? `<p>${coordinates}</p>` : ''}
      ${menu}
    </article>`,
  );
}

function renderNotFound() {
  return pageLayout('Кофейня не найдена', 'Возможно, кофейня была удалена или ссылка указана неверно.', '<p><a href="/shops" style="color:#EAB308">Вернуться в каталог</a></p>');
}

function renderUnavailable() {
  return pageLayout('Страница временно недоступна', 'Не удалось загрузить данные CoffeePeek. Попробуйте ещё раз позже.', '<p><a href="/shops" style="color:#EAB308">Обновить каталог</a></p>');
}

function jsonLd(value) {
  return `<script type="application/ld+json">${JSON.stringify(value).replaceAll('<', '\\u003c')}</script>`;
}

export async function renderPublicPage(request) {
  const url = new URL(request.url);
  const page = url.searchParams.get('page') || 'home';
  const shell = await loadSpaShell(request);

  if (page === 'home') {
    const title = 'CoffeePeek — кофейни Беларуси';
    const description = 'Находите кофейни Беларуси, изучайте меню и чекины, выбирайте место для следующей чашки кофе.';
    let html = replaceMeta(shell, { title, description, canonical: `${SITE_URL}/` });
    html = injectContent(html, `${renderHome()}${jsonLd({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'CoffeePeek', url: `${SITE_URL}/` })}`);
    return { html, status: 200 };
  }

  if (page === 'shops') {
    const result = await fetchJson('/api/CoffeeShops?page=1&pageSize=48');
    if (!result.ok) {
      const html = injectContent(replaceMeta(shell, { title: 'CoffeePeek временно недоступен', description: 'Каталог кофеен временно недоступен.', canonical: `${SITE_URL}/shops` }), renderUnavailable());
      return { html, status: 503 };
    }
    const shops = result.body?.data?.coffeeShops || [];
    shops.forEach(shop => { shop.canonicalPath = shop.address?.canonicalPath; });
    const title = 'Кофейни Беларуси — CoffeePeek';
    const description = `Каталог кофеен CoffeePeek: ${shops.length} заведений с адресами, рейтингами, меню и фотографиями.`;
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: shops.map((shop, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: shop.canonicalPath ? `${SITE_URL}${shop.canonicalPath}` : undefined,
        name: shop.name,
      })),
    };
    let html = replaceMeta(shell, { title, description, canonical: `${SITE_URL}/shops` });
    html = injectContent(
      html,
      `${pageLayout('Кофейни', 'Каталог кофеен с адресами, рейтингами и меню.', renderShopCards(shops))}${jsonLd(structuredData)}`,
    );
    return { html, status: 200 };
  }

  const prefixes = { shops: '/api/CoffeeShops', roasters: '/api/Roasters', users: '/api/Users' };
  const kind = page === 'shop' ? 'shops' : url.searchParams.get('kind');
  const segment = page === 'shop' ? url.searchParams.get('shopId') || '' : url.searchParams.get('segment') || '';
  if (!prefixes[kind]) return { html: '', status: 400 };
  const path = url.searchParams.get('path') || `/coffee-shops/${encodeURIComponent(segment)}`;
  const result = await fetchJson(`${prefixes[kind]}/by-slug/${encodeURIComponent(segment)}`, kind === 'users');
  const data = result.body?.data;
  const address = kind === 'users' ? result.body?.address : data?.address;
  if (!result.ok || !data || !address) {
    const status = result.ok ? 503 : result.status;
    const content = status === 404 ? renderNotFound() : renderUnavailable();
    return { html: injectContent(replaceMeta(shell, { title: 'CoffeePeek', description: 'Публичная страница CoffeePeek', canonical: `${SITE_URL}${path}` }), content), status, retryAfter: result.retryAfter };
  }
  if (path !== address.canonicalPath) return { html: '', status: 301, location: address.canonicalPath };
  const title = data.name || data.userName || 'CoffeePeek';
  const description = data.description || data.about || title;
  const canonical = `${SITE_URL}${address.canonicalPath}`;
  let html = replaceMeta(shell, { title: `${title} — CoffeePeek`, description, canonical,
    type: kind === 'shops' ? 'business.business' : 'website',
    image: data.photos?.[0]?.urls?.detail || data.photos?.[0]?.fullUrl,
  });
  const content = kind === 'shops' ? renderShopDetails(data) : pageLayout(title, description,
    kind === 'users' ? `<p>Чекинов: ${escapeHtml(data.checkInCount)}</p>` : '');
  const structured = kind === 'shops' ? jsonLd({ '@context': 'https://schema.org', '@type': 'CafeOrCoffeeShop', name: data.name, description, url: canonical,
    address: { '@type': 'PostalAddress', streetAddress: data.location?.address, addressCountry: 'BY' },
    geo: data.location?.latitude != null ? { '@type': 'GeoCoordinates', latitude: data.location.latitude, longitude: data.location.longitude } : undefined,
    aggregateRating: data.checkInCount ? { '@type': 'AggregateRating', ratingValue: data.rating, ratingCount: data.checkInCount } : undefined,
  }) : '';
  html = injectContent(html, content + structured);
  return { html, status: 200 };
}

export default {
  async fetch(request) {
    try {
      const { html, status, location, retryAfter } = await renderPublicPage(request);
      return new Response(html, {
        status,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          ...(location ? { Location: location } : {}),
          ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      return new Response('Public page is temporarily unavailable', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
  },
};
