import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, ChevronDown, ChevronRight, CircleCheck, Download, RefreshCw, Search } from 'lucide-react';
import {
  downloadOperationalLogs,
  getOperationalLogs,
  setOperationalLogResolution,
  type OperationalLogEntry,
  type OperationalLogResolutionFilter,
  type OperationalLogSearch,
} from '../api/operationalLogs';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { LoadError } from '../components/ui/LoadError';
import { NativeSelect } from '../components/ui/NativeSelect';
import { Pagination } from '../components/ui/Pagination';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errors';

const PAGE_SIZE = 50;
const MAX_PAGE = 10_000 / PAGE_SIZE;
const LOG_QUERY_KEY = ['admin', 'operational-logs'] as const;
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

type View = 'logs' | 'errors';
interface ErrorGroup {
  key: string;
  title: string;
  entries: OperationalLogEntry[];
  latest: OperationalLogEntry;
}

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

function formatTime(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('ru-RU');
}

function levelLabel(level: string) {
  return LEVELS.find(option => option.value === level)?.label ?? level;
}

function levelStyle(level: string) {
  if (level === 'Fatal' || level === 'Error') return 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300';
  if (level === 'Warning') return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300';
  return 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300';
}

function serviceLabel(service: string) {
  return SERVICES.find(option => option.value === service)?.label ?? service;
}

function groupErrors(entries: OperationalLogEntry[], sort: 'asc' | 'desc'): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>();
  for (const entry of entries) {
    const title = entry.exception?.split(/\r?\n/).find(line => line.trim())?.trim() || entry.message.trim() || 'Ошибка без сообщения';
    const key = JSON.stringify([entry.service, entry.category, title]);
    const group = groups.get(key);
    if (group) {
      group.entries.push(entry);
      if (new Date(entry.timestampUtc).getTime() > new Date(group.latest.timestampUtc).getTime()) group.latest = entry;
    } else {
      groups.set(key, { key, title, entries: [entry], latest: entry });
    }
  }
  return [...groups.values()].sort((a, b) => {
    const difference = new Date(a.latest.timestampUtc).getTime() - new Date(b.latest.timestampUtc).getTime();
    return sort === 'asc' ? difference : -difference;
  });
}

interface ResolutionActions {
  onChange: (ids: string[], resolved: boolean) => void;
  pending: boolean;
}

function EntryDetails({ entry, actions }: { entry: OperationalLogEntry; actions?: ResolutionActions }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="space-y-4 rounded-lg border border-border-light bg-stone-50/70 p-4 text-sm dark:border-border-dark dark:bg-black/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-text-main dark:text-stone-100">{entry.message}</p>
        <Button variant="secondary" size="sm" onClick={() => void copy()}>{copied ? 'Скопировано' : 'Копировать JSON'}</Button>
      </div>
      {entry.id && <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-text-muted dark:text-stone-400">
          {entry.resolution ? 'Решено ' + formatTime(entry.resolution.resolvedAtUtc) : 'Открыто'}
        </span>
        {actions && <Button variant="secondary" size="sm" disabled={actions.pending}
          onClick={() => actions.onChange([entry.id!], !entry.resolution)}>
          {entry.resolution ? 'Открыть снова' : 'Отметить решённой'}
        </Button>}
      </div>}
      <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 xl:grid-cols-3">
        <div><dt className="text-text-muted dark:text-stone-400">Время</dt><dd className="mt-1 font-mono tabular-nums">{formatTime(entry.timestampUtc)}</dd></div>
        <div><dt className="text-text-muted dark:text-stone-400">Сервис</dt><dd className="mt-1">{serviceLabel(entry.service)}</dd></div>
        <div><dt className="text-text-muted dark:text-stone-400">Уровень</dt><dd className="mt-1">{levelLabel(entry.level)}</dd></div>
        {entry.category && <div className="min-w-0"><dt className="text-text-muted dark:text-stone-400">Категория</dt><dd className="mt-1 break-all font-mono">{entry.category}</dd></div>}
        {entry.eventId != null && <div><dt className="text-text-muted dark:text-stone-400">Событие</dt><dd className="mt-1 font-mono">#{entry.eventId}</dd></div>}
        {entry.correlationId && <div className="min-w-0"><dt className="text-text-muted dark:text-stone-400">Correlation ID</dt><dd className="mt-1 break-all font-mono">{entry.correlationId}</dd></div>}
        {entry.traceId && <div className="min-w-0"><dt className="text-text-muted dark:text-stone-400">Trace ID</dt><dd className="mt-1 break-all font-mono">{entry.traceId}</dd></div>}
      </dl>
      {entry.exception && <div>
        <p className="mb-2 text-xs font-semibold text-red-700 dark:text-red-300">Исключение и стек вызовов</p>
        <pre className="max-h-80 overflow-auto rounded-md border border-red-200 bg-red-50 p-3 whitespace-pre-wrap break-all font-mono text-xs leading-5 text-red-900 dark:border-red-500/20 dark:bg-red-500/5 dark:text-red-200">{entry.exception}</pre>
      </div>}
    </div>
  );
}

