import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Archive, ArrowRight, CheckCircle2, ChevronDown, Factory, ImageOff, MapPin, PencilLine, TriangleAlert } from 'lucide-react';
import { getAdminCoffees, type AdminCoffee } from '../api/coffeeCatalog';
import { getCatalogRoasters } from '../api/catalogs';
import { coffeeWarningLabel } from '../utils/coffeePresentation';
import { Badge, type BadgeVariant } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CoffeeBeanSign } from '../components/ui/CoffeeBeanSign';
import { NativeSelect } from '../components/ui/NativeSelect';
import { Pagination } from '../components/ui/Pagination';

const statuses: Record<AdminCoffee['status'], { label: string; description: string; variant: BadgeVariant; icon: typeof Archive }> = {
  Draft: { label: 'Черновик', description: 'Ещё не опубликован', variant: 'info', icon: PencilLine },
  Published: { label: 'Опубликован', description: 'Опубликован в каталоге', variant: 'approved', icon: CheckCircle2 },
  Archived: { label: 'В архиве', description: 'Скрыт из каталога', variant: 'default', icon: Archive },
};

function CoffeePhoto({ coffee }: { coffee: AdminCoffee }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const photo = coffee.photos.find(photo => photo.urls?.card || photo.fullUrl);
  const url = photo?.urls?.card || photo?.fullUrl;
  return <div className="flex aspect-square items-center justify-center rounded-lg bg-stone-100 dark:bg-white/5">
    {url && url !== failedUrl
      ? <img src={url} alt={`Фото кофе ${coffee.content.name}`} loading="lazy" onError={() => setFailedUrl(url)} className="h-full w-full rounded-lg object-contain p-2" />
      : <div className="flex flex-col items-center gap-2 p-2 text-text-muted dark:text-stone-400"><ImageOff className="h-6 w-6" aria-hidden="true" /><span className="text-center text-xs">{url ? 'Фото недоступно' : 'Нет фото'}</span></div>}
  </div>;
}

