import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LEGAL } from '../constants/legal';
import catalogPages from '../seo/catalogMetadata.json';

interface PageMetadata {
  description?: string | null;
  canonicalPath?: string;
  search?: string;
}

const descriptions: Record<string, string> = {
  '/': 'Кофейни на карте, меню и отзывы. Находите новые места, выбирайте кофе и делитесь впечатлениями в CoffeePeek.',
  '/search': 'Поиск кофеен и обжарщиков: адреса, рейтинги и фильтры на CoffeePeek.',
  '/map': 'Карта кофеен: адреса, часы работы и оценки посетителей на CoffeePeek.',
  '/feed': 'Публичные чекины, фотографии и впечатления посетителей кофеен на CoffeePeek.',
};

export function updatePageMetadata(title: string, pathname: string, { description, canonicalPath, search = '' }: PageMetadata = {}): void {
  const catalog = Object.values(catalogPages).find(page => page.path === pathname);
  const params = new URLSearchParams(search);
  const page = Number(params.get('page') ?? 1);
  const validPage = Number.isSafeInteger(page) && page >= 1 && page <= 100000;
  const filtered = !!catalog && ['filters', 'q', 'sort', 'citySlug', 'city', 'filter', 'roasterSlug', 'section'].some(key => params.has(key));
  const fullTitle = catalog ? `${catalog.heading}${validPage && page > 1 ? `, страница ${page}` : ''} — CoffeePeek`
    : title ? `CoffeePeek | ${title}` : 'CoffeePeek';
  const path = canonicalPath ?? (catalog && validPage && page > 1 ? `${pathname}?page=${page}` : pathname);
  const canonical = LEGAL.siteUrl + (path.replace(/\/$/, '') || '/');
  const publicPath = pathname === '/' || !!catalog || pathname === '/support' || pathname === '/cities/minsk'
    || /^\/cities\/minsk\/(?:specialty|laptop-friendly)$/.test(pathname)
    || /^\/(?:coffee-shops|roasters|coffees|users|collections)\/[^/]+$/.test(pathname) && !pathname.endsWith('/new');
  const noindex = !publicPath || filtered || !!catalog && !validPage;
  const pageDescription = description?.trim() || catalog?.description || descriptions[pathname] || `${title || 'Кофейни, кофе и обжарщики'} на CoffeePeek.`;
  const previous = document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');
  if (previous !== canonical) document.head.querySelectorAll('script[type="application/ld+json"]').forEach(element => element.remove());
  const setTag = (selector: string, tag: 'link' | 'meta', attributes: Record<string, string>) => {
    const [existing, ...duplicates] = document.head.querySelectorAll(selector);
    const element = existing || document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    if (!existing) document.head.append(element);
    duplicates.forEach(duplicate => duplicate.remove());
  };
  document.title = fullTitle;
  setTag('link[rel="canonical"]', 'link', { rel: 'canonical', href: canonical });
  setTag('meta[name="robots"]', 'meta', { name: 'robots', content: `${noindex ? 'noindex' : 'index'}, follow` });
  for (const [attribute, name, content] of [
    ['name', 'description', pageDescription],
    ['property', 'og:title', fullTitle],
    ['property', 'og:description', pageDescription],
    ['property', 'og:url', canonical],
    ['name', 'twitter:title', fullTitle],
    ['name', 'twitter:description', pageDescription],
  ]) setTag(`meta[${attribute}="${name}"]`, 'meta', { [attribute]: name, content });
}

export function usePageTitle(title: string, { description, canonicalPath }: PageMetadata = {}): void {
  const { pathname, search } = useLocation();
  useEffect(() => {
    updatePageMetadata(title, pathname, { description, canonicalPath, search });
    return () => {
      document.title = 'CoffeePeek';
    };
  }, [title, pathname, search, description, canonicalPath]);
}

