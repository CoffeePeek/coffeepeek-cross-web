import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutationState } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { searchShops } from '../api/discovery';
import { applyCriteria, readSearchState, validateSearch, writeSearchState, type ShopFilters } from '../utils/catalogSearch';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { getThemeColors } from '../constants/colors';
import { getCatalogScope } from '../lib/catalogSession';
import { useLocalCity } from '../hooks/useLocalCity';
import { useCities } from '../hooks/queries/useCatalogs';
import { useFavorites } from '../hooks/useFavorites';
import { useLoadMoreOnScroll } from '../hooks/useLoadMoreOnScroll';
import ShopSearchBar from './ShopSearchBar';
import ShopCatalogFilters from './ShopCatalogFilters';
import { ShopCatalogCard } from './CatalogCards';
import { activeFilterCount, FilterChips } from './CatalogFilters';
import { ShopCardSkeleton } from './skeletons';
import Mascot from './Mascot';

export default function CoffeeShopList(_props: { onShopSelect: (shopId: string) => void }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { cityId } = useLocalCity();
  const usesDefaultCity = !params.has('filters') && !params.has('citySlug') && !params.has('city');
  const cities = useCities(usesDefaultCity && !cityId);
  const defaultCity = cityId || cities.data?.[0]?.id || '';
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { user, isLoading: authLoading } = useUser();
  const favorites = useFavorites();
  const scope = getCatalogScope();
  const parsed = useMemo(() => {
    try {
      const restored = new URLSearchParams(params);
      if (usesDefaultCity && defaultCity) restored.set('city', defaultCity);
      return { state: readSearchState(restored, 'shops'), error: '' };
    } catch {
      return { state: readSearchState(new URLSearchParams(), 'shops'), error: 'Фильтры в адресе повреждены. Сбросьте их и повторите поиск.' };
    }
  }, [params, defaultCity]);
  const state = parsed.state;
  const filters = state.filters as ShopFilters;
  const [input, setInput] = useState(state.q);
  const [showFilters, setShowFilters] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const update = (next: typeof state) => setParams(writeSearchState(next, 'shops'));
  useEffect(() => { setInput(state.q); }, [state.q]);
  useEffect(() => {
    if (input === state.q) return;
    const timer = setTimeout(() => update(applyCriteria(state, { q: input.trim().replace(/\s+/g, ' '), sort: filters.origin ? 'distance_asc' : input.trim() ? 'relevance' : 'name_asc' })), 600);
    return () => clearTimeout(timer);
  }, [input, state]);
  const personal = filters.favoritesOnly || filters.visitedOnly;
  const errors = validateSearch(state, 'shops');
  const enabled = !authLoading && (!usesDefaultCity || !!defaultCity || !cities.isPending) && !parsed.error && !Object.keys(errors).length && (!personal || !!user);
  const query = useInfiniteQuery({
    queryKey: ['catalog', scope, 'shops', state.q, state.filters, state.sort, state.page],
    initialPageParam: state.page,
    queryFn: ({ signal, pageParam }) => searchShops({ q: state.q, filters, sort: state.sort, page: pageParam, pageSize: 12 }, signal),
    getNextPageParam: page => page.currentPage < page.totalPages ? page.currentPage + 1 : undefined,
    enabled, retry: false, staleTime: 0,
  });
  const pending = useMutationState({ filters: { mutationKey: ['favorite-change', scope], status: 'pending' }, select: mutation => mutation.state.variables as { kind: string; address: { slug: string }; favorite: boolean } });
  const removed = pending.filter(change => !change.favorite && change.kind === 'coffee_shop' && favorites.isFavorite('coffee_shop', change.address.slug, true) === false);
  const shops = enabled ? [...new Map((query.data?.pages.flatMap(page => page.items) ?? []).filter(shop => !filters.favoritesOnly || !removed.some(change => change.address.slug === shop.address.slug)).map(shop => [shop.address.slug, shop])).values()] : [];
  const total = Math.max(0, (query.data?.pages[0]?.totalItems ?? 0) - (filters.favoritesOnly ? removed.length : 0));
  const loadMoreRef = useLoadMoreOnScroll(enabled && !!query.hasNextPage && !query.isFetching && !query.isError, () => { void query.fetchNextPage(); });
  const apply = (nextFilters: Record<string, unknown>) => {
    const next = applyCriteria(state, { filters: nextFilters, sort: nextFilters.origin ? 'distance_asc' : state.q ? 'relevance' : 'name_asc' });
    update(next);
    if (!user && (nextFilters.favoritesOnly || nextFilters.visitedOnly)) navigate('/login', { state: { from: { ...location, search: `?${writeSearchState(next, 'shops')}` } } });
  };
  const reset = () => update(applyCriteria(state, { filters: cityId ? { city: cityId } : {}, q: '', sort: 'name_asc' }));
  const closeFilters = () => { dialog.current?.close(); setShowFilters(false); };
  const panel = { filters, onApply: apply, resultCount: total };
  const grid = 'grid grid-cols-1 gap-5 pb-12 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';
  return <>
    <div className="relative min-h-screen pb-20" style={{ backgroundColor: colors.background }}>
      {theme === 'dark' && <div className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: 'radial-gradient(#2D241F 1px, transparent 1px)', backgroundSize: '40px 40px' }} />}
      <div className="relative">
        <ShopSearchBar searchQuery={input} onSearchChange={setInput} showFilters={showFilters} onFilterToggle={() => { setShowFilters(true); dialog.current?.showModal(); }} activeFilterCount={activeFilterCount(state.filters)} colors={colors} dark={theme === 'dark'} />
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
          <div className="hidden lg:block"><ShopCatalogFilters mode="quick" {...panel} /></div>
          <div className="lg:flex lg:items-start lg:gap-10">
            <aside className="no-scrollbar sticky top-20 hidden max-h-[calc(100vh-5.5rem)] w-[260px] shrink-0 self-start overflow-y-auto pb-8 pr-6 lg:block xl:w-[280px]" style={{ borderRight: `1px solid ${colors.border}` }}>
              <ShopCatalogFilters mode="sidebar" {...panel} />
            </aside>
            <div className="min-w-0 flex-1">
              <div className="lg:hidden"><ShopCatalogFilters mode="chips" {...panel} /></div>
              {(filters.menu || filters.minRating !== undefined) && <FilterChips filters={{ menu: filters.menu, minRating: filters.minRating }} groups={[]} onChange={extra => apply({ ...filters, menu: undefined, minRating: undefined, ...extra })} />}
              {(parsed.error || Object.keys(errors).length > 0) && <div role="alert" className="mb-6"><p>{parsed.error || Object.values(errors).join(' ')}</p><button type="button" className="min-h-11 underline" onClick={reset}>Сбросить фильтры</button></div>}
              {personal && !user && !authLoading && <p>Войдите, чтобы использовать личные фильтры.</p>}
              {query.isError && <div role="alert" className="mb-6 rounded-2xl border border-red-300 bg-red-500/10 p-4 text-red-700 dark:text-red-300"><p>Не удалось загрузить кофейни.</p>
                {(query.error as { status?: number }).status === 400 && <><p>Проверьте фильтры. Удалите недоступное значение или сбросьте фильтры.</p><FilterChips filters={filters} groups={[]} onChange={apply} /><button type="button" className="min-h-11 underline" onClick={reset}>Сбросить фильтры</button></>}
                <button type="button" className="min-h-11 underline" onClick={() => void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())}>Повторить загрузку</button>
              </div>}
              {query.isPending && enabled ? <div className={grid}><ShopCardSkeleton count={8} /></div> : !shops.length ? <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border px-6 py-16 text-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <Mascot pose="search" size={132} /><p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>Ничего не найдено. Попробуйте другой фильтр.</p>
              </div> : <div className={grid}>{shops.map(shop => <ShopCatalogCard key={shop.address.slug} shop={shop} />)}</div>}
              <div ref={loadMoreRef} className="pb-8">{query.isFetchingNextPage && <div className={grid}><ShopCardSkeleton count={4} /></div>}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <dialog ref={dialog} aria-label="Фильтры" onClose={() => setShowFilters(false)} className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/50">
      <button type="button" aria-label="Закрыть фильтры" className="absolute inset-0" onClick={closeFilters} />
      <aside className="absolute inset-x-0 bottom-0 max-h-[min(86dvh,760px)] overflow-y-auto rounded-t-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" style={{ background: colors.surface, borderTop: `1px solid ${colors.border}`, boxShadow: '0 -16px 48px rgba(0,0,0,.18)' }}>
        {showFilters && <ShopCatalogFilters mode="sidebar" {...panel} onClose={closeFilters} />}
      </aside>
    </dialog>
  </>;
}