export function CoffeesPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') || undefined;
  const query = useQuery({ queryKey: ['admin', 'coffee', 'list', { page, status }], queryFn: ({ signal }) => getAdminCoffees({ page, pageSize: 20, status }, signal), retry: false });
  const roasters = useQuery({ queryKey: ['admin', 'catalogs', 'roasters'], queryFn: async () => (await getCatalogRoasters()).data, retry: false });
  const roasterNames = new Map(roasters.data?.map(roaster => [roaster.id, roaster.name]));
  const changePage = (next: number) => setParams({ status: status ?? '', page: String(next) });

  return <main className="mx-auto max-w-6xl space-y-5 pb-6 text-text-main dark:text-white">
    <header className="flex items-start gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10"><CoffeeBeanSign size={26} title={null} /></div>
      <div><h1 className="text-2xl font-bold">Кофе</h1><p className="mt-1 text-sm text-text-muted dark:text-stone-400">Проверяйте данные кофе и готовьте карточки к публикации в каталоге.</p></div>
    </header>

    <Card className="flex flex-wrap items-end justify-between gap-4 p-4">
      <label className="block w-full space-y-2 text-sm font-medium sm:w-64">Статус публикации
        <NativeSelect className="min-h-11" value={status ?? ''} onChange={event => setParams({ status: event.target.value, page: '1' })}>
          <option value="">Все статусы</option>
          {Object.entries(statuses).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </NativeSelect>
      </label>
      {query.data && <p className="text-sm text-text-muted dark:text-stone-400" aria-live="polite">Найдено: <strong className="text-text-main dark:text-white">{query.data.totalItems}</strong><span className="ml-3">Страница {page} из {Math.max(1, query.data.totalPages)}</span></p>}
    </Card>

    {roasters.isError && <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-amber-800 dark:text-amber-300"><TriangleAlert className="h-4 w-4" aria-hidden="true" />Не удалось загрузить имена обжарщиков.<Button variant="secondary" onClick={() => void roasters.refetch()}>Повторить</Button></p>}
    {query.isPending && <div className="h-48 animate-pulse rounded-xl bg-stone-200 dark:bg-stone-800" role="status" aria-label="Загрузка кофе" />}
    {query.isError && <Card className="space-y-3 p-5" role="alert"><p>Не удалось загрузить кофе. {query.error.message}</p><Button onClick={() => void query.refetch()}>Повторить</Button></Card>}

    {query.data && <>
      <ul className="space-y-3" aria-label="Список кофе">
        {query.data.items.map(coffee => {
          const publication = statuses[coffee.status];
          const StatusIcon = publication.icon;
          const roasterName = roasterNames.get(coffee.roasterId);
          return <li key={coffee.id}>
            <Card>
              <article className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[6rem_minmax(0,1fr)] sm:p-5 lg:grid-cols-[6rem_minmax(0,1fr)_12rem]" aria-label={coffee.content.name}>
                <CoffeePhoto coffee={coffee} />
                <div className="min-w-0 space-y-3">
                  <h2 className="text-base font-semibold leading-6 sm:text-lg"><Link className="inline-flex min-h-11 items-center rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" to={`/coffees/${coffee.id}`}>{coffee.content.name}</Link></h2>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div className="flex gap-2"><Factory className="mt-0.5 h-4 w-4 shrink-0 text-text-muted dark:text-stone-400" aria-hidden="true" /><div><dt className="text-xs text-text-muted dark:text-stone-400">Обжарщик</dt><dd className="mt-0.5 break-words text-sm font-medium">{roasterName || (roasters.isPending ? 'Загрузка…' : roasters.isError ? 'Имя недоступно' : 'Не указан в справочнике')}</dd></div></div>
                    <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-muted dark:text-stone-400" aria-hidden="true" /><div><dt className="text-xs text-text-muted dark:text-stone-400">Страна зерна</dt><dd className={`mt-0.5 break-words text-sm font-medium ${coffee.countries.length ? '' : 'text-amber-800 dark:text-amber-300'}`}>{coffee.countries.length ? coffee.countries.map(country => country.nameRu || country.nameEn || country.code).join(', ') : 'Не подтверждена'}</dd></div></div>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{coffee.content.productKind === 'green_beans' ? 'Зелёный кофе' : coffee.content.productKind === 'roasted_beans' ? 'Обжаренный кофе' : 'Вид кофе не указан'}</Badge>
                    <Badge>{coffee.content.productForm === 'whole_beans' ? 'В зёрнах' : coffee.content.productForm === 'ground_only' ? 'Молотый' : 'Форма не указана'}</Badge>
                    {coffee.content.compositionKind === 'blend' && <Badge>Смесь</Badge>}
                  </div>
                  {!!coffee.content.tasteDescriptors.length && <p className="text-sm text-text-muted dark:text-stone-400"><span className="font-medium">Вкус:</span> {coffee.content.tasteDescriptors.join(', ')}</p>}
                </div>
                <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-border-light pt-3 dark:border-border-dark lg:col-span-1 lg:flex-col lg:items-start lg:justify-start lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                  <div><Badge variant={publication.variant} className="gap-1.5"><StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />{publication.label}</Badge><p className="mt-1.5 text-xs text-text-muted dark:text-stone-400">{publication.description}</p></div>
                  {!coffee.reviewWarnings.length && <p className="flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />Нет замечаний источника</p>}
                  <Button asChild variant="secondary" className="min-h-11"><Link to={`/coffees/${coffee.id}`} aria-label={`Открыть карточку: ${coffee.content.name}`}>Открыть карточку<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>
                </div>
                {!!coffee.reviewWarnings.length && <details className="group col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 lg:col-span-3">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
                    <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Нужно проверить ({coffee.reviewWarnings.length})</span><span className="block break-words text-xs [overflow-wrap:anywhere]">{coffeeWarningLabel(coffee.reviewWarnings[0])}</span></span>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <ul className="list-disc space-y-1 border-t border-amber-200 py-3 pl-6 text-sm [overflow-wrap:anywhere] dark:border-amber-500/30">{coffee.reviewWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{coffeeWarningLabel(warning)}</li>)}</ul>
                </details>}
              </article>
            </Card>
          </li>;
        })}
      </ul>
      {!query.data.items.length && <Card className="space-y-2 p-8 text-center"><h2 className="font-semibold">Кофе не найден</h2><p className="text-sm text-text-muted dark:text-stone-400">{status ? 'Попробуйте выбрать другой статус публикации.' : 'В каталоге пока нет карточек кофе.'}</p>{status && <Button variant="secondary" onClick={() => setParams({ page: '1' })}>Показать все статусы</Button>}</Card>}
      <Pagination page={page} totalPages={query.data.totalPages} onPageChange={changePage} />
    </>}
  </main>;
}
