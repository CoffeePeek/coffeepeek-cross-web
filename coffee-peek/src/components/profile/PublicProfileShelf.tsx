import { Link } from 'react-router-dom';
import { useProfileShelf } from '../../hooks/queries/usePublicProfile';
import type { PublicShelfItem } from '../../api/profileShelf';
import ShopPhotoPlaceholder from '../ShopPhotoPlaceholder';
import { ProfileSectionHeading } from './ProfileUI';

/** The public API returns cards only after an explicit opt-in; errors never reveal stale cards. */
export default function PublicProfileShelf({ slug }: { slug: string }) {
  const query = useProfileShelf(slug);
  if (query.isPending || query.isFetching || query.isError || !query.data) return null;
  return <section aria-label="Кофейная полка">
    <ProfileSectionHeading title="Кофейная полка" />
    {query.data.items.length ? <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
      {query.data.items.map(item => <ShelfCard key={item.id} item={item} />)}
    </div> : <p className="profile-muted mt-2 text-sm">На полке пока нет кофе.</p>}
  </section>;
}

function ShelfCard({ item }: { item: PublicShelfItem }) {
  const content = <>
    <div className="relative aspect-square overflow-hidden rounded-xl">
      <ShopPhotoPlaceholder fontSize={14} />
      {item.photoUrl && <img src={item.photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy"
        crossOrigin="anonymous" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none'; }} />}
    </div>
    <h3 className="mt-2 break-words text-sm font-semibold">{item.name || 'Кофе'}</h3>
    {item.roasterName && <p className="profile-muted mt-1 break-words text-xs">{item.roasterName}</p>}
  </>;
  const className = 'block w-36 shrink-0';
  return item.coffeeSlug ? <Link to={`/coffees/${encodeURIComponent(item.coffeeSlug)}`} className={className}>{content}</Link>
    : <article className={className}>{content}</article>;
}
