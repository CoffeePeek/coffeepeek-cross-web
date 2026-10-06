import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Archive, CheckCircle2, ChevronDown, ImageOff, PencilLine, TriangleAlert } from 'lucide-react';
import { getAdminCoffees, type AdminCoffee } from '../api/coffeeCatalog';
import { getCatalogRoasters } from '../api/catalogs';
import { coffeeWarningLabel } from '../utils/coffeePresentation';
import { Badge, type BadgeVariant } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { NativeSelect } from '../components/ui/NativeSelect';
import { Pagination } from '../components/ui/Pagination';

const statuses: Record<AdminCoffee['status'], { label: string; variant: BadgeVariant; icon: typeof Archive }> = {
  Draft: { label: 'Черновик', variant: 'info', icon: PencilLine },
  Published: { label: 'Опубликован', variant: 'approved', icon: CheckCircle2 },
  Archived: { label: 'В архиве', variant: 'default', icon: Archive },
};

function CoffeePhoto({ coffee }: { coffee: AdminCoffee }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const photo = coffee.photos.find(photo => photo.urls?.card || photo.fullUrl);
  const url = photo?.urls?.card || photo?.fullUrl;
  return <div className="flex aspect-square items-center justify-center rounded-lg bg-stone-100 dark:bg-white/5">
    {url && url !== failedUrl
      ? <img src={url} alt={`Фото кофе ${coffee.content.name}`} loading="lazy" onError={() => setFailedUrl(url)} className="h-full w-full rounded-lg object-contain p-2" />
      : <div className="flex flex-col items-center gap-1 p-1 text-text-muted dark:text-stone-400"><ImageOff className="h-4 w-4" aria-hidden="true" /><span className="text-center text-[10px]">{url ? 'Фото недоступно' : 'Нет фото'}</span></div>}
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

  return <section aria-label="Кофе" className="mx-auto max-w-6xl space-y-3 pb-6 text-text-main dark:text-white">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="w-44 shrink-0"><span className="sr-only">Статус публикации</span>
        <NativeSelect value={status ?? ''} onChange={event => setParams({ status: event.target.value, page: '1' })}>
          <option value="">Все статусы</option>
          {Object.entries(statuses).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </NativeSelect>
      </label>
      {query.data && <p className="flex flex-wrap gap-x-3 text-xs text-text-muted dark:text-stone-400" aria-live="polite"><span>Найдено: <strong className="text-text-main dark:text-white">{query.data.totalItems}</strong></span><span>Страница {page} из {Math.max(1, query.data.totalPages)}</span></p>}
    </div>

    {roasters.isError && <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-amber-800 dark:text-amber-300"><TriangleAlert className="h-4 w-4" aria-hidden="true" />Не удалось загрузить имена обжарщиков.<Button variant="secondary" onClick={() => void roasters.refetch()}>Повторить</Button></p>}
    {query.isPending && <div className="h-48 animate-pulse rounded-xl bg-stone-200 dark:bg-stone-800" role="status" aria-label="Загрузка кофе" />}
    {query.isError && <Card className="space-y-3 p-5" role="alert"><p>Не удалось загрузить кофе. {query.error.message}</p><Button onClick={() => void query.refetch()}>Повторить</Button></Card>}

    {query.data && <>
      <ul className="divide-y divide-border-light dark:divide-border-dark" aria-label="Список кофе">
        {query.data.items.map(coffee => {
          const publication = statuses[coffee.status];
          const StatusIcon = publication.icon;
          const roasterName = roasterNames.get(coffee.roasterId);
          return <li key={coffee.id}>
            <article className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 py-4 sm:grid-cols-[4rem_minmax(0,1fr)]" aria-label={coffee.content.name}>
              <CoffeePhoto coffee={coffee} />
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <h2 className="min-w-0 text-base font-semibold leading-6"><Link className="inline-block rounded-sm py-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" to={`/coffees/${coffee.id}`}>{coffee.content.name}</Link></h2>
                  <Badge variant={publication.variant} className="shrink-0 gap-1"><StatusIcon className="h-3 w-3" aria-hidden="true" />{publication.label}</Badge>
                </div>
                <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <div className="flex min-w-0 gap-1"><dt className="text-text-muted dark:text-stone-400">Обжарщик:</dt><dd className="min-w-0 break-words">{roasterName || (roasters.isPending ? 'Загрузка…' : roasters.isError ? 'Имя недоступно' : 'Не указан в справочнике')}</dd></div>
                  <div className="flex min-w-0 gap-1"><dt className="text-text-muted dark:text-stone-400">Страна:</dt><dd className={`min-w-0 break-words ${coffee.countries.length ? '' : 'text-amber-800 dark:text-amber-300'}`}>{coffee.countries.length ? coffee.countries.map(country => country.nameRu || country.nameEn || country.code).join(', ') : 'Не подтверждена'}</dd></div>
                </dl>
                <p className="text-xs text-text-muted dark:text-stone-400">
                  {coffee.content.productKind === 'green_beans' ? 'Зелёный кофе' : coffee.content.productKind === 'roasted_beans' ? 'Обжаренный кофе' : 'Вид кофе не указан'} · {coffee.content.productForm === 'whole_beans' ? 'В зёрнах' : coffee.content.productForm === 'ground_only' ? 'Молотый' : 'Форма не указана'}{coffee.content.compositionKind === 'blend' && ' · Смесь'}
                </p>
                {!!coffee.content.tasteDescriptors.length && <p className="text-xs text-text-muted dark:text-stone-400">Вкус: {coffee.content.tasteDescriptors.join(', ')}</p>}
                {!!coffee.reviewWarnings.length && <details className="group text-xs text-amber-800 dark:text-amber-300">
                  <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Нужно проверить ({coffee.reviewWarnings.length})</span>
                    <ChevronDown className="h-3 w-3 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <ul className="list-disc space-y-1 pb-1 pl-5 [overflow-wrap:anywhere]">{coffee.reviewWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{coffeeWarningLabel(warning)}</li>)}</ul>
                </details>}
              </div>
            </article>
          </li>;
        })}
      </ul>
      {!query.data.items.length && <Card className="space-y-2 p-8 text-center"><h2 className="font-semibold">Кофе не найден</h2><p className="text-sm text-text-muted dark:text-stone-400">{status ? 'Попробуйте выбрать другой статус публикации.' : 'В каталоге пока нет карточек кофе.'}</p>{status && <Button variant="secondary" onClick={() => setParams({ page: '1' })}>Показать все статусы</Button>}</Card>}
      <Pagination page={page} totalPages={query.data.totalPages} onPageChange={changePage} />
    </>}
  </section>;
}
