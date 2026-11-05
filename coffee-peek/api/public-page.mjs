const SITE_URL = 'https://coffeepeek.by';
const DEFAULT_API_URL = 'https://api.coffeepeek.by';
const DEFAULT_IMAGE = `${SITE_URL}/favicon/android-chrome-512x512.png`;
const HOME_TITLE = 'CoffeePeek — кофейни Минска, карта и отзывы';
const HOME_DESCRIPTION = 'Кофейни Минска на карте: адреса, часы работы, меню, фотографии и оценки посетителей. Находите новые места, выбирайте кофе и делитесь впечатлениями в CoffeePeek.';

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

export async function fetchJson(path, { direct = false, body } = {}) {
  try {
    const response = await fetch(apiUrl(path), {
      method: body ? 'POST' : 'GET',
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ok: false, status: response.status, body: null, retryAfter: response.headers.get('Retry-After') };
    const envelope = await response.json();
    return { ok: direct || envelope?.isSuccess === true, status: response.status, body: envelope };
  } catch {
    return { ok: false, status: 503, body: null };
  }
}

async function loadSpaShell(request) {
  const requestUrl = new URL(request.url);
  const shellUrl = new URL('/spa-shell.html', requestUrl.origin);
  const response = await fetch(shellUrl, {
    headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`SPA shell returned ${response.status}`);
  return response.text();
}

function replaceMeta(html, { title, description, canonical, type = 'website', image = DEFAULT_IMAGE, imageWidth, imageHeight, structuredData }) {
  const tags = [
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="CoffeePeek">`,
    '<meta property="og:locale" content="ru_BY">',
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    `<meta property="og:image:alt" content="${escapeHtml(title)}">`,
    ...(image === DEFAULT_IMAGE ? [
      '<meta property="og:image:type" content="image/png">',
      '<meta property="og:image:width" content="512">',
      '<meta property="og:image:height" content="512">',
    ] : imageWidth && imageHeight ? [
      `<meta property="og:image:width" content="${escapeHtml(imageWidth)}">`,
      `<meta property="og:image:height" content="${escapeHtml(imageHeight)}">`,
    ] : []),
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    `<meta name="twitter:image:alt" content="${escapeHtml(title)}">`,
    structuredData ? jsonLd(structuredData) : '',
  ].filter(Boolean).join('\n    ');

  return html
    .replace(/<meta\b[^>]*(?:name|property)=["'](?:description|og:[^"']+|twitter:[^"']+)["'][^>]*>\s*/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(title)}</title>`)
    .replace('</head>', () => `    ${tags}\n</head>`);
}

function serverContent(content, showHeader) {
  return `<div id="server-rendered-content" style="min-height:100vh;background:#1A1412;color:#fff;font-family:'Manrope',sans-serif">
    ${showHeader ? '<header style="border-bottom:1px solid #3D2F28;padding:16px clamp(20px,5vw,64px)"><a href="/" style="color:#fff;text-decoration:none;font-size:20px;font-weight:700">Coffee<span style="color:#EAB308">Peek</span></a></header>' : ''}
    ${content}
  </div><div id="app-startup"><span class="wobble-ring" role="status" aria-label="Загрузка" style="width:48px;height:48px;border-width:3px;border-top-color:#EAB308;border-right-color:#EAB308"></span></div>`;
}

function injectContent(html, content, { showHeader = true } = {}) {
  // Функции-замены: `$&` / `$'` / "$`" в названиях кофеен иначе раскрываются в куски шаблона.
  // The shell shows a loader until React replaces these children; without JavaScript the content stays readable.
  return html.replace('<div id="root"></div>', () => `<div id="root">${serverContent(content, showHeader)}</div>`);
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
    'Кофейни Минска — CoffeePeek',
    HOME_DESCRIPTION,
    `<nav aria-label="Разделы CoffeePeek"><ul>
      <li><a href="/shops">Кофейни: адреса, часы работы и меню</a></li>
      <li><a href="/map">Карта кофеен Минска</a></li>
      <li><a href="/coffees">Каталог кофе</a></li>
      <li><a href="/roasters">Обжарщики</a></li>
      <li><a href="/feed">Чекины и впечатления посетителей</a></li>
    </ul></nav>`,
  );
}

function renderShopCards(shops) {
  return `<ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;padding:0;list-style:none">${shops.map((shop) => {
    const address = shop.addressLine || 'Адрес уточняется';
    const photo = shop.coverPhoto?.urls?.card || shop.coverPhoto?.fullUrl;
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
    shopDescription(shop),
    `<article>
      <p><strong>Адрес:</strong> ${escapeHtml(address)}</p>
      ${shop.checkInCount ? `<p><strong>Рейтинг:</strong> ${escapeHtml(shop.rating)} из 5 · ${escapeHtml(shop.checkInCount)} чекинов</p>` : '<p>Пока без чекинов</p>'}
      ${coordinates ? `<p>${coordinates}</p>` : ''}
      ${menu}
    </article>`,
  );
}

function renderNotFound() {
  return pageLayout('Страница не найдена', 'Возможно, страница была удалена или ссылка указана неверно.', '<p><a href="/shops" style="color:#EAB308">Вернуться в каталог</a></p>');
}

function renderCheckInNotFound() {
  return pageLayout('Публикация недоступна', 'Возможно, автор скрыл или удалил её, или она ещё на модерации.', '<p><a href="/feed" aria-label="Вернуться в ленту" style="color:#EAB308;font-size:24px">←</a></p>');
}

function renderUnavailable() {
  return pageLayout('Страница временно недоступна', 'Не удалось загрузить данные CoffeePeek. Попробуйте ещё раз позже.', '<p><a href="/shops" style="color:#EAB308">Обновить каталог</a></p>');
}

function jsonLd(value) {
  return `<script type="application/ld+json">${JSON.stringify(value).replaceAll('<', '\\u003c')}</script>`;
}

export function renderHomePage(shell) {
  const html = replaceMeta(shell, {
    title: HOME_TITLE, description: HOME_DESCRIPTION, canonical: `${SITE_URL}/`,
    structuredData: {
      '@context': 'https://schema.org', '@type': 'WebSite', name: 'CoffeePeek',
      url: `${SITE_URL}/`, description: HOME_DESCRIPTION, inLanguage: 'ru-BY', image: DEFAULT_IMAGE,
    },
  });
  return injectContent(html, renderHome());
}

function shopDescription(shop) {
  if (shop.description?.trim()) return shop.description.trim();
  const address = shop.location?.address?.trim();
  const rating = shop.checkInCount > 0 && shop.rating > 0
    ? ` Оценка посетителей: ${Number(shop.rating).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} из 5.` : '';
  return `Кофейня «${shop.name}».${address ? ` Адрес: ${address}.` : ''}${rating} Фотографии, меню и чекины на CoffeePeek.`;
}

function pageImage(data) {
  const photos = [...(data.photos || [])].sort((a, b) =>
    Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)) || (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  for (const photo of [...photos, data.coverPhoto]) {
    const image = photo?.urls?.card || photo?.urls?.detail || photo?.fullUrl;
    if (image) return image;
  }
  return data.photoUrl || data.avatarUrl || DEFAULT_IMAGE;
}

const CHECK_IN_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function excerpt(text, limit = 200) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;
}

function checkInTitle(checkIn) {
  const author = checkIn.username || 'Пользователь';
  return checkIn.kind === 'Home' ? `Кофе дома — ${author}` : `${author} в «${checkIn.shopName || 'кофейне'}»`;
}

function checkInDescription(checkIn, title) {
  const text = excerpt(checkIn.text);
  if (text) return text;
  const score = checkIn.kind === 'Home' ? checkIn.home?.tasteScore
    : checkIn.rating && (checkIn.rating.coffee + checkIn.rating.service + checkIn.rating.place) / 3;
  const drink = checkIn.drinkNameRu || checkIn.customDrinkName;
  return `${[
    title,
    checkIn.home?.beanName && `Зерно: ${checkIn.home.beanName}`,
    drink && `Напиток: ${drink}`,
    score && `Оценка: ${Number(score).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} из 5`,
  ].filter(Boolean).join('. ')}.`;
}

// Check-in photo URLs are API-relative; crawlers need them absolute. JPEG is the most widely supported preview format.
function checkInImage(checkIn) {
  const photos = [...(checkIn.photos || [])].sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  for (const photo of [...photos, { url: checkIn.drinkPhotoUrl, variants: checkIn.drinkPhotoVariants }]) {
    const variant = photo?.variants?.find(v => v.purpose === 'detail' && v.format === 'jpeg');
    const url = variant?.url || photo?.url;
    if (url) return { image: new URL(url, apiUrl('/')).href, imageWidth: variant?.width, imageHeight: variant?.height };
  }
  return { image: DEFAULT_IMAGE };
}

function renderCheckIn(checkIn, title, description, image) {
  const links = [
    checkIn.shop?.canonicalPath && `<a href="${escapeHtml(checkIn.shop.canonicalPath)}" style="color:#EAB308">${escapeHtml(checkIn.shopName || 'Кофейня')}</a>`,
    checkIn.author?.canonicalPath && `<a href="${escapeHtml(checkIn.author.canonicalPath)}" style="color:#EAB308">${escapeHtml(checkIn.username || 'Профиль автора')}</a>`,
  ].filter(Boolean);
  return pageLayout(title, checkIn.text?.trim() || description, `<article>
      ${image !== DEFAULT_IMAGE ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" style="display:block;max-width:100%;max-height:640px;border-radius:16px;margin:0 0 24px">` : ''}
      ${links.length ? `<p>${links.join(' · ')}</p>` : ''}
      <p><a href="/feed" aria-label="Вернуться в ленту" style="color:#EAB308;font-size:24px">←</a></p>
    </article>`);
}

function collectionPlacePath(place) {
  const slug = place.address?.slug;
  if (typeof slug !== 'string' || !slug || /[\\/\u0000-\u001f]/.test(slug) || ['.', '..'].includes(slug)) return null;
  const kind = place.kind === 'coffee_shop' ? 'coffee-shops' : place.kind === 'roaster' ? 'roasters' : null;
  return kind ? `/${kind}/${encodeURIComponent(slug)}` : null;
}

function collectionImage(place) {
  try {
    const photo = place?.coverPhoto;
    const saved = photo && Object.hasOwn(photo, 'url');
    const value = saved ? photo.url : photo?.urls?.card || photo?.fullUrl;
    if (!value) return DEFAULT_IMAGE;
    const api = new URL(apiUrl('/'));
    const image = new URL(value, api);
    if (saved && (image.origin !== api.origin || !/^\/api\/v1\/favorite-collections\/[^/]+\/cover\/[^/]+$/.test(image.pathname))) return DEFAULT_IMAGE;
    return image.protocol === 'https:' && !image.username && !image.password ? image.href : DEFAULT_IMAGE;
  } catch { return DEFAULT_IMAGE; }
}

function collectionCheckInLabel(count) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  return `${count} ${mod100 >= 11 && mod100 <= 14 ? 'чекинов' : mod10 === 1 ? 'чекин' : mod10 >= 2 && mod10 <= 4 ? 'чекина' : 'чекинов'}`;
}

async function renderCollectionPage(shell, rawId) {
  const valid = /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(rawId);
  const id = rawId.replaceAll('-', '').toLowerCase();
  const result = valid ? await fetchJson(`/api/v1/favorite-collections/${id}`) : { ok: false, status: 404 };
  const canonical = `${SITE_URL}/collections/${valid ? id : ''}`;
  const collection = result.body?.data;
  const hidden = collection && ((collection.mode !== undefined && !['snapshot', 'list'].includes(collection.mode)) ||
    (collection.visibility !== undefined && collection.visibility !== 'public') ||
    (collection.mode === 'list' && collection.visibility !== 'public'));
  if (!result.ok || !collection || hidden) {
    const status = hidden || [400, 404, 410].includes(result.status) ? 404 : 503;
    const html = replaceMeta(shell, { title: 'Подборка недоступна — CoffeePeek',
      description: 'Ссылка на подборку недоступна или отключена владельцем.', canonical });
    return { html: injectContent(html, status === 404
      ? pageLayout('Подборка недоступна', 'Ссылка могла быть отключена владельцем.', '<p><a href="/search">Найти кофейни</a></p>')
      : renderUnavailable()), status };
  }
  const places = (collection.items || []).filter(place => collectionPlacePath(place))
    .sort((left, right) => Number(left.kind === 'roaster') - Number(right.kind === 'roaster'));
  const title = `${collection.title} — CoffeePeek`;
  const description = excerpt(collection.description?.trim() || `Мест в подборке: ${places.length}. ${places.map(place => place.name).join(', ')}.`);
  const cards = places.map(place => {
    const isShop = place.kind === 'coffee_shop';
    const label = isShop ? 'Кофейня' : 'Обжарщик';
    const image = collectionImage(place);
    const location = [place.cityName, place.streetAddress].filter(Boolean).join(' · ') || 'Адрес уточняется';
    const rating = isShop && Number(place.rating) > 0 && Number(place.rating) <= 5
      ? `<span class="shared-place__rating" aria-label="Рейтинг: ${escapeHtml(Number(place.rating).toFixed(1))} из 5"><span aria-hidden="true" style="color:var(--collection-gold)">★</span>${escapeHtml(Number(place.rating).toFixed(1))}</span>` : '';
    const checkIns = isShop && Number.isInteger(place.checkInCount) && place.checkInCount >= 0
      ? `<span class="shared-place__checkins">${escapeHtml(collectionCheckInLabel(place.checkInCount))}</span>` : '';
    return `<a class="shared-place ${isShop ? 'shared-place--shop' : 'shared-place--roaster'}" href="${escapeHtml(collectionPlacePath(place))}">
      <span class="shared-place__image">${image === DEFAULT_IMAGE ? `<span class="shared-place__placeholder" aria-hidden="true">${isShop ? 'COFFEEPEEK' : escapeHtml(label)}</span>` : `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async">`}</span>
      <div class="shared-place__body"><h2 class="shared-place__name">${escapeHtml(place.name || label)}</h2>${isShop ? `<span class="shared-place__location"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg><span>${escapeHtml(location)}</span></span>` : ''}</div>
      ${isShop && (rating || checkIns) ? `<span class="shared-place__score">${rating}${checkIns}</span>` : ''}<svg class="shared-place__arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
    </a>`;
  });
  // Keep the no-JavaScript fallback aligned with SharedCollectionPage.css.
  const styles = `<style>
.shared-collection {
  --collection-card: #332a24;
  --collection-pill: #514638;
  --collection-text: #f6f3ee;
  --collection-muted: #beb5ab;
  --collection-gold: #eab308;
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  background: linear-gradient(125deg, #2b241f 0%, #211c18 50%, #191512 100%);
  color: var(--collection-text);
  color-scheme: dark;
}

.shared-collection__home { display: block; text-decoration: none; }
.shared-collection__ribbon {
  overflow: hidden;
  background: #17130f;
  color: var(--collection-gold);
  white-space: nowrap;
}

.shared-collection__ribbon > span {
  display: flex;
  width: max-content;
  gap: 24px;
  padding: 8px 0;
  transform: translateX(-38px);
  font-size: 20px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: -.04em;
}

.shared-collection__content {
  box-sizing: border-box;
  width: min(100%, 1184px);
  flex: 1;
  margin: 0 auto;
  padding: 36px 30px 80px;
}

.shared-collection__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 12px;
}

.shared-collection__title { min-width: 0; }
.shared-collection__cover { display: block; width: 100%; max-height: 320px; margin-bottom: 28px; border-radius: 24px; object-fit: cover; }
.shared-collection__heading h1 { margin: 0; overflow-wrap: anywhere; font-size: clamp(30px, 4.3vw, 44px); font-weight: 700; line-height: 1.2; letter-spacing: -.04em; }
.shared-collection__heading p { margin: 10px 0 0; color: var(--collection-muted); font-size: clamp(16px, 2.15vw, 22px); line-height: 1.4; letter-spacing: -.035em; }
.shared-collection__heading .shared-collection__description { margin-top: 12px; font-size: 16px; line-height: 1.55; letter-spacing: normal; white-space: pre-line; overflow-wrap: anywhere; }
.shared-collection__actions { display: flex; flex-shrink: 0; align-items: center; gap: 8px; padding-top: 4px; }
.shared-collection__share, .shared-collection__download { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; gap: 8px; padding: 10px 14px; border: 1px solid transparent; border-radius: 999px; background: transparent; color: var(--collection-muted); font-size: 13px; font-weight: 500; line-height: 1.4; text-decoration: none; cursor: pointer; transition: background-color .15s, color .15s; }
.shared-collection__download { border-color: #5a4b3d; }
.shared-collection__share:hover, .shared-collection__download:hover { background: var(--collection-card); color: var(--collection-text); }
.shared-collection :is(a, button):focus-visible { outline: 2px solid var(--collection-gold); outline-offset: 4px; }
.shared-collection .shared-collection__home:focus-visible { outline-offset: -3px; }
.shared-collection__message { margin-top: 20px; color: var(--collection-gold); }
.shared-collection__empty { padding: 28px; border-radius: 24px; background: var(--collection-card); color: var(--collection-muted); }
.shared-collection .profile-muted { color: var(--collection-muted); }
.shared-collection .profile-panel { border-color: #59493c; background: var(--collection-card); }
.shared-collection .profile-text-button { min-height: 44px; padding: 8px; color: var(--collection-text); font-weight: 600; cursor: pointer; }
.shared-collection .profile-text-button:hover { color: var(--collection-gold); }

.shared-collection__groups, .shared-collection__shops { display: grid; gap: 14px; }
.shared-collection__roasters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }

.shared-place {
  display: grid;
  min-width: 0;
  align-items: center;
  gap: 22px;
  border: 1px solid #ffffff04;
  border-radius: 28px;
  background: var(--collection-card);
  color: var(--collection-text);
  text-decoration: none;
  transition: background-color .15s, border-color .15s;
}

.shared-place:hover { border-color: #695443; background: #3b3028; }
.shared-place--shop { min-height: 206px; grid-template-columns: 30% minmax(0, 1fr) 140px 18px; padding: 10px 20px 10px 10px; }
.shared-place--roaster { min-height: 146px; grid-template-columns: 122px minmax(0, 1fr) 16px; gap: 16px; padding: 10px 14px 10px 10px; }
.shared-place__image { position: relative; display: flex; width: 100%; align-items: center; justify-content: center; align-self: stretch; overflow: hidden; border-radius: 19px; background: #fff; color: #17130f; }
.shared-place--shop .shared-place__image { min-height: 184px; }
.shared-place--roaster .shared-place__image { min-height: 122px; }
.shared-place__placeholder { padding: 8px; font-size: clamp(16px, 2.8vw, 30px); font-weight: 800; letter-spacing: -.045em; }
.shared-place__image img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.shared-place--roaster .shared-place__image img { object-fit: contain; }
.shared-place__body { display: flex; min-width: 0; flex-direction: column; justify-content: center; gap: 10px; padding-block: 14px; }
.shared-place__name { margin: 0; overflow-wrap: anywhere; font-size: clamp(24px, 3.5vw, 36px); font-weight: 700; line-height: 1.18; letter-spacing: -.04em; }
.shared-place__location { display: flex; align-items: flex-start; gap: 8px; color: var(--collection-muted); font-size: clamp(15px, 2.05vw, 21px); line-height: 1.4; letter-spacing: -.035em; overflow-wrap: anywhere; }
.shared-place__location svg { flex-shrink: 0; margin-top: 2px; color: var(--collection-gold); }
.shared-place__score { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }
.shared-place__rating { display: inline-flex; min-width: 140px; align-items: center; justify-content: center; gap: 10px; padding: 7px 16px; border-radius: 999px; background: var(--collection-pill); font-size: 32px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; letter-spacing: -.035em; }
.shared-place__rating svg { flex-shrink: 0; color: var(--collection-gold); }
.shared-place__checkins { color: var(--collection-muted); font-size: 19px; line-height: 1.4; letter-spacing: -.035em; }
.shared-place__arrow { grid-column: -2; color: var(--collection-muted); }
.shared-place--roaster .shared-place__name { font-size: clamp(21px, 2.8vw, 28px); }

@media (min-width: 761px) and (max-width: 1100px) {
  .shared-collection__share span { display: none; }
}

@media (max-width: 760px) {
  .shared-collection__content { padding: 28px 20px 56px; }
  .shared-collection__heading { gap: 12px; margin-bottom: 18px; }
  .shared-collection__actions { gap: 2px; }
  .shared-collection__share { width: 44px; padding: 10px; }
  .shared-collection__share span { display: none; }
  .shared-collection__download { padding: 10px 12px; font-size: 11px; }
  .shared-place--shop { min-height: 166px; grid-template-columns: 29% minmax(0, 1fr) 94px 14px; gap: 14px; padding-right: 14px; border-radius: 24px; }
  .shared-place--shop .shared-place__image { min-height: 144px; border-radius: 16px; }
  .shared-place__name { font-size: 25px; }
  .shared-place__location { gap: 5px; font-size: 15px; }
  .shared-place__location svg { width: 18px; height: 18px; }
  .shared-place__rating { min-width: 94px; gap: 6px; padding: 7px 10px; font-size: 24px; }
  .shared-place__rating svg { width: 23px; height: 23px; }
  .shared-place__checkins { font-size: 14px; }
  .shared-collection__roasters { grid-template-columns: 1fr; }
  .shared-place--roaster { width: calc((100% - 14px) / 2); min-width: min(100%, 340px); min-height: 124px; grid-template-columns: 100px minmax(0, 1fr) 14px; border-radius: 24px; }
  .shared-place--roaster .shared-place__image { min-height: 102px; border-radius: 16px; }
}

@media (max-width: 540px) {
  .shared-collection__ribbon > span { gap: 18px; padding-block: 6px; font-size: 16px; line-height: 22px; }
  .shared-collection__content { padding: 26px 16px 48px; }
  .shared-collection__heading { flex-direction: column; gap: 12px; }
  .shared-collection__heading h1 { font-size: 32px; }
  .shared-collection__heading p { margin-top: 8px; font-size: 16px; }
  .shared-collection__actions { width: 100%; justify-content: space-between; padding: 0; }
  .shared-collection__share { width: auto; padding-left: 0; }
  .shared-collection__share span { display: inline; }
  .shared-collection__download { font-size: 12px; }
  .shared-collection__groups, .shared-collection__shops { gap: 12px; }
  .shared-place--shop { min-height: 142px; grid-template-columns: 100px minmax(0, 1fr) 12px; grid-template-rows: auto auto; column-gap: 12px; row-gap: 8px; padding: 8px 12px 8px 8px; border-radius: 22px; }
  .shared-place--shop .shared-place__image { grid-row: 1 / span 2; min-height: 124px; border-radius: 15px; }
  .shared-place--shop .shared-place__body { align-self: end; gap: 6px; padding: 4px 0 0; }
  .shared-place__name { font-size: 20px; line-height: 1.2; letter-spacing: -.03em; }
  .shared-place__location { gap: 4px; font-size: 12px; line-height: 1.45; letter-spacing: -.02em; }
  .shared-place__location svg { width: 15px; height: 15px; margin-top: 1px; }
  .shared-place__score { grid-column: 2; grid-row: 2; flex-direction: row; align-self: start; justify-content: flex-start; gap: 8px; padding-bottom: 4px; }
  .shared-place__rating { min-width: 64px; gap: 5px; padding: 4px 8px; font-size: 16px; }
  .shared-place__rating svg { width: 16px; height: 16px; }
  .shared-place__checkins { font-size: 11px; white-space: normal; }
  .shared-place--shop .shared-place__arrow { grid-column: 3; grid-row: 1 / span 2; width: 16px; }
  .shared-place__placeholder { font-size: 13px; }
  .shared-place--roaster { width: 100%; min-width: 0; min-height: 104px; grid-template-columns: 86px minmax(0, 1fr) 12px; gap: 12px; padding: 8px 12px 8px 8px; border-radius: 22px; }
  .shared-place--roaster .shared-place__image { min-height: 86px; border-radius: 15px; }
  .shared-place--roaster .shared-place__name { font-size: 20px; }
}

@media (max-width: 360px) {
  .shared-place--shop { grid-template-columns: 82px minmax(0, 1fr) 10px; column-gap: 8px; }
  .shared-place__name { font-size: 18px; }
  .shared-place__score { gap: 5px; }
  .shared-place__checkins { font-size: 10px; }
  .shared-place__placeholder { font-size: 11px; }
}

@media (prefers-reduced-motion: reduce) {
  .shared-collection *, .shared-collection *::before, .shared-collection *::after { transition: none; }
}
  </style>`;
  const cover = collectionImage(collection);
  let html = replaceMeta(shell, { title, description, canonical, image: cover !== DEFAULT_IMAGE ? cover : collectionImage(places[0]) });
  html = html.replace('</head>', `<meta name="robots" content="noindex, nofollow">${styles}</head>`);
  const ribbon = `<div class="shared-collection__ribbon" aria-hidden="true"><span>${'<span>COFFEEPEEK</span>'.repeat(32)}</span></div>`;
  const content = `<main class="shared-collection"><a class="shared-collection__home" href="/" aria-label="CoffeePeek — на главную">${ribbon}</a><div class="shared-collection__content">
    ${cover !== DEFAULT_IMAGE ? `<img src="${escapeHtml(cover)}" alt="" class="shared-collection__cover">` : ''}
    <header class="shared-collection__heading"><div class="shared-collection__title"><h1>${escapeHtml(collection.title)}</h1>${collection.description ? `<p class="shared-collection__description">${escapeHtml(collection.description)}</p>` : ''}<p>Мест в подборке: ${places.length}</p></div><nav class="shared-collection__actions" aria-label="Действия с подборкой"><a class="shared-collection__download" href="/download/auto">Скачать приложение</a></nav></header>
    <div class="shared-collection__groups">${cards.some((_, index) => places[index].kind === 'coffee_shop') ? `<section class="shared-collection__shops" aria-label="Кофейни">${cards.filter((_, index) => places[index].kind === 'coffee_shop').join('')}</section>` : ''}${cards.some((_, index) => places[index].kind === 'roaster') ? `<section class="shared-collection__roasters" aria-label="Обжарщики">${cards.filter((_, index) => places[index].kind === 'roaster').join('')}</section>` : ''}</div>${cards.length ? '' : `<p class="shared-collection__empty">${collection.mode === 'list' ? 'В подборке пока нет мест.' : 'Места из этой подборки больше недоступны.'}</p>`}
    </div>${ribbon}</main>`;
  return { html: injectContent(html, content, { showHeader: false }), status: 200 };
}

async function renderProfileCollection(slug) {
  const result = await fetchJson(`/api/v1/profiles/${encodeURIComponent(slug)}/collection`);
  const collection = result.body?.data;
  if (!result.ok || !collection || collection.mode !== 'list' || collection.visibility !== 'public') return '';
  const id = String(collection.id || '').replaceAll('-', '').toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id) || collection.canonicalPath !== `/collections/${id}`) return '';
  const cover = collectionImage(collection);
  return `<section><h2>${escapeHtml(collection.title || 'Избранное')}</h2><a href="/collections/${id}" style="display:block;color:inherit;text-decoration:none">
    ${cover !== DEFAULT_IMAGE ? `<img src="${escapeHtml(cover)}" alt="" style="width:160px;height:160px;object-fit:cover;border-radius:20px">` : ''}
    <h3>${escapeHtml(collection.title)}</h3>${collection.description ? `<p>${escapeHtml(collection.description)}</p>` : ''}
    <p>Мест в подборке: ${Array.isArray(collection.items) ? collection.items.length : 0}</p></a></section>`;
}

function profileShelfImage(slug, item) {
  try {
    const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
    if (!uuid.test(item.id) || typeof item.photoUrl !== 'string') return '';
    const api = new URL(apiUrl('/'));
    const image = new URL(item.photoUrl, api);
    const prefix = `/api/v1/profiles/${encodeURIComponent(slug)}/shelf/bags/${item.id}/photos/`;
    return image.protocol === 'https:' && image.origin === api.origin && !image.username && !image.password && !image.search && !image.hash
      && image.pathname.startsWith(prefix) && uuid.test(image.pathname.slice(prefix.length)) ? image.href : '';
  } catch { return ''; }
}

async function renderProfileShelf(slug) {
  const result = await fetchJson(`/api/v1/profiles/${encodeURIComponent(slug)}/shelf`);
  const shelf = result.body?.data;
  if (!result.ok || !shelf || !Array.isArray(shelf.items) || shelf.totalCount !== shelf.items.length) return '';
  const cards = shelf.items.map(item => {
    if (!item || typeof item.name !== 'string') return '';
    const photo = profileShelfImage(slug, item);
    const name = escapeHtml(item.name || 'Кофе');
    const coffee = typeof item.coffeeSlug === 'string' && item.coffeeSlug.trim()
      && !/[\\/\u0000-\u001f]/.test(item.coffeeSlug) && !['.', '..'].includes(item.coffeeSlug)
      ? `<a href="/coffees/${encodeURIComponent(item.coffeeSlug)}">${name}</a>` : name;
    return `<article style="width:144px;flex:none">${photo ? `<img src="${escapeHtml(photo)}" alt="" crossorigin="anonymous" referrerpolicy="no-referrer" style="width:144px;height:144px;object-fit:cover;border-radius:12px">` : ''}
      <h3>${coffee}</h3>${typeof item.roasterName === 'string' ? `<p>${escapeHtml(item.roasterName)}</p>` : ''}</article>`;
  }).join('');
  return `<section><h2>Кофейная полка</h2><div style="display:flex;gap:12px;overflow-x:auto">${cards || '<p>На полке пока нет кофе.</p>'}</div></section>`;
}

export async function renderPublicPage(request) {
  const url = new URL(request.url);
  const page = url.searchParams.get('page') || 'home';
  const shell = await loadSpaShell(request);

  if (page === 'collection') return renderCollectionPage(shell, url.searchParams.get('id') || '');

  if (page === 'home') {
    return { html: renderHomePage(shell), status: 200 };
  }

  if (page === 'not-found') {
    const html = replaceMeta(shell, { title: 'Страница не найдена — CoffeePeek', description: 'Запрашиваемая страница не существует.', canonical: `${SITE_URL}${url.searchParams.get('path') || '/'}` });
    return { html: injectContent(html, renderNotFound()), status: 404 };
  }

  if (page === 'shops') {
    const result = await fetchJson('/api/v1/coffee-shops/search', { body: { filters: {}, page: 1, pageSize: 48 } });
    if (!result.ok) {
      const html = injectContent(replaceMeta(shell, { title: 'CoffeePeek временно недоступен', description: 'Каталог кофеен временно недоступен.', canonical: `${SITE_URL}/shops` }), renderUnavailable());
      return { html, status: 503 };
    }
    const shops = result.body?.data?.items || [];
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
    let html = replaceMeta(shell, { title, description, canonical: `${SITE_URL}/shops`, structuredData });
    html = injectContent(
      html,
      pageLayout('Кофейни', 'Каталог кофеен с адресами, рейтингами и меню.', renderShopCards(shops)),
    );
    return { html, status: 200 };
  }

  if (page === 'check-in') {
    const id = url.searchParams.get('id') || '';
    const canonical = `${SITE_URL}/check-ins/${encodeURIComponent(id)}`;
    // Anonymous read: only public, approved check-ins come back; everything else is a 404 from the API.
    const result = CHECK_IN_ID.test(id) ? await fetchJson(`/api/v1/check-ins/${id}`) : { ok: false, status: 404 };
    const checkIn = result.body?.data;
    if (!result.ok || !checkIn) {
      const status = result.ok ? 503 : result.status;
      const content = status === 404 ? renderCheckInNotFound() : renderUnavailable();
      return { html: injectContent(replaceMeta(shell, { title: 'Публикация недоступна — CoffeePeek', description: 'Публикация CoffeePeek недоступна.', canonical }), content), status, retryAfter: result.retryAfter };
    }
    const title = checkInTitle(checkIn);
    const description = checkInDescription(checkIn, title);
    const image = checkInImage(checkIn);
    let html = replaceMeta(shell, { title: `${title} — CoffeePeek`, description, canonical, type: 'article', ...image });
    html = injectContent(html, renderCheckIn(checkIn, title, description, image.image));
    return { html, status: 200 };
  }

  const prefixes = { shops: '/api/CoffeeShops', roasters: '/api/Roasters', users: '/api/Users', coffees: '/api/v1/coffees' };
  const kind = page === 'shop' ? 'shops' : url.searchParams.get('kind');
  const segment = page === 'shop' ? url.searchParams.get('shopId') || '' : url.searchParams.get('segment') || '';
  if (!prefixes[kind]) return { html: '', status: 400 };
  const path = url.searchParams.get('path') || `/coffee-shops/${encodeURIComponent(segment)}`;
  const result = await fetchJson(`${prefixes[kind]}${kind === 'coffees' ? '/' : '/by-slug/'}${encodeURIComponent(segment)}`, { direct: kind === 'users' });
  const data = result.body?.data;
  const address = kind === 'users' ? result.body?.address : data?.address;
  if (!result.ok || !data || !address) {
    const status = result.ok ? 503 : result.status;
    const content = status === 404 ? renderNotFound() : renderUnavailable();
    return { html: injectContent(replaceMeta(shell, { title: 'CoffeePeek', description: 'Публичная страница CoffeePeek', canonical: `${SITE_URL}${path}` }), content), status, retryAfter: result.retryAfter };
  }
  if (path !== address.canonicalPath) return { html: '', status: 301, location: address.canonicalPath };
  const title = data.name || data.userName || 'CoffeePeek';
  const description = kind === 'shops' ? shopDescription(data) : data.description || data.about || (kind === 'coffees' ? `Кофе «${title}» от ${data.roaster?.name || 'обжарщика'}. Описание и предложения на CoffeePeek.` : title);
  const canonical = `${SITE_URL}${address.canonicalPath}`;
  const image = pageImage(data);
  const [featured, shelf] = kind === 'users' && !data.isBlockedByViewer
    ? await Promise.all([renderProfileCollection(address.slug), renderProfileShelf(address.slug)]) : ['', ''];
  const content = kind === 'shops' ? renderShopDetails(data) : pageLayout(title, description,
    kind === 'users' ? `<p>Чекинов: ${escapeHtml(data.checkInCount)}</p>${featured}${shelf}` : '');
  const structuredData = kind === 'shops' ? { '@context': 'https://schema.org', '@type': 'CafeOrCoffeeShop', name: data.name, description, url: canonical, image,
    address: { '@type': 'PostalAddress', streetAddress: data.location?.address, addressCountry: 'BY' },
    geo: data.location?.latitude != null ? { '@type': 'GeoCoordinates', latitude: data.location.latitude, longitude: data.location.longitude } : undefined,
    aggregateRating: data.checkInCount ? { '@type': 'AggregateRating', ratingValue: data.rating, ratingCount: data.checkInCount } : undefined,
  } : undefined;
  let html = replaceMeta(shell, { title: `${title} — CoffeePeek`, description, canonical,
    type: kind === 'shops' ? 'business.business' : 'website', image, structuredData,
  });
  html = injectContent(html, content);
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
          ...(status === 404 ? { 'X-Robots-Tag': 'noindex' } : {}),
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
