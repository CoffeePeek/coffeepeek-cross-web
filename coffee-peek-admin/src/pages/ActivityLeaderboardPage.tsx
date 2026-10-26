import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { getLeaderboard, type LeaderboardEntry, type LeaderboardPeriod } from '../api/leaderboard';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { LoadError } from '../components/ui/LoadError';
import { Pagination } from '../components/ui/Pagination';
import { getErrorMessage } from '../utils/errors';

const PAGE_SIZE = 20;
const columns: ColumnDef<LeaderboardEntry>[] = [
  { accessorKey: 'rank', header: 'Место' },
  { accessorKey: 'username', header: 'Пользователь' },
  { accessorKey: 'points', header: 'Баллы', cell: ({ row }) => <strong>{row.original.points}</strong> },
  { accessorKey: 'additions', header: 'Добавления' },
  { accessorKey: 'edits', header: 'Правки' },
  { accessorKey: 'checkIns', header: 'Чекины' },
];

function formatDate(date: string, offsetDays = 0) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value.toLocaleDateString('ru-RU', { timeZone: 'UTC' });
}

export function ActivityLeaderboardPage() {
  const [params, setParams] = useSearchParams();
  const period: LeaderboardPeriod = params.get('period') === 'month' ? 'month' : 'week';
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Minsk' }).format(new Date());
  const requestedDate = params.get('date') ?? '';
  const date = /^(20\d{2}|2100)-\d{2}-\d{2}$/.test(requestedDate)
    && !Number.isNaN(Date.parse(requestedDate)) && new Date(requestedDate).toISOString().slice(0, 10) === requestedDate ? requestedDate : today;
  const requestedPage = Number(params.get('page') ?? 1);
  const page = Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 10000 ? requestedPage : 1;
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'leaderboard', { period, date, page }],
    queryFn: () => getLeaderboard({ period, date, page, pageSize: PAGE_SIZE }).then(response => response.data),
  });
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };
  const totalPages = data ? Math.min(10000, Math.ceil(data.totalCount / data.pageSize)) : 0;

  return <div className="mx-auto w-full max-w-[1600px] space-y-6">
    <header>
      <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">Рейтинг активности</h2>
      <p className="mt-1 text-sm text-text-muted dark:text-stone-400">Добавление — 3 балла, правка — 1, чекин — 2. Баллы рассчитывает сервер; аккаунты Admin и Moderator исключены.</p>
    </header>
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border-light bg-white p-3 shadow-sm dark:border-border-dark dark:bg-surface-dark">
      <div role="group" aria-label="Период рейтинга" className="flex gap-2">
        {(['week', 'month'] as const).map(value => <Button key={value} aria-pressed={period === value} variant={period === value ? 'primary' : 'secondary'} onClick={() => setParam('period', value)}>{value === 'week' ? 'Неделя' : 'Месяц'}</Button>)}
      </div>
      <label className="space-y-1 text-sm"><span>Дата внутри периода</span><Input type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={event => { if (event.target.validity.valid) setParam('date', event.target.value); }} /></label>
    </div>
    {error && <LoadError message={getErrorMessage(error, 'Не удалось загрузить рейтинг')} onRetry={() => void refetch()} retrying={isFetching} />}
    {data && <p className="text-sm text-text-muted dark:text-stone-400">{formatDate(data.startsOn)} — {formatDate(data.endsOnExclusive, -1)} · {data.timeZone} · Участников: {data.totalCount}</p>}
    <Card>
      <DataTable columns={columns} data={data?.items ?? []} loading={isLoading} emptyText="За этот период нет активности" getRowId={entry => entry.authorId} />
      {data && <div className="border-t border-border-light px-5 py-3 dark:border-border-dark">
        {data.items.length === 0 && page > 1 && <Button variant="secondary" onClick={() => setParam('page', '1')}>На первую страницу</Button>}
        <Pagination page={page} totalPages={totalPages} onPageChange={next => setParam('page', String(next))} />
      </div>}
    </Card>
  </div>;
}
