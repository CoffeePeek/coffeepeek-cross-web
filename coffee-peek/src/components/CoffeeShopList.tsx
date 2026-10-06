import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutationState, useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowsOut, ArrowsIn } from '@phosphor-icons/react';
import { getRoasterCards, searchShops } from '../api/discovery';
import { applyCriteria, discoveryRoasters, isDiscoveryFiltering, normalizeQuery, readSearchState, validateSearch, writeSearchState, type ShopFilters } from '../utils/catalogSearch';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { getThemeColors } from '../constants/colors';
import { getCatalogScope } from '../lib/catalogSession';
import { useLocalCity } from '../hooks/useLocalCity';
import { useCities } from '../hooks/queries/useCatalogs';
import { useFavorites } from '../hooks/useFavorites';
import { useLoadMoreOnScroll } from '../hooks/useLoadMoreOnScroll';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import ShopSearchBar from './ShopSearchBar';
import ShopCatalogFilters from './ShopCatalogFilters';
import { RoasterCatalogCard, ShopCatalogCard } from './CatalogCards';
import { activeFilterCount, FilterChips } from './CatalogFilters';
import { ShopCardSkeleton } from './skeletons';
import { AppIcon } from './icons';
import Mascot from './Mascot';
import WobbleRing from './WobbleRing';

const MapPage = lazyWithRetry(() => import('./MapPage'));
type Section = 'all' | 'shops' | 'roasters';

