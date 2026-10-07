import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCoffeeDetails, getCoffeeFilterValues, searchCoffees } from '../api/discovery';
import { useTheme } from '../contexts/ThemeContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { CatalogPhoto, ClassificationBadges, CoffeeCatalogCard, OfferList, catalogButton, catalogPanel, checkedTime } from '../components/CatalogCards';
import { ShopCardSkeleton, CoffeeDetailSkeleton } from '../components/skeletons';
import { useUser } from '../contexts/UserContext';
import { getCatalogScope } from '../lib/catalogSession';
import { getThemeClasses } from '../utils/theme';
import { getThemeColors } from '../constants/colors';
import { countryFlagUrl, shareCoffee, type CoffeeFilters } from '../utils/catalogSearch';
import { useToast } from '../contexts/ToastContext';
import { InfoChip } from '../components/ShopCard';
import { AppIcon } from '../components/icons';
import Button from '../components/Button';
import PhotoLightbox from '../components/PhotoLightbox';

export default function CoffeeDetailPage() {
  const { slug = '' } = useParams();
  const { theme } = useTheme();
  const tc = getThemeClasses(theme);
  const colors = getThemeColors(theme);
  const { showToast } = useToast();
  const [activePhoto, setActivePhoto] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const navigate = useNavigate();
  const { isLoading } = useUser();
  const query = useQuery({ queryKey: ['catalog', getCatalogScope(), 'coffee-detail', slug], queryFn: ({ signal }) => getCoffeeDetails(slug, signal), enabled: !isLoading, retry: false, staleTime: 0 });
  const dictionary = useQuery({ queryKey: ['catalogs', 'coffee-filter-values'], queryFn: ({ signal }) => getCoffeeFilterValues(signal) });
  const similarFilters: CoffeeFilters = {
    productKind: query.data?.productKind, productForm: query.data?.productForm, availableOnly: true,
    ...(query.data?.classification.tasteGroups.length ? { taste: query.data.classification.tasteGroups }
      : query.data?.countries.length ? { countries: query.data.countries.map(country => country.code) }
        : { roasters: query.data ? [query.data.roaster.address.slug] : [] }),
  };
  const similar = useQuery({ queryKey: ['catalog', getCatalogScope(), 'similar-coffees', slug, similarFilters],
    queryFn: ({ signal }) => searchCoffees({ q: '', filters: similarFilters, sort: 'name_asc', page: 1, pageSize: 5 }, signal), enabled: !!query.data && !isLoading, retry: false });
  usePageTitle(query.data?.name ?? 'Кофе');
  useEffect(() => { setActivePhoto(0); setLightboxIndex(null); }, [slug]);
  useEffect(() => {
    if (!query.data) return;
    const address = query.data.address;
    if (address.slug !== slug) navigate(address.canonicalPath, { replace: true });
    const canonical = document.createElement('link'); canonical.rel = 'canonical'; canonical.href = `https://coffeepeek.by${address.canonicalPath}`;
    document.head.append(canonical); return () => canonical.remove();
  }, [query.data, slug, navigate]);
  if (query.isPending) return <CoffeeDetailSkeleton />;
  if (query.isError) return <main className="p-6"><p role="alert">{(query.error as { status?: number }).status === 404 ? 'Кофе не найден' : 'Карточка временно недоступна'}</p><button className={catalogButton} onClick={() => void query.refetch()}>Повторить</button><Link className={catalogButton} to="/coffees">Каталог кофе</Link></main>;
  const coffee = query.data;
  const photoIndex = Math.min(activePhoto, Math.max(0, coffee.photos.length - 1));
  const roasterPhoto = coffee.roaster.coverPhoto;
  const similarCoffees = similar.data?.items?.filter(item => item.address.slug !== coffee.address.slug).slice(0, 4) ?? [];
  const handleShare = async () => {
    try {
      if (await shareCoffee(coffee.name, coffee.address.canonicalPath) === 'copied') showToast('Ссылка на кофе скопирована', 'success');
    } catch { showToast('Не удалось поделиться ссылкой', 'error'); }
  };
  const countries = coffee.countries.length ? coffee.countries.map(country => <span key={country.code} className="inline-flex items-center gap-2">
    {countryFlagUrl(country.code) && <img src={countryFlagUrl(country.code)} alt="" width={24} height={18} loading="lazy" className="h-[18px] w-6 shrink-0 rounded-sm object-cover" onError={event => { event.currentTarget.hidden = true; }} />}{country.nameRu}
  </span>) : 'Происхождение не подтверждено';
  const productKind = coffee.productKind === 'green_beans' ? 'Зелёный кофе' : 'Обжаренный кофе';
  const productForm = coffee.productForm === 'ground_only' ? 'Молотый' : 'В зёрнах';
  return <main className={`mx-auto max-w-[1200px] space-y-8 px-4 py-5 pb-28 font-body sm:px-6 ${tc.text.primary}`}>
    <nav aria-label="Навигационная цепочка" className={`text-sm ${tc.text.secondary}`}>
      <ol className="flex flex-wrap items-center gap-x-2">
        <li><Link to="/coffees" className="inline-flex min-h-11 items-center hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Кофе</Link></li>
        <li aria-hidden="true">/</li>
        <li className="min-w-0 max-w-full"><Link to={coffee.roaster.address.canonicalPath} className="inline-flex min-h-11 items-center break-words hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{coffee.roaster.name}</Link></li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="min-w-0 max-w-full break-words">{coffee.name}</li>
      </ol>
    </nav>
    <section aria-labelledby="coffee-name" className="grid items-start gap-7 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-9">
      <div className="min-w-0 space-y-3">
        <div className="relative">
          <CatalogPhoto photo={coffee.photos[photoIndex]} name={coffee.name} size="detail" loading="eager" className="aspect-[10/11] bg-stone-100 [&_img]:object-contain dark:bg-[#2D241F]" />
          {!!coffee.photos.length && <Button variant="secondary" aria-label="Открыть фото кофе в полном размере" onClick={() => setLightboxIndex(photoIndex)} className="!absolute bottom-3 right-3 h-11 w-11 !rounded-full !p-0"><AppIcon name="search" size={22} aria-hidden /></Button>}
        </div>
        {coffee.photos.length > 1 && <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Фотографии кофе">
          {coffee.photos.map((photo, index) => <button key={photo.fullUrl} type="button" onClick={() => setActivePhoto(index)} aria-label={`Фото кофе ${index + 1}`} aria-pressed={index === photoIndex}
            className={`w-20 shrink-0 overflow-hidden rounded-xl border-2 p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary ${index === photoIndex ? 'border-primary' : 'border-transparent'}`}>
            <CatalogPhoto photo={photo} name={`${coffee.name} — фото ${index + 1}`} size="thumbnail" className="aspect-square" />
          </button>)}
        </div>}
      </div>
      <div className="min-w-0 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <Link to={coffee.roaster.address.canonicalPath} className="flex min-w-0 items-center gap-3 rounded-xl outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl ${tc.bg.card} ${tc.border.default} border`}>
              {roasterPhoto ? <img src={roasterPhoto.urls?.thumbnail || roasterPhoto.fullUrl} alt="" className="h-full w-full object-contain" /> : <AppIcon name="factory" size={28} aria-hidden />}
            </span>
            <span className="min-w-0"><span className="flex items-center gap-1 text-sm font-semibold"><span className="truncate">{coffee.roaster.name}</span><AppIcon name="chevron_right" size={16} aria-hidden /></span><span className={`mt-1 block text-xs ${tc.text.secondary}`}>Обжарщик</span></span>
          </Link>
          <Button variant="secondary" aria-label="Поделиться кофе" onClick={() => void handleShare()} className="h-11 w-11 shrink-0 !p-0"><AppIcon name="share" size={22} aria-hidden /></Button>
        </div>
        <div className="space-y-4">
          <h1 id="coffee-name" className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{coffee.name}</h1>
          <div className="flex flex-wrap gap-2">
            <InfoChip colors={colors}><span className="flex flex-wrap items-center gap-2 py-1">{countries}</span></InfoChip>
            <InfoChip colors={colors}><AppIcon name="coffee-bean" size={20} className="mr-2 shrink-0" aria-hidden />{productKind} · {productForm}</InfoChip>
          </div>
          {coffee.description && (coffee.description.length > 300 || coffee.description.split('\n').length > 4
            ? <details key={coffee.address.slug} className="group">
              <summary className={`inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg text-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden ${tc.text.primary}`}>
                <span className="group-open:hidden">Показать всё</span><span className="hidden group-open:inline">Скрыть</span>
              </summary>
              <p className={`whitespace-pre-wrap break-words text-base leading-relaxed ${tc.text.secondary}`}>{coffee.description}</p>
            </details>
            : <p className={`whitespace-pre-wrap break-words text-base leading-relaxed ${tc.text.secondary}`}>{coffee.description}</p>)}
        </div>
        <ClassificationBadges value={coffee.classification} groups={dictionary.data ?? []} layout="details" />
        {dictionary.isError && <p role="alert" className={`text-sm ${tc.text.secondary}`}>Названия характеристик временно недоступны. <button className={catalogButton} onClick={() => void dictionary.refetch()}>Повторить</button></p>}
        {!!coffee.tasteDescriptors.length && <section className={`space-y-3 border-t pt-5 ${tc.border.default}`}>
          <h2 className="text-base font-bold">Вкусовой профиль</h2>
          <div className="flex flex-wrap gap-2">{coffee.tasteDescriptors.map(taste => <InfoChip key={taste} colors={colors}>{taste}</InfoChip>)}</div>
        </section>}
        <section className={`space-y-4 border-t pt-5 ${tc.border.default}`}>
          <h2 className="text-base font-bold">О кофе</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className={`mb-2 text-xs ${tc.text.secondary}`}>Страна</dt><dd className="flex flex-wrap gap-2">{countries}</dd></div>
            <div><dt className={`mb-2 text-xs ${tc.text.secondary}`}>Форма</dt><dd className="flex items-center gap-2"><AppIcon name="coffee-bean" size={22} aria-hidden />{productForm}</dd></div>
          </dl>
        </section>
      </div>
    </section>
    <section aria-labelledby="coffee-offers" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="coffee-offers" className="text-2xl font-bold tracking-tight sm:text-3xl">Варианты покупки</h2><p className={`text-xs ${tc.text.secondary}`}>{checkedTime(coffee.catalogCheckedAtUtc)}</p></div>
      <OfferList offers={coffee.offers} defaults={coffee.classification.defaultBrewPurposes} groups={dictionary.data ?? []} />
      {!coffee.offers.length && <p className={tc.text.secondary}>Предложений покупки пока нет.</p>}
    </section>
    <section aria-labelledby="similar-coffees" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="similar-coffees" className="text-xl font-bold">Похожие сорта</h2><Link to={`/coffees?filters=${encodeURIComponent(JSON.stringify(similarFilters))}`} className="inline-flex min-h-11 items-center gap-2 text-sm underline outline-none focus-visible:ring-2 focus-visible:ring-primary">Смотреть все<AppIcon name="arrow_forward" size={18} aria-hidden /></Link></div>
      {similar.isPending && <div className="relative flex gap-4 overflow-x-auto pb-3 [contain:paint] sm:grid sm:grid-cols-2 lg:grid-cols-4 [&>article]:w-[80%] [&>article]:shrink-0 sm:[&>article]:w-auto" role="status" aria-label="Загрузка похожих сортов"><ShopCardSkeleton variant="coffee" count={4} /></div>}
      {similar.isError && <div className={catalogPanel} role="alert"><p>Похожие сорта временно недоступны.</p><Button variant="secondary" className="mt-3" onClick={() => void similar.refetch()}>Повторить</Button></div>}
      {!!similarCoffees.length && <div role="group" aria-label="Похожие сорта кофе" tabIndex={0} className="relative flex gap-4 overflow-x-auto pb-3 outline-none [contain:paint] focus-visible:ring-2 focus-visible:ring-primary sm:grid sm:grid-cols-2 lg:grid-cols-4 [&>article]:w-[80%] [&>article]:shrink-0 sm:[&>article]:w-auto">{similarCoffees.map(item => <CoffeeCatalogCard key={item.address.slug} coffee={item} groups={dictionary.data ?? []} />)}</div>}
      {similar.isSuccess && !similarCoffees.length && <p className={`text-sm ${tc.text.secondary}`}>Похожих сортов пока нет.</p>}
    </section>
    {lightboxIndex !== null && !!coffee.photos.length && <PhotoLightbox images={coffee.photos.map(photo => photo.urls?.fullscreen || photo.fullUrl)} shopName={coffee.name} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />}
  </main>;
}
