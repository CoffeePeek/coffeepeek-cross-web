import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LEGAL } from '../constants/legal';

interface PageMetadata {
  description?: string | null;
  canonicalPath?: string;
}

const descriptions: Record<string, string> = {
  '/': 'Кофейни Минска на карте: адреса, часы работы, меню, фотографии и оценки посетителей. Находите новые места, выбирайте кофе и делитесь впечатлениями в CoffeePeek.',
  '/shops': 'Каталог кофеен CoffeePeek: адреса, часы работы, рейтинги, меню и фотографии.',
  '/search': 'Поиск кофеен и обжарщиков: адреса, рейтинги и фильтры на CoffeePeek.',
  '/map': 'Карта кофеен Минска: адреса, часы работы и оценки посетителей на CoffeePeek.',
  '/coffees': 'Каталог кофе: обжарщики, вкусовые ноты, способы приготовления и предложения на CoffeePeek.',
  '/roasters': 'Обжарщики кофе: ассортимент, кофейни и контакты на CoffeePeek.',
  '/feed': 'Публичные чекины, фотографии и впечатления посетителей кофеен на CoffeePeek.',
};

export function updatePageMetadata(title: string, pathname: string, { description, canonicalPath }: PageMetadata = {}): void {
  const fullTitle = title ? `CoffeePeek | ${title}` : 'CoffeePeek';
  const canonical = LEGAL.siteUrl + ((canonicalPath ?? pathname).replace(/\/$/, '') || '/');
  const pageDescription = description?.trim() || descriptions[pathname] || `${title || 'Кофейни, кофе и обжарщики'} на CoffeePeek.`;
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
  const { pathname } = useLocation();
  useEffect(() => {
    updatePageMetadata(title, pathname, { description, canonicalPath });
    return () => {
      document.title = 'CoffeePeek';
    };
  }, [title, pathname, description, canonicalPath]);
}

