import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CaretRight, Factory, MapPin, ShareNetwork, Star } from '@phosphor-icons/react';
import { getCollection, collectionCoverUrl, collectionPlacePath, type CollectionPlace } from '../api/collections';
import { ProfileError, ProfileLoading } from '../components/profile/ProfileUI';
import { APP_DOWNLOAD_PATH } from '../utils/appDownload';
import './SharedCollectionPage.css';

export default function SharedCollectionPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [message, setMessage] = useState('');
  const collection = useQuery({ queryKey: ['shared-collection', id], queryFn: ({ signal }) => getCollection(id, signal),
    staleTime: 0, gcTime: 0, retry: false, refetchOnMount: 'always', refetchOnWindowFocus: true });
  const cover = collectionCoverUrl(collection.data?.coverPhoto);
  useEffect(() => {
    const previous = document.title;
    if (collection.isError) document.title = 'Подборка недоступна — CoffeePeek';
    else if (collection.data) document.title = `${collection.data.title} — CoffeePeek`;
    return () => { document.title = previous; };
  }, [collection.data, collection.isError]);

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

  return <main className="shared-collection">
    <Link to="/" className="shared-collection__home" aria-label="CoffeePeek — на главную"><BrandRibbon /></Link>
    <div className="shared-collection__content">
      {collection.isPending ? <ProfileLoading /> : collection.isError || !collection.data
        ? <ProfileError message="Подборка недоступна. Ссылка могла быть отключена владельцем." onRetry={() => void collection.refetch()} />
        : <>
          {cover && <img key={cover} src={cover} alt="" className="shared-collection__cover"
            onError={event => { event.currentTarget.style.display = 'none'; }} />}
          <header className="shared-collection__heading">
            <div className="shared-collection__title"><h1>{collection.data.title}</h1>
              {collection.data.description && <p className="shared-collection__description">{collection.data.description}</p>}
              <p>Мест в подборке: {collection.data.items.length}</p></div>
            <nav className="shared-collection__actions" aria-label="Действия с подборкой">
              <button type="button" onClick={() => void share()} className="shared-collection__share" aria-label="Поделиться подборкой">
                <ShareNetwork size={20} aria-hidden="true" /><span>Поделиться</span>
              </button>
              <Link to={APP_DOWNLOAD_PATH} className="shared-collection__download">Скачать приложение</Link>
            </nav>
          </header>
          {collection.data.items.length === 0 ? <p className="shared-collection__empty">{collection.data.mode === 'list' ? 'В подборке пока нет мест.' : 'Места из этой подборки больше недоступны.'}</p>
            : <CollectionPlaceGroups places={collection.data.items} />}
        </>}
      {message && <p className="shared-collection__message" role="status">{message}</p>}
    </div>
    <BrandRibbon />
  </main>;
}

function BrandRibbon() {
  return <div className="shared-collection__ribbon" aria-hidden="true">
    <span>{Array.from({ length: 32 }, (_, index) => <span key={index}>COFFEEPEEK</span>)}</span>
  </div>;
}

function CollectionPlaceGroups({ places }: { places: CollectionPlace[] }) {
  const shops = places.filter(place => place.kind === 'coffee_shop');
  const roasters = places.filter(place => place.kind === 'roaster');
  return <div className="shared-collection__groups">
    {shops.length > 0 && <section className="shared-collection__shops" aria-label="Кофейни">
      {shops.map(place => <CollectionPlaceCard key={`${place.kind}:${place.address?.slug}`} place={place} />)}
    </section>}
    {roasters.length > 0 && <section className="shared-collection__roasters" aria-label="Обжарщики">
      {roasters.map(place => <CollectionPlaceCard key={`${place.kind}:${place.address?.slug}`} place={place} />)}
    </section>}
  </div>;
}

function checkInLabel(count: number) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  return `${count} ${mod100 >= 11 && mod100 <= 14 ? 'чекинов' : mod10 === 1 ? 'чекин' : mod10 >= 2 && mod10 <= 4 ? 'чекина' : 'чекинов'}`;
}

function CollectionPlaceCard({ place }: { place: CollectionPlace }) {
  const path = collectionPlacePath(place);
  if (!path) return null;
  const isShop = place.kind === 'coffee_shop';
  const label = isShop ? 'Кофейня' : 'Обжарщик';
  const image = place.coverPhoto?.urls?.card || place.coverPhoto?.fullUrl;
  const location = [place.cityName, place.streetAddress].filter(Boolean).join(' · ');
  const hasRating = isShop && typeof place.rating === 'number' && place.rating > 0 && place.rating <= 5;
  const hasCheckIns = isShop && typeof place.checkInCount === 'number' && Number.isInteger(place.checkInCount) && place.checkInCount >= 0;

  return <Link to={path} className={`shared-place ${isShop ? 'shared-place--shop' : 'shared-place--roaster'}`}>
    <span className="shared-place__image">
      {isShop ? <span className="shared-place__placeholder" aria-hidden="true">COFFEEPEEK</span> : <Factory size={32} aria-hidden="true" />}
      {image && <img key={image} src={image} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.style.display = 'none'; }} />}
    </span>
    <div className="shared-place__body">
      <h2 className="shared-place__name">{place.name || label}</h2>
      {isShop && <span className="shared-place__location"><MapPin size={22} aria-hidden="true" /><span>{location || 'Адрес уточняется'}</span></span>}
    </div>
    {isShop && (hasRating || hasCheckIns) && <span className="shared-place__score">
      {hasRating && <span className="shared-place__rating" aria-label={`Рейтинг: ${place.rating!.toFixed(1)} из 5`}><Star size={28} weight="fill" aria-hidden="true" />{place.rating!.toFixed(1)}</span>}
      {hasCheckIns && <span className="shared-place__checkins">{checkInLabel(place.checkInCount!)}</span>}
    </span>}
    <CaretRight className="shared-place__arrow" size={20} aria-hidden="true" />
  </Link>;
}
