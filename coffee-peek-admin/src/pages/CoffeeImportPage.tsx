import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { getImportRuns } from '../api/coffeeCatalog';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { NativeSelect } from '../components/ui/NativeSelect';

function formatTime(value: string) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? date.toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Не указано';
}

export function CoffeeImportPage() {
  const [limit, setLimit] = useState(30);
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const query = useQuery({ queryKey: ['admin', 'coffee-import', limit], queryFn: ({ signal }) => getImportRuns(limit, signal), retry: false, staleTime: 0 });
  const runs = query.data ?? [];
  const sources = [...new Set([...runs.map(run => run.sourceKey), ...(source ? [source] : [])])].sort();
  const visibleRuns = runs.filter(run => (!source || run.sourceKey === source) && (!status || run.status === status));

  return <section aria-label="Журнал импорта кофе" className="min-w-0 w-full space-y-4 text-text-main dark:text-white">
    <p className="text-sm text-text-muted dark:text-stone-400">История автоматического обновления каталога кофе из источников.</p>
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-full sm:w-52"><NativeSelect aria-label="Источник" value={source} onChange={event => setSource(event.target.value)}>
        <option value="">Все источники</option>
        {sources.map(value => <option key={value} value={value}>{value}</option>)}
      </NativeSelect></div>
      <div className="w-full sm:w-44"><NativeSelect aria-label="Статус импорта" value={status} onChange={event => setStatus(event.target.value)}>
        <option value="">Все статусы</option><option value="Applied">Успешно</option><option value="Failed">Ошибка</option>
      </NativeSelect></div>
      <div className="w-40"><NativeSelect aria-label="Количество запусков" value={limit} onChange={event => setLimit(Number(event.target.value))}>
        {[30, 50, 100].map(value => <option key={value} value={value}>Последние {value}</option>)}
      </NativeSelect></div>
      <Button variant="secondary" size="sm" loading={query.isFetching} onClick={() => void query.refetch()}>
        {!query.isFetching && <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}Обновить журнал
      </Button>
      {query.data && <p className="text-xs text-text-muted dark:text-stone-400 sm:ml-auto" role="status">Показано: {visibleRuns.length} из {runs.length}</p>}
    </div>
    {query.isPending && <p role="status" className="py-6 text-sm text-text-muted">Загрузка журнала…</p>}
    {query.isError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">Не удалось обновить журнал: {query.error.message}</p>}
    <ul className="divide-y divide-border-light dark:divide-border-dark">
      {visibleRuns.map(run => <li key={run.id} className="min-w-0 py-4">
        <article className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto]" aria-label={`Импорт: ${run.sourceKey}`}>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-all text-sm font-semibold">{run.sourceKey}</h2>
              <Badge variant={run.status === 'Applied' ? 'approved' : 'rejected'} className="gap-1">
                {run.status === 'Applied' ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <AlertCircle className="h-3 w-3" aria-hidden="true" />}
                {run.status === 'Applied' ? 'Каталог обновлён' : 'Ошибка импорта'}
              </Badge>
            </div>
            <p className="text-xs text-text-muted dark:text-stone-400">{run.status === 'Applied' ? 'Обновлён' : 'Ошибка записана'}: <time dateTime={run.appliedAtUtc}>{formatTime(run.appliedAtUtc)}</time></p>
            {run.error && <p className="whitespace-pre-wrap break-words text-sm text-red-700 dark:text-red-300">{run.error}</p>}
          </div>
          {run.status === 'Applied' && <dl className="flex flex-wrap gap-x-6 gap-y-1 md:text-right">
            <div><dt className="text-xs text-text-muted dark:text-stone-400">Товаров</dt><dd className="text-sm font-semibold tabular-nums">{run.products}</dd></div>
            <div><dt className="text-xs text-text-muted dark:text-stone-400">Вариантов</dt><dd className="text-sm font-semibold tabular-nums">{run.variants}</dd></div>
            <div><dt className="text-xs text-text-muted dark:text-stone-400">Новых товаров</dt><dd className="text-sm font-semibold tabular-nums">{run.added}</dd></div>
          </dl>}
          <details className="min-w-0 text-xs md:col-span-2">
            <summary className="w-fit cursor-pointer rounded text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-stone-400">Подробности запуска</summary>
            <dl className="mt-2 grid min-w-0 gap-2 text-text-muted dark:text-stone-400">
              <div><dt className="inline">Данные собраны: </dt><dd className="inline"><time dateTime={run.collectedAtUtc}>{formatTime(run.collectedAtUtc)}</time></dd></div>
              {run.status === 'Applied' && <div><dt className="inline">Товары, исчезнувшие из источника: </dt><dd className="inline">{run.missingAvailabilityApplied ? 'наличие сброшено в «Неизвестно»' : 'наличие сохранено'}</dd></div>}
              <div><dt>Идентификатор снимка данных</dt><dd className="mt-0.5 break-all font-mono">{run.snapshotId}</dd></div>
            </dl>
          </details>
        </article>
      </li>)}
    </ul>
    {query.data && !visibleRuns.length && <div className="py-8 text-center text-sm text-text-muted dark:text-stone-400">
      <p>{runs.length ? 'Нет запусков с выбранными фильтрами.' : 'Записей импорта пока нет.'}</p>
      {(source || status) && <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSource(''); setStatus(''); }}>Сбросить фильтры</Button>}
    </div>}
  </section>;
}
