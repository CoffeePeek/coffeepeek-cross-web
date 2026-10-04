import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getShopPublicAddressById } from '../api/shopPublicAddresses';

/** Admin DTOs contain UUIDs; public browse routes accept the resolved slug. */
export function PublishedShopLink({ shopId, children, className }: {
  shopId: string;
  children: ReactNode;
  className?: string;
}) {
  const { data } = useQuery({
    queryKey: ['admin', 'shop-public-address', 'id', shopId],
    queryFn: () => getShopPublicAddressById(shopId).then(response => response.data),
    enabled: Boolean(shopId),
    staleTime: 60_000,
  });

  return data?.canonicalPath
    ? <Link to={data.canonicalPath} className={className}>{children}</Link>
    : <span>{children}</span>;
}
