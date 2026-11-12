import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Download, RefreshCw, Search } from 'lucide-react';
import {
  downloadOperationalLogs,
  getOperationalLogs,
  type OperationalLogEntry,
  type OperationalLogSearch,
} from '../api/operationalLogs';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { LoadError } from '../components/ui/LoadError';
import { NativeSelect } from '../components/ui/NativeSelect';
import { Pagination } from '../components/ui/Pagination';
import { getErrorMessage } from '../utils/errors';

const PAGE_SIZE = 50;
const MAX_PAGE = 10_000 / PAGE_SIZE;
const SERVICES = [
  { value: '', label: 'Все сервисы' },
  { value: 'gateway', label: 'Шлюз' },
  { value: 'account', label: 'Аккаунты' },
  { value: 'shops', label: 'Кофейни' },
  { value: 'moderation', label: 'Модерация' },
  { value: 'media', label: 'Медиа' },
];
const LEVELS = [
  { value: '', label: 'Все уровни' },
  { value: 'Information', label: 'События' },
  { value: 'Warning', label: 'Предупреждения' },
  { value: 'Error', label: 'Ошибки' },
  { value: 'Fatal', label: 'Критические ошибки' },
];

function localDateTime(iso: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function utcDateTime(local: string) {
  if (!local) return '';
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function levelLabel(level: string) {
  return LEVELS.find(option => option.value === level)?.label ?? level;
}

function levelStyle(level: string) {
  if (level === 'Fatal' || level === 'Error') return 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300';
  if (level === 'Warning') return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300';
  return 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300';
}

function LogEntry({ entry }: { entry: OperationalLogEntry }) {
  const service = SERVICES.find(option => option.value === entry.service)?.label ?? entry.service;
  return (
    <li className="border-b border-border-light px-4 py-4 last:border-b-0 dark:border-border-dark sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-text-muted dark:text-stone-400">
        <time className="font-mono tabular-nums" dateTime={entry.timestampUtc}>
          {new Date(entry.timestampUtc).toLocaleString('ru-RU')}
        </time>
        <span className="rounded bg-stone-100 px-2 py-0.5 font-medium text-text-main dark:bg-white/10 dark:text-stone-200">{service}</span>
        <span className={'rounded px-2 py-0.5 font-semibold ' + levelStyle(entry.level)}>{levelLabel(entry.level)}</span>
        {entry.category && <span className="break-all">{entry.category}</span>}
        {entry.eventId != null && <span className="font-mono">Событие #{entry.eventId}</span>}
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-main dark:text-stone-100">{entry.message}</p>
      {entry.exception && (
        <details className="mt-2 rounded-md border border-red-200 bg-red-50/60 p-2 dark:border-red-500/20 dark:bg-red-500/5">
          <summary className="cursor-pointer text-xs font-medium text-red-800 dark:text-red-300">Подробности ошибки</summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs leading-5 text-red-900 dark:text-red-200">{entry.exception}</pre>
        </details>
      )}
      {(entry.correlationId || entry.traceId) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-text-muted dark:text-stone-400">
          {entry.correlationId && <span className="break-all">Correlation ID: {entry.correlationId}</span>}
          {entry.traceId && <span className="break-all">Trace ID: {entry.traceId}</span>}
        </div>
      )}
    </li>
  );
}

export function OperationalLogsPage() {
  const [params, setParams] = useSearchParams();
  const service = params.get('service') ?? '';
  const level = params.get('level') ?? '';
  const q = params.get('q') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const sort = params.get('sort') === 'asc' ? 'asc' : 'desc';
  const requestedPage = Number(params.get('page') ?? '1');
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= MAX_PAGE ? requestedPage : 1;
  const invalidRange = Boolean(from && to && from > to);
  const [queryDraft, setQueryDraft] = useState(q);
  const [downloading, setDownloading] = useState<'csv' | 'jsonl' | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  useEffect(() => setQueryDraft(q), [q]);

  const search: OperationalLogSearch = {
    service: service || undefined,
    level: level || undefined,
    q: q || undefined,
    from: from || undefined,
    to: to || undefined,
    sort,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['admin', 'operational-logs', search],
    queryFn: () => getOperationalLogs(search).then(response => response.data),
    enabled: !invalidRange,
  });

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };
  const applyQuery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilter('q', queryDraft.trim());
  };
  const download = async (format: 'csv' | 'jsonl') => {
    setDownloading(format);
    setDownloadError(null);
    try {
      const blob = await downloadOperationalLogs(search, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'coffeepeek-logs-' + new Date().toISOString().slice(0, 10) + '.' + format;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (downloadFailure) {
      setDownloadError(getErrorMessage(downloadFailure, 'Не удалось выгрузить логи'));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">Логи сервисов</h2>
          <p className="mt-1 text-sm text-text-muted dark:text-stone-400">События и ошибки за последние 7 дней. Старые записи удаляются автоматически.</p>
        </div>
        <Button variant="secondary" onClick={() => void refetch()} disabled={invalidRange} loading={isFetching}>
          <RefreshCw className="h-4 w-4" /> Обновить
        </Button>
      </header>

      <section className="space-y-3 rounded-xl border border-border-light bg-white p-4 shadow-sm dark:border-border-dark dark:bg-surface-dark" aria-label="Фильтры логов">
        <form onSubmit={applyQuery} className="flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Поиск по сообщению, категории и идентификатору</span>
            <Input value={queryDraft} onChange={event => setQueryDraft(event.target.value)} placeholder="Сообщение, категория или ID запроса" maxLength={200} />
          </label>
          <Button type="submit"><Search className="h-4 w-4" /> Найти</Button>
        </form>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-xs font-medium text-text-muted dark:text-stone-400">
            <span>Сервис</span>
            <NativeSelect value={service} onChange={event => setFilter('service', event.target.value)}>
              {SERVICES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </NativeSelect>
          </label>
          <label className="space-y-1 text-xs font-medium text-text-muted dark:text-stone-400">
            <span>Уровень</span>
            <NativeSelect value={level} onChange={event => setFilter('level', event.target.value)}>
              {LEVELS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </NativeSelect>
          </label>
          <label className="space-y-1 text-xs font-medium text-text-muted dark:text-stone-400">
            <span>С даты и времени</span>
            <Input type="datetime-local" value={localDateTime(from)} onChange={event => setFilter('from', utcDateTime(event.target.value))} />
          </label>
          <label className="space-y-1 text-xs font-medium text-text-muted dark:text-stone-400">
            <span>До даты и времени</span>
            <Input type="datetime-local" value={localDateTime(to)} onChange={event => setFilter('to', utcDateTime(event.target.value))} />
          </label>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="w-48 space-y-1 text-xs font-medium text-text-muted dark:text-stone-400">
            <span>Порядок</span>
            <NativeSelect value={sort} onChange={event => setFilter('sort', event.target.value)}>
              <option value="desc">Сначала новые</option>
              <option value="asc">Сначала старые</option>
            </NativeSelect>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={!data?.total || invalidRange} loading={downloading === 'csv'} onClick={() => void download('csv')}>
              <Download className="h-3.5 w-3.5" /> Скачать CSV
            </Button>
            <Button variant="secondary" size="sm" disabled={!data?.total || invalidRange} loading={downloading === 'jsonl'} onClick={() => void download('jsonl')}>
              <Download className="h-3.5 w-3.5" /> Скачать JSONL
            </Button>
          </div>
        </div>
        {invalidRange && <p role="alert" className="text-sm text-red-700 dark:text-red-300">Начало периода должно быть раньше конца.</p>}
        {downloadError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{downloadError}</p>}
      </section>

      {error && <LoadError message={getErrorMessage(error, 'Не удалось загрузить логи')} onRetry={() => void refetch()} retrying={isFetching} />}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-light px-4 py-3 text-sm dark:border-border-dark sm:px-5">
          <strong className="text-text-main dark:text-white">Записи</strong>
          {data && <span className="tabular-nums text-text-muted dark:text-stone-400">Найдено: {data.total.toLocaleString('ru-RU')}</span>}
        </div>
        {isLoading && <p className="px-5 py-8 text-center text-sm text-text-muted">Загрузка логов…</p>}
        {!isLoading && data?.items.length === 0 && <p className="px-5 py-8 text-center text-sm text-text-muted">По выбранным фильтрам записей нет</p>}
        {data && <ol aria-label="Записи логов">{data.items.map((entry, index) => <LogEntry key={entry.timestampUtc + entry.service + index} entry={entry} />)}</ol>}
        {data && data.totalPages > 1 && (
          <div className="border-t border-border-light px-5 py-3 dark:border-border-dark">
            <Pagination page={page} totalPages={Math.min(data.totalPages, MAX_PAGE)} onPageChange={next => setFilter('page', String(next))} />
          </div>
        )}
      </Card>
    </div>
  );
}
