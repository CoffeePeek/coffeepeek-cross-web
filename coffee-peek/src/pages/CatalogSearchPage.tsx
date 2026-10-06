import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutationState, useQuery } from '@tanstack/react-query';
import { getCoffeeFacets, getCoffeeFilterValues, getRoasterFacets, getRoasterTags, searchCoffees, searchDiscovery, searchRoasters, searchShops,
  type CoffeeCard, type RoasterCard, type ShopCard, type Page, type DiscoveryResult } from '../api/discovery';
import { applyCriteria, canSortByPrice, readSearchState, transferDiscovery, validateSearch, writeSearchState, type CatalogKind, type CoffeeFilters, type DiscoveryFilters, type RoasterFilters, type SearchState, type ShopFilters } from '../utils/catalogSearch';
import { getCatalogScope } from '../lib/catalogSession';
import { useUser } from '../contexts/UserContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useTheme } from '../contexts/ThemeContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { CatalogFilters, FilterChips, activeFilterCount, catalogInput } from '../components/CatalogFilters';
import ShopCatalogFilters from '../components/ShopCatalogFilters';
import { CoffeeCatalogCard, RoasterCatalogCard, ShopCatalogCard, CatalogPagination, catalogButton, catalogPanel } from '../components/CatalogCards';
import { ShopCardSkeleton } from '../components/skeletons';
import { useFavorites } from '../hooks/useFavorites';
import { useLocalCity } from '../hooks/useLocalCity';

