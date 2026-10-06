import { useEffect } from 'react';
import { useMutation, useIsMutating, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFavorites, setFavorite, updateFavoriteList, type FavoriteItem, type FavoriteKind } from '../api/favorites';
import type { PublicAddress } from '../api/publicAddresses';
import { useUser } from '../contexts/UserContext';
import { useRequireAuth } from './useRequireAuth';
import { useToast } from '../contexts/ToastContext';
import { catalogMutationSignal, getCatalogScope } from '../lib/catalogSession';
import { useLocation, useNavigate } from 'react-router-dom';

const intentKey = 'coffeepeek.favoriteIntent';
const locks = new Set<string>();
export function clearFavoriteIntent() { sessionStorage.removeItem(intentKey); }
export function useFavorites() {
  const { user, isLoading } = useUser();
  const { requireAuth } = useRequireAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const scope = getCatalogScope();
  const queryKey = ['favorites', scope] as const;
  const query = useQuery({ queryKey, queryFn: ({ signal }) => getFavorites(signal), enabled: !!user && !isLoading, retry: false, staleTime: 0 });
  const mutation = useMutation({
    mutationKey: ['favorite-change', scope],
    mutationFn: async ({ kind, address, favorite }: { kind: FavoriteKind; address: PublicAddress; favorite: boolean }) => {
      const lock = `${scope}:${kind}:${address.slug}`;
      if (locks.has(lock) || scope !== getCatalogScope()) return;
      locks.add(lock);
      const { signal, release } = catalogMutationSignal();
      let previous: FavoriteItem[] | undefined;
      let wasFavorite = !favorite;
      try {
        await qc.cancelQueries({ queryKey });
        if (scope !== getCatalogScope()) return;
        previous = qc.getQueryData<FavoriteItem[]>(queryKey);
        wasFavorite = previous?.some(item => item.kind === kind && item.address.slug === address.slug) ?? !favorite;
        qc.setQueryData<FavoriteItem[]>(queryKey, updateFavoriteList(previous ?? [], kind, address, favorite));
        window.dispatchEvent(new CustomEvent('coffeepeek:favorite-changed', { detail: { scope, kind, slug: address.slug, favorite } }));
        await setFavorite(kind, address.slug, favorite, signal);
        if (scope !== getCatalogScope()) return;
        showToast(favorite ? 'Добавлено в избранное' : 'Удалено из избранного', 'success');
      } catch (error) {
        if (scope !== getCatalogScope()) return;
        if (previous) qc.setQueryData<FavoriteItem[]>(queryKey, current => updateFavoriteList(current ?? [], kind, address, wasFavorite));
        else qc.removeQueries({ queryKey, exact: true });
        showToast('Не удалось сохранить избранное. Повторите нажатие.', 'error');
        if ((error as { status?: number }).status === 401) navigate('/login', { state: { from: location } });
        throw error;
      } finally {
        release(); locks.delete(lock);
        if (scope === getCatalogScope()) {
          await Promise.all(['favorites', 'catalog', 'coffeeShops', 'publicAddress', 'catalogs'].map(key => qc.invalidateQueries({ queryKey: [key] })));
        }
      }
    },
  });
  const toggle = (kind: FavoriteKind, address: PublicAddress, serverValue?: boolean | null) => {
    if (isLoading) return;
    if (!user) {
      sessionStorage.setItem(intentKey, JSON.stringify({ kind, address }));
      requireAuth(); return;
    }
    if (locks.has(`${scope}:${kind}:${address.slug}`)) return;
    const favorite = query.data ? query.data.some(item => item.kind === kind && item.address.slug === address.slug) : serverValue;
    if (favorite == null) { showToast('Состояние избранного недоступно. Повторите загрузку.', 'error'); void query.refetch(); return; }
    mutation.mutate({ kind, address, favorite: !favorite });
  };
  useEffect(() => {
    if (!user || isLoading) return;
    const raw = sessionStorage.getItem(intentKey);
    if (!raw) return;
    clearFavoriteIntent();
    try {
      const intent = JSON.parse(raw) as { kind: FavoriteKind; address: PublicAddress };
      if (['coffee_shop', 'roaster'].includes(intent.kind) && typeof intent.address?.slug === 'string')
        mutation.mutate({ ...intent, favorite: true });
    } catch { /* Discard a malformed session intent. */ }
  }, [user?.id, isLoading, scope]);
  return { ...query, scope, toggle, isFavorite: (kind: FavoriteKind, slug: string, serverValue?: boolean | null) =>
    !user ? null : query.data ? query.data.some(item => item.kind === kind && item.address.slug === slug) : serverValue ?? null };
}
export function useFavorite(kind: FavoriteKind, address: PublicAddress | undefined, serverValue?: boolean | null) {
  const favorites = useFavorites();
  const pending = useIsMutating({ mutationKey: ['favorite-change', favorites.scope], predicate: mutation => {
    const variables = mutation.state.variables as { kind?: FavoriteKind; address?: PublicAddress } | undefined;
    return variables?.kind === kind && variables.address?.slug === address?.slug;
  } }) > 0;
  return { favorite: address ? favorites.isFavorite(kind, address.slug, serverValue) : null, pending,
    toggle: () => { if (address) favorites.toggle(kind, address, serverValue); } };
}
