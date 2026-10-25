import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Coffee, CoffeeBean, Storefront } from '@phosphor-icons/react';
import type { ProfileFavorite } from '../../api/user';
import { useProfileFavorites } from '../../hooks/queries/usePublicProfile';
import { ProfileDialog, ProfileError, ProfileLoading, ProfileSectionHeading } from './ProfileUI';

const favoriteKinds = {
  coffee_shop: { label: 'Кофейня', Icon: Storefront },
  roaster: { label: 'Обжарщик', Icon: CoffeeBean },
  drink: { label: 'Напиток', Icon: Coffee },
};

export default function PublicProfileFavorites({ slug }: { slug: string }) {
  const favorites = useProfileFavorites(slug);
  const [expanded, setExpanded] = useState(false);
  const items = (favorites.data ?? []).filter(item => Object.hasOwn(favoriteKinds, item.kind));
  if (!favorites.isPending && !favorites.isError && !items.length) return null;
  return <section>
    <ProfileSectionHeading title="Любимые" onAll={items.length ? () => setExpanded(true) : undefined} />
    {favorites.isPending ? <ProfileLoading /> : <>
      {favorites.isError && <ProfileError message="Не удалось загрузить любимые места и напитки" onRetry={() => void favorites.refetch()} />}
      <div className="profile-favorites flex gap-3 overflow-x-auto pb-2 pt-1">
        {items.slice(0, 6).map((item, index) => <FavoriteCard key={favoriteKey(item, index)} item={item} />)}
      </div>
    </>}
    {expanded && <ProfileDialog title="Любимые" onClose={() => setExpanded(false)}>
      <div className="grid grid-cols-2 gap-3">{items.map((item, index) => <FavoriteCard key={favoriteKey(item, index)} item={item} full onNavigate={() => setExpanded(false)} />)}</div>
    </ProfileDialog>}
  </section>;
}

function favoriteKey(item: ProfileFavorite, index: number) {
  return `${item.kind}:${item.address?.slug ?? item.drink?.slug ?? index}`;
}

function FavoriteCard({ item, full = false, onNavigate }: { item: ProfileFavorite; full?: boolean; onNavigate?: () => void }) {
  const { Icon, label } = favoriteKinds[item.kind];
  const image = item.coverPhoto?.urls?.card || item.coverPhoto?.fullUrl;
  const content = <>
    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-[#EAB308]/10 text-[#CA8A04]">
      <Icon size={32} weight="duotone" aria-hidden="true" />
      {image && <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = 'none'; }} />}
    </div>
    <p className="mt-2 break-words text-sm font-bold leading-snug">{item.name || label}</p>
    <p className="mt-1 text-xs profile-muted">{label}</p>
  </>;
  const className = `profile-panel block min-w-0 rounded-2xl border p-2.5 ${full ? '' : 'w-40 shrink-0 snap-start sm:w-48'}`;
  return item.kind !== 'drink' && item.address?.canonicalPath
    ? <Link to={item.address.canonicalPath} onClick={onNavigate} className={`${className} transition-opacity hover:opacity-80`}>{content}</Link>
    : <div className={className}>{content}</div>;
}
