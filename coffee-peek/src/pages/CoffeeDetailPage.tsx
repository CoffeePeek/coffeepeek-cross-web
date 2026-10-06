import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCoffeeDetails, getCoffeeFilterValues } from '../api/discovery';
import { useTheme } from '../contexts/ThemeContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { CatalogPhoto, ClassificationBadges, OfferList, catalogButton, checkedTime } from '../components/CatalogCards';
import { ShopDetailSkeleton } from '../components/skeletons';
import { useUser } from '../contexts/UserContext';
import { getCatalogScope } from '../lib/catalogSession';

export default function CoffeeDetailPage() {
  const { slug = '' } = useParams();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { isLoading } = useUser();
  const query = useQuery({ queryKey: ['catalog', getCatalogScope(), 'coffee-detail', slug], queryFn: ({ signal }) => getCoffeeDetails(slug, signal), enabled: !isLoading, retry: false, staleTime: 0 });
  const dictionary = useQuery({ queryKey: ['catalogs', 'coffee-filter-values'], queryFn: ({ signal }) => getCoffeeFilterValues(signal) });
  usePageTitle(query.data?.name ?? 'Кофе');
  useEffect(() => {
    if (!query.data) return;
    const address = query.data.address;
    if (address.slug !== slug) navigate(address.canonicalPath, { replace: true });
    const canonical = document.createElement('link'); canonical.rel = 'canonical'; canonical.href = `https://coffeepeek.by${address.canonicalPath}`;
    document.head.append(canonical); return () => canonical.remove();
  }, [query.data, slug, navigate]);
  if (query.isPending) return <ShopDetailSkeleton />;
  if (query.isError) return <main className="p-6"><p role="alert">{(query.error as { status?: number }).status === 404 ? 'Кофе не найден' : 'Карточка временно недоступна'}</p><button className={catalogButton} onClick={() => void query.refetch()}>Повторить</button><Link className={catalogButton} to="/coffees">Каталог кофе</Link></main>;
  const coffee = query.data;
  return <main className={`mx-auto max-w-4xl space-y-5 p-4 pb-28 sm:p-6 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
    <Link className={catalogButton} to="/coffees">← Каталог кофе</Link><h1 className="text-3xl font-bold">{coffee.name}</h1>
    <Link className="inline-flex min-h-11 items-center underline" to={coffee.roaster.address.canonicalPath}>{coffee.roaster.name}</Link>
    {coffee.photos.length ? <div className="grid gap-3 sm:grid-cols-2">{coffee.photos.map(photo => <CatalogPhoto key={photo.fullUrl} photo={photo} name={coffee.name} />)}</div> : <CatalogPhoto photo={null} name={coffee.name} />}
    <p>{coffee.productKind === 'green_beans' ? 'Зелёный кофе' : 'Обжаренный кофе'} · {coffee.productForm === 'ground_only' ? 'Молотый' : 'В зёрнах'}</p>
    <p>{coffee.countries.map(country => country.nameRu).join(', ') || 'Происхождение не подтверждено'}</p>
    <ClassificationBadges value={coffee.classification} groups={dictionary.data ?? []} />
    {dictionary.isError && <p role="alert">Названия характеристик временно недоступны. <button className={catalogButton} onClick={() => void dictionary.refetch()}>Повторить</button></p>}
    <p className="whitespace-pre-wrap">{coffee.description}</p><p>{coffee.tasteDescriptors.join(', ')}</p>
    <h2 className="text-2xl font-bold">Варианты покупки</h2><OfferList offers={coffee.offers} defaults={coffee.classification.defaultBrewPurposes} />{!coffee.offers.length && <p>Предложений покупки пока нет.</p>}
    <p className="text-sm">{checkedTime(coffee.catalogCheckedAtUtc)}</p>
  </main>;
}
