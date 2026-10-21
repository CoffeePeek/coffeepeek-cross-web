import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getModerationShopById } from '../api/admin';
import { getShopPublicAddressBySlug } from '../api/shopPublicAddresses';
import { LoadError } from '../components/ui/LoadError';
import { useUser } from '../contexts/UserContext';
import { BrowseShopPage } from './BrowseShopPage';
import { PublishedShopEditPage } from './PublishedShopEditPage';
import { ShopEditPage } from './ShopEditPage';

export function ShopDetailPage({ source }: { source: 'public' | 'published' | 'moderation' }) {
  const { id = '' } = useParams();
  const { isAdmin } = useUser();
  const submission = useQuery({
    queryKey: ['admin', 'shop', id],
    queryFn: () => getModerationShopById(id).then(response => response.data),
    enabled: source === 'moderation' && Boolean(id),
  });
  const address = useQuery({
    queryKey: ['admin', 'shop-public-address', 'slug', id],
    queryFn: () => getShopPublicAddressBySlug(id).then(response => response.data),
    enabled: source === 'public' && isAdmin && Boolean(id),
    staleTime: 60_000,
  });

  if (source === 'public' && !isAdmin) return <BrowseShopPage key={id} />;

  const lookup = source === 'moderation' ? submission : source === 'public' ? address : null;
  if (lookup?.isError && !lookup.data) return <LoadError message="Не удалось загрузить кофейню." onRetry={() => void lookup.refetch()} retrying={lookup.isFetching} />;
  if (lookup && !lookup.data) return <p role="status">Загрузка кофейни…</p>;

  const publishedId = source === 'published' ? id : source === 'public' ? address.data?.entityId : submission.data?.publishedShopId;
  return isAdmin && publishedId
    ? <PublishedShopEditPage key={publishedId} id={publishedId} submissionId={source === 'moderation' ? id : undefined} />
    : <ShopEditPage key={id} id={id} />;
}
