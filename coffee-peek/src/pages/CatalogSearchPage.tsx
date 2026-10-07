import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useMutationState, useQuery } from '@tanstack/react-query';
import { getCoffeeFacets, getCoffeeFilterValues, getRoasterCards, searchCoffees, searchDiscovery, searchShops,
  type CoffeeCard, type RoasterCard, type ShopCard, type Page, type DiscoveryResult } from '../api/discovery';
import { applyCriteria, filterRoasters, readSearchState, transferDiscovery, validateSearch, writeSearchState, type CatalogKind, type CoffeeFilters, type DiscoveryFilters, type SearchState, type ShopFilters } from '../utils/catalogSearch';
import { getCatalogScope } from '../lib/catalogSession';
import { useUser } from '../contexts/UserContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useTheme } from '../contexts/ThemeContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { getThemeColors } from '../constants/colors';
import { CatalogFilters, FilterChips, activeFilterCount, catalogInput } from '../components/CatalogFilters';
import ShopCatalogFilters from '../components/ShopCatalogFilters';
import ShopSearchBar from '../components/ShopSearchBar';
import Mascot from '../components/Mascot';
import { CoffeeCatalogCard, RoasterCatalogCard, ShopCatalogCard, CatalogPagination, catalogButton, catalogPanel } from '../components/CatalogCards';
import { ShopCardSkeleton } from '../components/skeletons';
import { useFavorites } from '../hooks/useFavorites';
import { useLocalCity } from '../hooks/useLocalCity';
import { useLoadMoreOnScroll } from '../hooks/useLoadMoreOnScroll';

