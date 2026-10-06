// Isolated manual test harness. All CoffeePeek API mutations and extension messages are fixtures.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ImportQueuePage } from '../../src/pages/ImportQueuePage';
import { ToastProvider } from '../../src/contexts/ToastContext';
import { ThemeProvider } from '../../src/contexts/ThemeContext';
import { TokenManager } from '../../src/api/core/httpClient';
import { LINK_IMPORT_CHANNEL, LINK_IMPORT_VERSION } from '../../src/utils/linkImport';
import { CATALOG_TAG_OPTIONS } from '../../src/constants/catalogIngest';
import '../../src/index.css';

const source = 'https://yandex.by/maps/org/coffelion/41070949812/';
const photoUrl = 'https://avatars.mds.yandex.net/get-altay/13322921/2a00000193c9fe344039be8a8a8e8b8631b2/XXXL';
const drinks = [
  { slug: 'espresso', nameRu: 'Эспрессо', nameEn: 'Espresso', category: 'Espresso', sortOrder: 0 },
  { slug: 'cappuccino', nameRu: 'Капучино', nameEn: 'Cappuccino', category: 'Espresso', sortOrder: 1 },
];
const original = { id: 'enrichment-fixture', name: 'Coffelion · тестовая карточка', source: 'File', externalId: 'yandex:41070949812',
  address: 'Минск, Игуменский тракт, 14', latitude: 53.847294, longitude: 27.567544,
  phone: '+375291111111', instagram: 'https://www.instagram.com/coffelion_minsk/', openingHours: 'Пн-Пт 08:00–22:00',
  coffeeFocus: 'coffee_bar', tagSlugs: [], signals: [], queueStatus: 'Pending', research: { yandexMaps: source },
  menu: { currency: 'BYN', parseStatus: 'Ready', photos: [], items: [{ ...drinks[0], availability: 'Present', price: 3, volumeMl: 30, currency: 'BYN', source: 'Manual' }] },
};
let candidate = structuredClone(original), failParse = false, ignoreMenu = false;
let publishTags: string[] = [], mutations: string[] = [];
const json = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const requestUrl = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin);
  if (!requestUrl.pathname.startsWith('/backend/') && requestUrl.pathname !== '/fixture-upload') return originalFetch(input, init);
  const path = requestUrl.pathname.replace('/backend', ''), method = init?.method || 'GET';
  const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : {};
  if (method !== 'GET') { mutations.push(method + ' ' + path); window.dispatchEvent(new Event('fixture-update')); }
  if (path === '/fixture-upload') return new Response('', { status: 200 });
  if (path === '/api/admin/shop-tags') return json(CATALOG_TAG_OPTIONS.map((tag, i) => ({ id: tag.slug, slug: tag.slug, name: tag.label, sortOrder: i, isActive: true })));
  if (path === '/api/menu/drinks') return json(drinks);
  if (path === '/api/Photos/menu') return json(body.map((_: unknown, index: number) => ({ uploadUrl: location.origin + '/fixture-upload', storageKey: 'fixture-menu-' + index })));
  if (path.endsWith('/menu/photos')) {
    candidate.menu.photos.push(...body.photos.map((p: object) => ({ ...p, fullUrl: photoUrl })));
    return json(candidate);
  }
  if (path.endsWith('/menu/parse')) {
    if (failParse) { failParse = false; return new Response(JSON.stringify({ success: false, message: 'Тест: распознавание временно недоступно' }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }
    candidate.menu.parseStatus = 'Ready'; return json(candidate);
  }
  if (path.endsWith('/menu') && method === 'PUT') {
    if (!ignoreMenu) candidate.menu.items = body.items.map((row: object & { slug: string }) => ({ ...drinks.find((drink) => drink.slug === row.slug), ...row, currency: 'BYN', source: 'Manual' }));
    return json(candidate);
  }
  if (path.endsWith('/decide')) { publishTags = body.tagSlugs; candidate.tagSlugs = publishTags; candidate.queueStatus = 'Published'; return json(candidate); }
  if (path === '/api/admin/import/candidates') return json({ items: [candidate], totalCount: 1, totalPages: 1, page: 1 });
  if (path === '/api/admin/import/candidates/enrichment-fixture') {
    if (method === 'PATCH') Object.assign(candidate, body);
    return json(candidate);
  }
  if (path === '/api/admin/import/file') return json({ parsed: 1, inserted: 1, enriched: 0, unchanged: 0, invalid: 0 });
  return json([]);
};
TokenManager.setAccessToken('e30.' + btoa(JSON.stringify({ roles: ['Admin'], exp: Math.floor(Date.now() / 1000) + 3600 })) + '.fixture');
window.addEventListener('message', (event) => {
  const message = event.data;
  if (event.origin !== location.origin || message?.channel !== LINK_IMPORT_CHANNEL || message.direction !== 'request') return;
  const response = message.action === 'ping' ? { version: LINK_IMPORT_VERSION } : message.action === 'image'
    ? { contentType: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBv8AAAAASUVORK5CYII=' }
    : { draft: { url: source, extractedAt: '', evidence: {}, fields: { name: 'Coffelion', address: candidate.address, phone: '+375292222222', website: 'https://coffee.example.test/' }, enrichment: {
      tags: [{ slug: 'to_go', evidence: 'Кофе с собой', sourceUrl: source }, { slug: 'pet_friendly', evidence: 'dog friendly🐾', sourceUrl: 'https://www.instagram.com/coffelion_minsk/' }],
      menuItems: [
        { name: 'Капучино 250 мл', price: 5.5, currency: 'BYN', volumeMl: 250, sourceUrl: source + 'menu/', delivery: false },
        { name: 'Капучино 350 мл', price: 7, currency: 'BYN', volumeMl: 350, sourceUrl: source + 'menu/', delivery: true },
        { name: 'Паста', price: 18, currency: 'BYN', weightGrams: 250, sourceUrl: source + 'menu/', delivery: true },
      ], menuSources: [{ url: source + 'menu/', kind: 'menu', label: 'Меню в Яндексе' }],
      photos: [{ url: photoUrl, sourceUrl: source + 'gallery/', label: 'Фото из галереи Яндекса' }], warnings: ['Меню доставки: цены в заведении могут отличаться.'],
    } } };
  if (message.action !== 'cancel') window.postMessage({ channel: LINK_IMPORT_CHANNEL, direction: 'response', requestId: message.requestId, ...response }, location.origin);
});
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Harness() {
  const [, refresh] = useState(0);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const update = () => refresh((value) => value + 1);
    window.addEventListener('fixture-update', update);
    return () => window.removeEventListener('fixture-update', update);
  }, []);
  return <>
    <div className="p-3 bg-amber-100 text-sm flex flex-wrap items-center gap-3">
      <strong>Тест импорта · API и расширение подменены</strong>
      <button onClick={() => { candidate = structuredClone(original); publishTags = []; mutations = []; ignoreMenu = false; failParse = false; localStorage.removeItem('coffeepeek-import-enrichment-v2:' + candidate.id); client.clear(); setRevision((value) => value + 1); }}>Сбросить тест</button>
      <label><input type="checkbox" onChange={(event) => { ignoreMenu = event.target.checked; }} /> API игнорирует меню</label>
      <button onClick={() => { failParse = true; }}>Сбой следующего распознавания</button>
      <output aria-label="Публикуемые теги">Теги: {publishTags.join(', ') || 'не опубликованы'}</output>
      <output aria-label="Запросы теста">{mutations.join(' · ')}</output>
    </div>
    <div className="h-[calc(100dvh-80px)]"><MemoryRouter key={revision} initialEntries={['/import/enrichment-fixture?panel=list']}><Routes>
      <Route path="/import/:id" element={<ImportQueuePage />} /><Route path="/import" element={<ImportQueuePage />} />
    </Routes></MemoryRouter></div>
  </>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><ThemeProvider><ToastProvider><Harness /></ToastProvider></ThemeProvider></QueryClientProvider>);
