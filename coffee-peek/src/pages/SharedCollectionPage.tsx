import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Coffee, Factory, ShareNetwork, Star } from '@phosphor-icons/react';
import { getCollection, collectionPlacePath, type CollectionPlace } from '../api/collections';
import { ProfileError, ProfileLoading } from '../components/profile/ProfileUI';
import '../pages/UserProfilePage.css';
import { APP_DOWNLOAD_PATH } from '../utils/appDownload';

export default function SharedCollectionPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [message, setMessage] = useState('');
  const collection = useQuery({ queryKey: ['shared-collection', id], queryFn: ({ signal }) => getCollection(id, signal),
    staleTime: 0, gcTime: 0, retry: false, refetchOnMount: 'always', refetchOnWindowFocus: true });
  useEffect(() => {
    const previous = document.title;
    if (collection.data) document.title = `${collection.data.title} — CoffeePeek`;
    return () => { document.title = previous; };
  }, [collection.data]);

  async function share() {
    if (!collection.data) return;
    const data = { title: collection.data.title, url: `https://coffeepeek.by${collection.data.canonicalPath}` };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.url); setMessage('Ссылка скопирована'); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Не удалось отправить ссылку. Попробуйте ещё раз.');
    }
  }

  return <main className="profile-page mx-auto min-h-screen max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
    <header className="mb-8 flex items-center justify-between gap-4">
      <Link to="/" className="text-xl font-bold">Coffee<span className="text-[#EAB308]">Peek</span></Link>
      <Link to={APP_DOWNLOAD_PATH} className="profile-text-button">Скачать приложение</Link>
    </header>
    {collection.isPending ? <ProfileLoading /> : collection.isError || !collection.data
      ? <ProfileError message="Подборка недоступна. Ссылка могла быть отключена владельцем." onRetry={() => void collection.refetch()} />
      : <>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><h1 className="break-words text-3xl font-bold sm:text-4xl">{collection.data.title}</h1>
            <p className="profile-muted mt-2">Мест в подборке: {collection.data.items.length}</p></div>
          <button type="button" onClick={() => void share()} className="profile-text-button inline-flex min-h-11 items-center gap-2">
            <ShareNetwork size={22} aria-hidden="true" />Поделиться</button>
        </div>
        {collection.data.items.length === 0 ? <p>Места из этой подборки больше недоступны.</p>
          : <CollectionPlaceGroups places={collection.data.items} />}
      </>}
    {message && <p className="mt-4" role="status">{message}</p>}
  </main>;
}

function CollectionPlaceGroups({ places }: { places: CollectionPlace[] }) {
  return <div className="space-y-4">{(['coffee_shop', 'roaster'] as const).map(kind => {
    const group = places.filter(place => place.kind === kind);
    return group.length > 0 && <div key={kind} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {group.map(place => <CollectionPlaceCard key={`${place.kind}:${place.address?.slug}`} place={place} />)}
    </div>;
  })}</div>;
}

function CollectionPlaceCard({ place }: { place: CollectionPlace }) {
  const path = collectionPlacePath(place);
  if (!path) return null;
  const isShop = place.kind === 'coffee_shop';
  const label = isShop ? 'Кофейня' : 'Обжарщик';
  const Icon = isShop ? Coffee : Factory;
  const image = place.coverPhoto?.urls?.card || place.coverPhoto?.fullUrl;
  return <Link to={path} className="profile-panel flex min-w-0 items-center gap-4 rounded-3xl border p-4 transition-opacity hover:opacity-80">
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl text-[#CA8A04] ${isShop ? 'h-28 w-32 bg-[#EAB308]/10' : 'h-20 w-20 bg-white'}`}>
      <Icon size={32} aria-hidden="true" />{image && <img src={image} alt="" loading="lazy" className={`absolute inset-0 h-full w-full ${isShop ? 'object-cover' : 'object-contain p-2'}`}
        onError={event => { event.currentTarget.style.display = 'none'; }} />}
    </div>
    <div className="min-w-0"><h2 className="break-words text-lg font-bold">{place.name || label}</h2>
      <p className="profile-muted mt-1 text-xs">{label}</p>
      {isShop && typeof place.rating === 'number' && place.rating > 0 && place.rating <= 5 && <p className="mt-1 inline-flex items-center gap-1 font-bold">
        <Star size={18} weight="fill" className="text-[#EAB308]" aria-hidden="true" />{place.rating.toFixed(1)}</p>}
      {isShop && typeof place.checkInCount === 'number' && place.checkInCount >= 0 && <p className="profile-muted text-xs">Чекинов: {place.checkInCount}</p>}
      <p className="profile-muted mt-1 text-sm">{[place.cityName, place.streetAddress].filter(Boolean).join(' · ') || label}</p></div>
  </Link>;
}