const titles = { discovery: 'Поиск кофеен и обжарщиков', shops: 'Кофейни', roasters: 'Обжарщики', coffees: 'Кофе' };
export default function CatalogSearchPage({ kind }: { kind: CatalogKind }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const favorites = useFavorites();
  const { cityId } = useLocalCity();
  const { user, isLoading: authLoading } = useUser();
  const { requireAuth } = useRequireAuth();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const scope = getCatalogScope();
  const pendingFavorites = useMutationState({ filters: { mutationKey: ['favorite-change', scope], status: 'pending' }, select: mutation => mutation.state.variables as { kind: string; address: { slug: string }; favorite: boolean } });
  const parsed = useMemo(() => {
    try {
      const restored = new URLSearchParams(params);
      if (kind === 'shops' && !params.has('filters') && !params.has('citySlug') && !params.has('city') && cityId) restored.set('city', cityId);
      return { state: readSearchState(restored, kind), error: '' };
    }
    catch { return { state: readSearchState(new URLSearchParams(), kind), error: 'Фильтры в адресе повреждены. Сбросьте их и повторите поиск.' }; }
  }, [params, kind, cityId]);
  const state = parsed.state;
  const [input, setInput] = useState(state.q);
  const dialog = useRef<HTMLDialogElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  usePageTitle(titles[kind]);
  useEffect(() => { setInput(state.q); }, [state.q]);
  const update = (next: SearchState, replace = false) => setParams(writeSearchState(next, kind), { replace });
  useEffect(() => { if (kind === 'shops' && cityId && !params.has('filters') && !params.has('city') && !params.has('citySlug')) update(state, true); }, [kind, cityId, params]);
  useEffect(() => {
    if (input === state.q) return;
    const timer = setTimeout(() => update(applyCriteria(state, { q: input.trim().replace(/\s+/g, ' '), sort: ['relevance', 'name_asc'].includes(state.sort) ? (input.trim() ? 'relevance' : 'name_asc') : state.sort })), 300);
    return () => clearTimeout(timer);
  }, [input, state, kind]);
  useEffect(() => {
    const listener = (event: Event) => {
      const change = (event as CustomEvent).detail;
      if (change.scope === scope && !change.favorite && state.filters.favoritesOnly && ((kind === 'shops' && change.kind === 'coffee_shop') || (kind === 'roasters' && change.kind === 'roaster'))) update({ ...state, page: 1 }, true);
    };
    window.addEventListener('coffeepeek:favorite-changed', listener);
    return () => window.removeEventListener('coffeepeek:favorite-changed', listener);
  }, [scope, state, kind]);
  const localErrors = validateSearch(state, kind);
  const personal = state.filters.favoritesOnly === true || state.filters.visitedOnly === true;
  const enabled = !parsed.error && !Object.keys(localErrors).length && !authLoading && (!personal || !!user);
  const scroll = kind === 'roasters' || kind === 'coffees';
  const request = { q: state.q, filters: state.filters, sort: state.sort, page: scroll ? 1 : state.page, pageSize: 20 };
  const discoveryRequest = { q: state.q, filters: state.filters as DiscoveryFilters, sort: state.sort as 'relevance' | 'name_asc', sections: ['coffee_shops'] as ('coffee_shops' | 'roasters')[], coffeeShops: { page: state.coffeeShopsPage, pageSize: 10 }, roasters: { page: 1, pageSize: 10 } };
  const query = useInfiniteQuery<Page<CoffeeCard | RoasterCard | ShopCard> | DiscoveryResult>({
    queryKey: ['catalog', scope, kind, 'pages', kind === 'discovery' ? discoveryRequest : request],
    initialPageParam: request.page,
    getNextPageParam: page => kind === 'coffees' && 'items' in page && page.currentPage < page.totalPages ? page.currentPage + 1 : undefined,
    queryFn: ({ signal, pageParam }) => kind === 'discovery' ? searchDiscovery(discoveryRequest, signal) : kind === 'coffees' ? searchCoffees({ ...request, page: Number(pageParam), filters: state.filters as CoffeeFilters }, signal)
      : searchShops({ ...request, filters: state.filters as ShopFilters }, signal),
    enabled: enabled && kind !== 'roasters', retry: false, staleTime: 0,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === scope && previousQuery.queryKey[2] === kind ? previous : undefined,
  });
  const roasters = useQuery({
    queryKey: ['catalog', scope, 'roasters', 'all'], queryFn: ({ signal }) => getRoasterCards(signal),
    enabled: enabled && (kind === 'roasters' || kind === 'discovery'), retry: false,
  });
  const resultsQuery = kind === 'roasters' ? roasters : query;
  const localRoasters = filterRoasters(roasters.data ?? [], kind === 'roasters' ? state : { ...state, filters: {} }, slug => favorites.isFavorite('roaster', slug) === true);
  const facets = useQuery({
    queryKey: ['catalog', scope, kind, 'facets', { q: state.q, filters: state.filters }],
    queryFn: ({ signal }) => getCoffeeFacets({ q: state.q, filters: state.filters as CoffeeFilters }, signal),
    enabled: enabled && kind === 'coffees', retry: false, staleTime: 0,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === scope && previousQuery.queryKey[2] === kind ? previous : undefined,
  });
  const dictionary = useQuery({ queryKey: ['catalogs', 'coffee-filter-values'], queryFn: ({ signal }) => getCoffeeFilterValues(signal), enabled: kind === 'coffees', retry: false });
  const groups = facets.data?.groups ?? [];
  const errors = { ...localErrors, ...Object.fromEntries(Object.entries((resultsQuery.error as { errors?: Record<string, string[]> } | null)?.errors ?? {}).map(([key, value]) => [key, value.join(' ')])) };
  const apply = (filters: Record<string, unknown>) => {
    const next = applyCriteria(state, { filters });
    update(next);
    if (kind !== 'roasters' && kind !== 'coffees') { dialog.current?.close(); setMobileOpen(false); }
    if (!user && (filters.favoritesOnly || filters.visitedOnly)) navigate('/login', { state: { from: { ...location, search: `?${writeSearchState(next, kind)}` } } });
  };
  const filterForm = () => kind === 'shops' ? <ShopCatalogFilters filters={state.filters as ShopFilters} onApply={apply} /> : <CatalogFilters kind={kind} filters={state.filters} groups={groups} errors={errors} onApply={apply} />;
  const reset = () => update(applyCriteria(state, { filters: kind === 'coffees' ? { availableOnly: true } : {}, q: '', sort: 'name_asc' }));
  const cards = (items: (CoffeeCard | RoasterCard | ShopCard)[], section: CatalogKind) => <div className="grid grid-cols-1 gap-4 md:grid-cols-2 min-[1180px]:grid-cols-3">{items.map((item, index) => section === 'coffees' ? <CoffeeCatalogCard key={item.address.slug} coffee={item as CoffeeCard} groups={dictionary.data ?? []} />
    : section === 'roasters' ? <RoasterCatalogCard key={item.address.slug ?? index} roaster={item as RoasterCard} /> : <ShopCatalogCard key={item.address.slug} shop={item as ShopCard} />)}</div>;
  const result = query.data?.pages[0];
  const rawPage = kind === 'roasters' ? roasters.data ? { items: localRoasters, totalItems: localRoasters.length, totalPages: 1, currentPage: 1, pageSize: localRoasters.length } : undefined
    : result && 'items' in result ? scroll ? { ...result, items: [...new Map(query.data!.pages.flatMap(page => 'items' in page ? page.items : []).map(item => [item.address.slug, item])).values()] } : result : undefined;
  const hidden = pendingFavorites.filter(change => kind === 'shops' && !change.favorite && change.kind === 'coffee_shop' && favorites.isFavorite('coffee_shop', change.address.slug, true) === false);
  const page = rawPage && state.filters.favoritesOnly && hidden.length ? { ...rawPage, items: rawPage.items.filter(item => !hidden.some(change => change.address.slug === item.address.slug)), totalItems: Math.max(0, rawPage.totalItems - hidden.length) } : rawPage;
  const discovery = kind === 'discovery' ? { coffeeShops: result && 'coffeeShops' in result ? result.coffeeShops : null, roasters: roasters.data ? {
    items: localRoasters.slice((state.roastersPage - 1) * 10, state.roastersPage * 10), totalItems: localRoasters.length,
    totalPages: Math.ceil(localRoasters.length / 10), currentPage: state.roastersPage, pageSize: 10,
  } : null } : undefined;
  const loadMoreRef = useLoadMoreOnScroll(kind === 'coffees' && enabled && !!query.hasNextPage && !query.isFetching && !query.isError, () => { void query.fetchNextPage(); });
  return <main className={`mx-auto max-w-[1680px] px-4 pb-28 sm:px-6 lg:px-8 ${kind === 'roasters' ? 'pt-4' : ''} ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
    <h1 className={kind === 'coffees' || kind === 'roasters' ? 'sr-only' : 'mb-5 pt-6 text-3xl font-bold'}>{titles[kind]}</h1>
    {kind === 'coffees' ? <ShopSearchBar className="mb-5" searchQuery={input} onSearchChange={setInput} placeholder="Название кофе или обжарщика" ariaLabel="Поиск кофе" colors={colors} dark={theme === 'dark'} showFilters={mobileOpen} activeFilterCount={activeFilterCount(state.filters)} onFilterToggle={() => { setMobileOpen(true); dialog.current?.showModal(); }} />
      : <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm">{kind === 'roasters' ? 'Поиск обжарщика' : 'Поиск'}<input type="search" className={catalogInput} value={input} maxLength={100} onChange={event => setInput(event.target.value)} /></label>
        {kind !== 'roasters' && <button type="button" className={`${catalogButton} lg:hidden`} onClick={() => { setMobileOpen(true); dialog.current?.showModal(); }}>Фильтры ({activeFilterCount(state.filters)})</button>}
        {kind === 'roasters' && Object.keys(state.filters).length > 0 && <button type="button" className={catalogButton} onClick={reset}>Сбросить фильтры</button>}
      </div>}
    {(kind === 'discovery' || kind === 'shops') && <FilterChips filters={state.filters} groups={groups} onChange={filters => update(applyCriteria(state, { filters }))} />}
    <div className="flex items-start gap-6">{kind !== 'roasters' && <aside className={`${kind === 'discovery' ? catalogPanel : ''} hidden w-72 shrink-0 lg:block`}>{filterForm()}</aside>}<div className="min-w-0 flex-1 space-y-5">
      {parsed.error && <p role="alert">{parsed.error} <button className={catalogButton} onClick={reset}>Сбросить</button></p>}
      {!!Object.keys(errors).length && <div role="alert" className="space-y-2 text-red-700 dark:text-red-300">{Object.entries(errors).map(([key, value]) => <p key={key}>{key}: {value}</p>)}</div>}
      {!user && personal && <div className={catalogPanel}><p>Войдите, чтобы использовать личные фильтры.</p><button className={catalogButton} onClick={requireAuth}>Войти</button></div>}
      {resultsQuery.isError && (resultsQuery.error as { status?: number })?.status === 400 && <div role="alert" className={catalogPanel}><p>Проверьте фильтры. Сохранённое значение могло быть деактивировано; удалите его явно.</p><button className={catalogButton} onClick={reset}>Сбросить фильтры</button></div>}
      {!scroll && resultsQuery.isFetching && resultsQuery.data && <p role="status">{query.isFetchingNextPage ? 'Загрузка результатов…' : 'Обновление результатов…'}</p>}
      {kind === 'coffees' && facets.data?.priceRange && <p className="text-sm">Диапазон цен для {facets.data.priceRange.weightGrams} г: {facets.data.priceRange.min}–{facets.data.priceRange.max} {facets.data.priceRange.currency}</p>}
      {(resultsQuery.isPending || (kind === 'discovery' && roasters.isPending)) && enabled && <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><ShopCardSkeleton count={4} /></div>}
      {page && <>{!scroll && <p aria-live="polite">Результатов: {page.totalItems}</p>}{page.items.length ? cards(page.items, kind) : <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border px-6 py-16 text-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <Mascot pose="search" size={132} /><p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>Ничего не найдено. Попробуйте другой фильтр.</p>
      </div>}{scroll ? <div ref={loadMoreRef} className="h-1" aria-hidden="true" /> : <CatalogPagination label={titles[kind]} page={state.page} totalPages={page.totalPages} onChange={page => update({ ...state, page })} />}</>}
      {discovery && (['shops', 'roasters'] as const).map(section => {
        const result = section === 'shops' ? discovery.coffeeShops : discovery.roasters;
        if (!result) return null;
        return <section key={section} className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-bold">{titles[section]} ({result.totalItems})</h2><Link className={catalogButton} to={`/${section}?${writeSearchState(transferDiscovery(state, section), section)}`}>Показать все</Link></div>
          {result.items.length ? cards(result.items, section) : <p>В этой секции ничего не найдено.</p>}
          <CatalogPagination label={titles[section]} page={section === 'shops' ? state.coffeeShopsPage : state.roastersPage} totalPages={result.totalPages} onChange={page => update({ ...state, [section === 'shops' ? 'coffeeShopsPage' : 'roastersPage']: page })} />
        </section>;
      })}
    </div></div>
    {kind !== 'roasters' && <dialog ref={dialog} onClose={() => setMobileOpen(false)} className={`max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg rounded-2xl p-5 backdrop:bg-black/60 ${theme === 'dark' ? 'bg-[#2D241F] text-white' : 'bg-white text-stone-900'}`}>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">Фильтры</h2><button type="button" className={catalogButton} onClick={() => dialog.current?.close()} aria-label="Закрыть фильтры">×</button></div>{(mobileOpen || kind === 'coffees') && filterForm()}
    </dialog>}
  </main>;
}