export default function CoffeeShopList({ initialSection = 'all', initialMapExpanded = false }: {
  initialSection?: Section; initialMapExpanded?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { cityId } = useLocalCity();
  const usesDefaultCity = !params.has('filters') && !params.has('citySlug') && !params.has('city');
  const cities = useCities(!cityId);
  const defaultCity = cityId || cities.data?.[0]?.id || '';
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { user, isLoading: authLoading } = useUser();
  const favorites = useFavorites();
  const scope = getCatalogScope();
  const parsed = useMemo(() => {
    try {
      const restored = new URLSearchParams(params);
      if (restored.get('page') === 'map') restored.delete('page');
      if (usesDefaultCity && defaultCity) restored.set('city', defaultCity);
      return { state: readSearchState(restored, 'shops'), error: '' };
    } catch {
      return { state: readSearchState(new URLSearchParams(), 'shops'), error: 'Фильтры в адресе повреждены. Сбросьте их и повторите поиск.' };
    }
  }, [params, defaultCity, usesDefaultCity]);
  const state = parsed.state;
  const filters = state.filters as ShopFilters;
  const sectionParam = params.get('section');
  const section: Section = sectionParam === 'shops' || sectionParam === 'roasters' || sectionParam === 'all' ? sectionParam : initialSection;
  const [input, setInput] = useState(state.q);
  const [showFilters, setShowFilters] = useState(false);
  const [desktop, setDesktop] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches);
  const [mapExpanded, setMapExpanded] = useState(initialMapExpanded);
  const dialog = useRef<HTMLDialogElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const closeMap = () => {
    setMapExpanded(false);
    requestAnimationFrame(() => Array.from(toolbar.current?.querySelectorAll<HTMLInputElement>('input[type="search"]') ?? []).find(input => input.offsetParent)?.focus());
  };
  const [columns, setColumns] = useState(1);
  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    const measure = () => setColumns(Math.max(1, Math.floor((element.clientWidth + 16) / (360 + 16))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const filtering = section !== 'all' || isDiscoveryFiltering(input, filters, defaultCity);
  const mapHidden = (filtering || showFilters) && !mapExpanded;
  const overview = !filtering;
  const update = (next: typeof state, nextSection = section) => {
    const nextParams = writeSearchState(next, 'shops');
    if (nextSection !== 'all' || initialSection !== 'all') nextParams.set('section', nextSection);
    setParams(nextParams);
  };
  useEffect(() => { setInput(state.q); }, [state.q]);
  useEffect(() => { setMapExpanded(initialMapExpanded); }, [initialMapExpanded]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const sync = () => setDesktop(media.matches);
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    if (showFilters && !desktop) dialog.current?.showModal();
    else dialog.current?.close();
  }, [showFilters, desktop]);
  useEffect(() => {
    if (normalizeQuery(input) === state.q) return;
    const timer = setTimeout(() => update(applyCriteria(state, { q: normalizeQuery(input), sort: filters.origin ? 'distance_asc' : input.trim() ? 'relevance' : 'name_asc' })), 300);
    return () => clearTimeout(timer);
  }, [input, state, section]);
  useEffect(() => {
    if (!mapExpanded) return;
    expandButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMap();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [mapExpanded]);
  const personal = filters.favoritesOnly || filters.visitedOnly;
  const errors = validateSearch(state, 'shops');
  const enabled = !authLoading && (!usesDefaultCity || !!defaultCity || !cities.isPending) && !parsed.error && !Object.keys(errors).length && (!personal || !!user);
  const query = useInfiniteQuery({
    queryKey: ['catalog', scope, 'shops', state.q, state.filters, state.sort, state.page],
    initialPageParam: state.page,
    queryFn: ({ signal, pageParam }) => searchShops({ q: state.q, filters, sort: state.sort, page: pageParam, pageSize: 12 }, signal),
    getNextPageParam: page => page.currentPage < page.totalPages ? page.currentPage + 1 : undefined,
    enabled: enabled && section !== 'roasters', retry: false, staleTime: 0,
  });
  const roasters = useQuery({
    queryKey: ['catalog', scope, 'roasters', 'all'], queryFn: ({ signal }) => getRoasterCards(signal),
    enabled: enabled && section !== 'shops', retry: false,
  });
  const localRoasters = enabled ? discoveryRoasters(roasters.data ?? [], state, slug => favorites.isFavorite('roaster', slug) === true) : [];
  const pending = useMutationState({ filters: { mutationKey: ['favorite-change', scope], status: 'pending' }, select: mutation => mutation.state.variables as { kind: string; address: { slug: string }; favorite: boolean } });
  const removed = pending.filter(change => !change.favorite && change.kind === 'coffee_shop' && favorites.isFavorite('coffee_shop', change.address.slug, true) === false);
  const shops = enabled ? [...new Map((query.data?.pages.flatMap(page => page.items) ?? []).filter(shop => !filters.favoritesOnly || !removed.some(change => change.address.slug === shop.address.slug)).map(shop => [shop.address.slug, shop])).values()] : [];
  const total = Math.max(0, (query.data?.pages[0]?.totalItems ?? 0) - (filters.favoritesOnly ? removed.length : 0));
  const loadMoreRef = useLoadMoreOnScroll((desktop || !overview) && !mapExpanded && section !== 'roasters' && enabled && !!query.hasNextPage && !query.isFetching && !query.isError, () => { void query.fetchNextPage(); });
  const loadMoreShops = (event: React.UIEvent<HTMLDivElement>) => {
    const row = event.currentTarget;
    if (!desktop && overview && query.hasNextPage && !query.isFetching && !query.isError && row.scrollLeft + row.clientWidth >= row.scrollWidth - 200) void query.fetchNextPage();
  };
  const apply = (nextFilters: Record<string, unknown>) => {
    const next = applyCriteria(state, { filters: nextFilters, sort: nextFilters.origin ? 'distance_asc' : state.q ? 'relevance' : 'name_asc' });
    update(next);
    setMapExpanded(false);
    if (!user && (nextFilters.favoritesOnly || nextFilters.visitedOnly)) navigate('/login', { state: { from: { ...location, search: `?${writeSearchState(next, 'shops')}` } } });
  };
  const reset = () => { setInput(''); update(applyCriteria(state, { filters: defaultCity ? { city: defaultCity } : {}, q: '', sort: 'name_asc' }), 'all'); };
  const closeFilters = () => { dialog.current?.close(); setShowFilters(false); };
  const panel = { filters, onApply: apply, resultCount: (section === 'roasters' ? 0 : total) + (section === 'shops' ? 0 : localRoasters.length) };
  const showSection = (nextSection: Section) => update(applyCriteria(state, {}), nextSection);
  const allLoaded = (section === 'roasters' || query.isSuccess) && (section === 'shops' || roasters.isSuccess);
  const empty = <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border px-6 py-12 text-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
    <Mascot pose="search" size={132} /><p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>Ничего не найдено. Попробуйте другой фильтр.</p>
  </div>;
  const sectionHeading = (title: string, count: number, nextSection: Section) => <div className="mb-4 flex items-center justify-between gap-3">
    <h2 className="text-2xl font-bold tracking-tight">{title} <span className="ml-1 text-sm font-medium" style={{ color: colors.textSecondary }}>{count || ''}</span></h2>
    {overview && <button type="button" onClick={() => showSection(nextSection)} className="flex min-h-11 shrink-0 items-center gap-2 rounded-full px-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Показать все <AppIcon name="arrow_forward" size={18} /></button>}
  </div>;
  return <>
    <main className={`discovery-layout ${overview ? 'discovery-layout--overview' : ''} ${mapExpanded ? 'discovery-layout--expanded' : showFilters && desktop ? 'discovery-layout--filters' : mapHidden ? 'discovery-layout--search' : ''}`} style={{ color: colors.textPrimary }}>
      <div ref={toolbar} className="discovery-toolbar" inert={mapExpanded} aria-hidden={mapExpanded || undefined}>
        <h1 className="sr-only">Поиск кофеен и обжарщиков</h1>
        <ShopSearchBar className="mb-2" desktopFilters searchQuery={input} onSearchChange={value => { setInput(value); setMapExpanded(false); }} showFilters={showFilters} onFilterToggle={() => { setShowFilters(value => !value); setMapExpanded(false); }} activeFilterCount={activeFilterCount({ ...filters, city: undefined })} colors={colors} dark={theme === 'dark'} placeholder="Поиск кофеен и обжарщиков" ariaLabel="Поиск кофеен и обжарщиков" />
        <ShopCatalogFilters mode="chips" {...panel} />
        <div className={`flex items-center justify-end gap-2 ${!filtering && !showFilters ? 'hidden' : ''}`}>
          {(filtering || showFilters) && <button type="button" onClick={() => { reset(); closeFilters(); }} className="min-h-11 rounded-full px-3 text-sm underline focus-visible:ring-2 focus-visible:ring-primary">Отменить</button>}
          <button type="button" onClick={() => { window.scrollTo({ top: 0 }); setMapExpanded(true); }} className="flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden" style={{ borderColor: colors.border }}><AppIcon name="map" size={18} />Карта</button>
        </div>
        {(filters.menu || filters.minRating !== undefined) && <FilterChips filters={{ menu: filters.menu, minRating: filters.minRating }} groups={[]} onChange={extra => apply({ ...filters, menu: undefined, minRating: undefined, ...extra })} />}
        {(parsed.error || Object.keys(errors).length > 0) && <div role="alert" className="mb-6"><p>{parsed.error || Object.values(errors).join(' ')}</p><button type="button" className="min-h-11 underline" onClick={reset}>Сбросить фильтры</button></div>}
        {personal && !user && !authLoading && <p>Войдите, чтобы использовать личные фильтры.</p>}
        {query.isError && (query.error as { status?: number }).status === 400 && <div role="alert" className="mb-6 rounded-2xl border border-red-300 bg-red-500/10 p-4 text-red-700 dark:text-red-300">
          <p>Проверьте фильтры. Удалите недоступное значение или сбросьте фильтры.</p><FilterChips filters={filters} groups={[]} onChange={apply} /><button type="button" className="min-h-11 underline" onClick={reset}>Сбросить фильтры</button>
        </div>}
      </div>
      <div ref={content} className="discovery-content" inert={mapExpanded} aria-hidden={mapExpanded || undefined}>
        <div className="discovery-results" aria-live="polite" aria-busy={query.isFetching || roasters.isFetching}>
          {section !== 'shops' && (localRoasters.length > 0 || roasters.isPending && enabled) && <section aria-label="Обжарщики" className="discovery-roasters">
            {sectionHeading('Обжарщики', localRoasters.length, 'roasters')}
            <div className="discovery-cards discovery-cards--roasters" role="group" aria-label="Карточки обжарщиков" tabIndex={overview && !desktop ? 0 : undefined}>{roasters.isPending && enabled ? <ShopCardSkeleton count={columns} /> : (overview && desktop ? localRoasters.slice(0, columns) : localRoasters).map((roaster, index) => <RoasterCatalogCard key={roaster.address.slug ?? index} roaster={roaster} />)}</div>
          </section>}
          {section !== 'roasters' && <section aria-label="Кофейни" className="discovery-shops">
            {sectionHeading('Кофейни', total, 'shops')}
            {query.isPending && enabled ? <div className="discovery-cards discovery-cards--shops"><ShopCardSkeleton count={columns * 2} /></div> : shops.length ? <div className="discovery-cards discovery-cards--shops" role="group" aria-label="Карточки кофеен" tabIndex={overview && !desktop ? 0 : undefined} onScroll={loadMoreShops}>{shops.map(shop => <ShopCatalogCard key={shop.address.slug} shop={shop} />)}{!desktop && overview && query.isFetchingNextPage && <ShopCardSkeleton count={1} />}</div> : query.isSuccess && enabled && localRoasters.length > 0 ? <p className="py-6 text-sm" style={{ color: colors.textSecondary }}>Кофейни по этим условиям не найдены.</p> : null}
          </section>}
          {allLoaded && enabled && (section === 'roasters' || !shops.length) && (section === 'shops' || !localRoasters.length) && empty}
        </div>
        <div ref={loadMoreRef} className="py-6">{(desktop || !overview) && query.isFetchingNextPage && <div className="discovery-cards discovery-cards--shops"><ShopCardSkeleton count={columns} /></div>}</div>
      </div>
      <section className={`discovery-map ${mapHidden ? 'discovery-map--hidden' : ''}`} aria-label="Карта кофеен" inert={mapHidden} aria-hidden={mapHidden || undefined}>
        <div className="discovery-map-frame" style={{ borderColor: colors.border }}>
          <Suspense fallback={<div className="flex h-full items-center justify-center"><WobbleRing size={48} /></div>}><MapPage fillContainer showSearch={false} compactPreview={!mapExpanded} /></Suspense>
          <div className="pointer-events-none absolute right-4 top-4 z-[600]">
            <button ref={expandButton} type="button" onClick={() => { if (mapExpanded) closeMap(); else { window.scrollTo({ top: 0 }); setMapExpanded(true); } }} aria-label={mapExpanded ? 'Свернуть карту' : 'Развернуть карту'} aria-expanded={mapExpanded} className="discovery-map-expand pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ background: colors.surface, borderColor: colors.border }}>{mapExpanded ? <ArrowsIn size={32} className="h-8 w-8 shrink-0" /> : <ArrowsOut size={32} className="h-8 w-8 shrink-0" />}</button>
          </div>
        </div>
      </section>
      {showFilters && desktop && !mapExpanded && <section aria-label="Фильтры поиска" className="discovery-filter-panel rounded-[28px] border p-4" style={{ background: colors.surface, borderColor: colors.border }}>
        <ShopCatalogFilters mode="sidebar" {...panel} onClose={closeFilters} />
      </section>}
    </main>
    <dialog ref={dialog} aria-label="Фильтры" onClose={() => { if (!desktop) setShowFilters(false); }} className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/50">
      <button type="button" aria-label="Закрыть фильтры" className="absolute inset-0" onClick={closeFilters} />
      <aside className="absolute inset-x-0 bottom-0 max-h-[min(86dvh,760px)] overflow-y-auto rounded-t-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" style={{ background: colors.surface, border: `1px solid ${colors.border}`, boxShadow: '0 -16px 48px rgba(0,0,0,.18)' }}>
        {showFilters && !desktop && <ShopCatalogFilters mode="sidebar" {...panel} onClose={closeFilters} />}
      </aside>
    </dialog>
  </>;
}