const titles = { discovery: 'Поиск кофеен и обжарщиков', shops: 'Кофейни', roasters: 'Обжарщики', coffees: 'Кофе' };
const sortLabels: Record<string, string> = { relevance: 'По релевантности', name_asc: 'По названию', distance_asc: 'По расстоянию', rating_desc: 'По рейтингу', available_coffees_desc: 'По доступному ассортименту', price_asc: 'Цена по возрастанию', price_desc: 'Цена по убыванию', newest: 'Новые товары' };
export default function CatalogSearchPage({ kind }: { kind: CatalogKind }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const favorites = useFavorites();
  const { cityId } = useLocalCity();
  const { user, isLoading: authLoading } = useUser();
  const { requireAuth } = useRequireAuth();
  const { theme } = useTheme();
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
  const request = { q: state.q, filters: state.filters, sort: state.sort, page: state.page, pageSize: 20 };
  const discoveryRequest = { q: state.q, filters: state.filters as DiscoveryFilters, sort: state.sort as 'relevance' | 'name_asc', sections: ['coffee_shops', 'roasters'] as ('coffee_shops' | 'roasters')[], coffeeShops: { page: state.coffeeShopsPage, pageSize: 10 }, roasters: { page: state.roastersPage, pageSize: 10 } };
  const query = useQuery<Page<CoffeeCard | RoasterCard | ShopCard> | DiscoveryResult>({
    queryKey: ['catalog', scope, kind, kind === 'discovery' ? discoveryRequest : request],
    queryFn: ({ signal }) => kind === 'discovery' ? searchDiscovery(discoveryRequest, signal) : kind === 'coffees' ? searchCoffees({ ...request, filters: state.filters as CoffeeFilters }, signal)
      : kind === 'roasters' ? searchRoasters({ ...request, filters: state.filters as RoasterFilters }, signal) : searchShops({ ...request, filters: state.filters as ShopFilters }, signal),
    enabled, retry: false, staleTime: 0,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === scope && previousQuery.queryKey[2] === kind ? previous : undefined,
  });
  const facets = useQuery({
    queryKey: ['catalog', scope, kind, 'facets', { q: state.q, filters: state.filters }],
    queryFn: ({ signal }) => kind === 'coffees' ? getCoffeeFacets({ q: state.q, filters: state.filters as CoffeeFilters }, signal) : getRoasterFacets({ q: state.q, filters: state.filters as RoasterFilters }, signal),
    enabled: enabled && ['coffees', 'roasters'].includes(kind), retry: false, staleTime: 0,
  });
  const dictionary = useQuery({ queryKey: ['catalogs', 'coffee-filter-values'], queryFn: ({ signal }) => getCoffeeFilterValues(signal), enabled: kind !== 'shops', retry: false });
  const tags = useQuery({ queryKey: ['catalogs', 'roaster-tags'], queryFn: ({ signal }) => getRoasterTags(signal), enabled: kind === 'roasters', retry: false });
  const groups = facets.data?.groups ?? [];
  const errors = { ...localErrors, ...Object.fromEntries(Object.entries((query.error as { errors?: Record<string, string[]> } | null)?.errors ?? {}).map(([key, value]) => [key, value.join(' ')])) };
  const apply = (filters: Record<string, unknown>) => {
    const next = applyCriteria(state, { filters });
    update(next);
    dialog.current?.close(); setMobileOpen(false);
    if (!user && (filters.favoritesOnly || filters.visitedOnly)) navigate('/login', { state: { from: { ...location, search: `?${writeSearchState(next, kind)}` } } });
  };
  const filterForm = () => kind === 'shops' ? <ShopCatalogFilters filters={state.filters as ShopFilters} onApply={apply} /> : <CatalogFilters kind={kind} filters={state.filters} groups={groups} tags={tags.data} errors={errors} onApply={apply} />;
  const reset = () => update(applyCriteria(state, { filters: kind === 'coffees' ? { availableOnly: true } : {}, q: '', sort: 'name_asc' }));
  const availableSorts = kind === 'discovery' ? ['name_asc', 'relevance'] : kind === 'shops' ? ['name_asc', 'relevance', 'distance_asc', 'rating_desc'] : kind === 'roasters' ? ['name_asc', 'relevance', 'available_coffees_desc'] : ['name_asc', 'relevance', 'price_asc', 'price_desc', 'newest'];
  const cards = (items: (CoffeeCard | RoasterCard | ShopCard)[], section: CatalogKind) => <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(item => section === 'coffees' ? <CoffeeCatalogCard key={item.address.slug} coffee={item as CoffeeCard} groups={dictionary.data ?? []} />
    : section === 'roasters' ? <RoasterCatalogCard key={item.address.slug} roaster={item as RoasterCard} groups={dictionary.data ?? []} /> : <ShopCatalogCard key={item.address.slug} shop={item as ShopCard} />)}</div>;
  const rawPage = query.data && 'items' in query.data ? query.data : undefined;
  const hidden = pendingFavorites.filter(change => !change.favorite && change.kind === (kind === 'shops' ? 'coffee_shop' : 'roaster') && favorites.isFavorite(change.kind as 'coffee_shop' | 'roaster', change.address.slug, true) === false);
  const page = rawPage && state.filters.favoritesOnly && hidden.length ? { ...rawPage, items: rawPage.items.filter(item => !hidden.some(change => change.address.slug === item.address.slug)), totalItems: Math.max(0, rawPage.totalItems - hidden.length) } : rawPage;
  const discovery = query.data && 'coffeeShops' in query.data ? query.data : undefined;
  return <main className={`mx-auto max-w-[1600px] px-4 py-6 pb-28 sm:px-6 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
    <nav className="mb-5 flex flex-wrap gap-2" aria-label="Каталоги">{[['/search', 'Общий поиск'], ['/shops', 'Кофейни'], ['/roasters', 'Обжарщики'], ['/coffees', 'Кофе']].map(([path, name]) => <Link key={path} className={catalogButton} to={path}>{name}</Link>)}{kind === 'shops' && <Link className={catalogButton} to="/dashboard?page=map">Карта</Link>}</nav>
    <h1 className="mb-5 text-3xl font-bold">{titles[kind]}</h1>
    <div className="mb-4 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1">Поиск<input type="search" className={catalogInput} value={input} maxLength={100} onChange={event => setInput(event.target.value)} /></label>
      <button type="button" className={`${catalogButton} lg:hidden`} onClick={() => { setMobileOpen(true); dialog.current?.showModal(); }}>Фильтры ({activeFilterCount(state.filters)})</button>
      <label>Сортировка<select className={catalogInput} value={state.sort} onChange={event => update(applyCriteria(state, { sort: event.target.value }))}>{availableSorts.map(sort => <option key={sort} value={sort} disabled={sort === 'relevance' && !state.q || sort.startsWith('price_') && !canSortByPrice(state.filters as CoffeeFilters) || sort === 'distance_asc' && !state.filters.origin}>{sortLabels[sort]}</option>)}</select></label>
    </div>
    {kind === 'coffees' && !canSortByPrice(state.filters as CoffeeFilters) && <p className="text-sm">Для сортировки по цене выберите валюту и вес пачки.</p>}
    <FilterChips filters={state.filters} groups={groups} onChange={filters => update(applyCriteria(state, { filters }))} />
    <div className="flex items-start gap-6"><aside className={`${catalogPanel} hidden w-72 shrink-0 lg:block`}>{filterForm()}</aside><div className="min-w-0 flex-1 space-y-5">
      {parsed.error && <p role="alert">{parsed.error} <button className={catalogButton} onClick={reset}>Сбросить</button></p>}
      {!!Object.keys(errors).length && <div role="alert" className="space-y-2 text-red-700 dark:text-red-300">{Object.entries(errors).map(([key, value]) => <p key={key}>{key}: {value}</p>)}</div>}
      {!user && personal && <div className={catalogPanel}><p>Войдите, чтобы использовать личные фильтры.</p><button className={catalogButton} onClick={requireAuth}>Войти</button></div>}
      {(query.isError || facets.isError || dictionary.isError || tags.isError) && <div role="alert" className={catalogPanel}><p>{(query.error as { status?: number })?.status === 400 ? 'Проверьте фильтры. Сохранённое значение могло быть деактивировано; удалите его явно.' : 'Каталог временно недоступен.'}</p><button className={catalogButton} onClick={() => { void query.refetch(); if (facets.isError) void facets.refetch(); if (dictionary.isError) void dictionary.refetch(); if (tags.isError) void tags.refetch(); }}>Повторить</button></div>}
      {query.isFetching && query.data && <p role="status">Обновление результатов…</p>}
      {kind === 'coffees' && facets.data?.priceRange && <p className="text-sm">Диапазон цен для {facets.data.priceRange.weightGrams} г: {facets.data.priceRange.min}–{facets.data.priceRange.max} {facets.data.priceRange.currency}</p>}
      {query.isPending && enabled && <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><ShopCardSkeleton count={4} /></div>}
      {page && <><p aria-live="polite">Результатов: {page.totalItems}</p>{page.items.length ? cards(page.items, kind) : <div className={catalogPanel}><p>Ничего не найдено.</p><button className={catalogButton} onClick={reset}>Сбросить фильтры</button></div>}<CatalogPagination label={titles[kind]} page={state.page} totalPages={page.totalPages} onChange={page => update({ ...state, page })} /></>}
      {discovery && (['shops', 'roasters'] as const).map(section => {
        const result = section === 'shops' ? discovery.coffeeShops : discovery.roasters;
        if (!result) return null;
        return <section key={section} className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-bold">{titles[section]} ({result.totalItems})</h2><Link className={catalogButton} to={`/${section}?${writeSearchState(transferDiscovery(state, section), section)}`}>Показать все</Link></div>
          {result.items.length ? cards(result.items, section) : <p>В этой секции ничего не найдено.</p>}
          <CatalogPagination label={titles[section]} page={section === 'shops' ? state.coffeeShopsPage : state.roastersPage} totalPages={result.totalPages} onChange={page => update({ ...state, [section === 'shops' ? 'coffeeShopsPage' : 'roastersPage']: page })} />
        </section>;
      })}
    </div></div>
    <dialog ref={dialog} onClose={() => setMobileOpen(false)} className={`max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg rounded-2xl p-5 backdrop:bg-black/60 ${theme === 'dark' ? 'bg-[#2D241F] text-white' : 'bg-white text-stone-900'}`}>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">Фильтры</h2><button type="button" className={catalogButton} onClick={() => dialog.current?.close()} aria-label="Закрыть фильтры">×</button></div>{mobileOpen && filterForm()}
    </dialog>
  </main>;
}
