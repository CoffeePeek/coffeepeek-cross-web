import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getShopPublicAddressById } from '../api/shopPublicAddresses';
import { getPublishedShopById } from '../api/admin';
import { getBrowseCoffeeShopBySlug } from '../api/coffeeShops';
import { useUser } from '../contexts/UserContext';

export function PublishedShopLink({ shopId, children, className }: {
  shopId: string;
  children?: ReactNode;
  className?: string;
}) {
  const { isAdmin } = useUser();
  const published = useQuery({
    queryKey: ['admin', 'published-shop', shopId],
    queryFn: () => getPublishedShopById(shopId).then(response => response.data),
    enabled: isAdmin && children == null && Boolean(shopId),
    staleTime: 60_000,
  });
  const address = useQuery({
    queryKey: ['admin', 'shop-public-address', 'id', shopId],
    queryFn: () => getShopPublicAddressById(shopId).then(response => response.data),
    enabled: !isAdmin && Boolean(shopId),
    staleTime: 60_000,
  });
  const browse = useQuery({
    queryKey: ['browse', 'coffee-shop', address.data?.slug],
    queryFn: () => getBrowseCoffeeShopBySlug(address.data!.slug).then(response => response.data),
    enabled: !isAdmin && children == null && Boolean(address.data?.slug),
    staleTime: 60_000,
  });

  const name = isAdmin ? published.data?.name : browse.data?.name;
  const street = isAdmin ? published.data?.location?.address : browse.data?.address;
  const failed = isAdmin ? published.isError : address.isError || browse.isError;
  const content = children ?? (name ? <><span className="block">{name}</span><span className="mt-1 block text-xs font-normal text-text-muted dark:text-stone-400">{street || 'Адрес не указан'}</span></> : failed ? 'Кофейня недоступна' : 'Загрузка кофейни…');
  const to = isAdmin ? `/published-shops/${encodeURIComponent(shopId)}` : address.data?.canonicalPath;

  return to
    ? <Link to={to} className={className}>{content}</Link>
    : <span>{content}</span>;
}
