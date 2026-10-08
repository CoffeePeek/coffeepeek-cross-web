import type { AddressKind } from '../api/publicAddresses';
import React, { createContext, useContext, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getBySlug } from '../api/publicAddresses';
import { normalizeResponseData } from '../api/core/interceptors';
import WobbleRing from './WobbleRing';
import { ShopDetailSkeleton } from './skeletons';
import { getCatalogScope } from '../lib/catalogSession';
import { useUser } from '../contexts/UserContext';

const Resolution = createContext<{ id: string; data: any; reload: () => Promise<unknown> } | null>(null);
export const usePublicResolution = () => useContext(Resolution);
export default function PublicAddressPage({ kind, param, children }: { kind: AddressKind; param: string; children: React.ReactNode }) {
  const value = useParams()[param] || '';
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading: authLoading } = useUser();
  const query = useQuery({
    queryKey: ['publicAddress', kind, getCatalogScope(), value],
    queryFn: ({ signal }) => getBySlug<any>(kind, value, signal),
    enabled: !authLoading,
    staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: true,
  });
  useEffect(() => {
    const address = query.data?.address;
    if (!address) return;
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const previous = canonical?.href;
    const created = !canonical;
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
    canonical.href = `https://coffeepeek.by${address.canonicalPath}`;
    const prefix = kind === 'shops' ? /^\/(?:shops|coffee-shops)\/[^/]+/ : /^\/[^/]+\/[^/]+/;
    const suffix = location.pathname.replace(prefix, '');
    const target = address.canonicalPath + suffix;
    if (target !== location.pathname) navigate(target + location.search, { replace: true, state: location.state });
    return () => { if (created) canonical?.remove(); else if (canonical && previous) canonical.href = previous; };
  }, [query.data, location.pathname, location.search, location.state, navigate, kind]);
  if (query.isPending) return kind === 'shops' && /^\/(?:shops|coffee-shops)\/[^/]+\/?$/.test(location.pathname)
    ? <ShopDetailSkeleton />
    : <div className="flex min-h-[70vh] items-center justify-center"><WobbleRing size={48} /></div>;
  if (query.isError) {
    const status = (query.error as { status?: number }).status;
    return <main className="p-8 text-center"><p>{status === 404 ? 'Не найдено' : status === 400 ? 'Некорректный адрес' : 'Страница временно недоступна'}</p>
      {status !== 404 && status !== 400 && <button className="mt-4 min-h-11" onClick={() => {
        const retryAfter = (query.error as unknown as { retryAfter?: string }).retryAfter;
        const delay = retryAfter ? (/^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - query.errorUpdatedAt) : 1000;
        if (Date.now() >= query.errorUpdatedAt + Math.max(1000, Number.isFinite(delay) ? delay : 1000)) void query.refetch();
      }}>Повторить</button>}</main>;
  }
  if (!query.data) return null;
  const { address, data } = query.data;
  return <Resolution.Provider value={{ id: address.slug, data: normalizeResponseData({ ...data, address }), reload: query.refetch }}>
    {children}
  </Resolution.Provider>;
}
