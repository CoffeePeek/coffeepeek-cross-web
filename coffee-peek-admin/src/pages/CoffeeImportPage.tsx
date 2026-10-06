import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getImportRuns } from '../api/coffeeCatalog';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { NativeSelect } from '../components/ui/NativeSelect';

export function CoffeeImportPage() {
  const [limit, setLimit] = useState(30);
  const query = useQuery({ queryKey: ['admin', 'coffee-import', limit], queryFn: ({ signal }) => getImportRuns(limit, signal), retry: false, staleTime: 0 });
  return <main className="mx-auto max-w-6xl space-y-5"><h1 className="text-2xl font-bold">Импорт кофе</h1><p>Журнал отдельных источников. Расписание выполняется на сервере.</p>
    <label className="block">Последние записи<NativeSelect value={limit} onChange={event => setLimit(Number(event.target.value))}>{[30, 50, 100].map(value => <option key={value}>{value}</option>)}</NativeSelect></label>
    <Button onClick={() => void query.refetch()} disabled={query.isFetching}>Обновить журнал</Button>
    {query.isPending && <div className="h-48 animate-pulse rounded-xl bg-stone-200 dark:bg-stone-800" aria-label="Загрузка журнала" />}
    {query.isError && <p role="alert">{query.error.message}</p>}
    {query.data?.map(run => <Card key={run.id} className="space-y-2 p-5"><h2 className="font-bold">{run.sourceKey} · {run.status === 'Applied' ? 'Applied — применён' : 'Failed — ошибка'}</h2><p className="break-all text-xs">snapshotId: {run.snapshotId}</p>
      <p>Собрано: {new Date(run.collectedAtUtc).toLocaleString()} · Применено: {new Date(run.appliedAtUtc).toLocaleString()}</p><p>Товаров: {run.products} · Вариантов: {run.variants} · Добавлено: {run.added}</p><p>missingAvailabilityApplied: {run.missingAvailabilityApplied ? 'Да' : 'Нет'}</p>{run.error && <p className="whitespace-pre-wrap text-red-600 dark:text-red-300">{run.error}</p>}
    </Card>)}
    {query.data && !query.data.length && <p>Записей импорта пока нет.</p>}
  </main>;
}
