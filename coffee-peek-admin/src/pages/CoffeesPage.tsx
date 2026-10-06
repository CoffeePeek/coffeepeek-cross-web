import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAdminCoffees } from '../api/coffeeCatalog';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { NativeSelect } from '../components/ui/NativeSelect';

export function CoffeesPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') || undefined;
  const query = useQuery({ queryKey: ['admin', 'coffee', 'list', { page, status }], queryFn: ({ signal }) => getAdminCoffees({ page, pageSize: 20, status }, signal), retry: false });
  return <main className="mx-auto max-w-6xl space-y-5"><h1 className="text-2xl font-bold">Кофе</h1><label className="block">Статус<NativeSelect value={status ?? ''} onChange={event => setParams({ status: event.target.value, page: '1' })}><option value="">Все</option>{['Draft', 'Published', 'Archived'].map(value => <option key={value}>{value}</option>)}</NativeSelect></label>
    {query.isPending && <div className="h-48 animate-pulse rounded-xl bg-stone-200 dark:bg-stone-800" aria-label="Загрузка кофе" />}
    {query.isError && <p role="alert">{query.error.message} <Button onClick={() => void query.refetch()}>Повторить</Button></p>}
    {query.data && <><p>Результатов: {query.data.totalItems}</p>{query.data.items.map(coffee => <Card key={coffee.id} className="p-4"><Link className="inline-flex min-h-11 items-center font-semibold underline" to={`/coffees/${coffee.id}`}>{coffee.content.name}</Link><p>{coffee.status} · версия {coffee.version} · предупреждений {coffee.reviewWarnings.length}</p></Card>)}{!query.data.items.length && <p>Кофе с таким статусом не найден.</p>}
      <nav aria-label="Страницы кофе" className="flex flex-wrap items-center gap-3"><Button disabled={page <= 1} onClick={() => setParams({ status: status ?? '', page: String(page - 1) })}>Назад</Button><span>{page} / {Math.max(1, query.data.totalPages)}</span><Button disabled={page >= query.data.totalPages} onClick={() => setParams({ status: status ?? '', page: String(page + 1) })}>Далее</Button></nav></>}
  </main>;
}
