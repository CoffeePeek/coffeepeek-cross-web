import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { searchShops } from '../api/discovery';
import ShopPhotoPlaceholder from '../components/ShopPhotoPlaceholder';
import { ShopCardSkeleton } from '../components/skeletons';
import minsk from '../constants/minskCatalog.json';
import { usePageTitle } from '../hooks/usePageTitle';
import { shopFiltersSchema } from '../utils/catalogSearch';

type Collection = keyof typeof minsk.collections;
interface CityCatalog {
  path?: string;
  page: number;
  totalPages: number;
  shops: Array<{
    path: string;
    name: string;
    address?: string;
    photo?: string;
    rating?: number;
    checkInCount?: number;
    tags?: string[];
    details?: string[];
    source?: { url: string; label: string };
  }>;
}

function readServerCatalog(): CityCatalog | undefined {
  const data = document.getElementById('minsk-catalog-data')?.textContent;
  return data ? JSON.parse(data) : undefined;
}

const catalogLink = (path: string, page: number) => page === 1 ? path : `${path}?p=${page}`;
const navLinkClass = 'inline-flex min-h-11 items-center rounded-lg font-semibold underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
const laptopNotes: Record<string, Pick<CityCatalog['shops'][number], 'details' | 'source'>> = minsk.collections['laptop-friendly'].notes;

export default function MinskCatalogPage({ collection }: { collection?: Collection }) {
  const topic = collection ? minsk.collections[collection] : undefined;
  const section = topic ?? minsk;
  const [params] = useSearchParams();
  const rawPage = params.get('p') ?? '1';
  const page = Number(rawPage);
  const validPage = /^\d+$/.test(rawPage) && Number.isSafeInteger(page) && page > 0;
  const [serverCatalog] = useState(readServerCatalog);
  usePageTitle(validPage && page > 1 ? section.heading + ', страница ' + page : section.title, {
    description: section.description, canonicalPath: validPage ? catalogLink(section.path, page) : section.path,
  });

  const catalog = useQuery({
    queryKey: ['cityCatalog', section.path, page],
    enabled: validPage,
    initialData: serverCatalog?.page === page && (serverCatalog.path ?? minsk.path) === section.path ? serverCatalog : undefined,
    staleTime: 60_000,
    retry: false,
    queryFn: async ({ signal }): Promise<CityCatalog> => {
      const filters = shopFiltersSchema.parse({ city: minsk.slug, ...topic?.filters });
      const { items, totalPages } = await searchShops({ q: '', filters, sort: 'name_asc', page, pageSize: minsk.pageSize }, signal);
      const renderedShops = serverCatalog?.path === section.path ? serverCatalog.shops : [];
      return {
        page, totalPages,
        shops: items.flatMap(shop => {
          const path = shop.address.canonicalPath;
          if (!path) return [];
          return [{
            path,
            name: shop.name,
            address: shop.addressLine,
            photo: shop.coverPhoto?.urls?.card || shop.coverPhoto?.fullUrl,
            rating: shop.rating,
            checkInCount: shop.checkInCount,
            tags: shop.tags.filter(tag => !filters.tags?.includes(tag.slug)).slice(0, 3).map(tag => tag.name),
            details: renderedShops.find(rendered => rendered.path === path)?.details,
            ...(collection === 'laptop-friendly' ? laptopNotes[shop.address.slug] : undefined),
          }];
        }),
      };
    },
  });

  const totalPages = Math.max(1, catalog.data?.totalPages ?? 1);
  const pageNotFound = !validPage || (catalog.data && page > totalPages);
  const related = Object.values(minsk.collections).filter(other => other.path !== section.path);
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8 text-stone-900 sm:px-8 sm:py-12 dark:text-white">
      <a href={topic ? minsk.path : '/shops'} className={navLinkClass}>{topic ? minsk.heading : 'Все кофейни'}</a>
      <h1 className="mt-3 max-w-4xl font-extended text-4xl font-black tracking-tight sm:text-5xl">{section.heading}</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-600 dark:text-stone-300">{section.description}</p>
      {topic && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-stone-300">{topic.guide}</p>}
      <nav aria-label="Подборки кофеен Минска" className="mt-4 flex flex-wrap gap-x-5">
        {related.map(other => <a key={other.path} href={other.path} className={navLinkClass}>{other.heading}</a>)}
      </nav>

      {pageNotFound ? (
        <p className="mt-6">Страница не найдена. <a href={section.path} className={navLinkClass}>Вернуться к списку кофеен</a></p>
      ) : catalog.isPending ? (
        <div role="status" className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <span className="sr-only">Загружаем кофейни Минска</span>
          <ShopCardSkeleton count={3} />
        </div>
      ) : catalog.isError && !catalog.data ? (
        <div role="alert" className="mt-6">
          <p>Не удалось загрузить кофейни.</p>
          <button type="button" className={navLinkClass} onClick={() => void catalog.refetch()}>Повторить</button>
        </div>
      ) : catalog.data?.shops.length ? (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.data.shops.map(shop => (
            <li key={shop.path} className="flex min-w-0 flex-col overflow-hidden rounded-[28px] border border-stone-200 bg-white focus-within:ring-2 focus-within:ring-primary dark:border-[#3D2F28] dark:bg-[#2D241F]">
              <a href={shop.path} className="group block flex-1 focus-visible:outline-none">
                <div className="aspect-video overflow-hidden">
                  {shop.photo
                    ? <img src={shop.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <ShopPhotoPlaceholder />}
                </div>
                <div className="p-4">
                  <h2 className="break-words text-xl font-extrabold group-hover:underline">{shop.name}</h2>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{shop.address || 'Адрес уточняется'}</p>
                  {!!shop.details?.length && (
                    <ul className="mt-2 space-y-1 text-sm text-stone-700 dark:text-stone-200">
                      {shop.details.map(detail => <li key={detail}>{detail}</li>)}
                    </ul>
                  )}
                  {!!shop.tags?.length && (
                    <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{shop.tags.join(' · ')}</p>
                  )}
                  {Boolean(shop.checkInCount) && typeof shop.rating === 'number' && (
                    <p className="mt-2 text-sm font-semibold" aria-label={`Оценка ${shop.rating} из 5`}>
                      <span className="text-amber-700 dark:text-primary" aria-hidden="true">★</span> {shop.rating.toLocaleString('ru-BY')}
                    </p>
                  )}
                </div>
              </a>
              {shop.source && <a href={shop.source.url} className={`${navLinkClass} mx-4 self-start text-sm`}>{shop.source.label}</a>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6">{topic ? 'В этой подборке пока нет кофеен.' : 'В каталоге пока нет кофеен Минска.'}</p>
      )}

      {!pageNotFound && totalPages > 1 && (
        <nav aria-label="Страницы каталога" className="mt-6 flex flex-wrap items-center justify-center gap-x-5">
          {page > 1 && <a href={catalogLink(section.path, page - 1)} className={navLinkClass}>Назад</a>}
          <span>Страница {page} из {totalPages}</span>
          {page < totalPages && <a href={catalogLink(section.path, page + 1)} className={navLinkClass}>Далее</a>}
        </nav>
      )}
    </main>
  );
}
