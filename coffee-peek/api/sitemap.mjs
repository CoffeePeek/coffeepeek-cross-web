import { fetchJson } from './public-page.mjs';

const SITE_URL = 'https://coffeepeek.by';
const escapeXml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

export async function renderSitemap() {
  const urls = new Set(['/', '/shops', '/map', '/coffees', '/roasters', '/feed', '/privacy', '/terms', '/support'].map(path => SITE_URL + path));
  const addItems = (items, prefix) => {
    if (!Array.isArray(items)) throw new Error('Invalid public catalog');
    for (const item of items) {
      const path = item.address?.canonicalPath;
      if (path == null && prefix === '/roasters/') continue;
      if (typeof path !== 'string' || !path.startsWith(prefix) || !path.slice(prefix.length) || /[/?#\\]/.test(path.slice(prefix.length))) throw new Error('Invalid canonical path');
      const url = new URL(path, SITE_URL);
      if (url.origin !== SITE_URL || !url.pathname.startsWith(prefix) || !url.pathname.slice(prefix.length)) throw new Error('Invalid canonical origin');
      urls.add(url.href);
      if (urls.size > 50000) throw new Error('A sitemap index is required above 50,000 URLs');
    }
  };
  for (const kind of ['shops', 'coffees', 'roasters']) {
    let page = 1;
    let totalPages = 1;
    do {
      const result = kind === 'roasters' ? await fetchJson('/api/Roasters')
        : await fetchJson(`/api/v1/${kind === 'shops' ? 'coffee-shops' : 'coffees'}/search`, { body: { ...(kind === 'coffees' ? { q: '', sort: 'name_asc' } : {}), filters: {}, page, pageSize: 100 } });
      if (!result.ok) throw new Error('Public catalog unavailable');
      const data = result.body?.data;
      totalPages = kind === 'roasters' ? 1 : data?.totalPages;
      if (!Number.isInteger(totalPages) || totalPages < 0 || totalPages > 500) throw new Error('Invalid public catalog pagination');
      addItems(kind === 'roasters' ? data : data?.items, kind === 'shops' ? '/coffee-shops/' : `/${kind}/`);
      page++;
    } while (page <= totalPages);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls].map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}\n</urlset>`;
}

export default {
  async fetch() {
    try {
      return new Response(await renderSitemap(), { headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=300',
        'X-Content-Type-Options': 'nosniff',
      } });
    } catch {
      return new Response('Sitemap is temporarily unavailable', { status: 503, headers: {
        'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '60',
      } });
    }
  },
};