function LogRow({ entry }: { entry: OperationalLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="border-b border-border-light last:border-b-0 dark:border-border-dark">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}
        className="grid w-full min-w-0 grid-cols-[20px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 dark:hover:bg-white/5 sm:px-5 lg:grid-cols-[20px_172px_112px_96px_minmax(0,1fr)]">
        {expanded ? <ChevronDown className="h-4 w-4 text-text-muted" /> : <ChevronRight className="h-4 w-4 text-text-muted" />}
        <time dateTime={entry.timestampUtc} className="font-mono text-xs tabular-nums text-text-muted dark:text-stone-400">{formatTime(entry.timestampUtc)}</time>
        <span className="col-start-2 truncate text-xs text-text-muted dark:text-stone-400 lg:col-start-auto">{serviceLabel(entry.service)}</span>
        <span className="col-start-2 lg:col-start-auto"><span className={'inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ' + levelStyle(entry.level)}>{levelLabel(entry.level)}</span></span>
        <span className="col-start-2 min-w-0 truncate text-sm text-text-main dark:text-stone-100 lg:col-start-auto">{entry.message || 'Без сообщения'}</span>
      </button>
      {expanded && <div className="px-4 pb-4 pl-11 sm:px-5 sm:pl-12"><EntryDetails entry={entry} /></div>}
    </li>
  );
}

function ErrorRow({ group, actions }: { group: ErrorGroup; actions: ResolutionActions }) {
  const [expanded, setExpanded] = useState(false);
  const { latest } = group;
  const openIds: string[] = [];
  const resolvedIds: string[] = [];
  for (const entry of group.entries) {
    if (!entry.id) continue;
    if (entry.resolution) resolvedIds.push(entry.id);
    else openIds.push(entry.id);
  }
  const allResolved = resolvedIds.length === group.entries.length;
  return (
    <li className="border-b border-border-light last:border-b-0 dark:border-border-dark">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}
        className="grid w-full min-w-0 gap-3 px-4 py-4 text-left hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 dark:hover:bg-white/5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_130px_120px_100px] lg:items-center">
        <span className="flex min-w-0 items-start gap-3">
          {allResolved
            ? <CircleCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            : <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />}
          <span className="min-w-0">
            <span className="block break-words text-sm font-semibold text-text-main dark:text-white">{group.title}</span>
            {latest.message.trim() !== group.title && <span className="mt-0.5 block truncate text-xs text-text-muted dark:text-stone-400">{latest.message}</span>}
            <span className="mt-2 block truncate font-mono text-[11px] text-text-muted dark:text-stone-400">{serviceLabel(latest.service)}{latest.category ? ` · ${latest.category}` : ''}</span>
          </span>
        </span>
        <span className="pl-7 text-xs text-text-muted dark:text-stone-400 lg:pl-0"><span className="lg:hidden">Последняя: </span><time dateTime={latest.timestampUtc} className="tabular-nums">{formatTime(latest.timestampUtc)}</time></span>
        <span className="pl-7 text-xs tabular-nums text-text-main dark:text-stone-100 lg:pl-0"><span className="lg:hidden">Записей: </span>{group.entries.length}{resolvedIds.length > 0 && (
          <span className="mt-0.5 block text-[11px] text-emerald-700 dark:text-emerald-400">
            {allResolved ? 'Решено' : 'Решено: ' + resolvedIds.length}
          </span>
        )}</span>
        <span className="flex items-center gap-1 pl-7 text-xs font-medium text-primary-dark dark:text-primary lg:pl-0">Подробнее {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</span>
      </button>
      {expanded && <div className="space-y-3 px-4 pb-4 sm:px-5">
        <p className="text-xs text-text-muted dark:text-stone-400">Записи этой группы на текущей странице</p>
        {group.entries.length > 1 && <div className="flex flex-wrap gap-2">
          {openIds.length > 0 && <Button variant="secondary" size="sm" disabled={actions.pending}
            onClick={() => actions.onChange(openIds, true)}>Отметить решёнными ({openIds.length})</Button>}
          {resolvedIds.length > 0 && <Button variant="secondary" size="sm" disabled={actions.pending}
            onClick={() => actions.onChange(resolvedIds, false)}>Открыть снова ({resolvedIds.length})</Button>}
        </div>}
        {group.entries.length === 1 ? <EntryDetails entry={latest} actions={actions} /> : group.entries.map((entry, index) =>
          <details key={`${entry.timestampUtc}-${index}`} className="rounded-lg border border-border-light dark:border-border-dark">
            <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-text-main marker:text-text-muted dark:text-stone-100">
              <time dateTime={entry.timestampUtc} className="font-mono tabular-nums">{formatTime(entry.timestampUtc)}</time>
              {entry.traceId && <span className="ml-3 break-all font-mono font-normal text-text-muted dark:text-stone-400">Trace: {entry.traceId}</span>}
            </summary>
            <div className="px-3 pb-3"><EntryDetails entry={entry} actions={actions} /></div>
          </details>,
        )}
      </div>}
    </li>
  );
}

