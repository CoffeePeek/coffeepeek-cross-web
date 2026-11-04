import { Link } from 'react-router-dom';
import { collectionCoverUrl } from '../../api/collections';
import { useProfileCollection } from '../../hooks/queries/usePublicProfile';
import ShopPhotoPlaceholder from '../ShopPhotoPlaceholder';
import { ProfileError, ProfileLoading, ProfileSectionHeading } from './ProfileUI';

/** Public profiles never fall back to the owner's complete favorites. */
export default function PublicProfileCollection({ slug }: { slug: string }) {
  const query = useProfileCollection(slug);
  const collection = query.data;
  if (!query.isPending && !query.isError && !collection) return null;
  const image = collectionCoverUrl(collection?.coverPhoto);
  return <section>
    <ProfileSectionHeading title={collection?.title || 'Избранное'} />
    {query.isPending ? <ProfileLoading /> : query.isError
      ? <ProfileError message="Не удалось загрузить подборку" onRetry={() => void query.refetch()} />
      : collection && <Link to={collection.canonicalPath} className="profile-panel mt-2 flex min-w-0 items-center gap-4 rounded-2xl border p-3 transition-opacity hover:opacity-80">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl">
          <ShopPhotoPlaceholder fontSize={14} />
          {image && <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy"
            onError={event => { event.currentTarget.style.display = 'none'; }} />}
        </div>
        <div className="min-w-0">
          <h3 className="break-words text-lg font-bold">{collection.title}</h3>
          {collection.description && <p className="profile-muted mt-1 break-words whitespace-pre-line text-sm">{collection.description}</p>}
          <p className="profile-muted mt-2 text-sm">Мест в подборке: {collection.items.length}</p>
        </div>
      </Link>}
  </section>;
}
