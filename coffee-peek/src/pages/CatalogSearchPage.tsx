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
import { Sparkle } from '@phosphor-icons/react';
import { CatalogFilters, FilterChips, activeFilterCount, catalogInput } from '../components/CatalogFilters';
import ShopCatalogFilters from '../components/ShopCatalogFilters';
import { CoffeeCatalogCard, RoasterCatalogCard, ShopCatalogCard, CatalogPagination, catalogButton, catalogPanel } from '../components/CatalogCards';
import { ShopCardSkeleton } from '../components/skeletons';
import { useFavorites } from '../hooks/useFavorites';
import { useLocalCity } from '../hooks/useLocalCity';

const titles = { discovery: 'Поиск кофеен и обжарщиков', shops: 'Кофейни', roasters: 'Обжарщики', coffees: 'Кофе' };
const sortLabels: Record<string, string> = { relevance: 'По релевантности', name_asc: 'По названию', distance_asc: 'По расстоянию', rating_desc: 'По рейтингу', available_coffees_desc: 'По доступному ассортименту', price_asc: 'Цена по возрастанию', price_desc: 'Цена по убыванию', newest: 'Новые товары' };
function CoffeeCatalogHero({ filters, total, quickFilters, onChange, onOpen }: {
  filters: Record<string, unknown>; total?: number; quickFilters: { label: string; field: string; values: string[] | string }[];
  onChange: (filters: Record<string, unknown>) => void; onOpen: () => void;
}) {
  const countLabel = ({ one: 'товар', few: 'товара', many: 'товаров', other: 'товара' } as Record<string, string>)[new Intl.PluralRules('ru').select(total ?? 0)];
  return <section className="mb-10 rounded-3xl border border-stone-200 bg-gradient-to-br from-white to-stone-50 p-5 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.16)] sm:p-8 lg:p-9 dark:border-[#3D2F28] dark:from-[#2D241F] dark:to-[#241C17]">
    <div className="grid gap-5 sm:gap-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
      <div><h1 className="max-w-3xl text-[28px] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-[42px] xl:text-[46px]">Каталог specialty coffee<br className="hidden sm:block" /> с доставкой в Беларусь</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-stone-600 sm:mt-5 sm:text-lg dark:text-stone-300">Кофе для вашего способа заваривания — выбирайте по вкусовому профилю, обработке и обжарке, <strong className="font-semibold text-stone-950 dark:text-white">находите подходящий вариант покупки.</strong></p></div>
      <div className="self-start rounded-3xl border border-stone-200 bg-white/70 p-4 shadow-sm sm:p-5 dark:border-[#4A3D35] dark:bg-[#1A1412]/40">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600 dark:text-stone-300">{filters.availableOnly === false ? 'В каталоге сейчас' : 'В продаже сейчас'}</p>
        <p className="mt-2 flex items-baseline gap-2"><span className="text-[36px] font-bold leading-none tracking-tight sm:text-[44px]" aria-live="polite">{total?.toLocaleString() ?? '—'}</span><span className="text-xs text-stone-600 sm:text-sm dark:text-stone-300">{countLabel} по вашим условиям</span></p>
        <button type="button" onClick={onOpen} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 sm:mt-5 dark:bg-white dark:text-stone-950 dark:hover:bg-stone-200"><Sparkle size={18} weight="fill" aria-hidden="true" />Подобрать кофе</button>
      </div>
    </div>
    <div className="mt-6 flex flex-wrap gap-2 border-t border-stone-200 pt-4 dark:border-[#3D2F28]">{quickFilters.map(preset => {
      const current = filters[preset.field];
      const selected = Array.isArray(preset.values) ? Array.isArray(current) && preset.values.length === current.length && preset.values.every(value => current.includes(value)) : current === preset.values;
      return <button key={preset.label} type="button" aria-pressed={selected} onClick={() => onChange({ ...filters, [preset.field]: selected ? undefined : preset.values })} className={`min-h-10 rounded-full border px-3.5 py-2 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 sm:text-sm ${selected ? 'border-stone-950 bg-stone-950 text-white dark:border-white dark:bg-white dark:text-stone-950' : 'border-stone-200 bg-white text-stone-950 hover:bg-stone-100 dark:border-[#4A3D35] dark:bg-[#2D241F] dark:text-white dark:hover:bg-[#1A1412]'}`}>{preset.label}</button>;
    })}</div>
  </section>;
}
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
  const desktopFilters = useRef<HTMLElement>(null);
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
  const cards = (items: (CoffeeCard | RoasterCard | ShopCard)[], section: CatalogKind) => <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${section === 'coffees' ? 'min-[1180px]:grid-cols-3' : 'xl:grid-cols-3'}`}>{items.map(item => section === 'coffees' ? <CoffeeCatalogCard key={item.address.slug} coffee={item as CoffeeCard} groups={dictionary.data ?? []} />
    : section === 'roasters' ? <RoasterCatalogCard key={item.address.slug} roaster={item as RoasterCard} groups={dictionary.data ?? []} /> : <ShopCatalogCard key={item.address.slug} shop={item as ShopCard} />)}</div>;
  const rawPage = query.data && 'items' in query.data ? query.data : undefined;
  const hidden = pendingFavorites.filter(change => !change.favorite && change.kind === (kind === 'shops' ? 'coffee_shop' : 'roaster') && favorites.isFavorite(change.kind as 'coffee_shop' | 'roaster', change.address.slug, true) === false);
  const page = rawPage && state.filters.favoritesOnly && hidden.length ? { ...rawPage, items: rawPage.items.filter(item => !hidden.some(change => change.address.slug === item.address.slug)), totalItems: Math.max(0, rawPage.totalItems - hidden.length) } : rawPage;
  const discovery = query.data && 'coffeeShops' in query.data ? query.data : undefined;
  const openFilters = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) { desktopFilters.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); desktopFilters.current?.querySelector<HTMLElement>('summary, input')?.focus({ preventScroll: true }); }
    else { setMobileOpen(true); dialog.current?.showModal(); }
  };
  const quickFilters = [
    { label: 'Кофе в зерне', field: 'productForm', values: 'whole_beans' }, { label: 'Для эспрессо', field: 'brew', values: ['espresso'] },
    { label: 'Для фильтра', field: 'brew', values: ['filter'] }, { label: 'Декаф', field: 'caffeine', values: ['decaf'] },
    { label: 'Шоколадный профиль', field: 'taste', values: ['chocolate'] }, { label: 'Ягодные лоты', field: 'taste', values: ['berry'] },
    { label: 'Без яркой кислотности', field: 'acidity', values: ['low', 'balanced'] },
  ].filter(preset => typeof preset.values === 'string' || preset.values.every(value => dictionary.data?.find(group => group.code === preset.field)?.values.some(option => option.code === value)));
  return <main className={`mx-auto ${kind === 'coffees' ? 'max-w-[1320px] py-8' : 'max-w-[1600px] py-6'} px-4 pb-28 sm:px-6 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
    {kind === 'coffees' ? <CoffeeCatalogHero filters={state.filters} total={page?.totalItems} quickFilters={quickFilters} onChange={filters => update(applyCriteria(state, { filters }))} onOpen={openFilters} /> : <>
      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Каталоги">{[['/search', 'Общий поиск'], ['/shops', 'Кофейни'], ['/roasters', 'Обжарщики'], ['/coffees', 'Кофе']].map(([path, name]) => <Link key={path} className={catalogButton} to={path}>{name}</Link>)}{kind === 'shops' && <Link className={catalogButton} to="/dashboard?page=map">Карта</Link>}</nav>
      <h1 className="mb-5 text-3xl font-bold">{titles[kind]}</h1>
    </>}
    <div className={`mb-4 flex flex-wrap items-end gap-3 ${kind === 'coffees' ? 'lg:ml-[312px]' : ''}`}><label className="min-w-0 flex-1 text-sm">Поиск<input type="search" className={catalogInput} placeholder={kind === 'coffees' ? 'Название кофе или обжарщика' : undefined} value={input} maxLength={100} onChange={event => setInput(event.target.value)} /></label>
      <button type="button" className={`${catalogButton} lg:hidden`} onClick={() => { setMobileOpen(true); dialog.current?.showModal(); }}>Фильтры ({activeFilterCount(state.filters)})</button>
      <label>Сортировка<select className={catalogInput} value={state.sort} onChange={event => update(applyCriteria(state, { sort: event.target.value }))}>{availableSorts.map(sort => <option key={sort} value={sort} disabled={sort === 'relevance' && !state.q || sort.startsWith('price_') && !canSortByPrice(state.filters as CoffeeFilters) || sort === 'distance_asc' && !state.filters.origin}>{sortLabels[sort]}</option>)}</select></label>
    </div>
    {kind === 'coffees' && !canSortByPrice(state.filters as CoffeeFilters) && <p className="text-sm">Для сортировки по цене выберите валюту и вес пачки.</p>}
    <FilterChips filters={state.filters} groups={groups} onChange={filters => update(applyCriteria(state, { filters }))} />
    <div className="flex items-start gap-6"><aside ref={desktopFilters} className={`${kind === 'coffees' ? 'scroll-mt-28' : catalogPanel} hidden w-72 shrink-0 lg:block`}>{filterForm()}</aside><div className="min-w-0 flex-1 space-y-5">
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