export function OperationalLogsPage() {
  const [params, setParams] = useSearchParams();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const view: View = params.get('view') === 'errors' ? 'errors' : 'logs';
  const service = params.get('service') ?? '';
  const level = params.get('level') ?? '';
  const q = params.get('q') ?? '';
  const status = params.get('resolution');
  const resolution: OperationalLogResolutionFilter | 'all' = status === 'resolved' || status === 'all' ? status : 'open';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const sort = params.get('sort') === 'asc' ? 'asc' : 'desc';
  const requestedPage = Number(params.get('page') ?? '1');
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= MAX_PAGE ? requestedPage : 1;
  const invalidRange = Boolean(from && to && from > to);
  const [queryDraft, setQueryDraft] = useState(q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [downloading, setDownloading] = useState<'csv' | 'jsonl' | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  useEffect(() => setQueryDraft(q), [q]);

  const search: OperationalLogSearch = {
    service: service || undefined,
    level: view === 'errors' ? (level === 'Fatal' ? 'Fatal' : 'Error') : level || undefined,
    resolution: view === 'errors' && resolution !== 'all' ? resolution : undefined,
    q: q || undefined,
    from: from || undefined,
    to: to || undefined,
    sort,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [...LOG_QUERY_KEY, search],
    queryFn: () => getOperationalLogs(search).then(response => response.data),
    enabled: !invalidRange,
  });
  const { mutate: changeResolution, isPending: resolutionPending } = useMutation({
    mutationFn: ({ ids, resolved }: { ids: string[]; resolved: boolean }) => setOperationalLogResolution(ids, resolved),
    onSuccess: async (_, { resolved }) => {
      await queryClient.invalidateQueries({ queryKey: LOG_QUERY_KEY });
      showToast(resolved ? 'Ошибки отмечены решёнными' : 'Ошибки снова открыты', 'success');
    },
    onError: (failure) => showToast(getErrorMessage(failure, 'Не удалось изменить статус ошибки'), 'error'),
  });
  const actions: ResolutionActions = {
    onChange: (ids, resolved) => changeResolution({ ids, resolved }),
    pending: resolutionPending,
  };

  const lastPage = data ? Math.max(1, Math.min(data.totalPages, MAX_PAGE)) : null;
  useEffect(() => {
    if (!invalidRange && lastPage !== null && page > lastPage) {
      const next = new URLSearchParams(params);
      if (lastPage === 1) next.delete('page'); else next.set('page', String(lastPage));
      setParams(next, { replace: true });
    }
  }, [invalidRange, lastPage, page, params, setParams]);

  const errorGroups = view === 'errors' ? groupErrors(data?.items ?? [], sort) : [];
  const supportsResolution = data?.items.every(entry => Boolean(entry.id)) ?? true;

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };
  const setView = (nextView: View) => {
    const next = new URLSearchParams(params);
    if (nextView === 'errors') next.set('view', 'errors'); else next.delete('view');
    next.delete('level');
    next.delete('page');
    setDownloadError(null);
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
      link.download = `coffeepeek-${view}-${new Date().toISOString().slice(0, 10)}.${format}`;
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
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">Логи сервисов</h2>
          <p className="mt-1 text-sm text-text-muted dark:text-stone-400">События и ошибки за последние 7 дней. Старые записи удаляются автоматически.</p>
        </div>
        <Button variant="secondary" onClick={() => void refetch()} disabled={invalidRange} loading={isFetching}>
          <RefreshCw className="h-4 w-4" /> Обновить
        </Button>
      </header>

      <nav aria-label="Разделы логов" className="flex gap-1 border-b border-border-light dark:border-border-dark">
        {(['logs', 'errors'] as const).map(item => (
          <button key={item} type="button" aria-current={view === item ? 'page' : undefined} onClick={() => setView(item)}
            className={'min-h-10 border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ' + (view === item ? 'border-primary text-text-main dark:text-white' : 'border-transparent text-text-muted hover:text-text-main dark:text-stone-400 dark:hover:text-white')}>
            {item === 'logs' ? 'Журнал логов' : 'Ошибки'}
          </button>
        ))}
      </nav>

      {view === 'errors' && supportsResolution && <div className="flex flex-wrap gap-2" role="group" aria-label="Статус ошибок">
        {([
          { value: 'open', label: 'Открытые' },
          { value: 'resolved', label: 'Решённые' },
          { value: 'all', label: 'Все' },
        ] as const).map(option => (
          <Button key={option.value} size="sm" variant={resolution === option.value ? 'primary' : 'secondary'}
            aria-pressed={resolution === option.value}
            onClick={() => setFilter('resolution', option.value === 'open' ? '' : option.value)}>
            {option.label}
          </Button>
        ))}
      </div>}

      <section className="space-y-3 rounded-xl border border-border-light bg-white p-4 shadow-sm dark:border-border-dark dark:bg-surface-dark" aria-label="Фильтры логов">
        <form onSubmit={applyQuery} className="flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Поиск по сообщению, категории и идентификатору</span>
            <Input value={queryDraft} onChange={event => setQueryDraft(event.target.value)} placeholder="Сообщение, категория или ID запроса" maxLength={200} />
          </label>
          <Button type="submit"><Search className="h-4 w-4" /> Найти</Button>
        </form>
        <button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}
          className="flex min-h-9 items-center gap-1 text-xs font-medium text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:text-stone-100 sm:hidden">
          {filtersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Фильтры и выгрузка
        </button>
        <div className={filtersOpen ? 'space-y-3' : 'hidden space-y-3 sm:block'}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-xs font-medium text-text-muted dark:text-stone-400">
              <span>Сервис</span>
              <NativeSelect value={service} onChange={event => setFilter('service', event.target.value)}>
                {SERVICES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </NativeSelect>
            </label>
            <label className="space-y-1 text-xs font-medium text-text-muted dark:text-stone-400">
              <span>{view === 'errors' ? 'Тип ошибки' : 'Уровень'}</span>
              <NativeSelect value={view === 'errors' ? (level === 'Fatal' ? 'Fatal' : 'Error') : level} onChange={event => setFilter('level', event.target.value)}>
                {(view === 'errors' ? LEVELS.filter(option => option.value === 'Error' || option.value === 'Fatal') : LEVELS).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
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
        </div>
        {invalidRange && <p role="alert" className="text-sm text-red-700 dark:text-red-300">Начало периода должно быть раньше конца.</p>}
        {downloadError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{downloadError}</p>}
      </section>

      {error && <LoadError message={getErrorMessage(error, 'Не удалось загрузить логи')} onRetry={() => void refetch()} retrying={isFetching} />}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-light px-4 py-3 text-sm dark:border-border-dark sm:px-5">
          <div>
            <strong className="text-text-main dark:text-white">{view === 'errors' ? 'Группы ошибок' : 'Журнал событий'}</strong>
            {view === 'errors' && <p className="mt-0.5 text-xs text-text-muted dark:text-stone-400">Одинаковые ошибки сгруппированы на текущей странице</p>}
          </div>
          {data && <span className="tabular-nums text-text-muted dark:text-stone-400">Записей: {data.total.toLocaleString('ru-RU')}{view === 'errors' ? ` · Групп на странице: ${errorGroups.length}` : ''}</span>}
        </div>
        {isLoading && <p className="px-5 py-8 text-center text-sm text-text-muted" role="status">Загрузка логов…</p>}
        {!isLoading && data?.items.length === 0 && <p className="px-5 py-8 text-center text-sm text-text-muted">По выбранным фильтрам записей нет</p>}
        {data && view === 'logs' && <>
          <div className="hidden grid-cols-[20px_172px_112px_96px_minmax(0,1fr)] gap-x-3 border-b border-border-light bg-stone-50 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted dark:border-border-dark dark:bg-white/5 dark:text-stone-400 lg:grid">
            <span /><span>Время</span><span>Сервис</span><span>Уровень</span><span>Сообщение</span>
          </div>
          <ol aria-label="Записи логов">{data.items.map((entry, index) => <LogRow key={`${entry.timestampUtc}-${entry.service}-${index}`} entry={entry} />)}</ol>
        </>}
        {data && view === 'errors' && <>
          <div className="hidden grid-cols-[minmax(0,1fr)_130px_120px_100px] gap-3 border-b border-border-light bg-stone-50 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted dark:border-border-dark dark:bg-white/5 dark:text-stone-400 lg:grid">
            <span>Ошибка</span><span>Последняя</span><span>Записей на странице</span><span />
          </div>
          <ol aria-label="Группы ошибок">{errorGroups.map(group => <ErrorRow key={group.key} group={group} actions={actions} />)}</ol>
        </>}
        {data && data.totalPages > 1 && <div className="border-t border-border-light px-5 py-3 dark:border-border-dark">
          <Pagination page={page} totalPages={Math.min(data.totalPages, MAX_PAGE)} onPageChange={next => setFilter('page', String(next))} />
        </div>}
      </Card>
    </div>
  );
}
