import PublicEntityLink from '../components/PublicEntityLink';
import { usePublicResolution } from '../components/PublicAddressPage';
import type { RoasterDetails } from '../api/coffeeshop';
import React, { useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCoffeeFilterValues, searchCoffees } from '../api/discovery';
import { CoffeeCatalogCard, FavoriteButton, catalogButton, catalogPanel, checkedTime } from '../components/CatalogCards';
import { getCatalogScope } from '../lib/catalogSession';
import { ShopCardSkeleton, ShopDetailSkeleton } from '../components/skeletons';
import PhotoCarousel from '../components/PhotoCarousel';
import Mascot from '../components/Mascot';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/theme';
import { useRoaster } from '../hooks/queries/useCatalogs';
import { usePageTitle } from '../hooks/usePageTitle';
import { instagramHandle, instagramUrl, toWebsiteHref } from '../utils/shopUtils';
import { AppIcon } from '../components/icons';
import Button from '../components/Button';
import { InfoChip } from '../components/ShopCard';
import { getThemeColors } from '../constants/colors';

const RoasterDetailPage: React.FC = () => {
  const { roasterId } = useParams<{ roasterId: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const tc = getThemeClasses(theme);
  const colors = getThemeColors(theme);

  const resolution = usePublicResolution();
  const legacy = useRoaster(resolution ? null : roasterId ?? null);
  const { data: roaster, isLoading, error } = resolution ? { data: resolution.data as RoasterDetails, isLoading: false, error: null } : legacy;

  usePageTitle(roaster?.name || 'Обжарщик');
  const slug = roaster?.publicAddress?.slug ?? roasterId ?? '';
  useEffect(() => {
    const address = roaster?.publicAddress;
    if (!address) return;
    if (address.slug !== roasterId) navigate(address.canonicalPath, { replace: true });
    const canonical = document.createElement('link'); canonical.rel = 'canonical'; canonical.href = `https://coffeepeek.by${address.canonicalPath}`;
    document.head.append(canonical); return () => canonical.remove();
  }, [roaster?.publicAddress, roasterId, navigate]);
  const assortment = useQuery({ queryKey: ['catalog', getCatalogScope(), 'roaster-assortment', slug],
    queryFn: ({ signal }) => searchCoffees({ q: '', filters: { roasters: [slug], availableOnly: true }, sort: 'name_asc', page: 1, pageSize: 6 }, signal), enabled: !!roaster, retry: false });
  const dictionary = useQuery({ queryKey: ['catalogs', 'coffee-filter-values'], queryFn: ({ signal }) => getCoffeeFilterValues(signal) });

  const bgClass = tc.bg.primary;
  const textMain = tc.text.primary;
  const textMuted = tc.text.secondary;
  const cardBg = tc.bg.card;
  const borderColor = tc.border.default;

  if (isLoading) {
    return <ShopDetailSkeleton />;
  }

  if (error || !roaster) {
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <div className="text-center">
          <div className="flex justify-center mb-2" aria-hidden>
            <Mascot pose="astonishment" size={148} />
          </div>
          <p className={`text-xl ${textMain} mb-4`}>{(error as { status?: number } | null)?.status === 404 ? 'Обжарщик не найден' : 'Карточка обжарщика временно недоступна'}</p>
          {error && (error as { status?: number }).status !== 404 && <button className="mb-4 min-h-11 underline" onClick={() => void legacy.refetch()}>Повторить</button>}
          <Button onClick={() => navigate('/roasters')} className="mx-auto">
            Вернуться назад
          </Button>
        </div>
      </div>
    );
  }

  const websiteHref = roaster.contact?.siteLink ? toWebsiteHref(roaster.contact.siteLink) : undefined;
  const websiteLabel = roaster.contact?.siteLink?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const catalogPath = `/coffees?filters=${encodeURIComponent(JSON.stringify({ roasters: [slug], availableOnly: true }))}`;
  const stats = [
    { label: roaster.coffeeProductsCount == null ? 'доступных товаров' : 'товаров в каталоге', value: roaster.coffeeProductsCount ?? assortment.data?.totalItems },
    { label: 'кофеен с нашим кофе', value: roaster.coffeeShopsCount ?? roaster.shops.length },
  ];

  return (
    <main className={`mx-auto max-w-[1200px] space-y-8 px-4 py-6 pb-28 font-body sm:px-6 ${bgClass} ${textMain}`}>
      <header className="space-y-3">
        <nav aria-label="Навигационная цепочка" className={`text-sm ${textMuted}`}>
          <ol className="flex flex-wrap items-center gap-x-2">
            <li><Link to="/roasters" className="inline-flex min-h-11 items-center hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Обжарщики</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="min-w-0 max-w-full break-words">{roaster.name}</li>
          </ol>
        </nav>
        <section aria-labelledby="roaster-name" className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 items-start gap-4 sm:gap-5">
            <div className={`flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border sm:h-32 sm:w-32 ${cardBg} ${borderColor}`}>
              {roaster.photos.length ? <div className="h-full w-full"><PhotoCarousel images={roaster.photos} shopName={roaster.name} isCardView /></div> : <AppIcon name="factory" size={48} className={textMuted} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                <h1 id="roaster-name" className="min-w-0 flex-1 break-words text-2xl font-bold tracking-tight sm:text-3xl">{roaster.name}</h1>
                {roaster.publicAddress && <FavoriteButton kind="roaster" address={roaster.publicAddress} value={roaster.isFavorite} className={`${catalogButton} flex h-11 w-11 shrink-0 items-center justify-center rounded-full`} />}
              </div>
              {roaster.location?.address && <p className={`mt-2 flex items-start gap-1.5 text-sm ${textMuted}`}><AppIcon name="pin_drop" size={18} className={`${tc.primary.text} mt-0.5 shrink-0`} /><span className="min-w-0 break-words">{roaster.location.address}</span></p>}
              {(websiteHref || roaster.contact?.instagramLink) && <div className="mt-3 flex flex-wrap gap-2">
                {websiteHref && <a href={websiteHref} target="_blank" rel="noopener noreferrer" className={`${catalogButton} inline-flex max-w-full items-center gap-2 text-sm`}><AppIcon name="language" size={18} className="shrink-0" /><span className="truncate">{websiteLabel || 'Сайт обжарщика'}</span><AppIcon name="arrow_forward" size={18} className="shrink-0" /></a>}
                {roaster.contact?.instagramLink && <a href={instagramUrl(roaster.contact.instagramLink)} target="_blank" rel="noopener noreferrer" className={`${catalogButton} inline-flex max-w-full items-center gap-2 text-sm`}><AppIcon name="instagram-logo" size={18} className="shrink-0" /><span className="truncate">{instagramHandle(roaster.contact.instagramLink)}</span></a>}
              </div>}
              {!!roaster.tags?.length && <div className="mt-3 flex flex-wrap gap-2">{roaster.tags.map(tag => <InfoChip key={tag.slug} colors={colors}>{tag.name}</InfoChip>)}</div>}
            </div>
          </div>
          <dl aria-label="Статистика обжарщика" className={`${catalogPanel} grid grid-cols-2`}>
            {stats.map((stat, index) => <div key={stat.label} className={`px-3 py-2 text-center ${index ? `border-l ${borderColor}` : ''}`}>
              <dd className="text-2xl font-bold tabular-nums">{stat.value != null && stat.value !== '' && Number.isSafeInteger(Number(stat.value)) && Number(stat.value) >= 0 ? Number(stat.value).toLocaleString('ru-RU') : '—'}</dd>
              <dt className={`mt-1 text-xs ${textMuted}`}>{stat.label}</dt>
            </div>)}
          </dl>
        </section>
      </header>

      {roaster.about && (
        <section>
          <h2 className={`mb-3 text-xl font-bold ${textMain}`}>Об обжарщике</h2>
          <p className={`${textMuted} whitespace-pre-line break-words text-base leading-relaxed`}>{roaster.about}</p>
        </section>
      )}

      <section className={textMain}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-2xl font-bold">Кофе в ассортименте</h2>{assortment.data && <p className={`mt-1 text-sm ${textMuted}`}>Доступных товаров: {assortment.data.totalItems}</p>}</div>
          <Link className={`inline-flex min-h-11 items-center gap-2 font-semibold ${tc.primary.text} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`} to={catalogPath}>Весь кофе обжарщика<AppIcon name="arrow_forward" size={18} /></Link>
        </div>
        {assortment.isPending && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Загрузка ассортимента"><ShopCardSkeleton count={3} /></div>}
        {assortment.isError && <div className={catalogPanel} role="alert"><p>Ассортимент временно недоступен.</p><Button variant="secondary" className="mt-3" onClick={() => void assortment.refetch()}>Повторить</Button></div>}
        {assortment.data && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assortment.data.items.map(coffee => <CoffeeCatalogCard key={coffee.address.slug} coffee={coffee} groups={dictionary.data ?? []} />)}
          {!assortment.isError && assortment.data.items.length < 6 && assortment.data.totalItems <= assortment.data.items.length && <div className={`${catalogPanel} flex min-h-64 flex-col items-center justify-center gap-4 py-8 text-center`}>
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${tc.primary.bgLight}`}><AppIcon name="coffee-bean" size={32} className={tc.primary.text} /></div>
            <h3 className="text-xl font-bold">{assortment.data.items.length ? 'Пока это весь ассортимент' : 'Ассортимент пока пуст'}</h3>
            <p className={`max-w-xs text-sm leading-relaxed ${textMuted}`}>Следите за обновлениями обжарщика.</p>
            {websiteHref && <a href={websiteHref} target="_blank" rel="noopener noreferrer" className={`${catalogButton} inline-flex items-center gap-2 ${tc.primary.bg} ${tc.text.inverse}`}>Перейти на сайт<AppIcon name="arrow_forward" size={18} /></a>}
          </div>}
        </div>}
        {roaster.coffeeCatalogUpdatedAtUtc && <p className={`mt-3 text-xs ${textMuted}`}>{checkedTime(roaster.coffeeCatalogUpdatedAtUtc)}</p>}
      </section>
      {roaster.shops.length > 0 && (
        <section>
          <h2 className={`mb-4 text-2xl font-bold ${textMain}`}>Где используют</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roaster.shops.map((shop) => (
              <PublicEntityLink
                key={shop.id}
                kind="shops" entityId={shop.id} address={shop.publicAddress}
                className={`flex min-h-[86px] items-center gap-4 rounded-2xl border p-3 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${cardBg} ${borderColor} ${textMain}`}
              >
                {shop.photoUrl
                  ? <img src={shop.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
                  : <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold ${tc.primary.bgLight} ${tc.primary.text}`}>{shop.name.charAt(0)}</span>}
                <span className="min-w-0 flex-1 truncate text-lg font-semibold">{shop.name}</span>
                <AppIcon name="chevron_right" size={24} color="currentColor" />
              </PublicEntityLink>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};

export default RoasterDetailPage;
