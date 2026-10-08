import { Input } from '@/src/components/ui/Input';
import { NativeSelect } from '@/src/components/ui/NativeSelect';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { decideImportCandidate, getImportCandidates, ImportCandidate } from '../api/import';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/Dialog';
import { DataTable } from '../components/ui/DataTable';
import {
  CoffeeFocusPicker,
  FocusBadge,
  GoogleStatusBadge,
  SourceBadge,
} from '../components/import/catalogControls';
import { useToast } from '../contexts/ToastContext';
import { useLoadMoreOnScroll } from '../hooks/useLoadMoreOnScroll';
import {
  BUCKET_LABELS,
  COFFEE_FOCUS_OPTIONS,
  CoffeeFocus,
  CollectorBucket,
  IMPORT_LIST_PAGE_SIZE,
  ImportSource,
  QUEUE_STATUS_LABELS,
  REJECT_REASON_LABELS,
  REJECT_REASON_OPTIONS,
  RejectReason,
  KnownQueueStatus,
  displayShopName,
  isClosedPermanently,
  isUsableShopName,
  parseImportListSearch,
} from '../constants/catalogIngest';

const PAGE_SIZE = IMPORT_LIST_PAGE_SIZE;
const BATCH_CONCURRENCY = 5;

/** Runs fn over items with at most `limit` in flight; results keep input order. */
async function settleWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: 'fulfilled', value: await fn(items[index]) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

type SortKey = 'name' | 'focus' | 'google' | 'osm' | 'bucket' | 'status';
type SortDir = 'asc' | 'desc';
type BatchModal = 'publish' | 'reject' | null;

const STATUSES: { value: KnownQueueStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'Pending', label: 'Ожидает' },
  { value: 'Skipped', label: 'Позже' },
  { value: 'Published', label: 'В ленте' },
  { value: 'Rejected', label: 'Не в ленту' },
];
const BUCKETS: { value: CollectorBucket | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'priority', label: 'Приоритет' },
  { value: 'review', label: 'Проверить' },
  { value: 'noise', label: 'Шум' },
  { value: 'vending', label: 'Вендинг' },
];

const headerControl = 'h-8 min-w-[7.5rem] text-xs';

function isSelectable(item: ImportCandidate): boolean {
  return item.queueStatus === 'Pending' || item.queueStatus === 'Skipped';
}

function matchesSearch(item: ImportCandidate, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const haystack = [item.name, item.brand, item.address]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function compareItems(a: ImportCandidate, b: ImportCandidate, key: SortKey): number {
  const emptyLast = (value?: string) => value || '\uffff';
  switch (key) {
    case 'name':
      return displayShopName(a.name, a.brand).localeCompare(displayShopName(b.name, b.brand), 'ru');
    case 'focus':
      return emptyLast(a.coffeeFocus).localeCompare(emptyLast(b.coffeeFocus));
    case 'google':
      return emptyLast(a.googleBusinessStatus).localeCompare(emptyLast(b.googleBusinessStatus));
    case 'osm':
      return (a.osmAgeDays ?? Number.MAX_SAFE_INTEGER) - (b.osmAgeDays ?? Number.MAX_SAFE_INTEGER);
    case 'bucket':
      return emptyLast(a.collectorBucket).localeCompare(emptyLast(b.collectorBucket));
    case 'status':
      return a.queueStatus.localeCompare(b.queueStatus);
  }
}

const SortButton: React.FC<{
  label: string;
  column: SortKey;
  sortKey: SortKey | '';
  sortDir: SortDir;
  onSort: (column: SortKey) => void;
}> = ({ label, column, sortKey, sortDir, onSort }) => (
  <button
    type="button"
    onClick={() => onSort(column)}
    className="inline-flex items-center gap-1 text-xs font-medium text-text-muted dark:text-stone-400 hover:text-text-main dark:hover:text-white font-body"
  >
    {label}
    <span className="text-[10px] leading-none w-2.5">
      {sortKey === column ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </span>
  </button>
);

/** Rendered only embedded in the ImportQueuePage "Список" panel. */
export const ImportInboxPage: React.FC<{
  selectedId?: string;
}> = ({ selectedId }) => {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { status, bucket, focus, search, hasAddress, rejectReason, source } =
    parseImportListSearch(searchParams);
  const sortKey = (searchParams.get('sort') ?? '') as SortKey | '';
  const sortDir = (searchParams.get('dir') === 'desc' ? 'desc' : 'asc') as SortDir;
  const [localSearch, setLocalSearch] = useState(search);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [batchModal, setBatchModal] = useState<BatchModal>(null);
  const [batchFocus, setBatchFocus] = useState<CoffeeFocus | undefined>();
  const [confirmPublishClosed, setConfirmPublishClosed] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery({
      queryKey: [
        'admin',
        'import',
        'inbox',
        { status, bucket, focus, search, hasAddress, rejectReason, source },
      ],
      initialPageParam: 1,
      staleTime: 0,
      queryFn: ({ pageParam }) =>
        getImportCandidates({
          status: status === 'all' ? undefined : status,
          bucket: bucket === 'all' ? undefined : bucket,
          focus: focus || undefined,
          search: search || undefined,
          hasAddress: hasAddress || undefined,
          rejectReason: rejectReason || undefined,
          source: (source as ImportSource) || undefined,
          page: pageParam,
          pageSize: PAGE_SIZE,
        }).then((r) => r.data),
      getNextPageParam: (lastPage, allPages) => {
        const loaded = allPages.reduce((n, p) => n + (p.items?.length ?? 0), 0);
        if (!lastPage.items?.length) return undefined;
        if (lastPage.pageSize > 0 && lastPage.items.length < lastPage.pageSize) return undefined;
        if (lastPage.totalCount > 0 && loaded >= lastPage.totalCount) return undefined;
        if (lastPage.totalPages > 0 && allPages.length >= lastPage.totalPages) return undefined;
        return allPages.length + 1;
      },
    });

  const items = useMemo(() => {
    let list = data?.pages.flatMap((page) => page.items) ?? [];
    // Backend search can return extras / stale pages — keep the visible list in sync with the box.
    list = list.filter((item) => matchesSearch(item, localSearch));
    if (hasAddress) {
      list = list.filter((item) => Boolean(item.address?.trim()));
    }
    if (rejectReason) {
      list = list.filter((item) => item.rejectReason === rejectReason);
    }
    if (!sortKey) return list;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => compareItems(a, b, sortKey) * dir);
  }, [data, localSearch, hasAddress, rejectReason, sortKey, sortDir]);

  // Prefer filtered length when search is active; API totalCount often disagrees with returned rows.
  const totalInFilter = useMemo(() => {
    if (localSearch.trim()) return items.length;
    return data?.pages[0]?.totalCount;
  }, [data, localSearch, items.length]);

  const selectableItems = useMemo(() => items.filter(isSelectable), [items]);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );
  const namedSelected = useMemo(
    () => selectedItems.filter((item) => isSelectable(item) && isUsableShopName(item.name)),
    [selectedItems],
  );
  // Same rule as single publish: suggestReject needs an explicit per-item override in the dossier.
  const overrideSelected = namedSelected.filter((item) => item.suggestReject);
  const publishableSelected = useMemo(
    () => namedSelected.filter((item) => !item.suggestReject),
    [namedSelected],
  );
  const skippedNoName = selectedItems.filter(isSelectable).length - namedSelected.length;
  const closedSelected = publishableSelected.filter((item) =>
    isClosedPermanently(item.googleBusinessStatus),
  );
  const allSelectableChecked =
    selectableItems.length > 0 && selectableItems.every((item) => selectedIds.has(item.id));
  const someSelectableChecked = selectableItems.some((item) => selectedIds.has(item.id));

  // Don't gate on items.length: client-side filters may hide every loaded row while more pages exist.
  // Don't auto-retry after a failed page — the user gets a «Повторить» button instead.
  const loadMoreRef = useLoadMoreOnScroll(
    Boolean(hasNextPage) && !isFetchingNextPage && !isFetchNextPageError,
    () => {
      void fetchNextPage();
    },
    scrollRef,
  );

  const patchParams = (patch: Record<string, string>, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (resetPage) next.delete('page');
    setSearchParams(next);
  };

  // The debounce timer must patch the *latest* params, or it reverts filters changed within the window.
  const latestRef = useRef({ patchParams, search });
  latestRef.current = { patchParams, search };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const latest = latestRef.current;
      if (localSearch !== latest.search) latest.patchParams({ search: localSearch });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [localSearch]);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    setSelectedIds(new Set());
    setBatchModal(null);
    setBatchFocus(undefined);
    setConfirmPublishClosed(false);
  }, [status, bucket, focus, search, hasAddress, rejectReason, source]);

  const onSort = (column: SortKey) => {
    if (sortKey === column) {
      patchParams({ sort: column, dir: sortDir === 'asc' ? 'desc' : 'asc' }, false);
    } else {
      patchParams({ sort: column, dir: 'asc' }, false);
    }
  };

  const toggleOne = (id: string, next: boolean) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (allSelectableChecked) {
        selectableItems.forEach((item) => copy.delete(item.id));
      } else {
        selectableItems.forEach((item) => copy.add(item.id));
      }
      return copy;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBatchModal(null);
    setBatchFocus(undefined);
    setConfirmPublishClosed(false);
  };

  const batchMutation = useMutation({
    mutationFn: async ({
      mode,
      targets,
      coffeeFocus,
      rejectReason: reason,
      overrideClosed,
    }: {
      mode: 'Published' | 'Rejected';
      targets: ImportCandidate[];
      coffeeFocus?: CoffeeFocus;
      rejectReason?: RejectReason;
      overrideClosed?: boolean;
    }) => {
      const results = await settleWithConcurrency(targets, BATCH_CONCURRENCY, (item) =>
        decideImportCandidate(item.id, {
          status: mode,
          coffeeFocus: mode === 'Published' ? coffeeFocus : undefined,
          // Publish only the candidate's existing tags.
          tagSlugs: mode === 'Published' ? item.tagSlugs : undefined,
          overrideClosed: mode === 'Published' ? Boolean(overrideClosed) : undefined,
          rejectReason: mode === 'Rejected' ? reason : undefined,
        }),
      );

      const okIds = targets.filter((_, i) => results[i].status === 'fulfilled').map((t) => t.id);
      const ok = okIds.length;
      const fail = results.length - ok;
      return { ok, okIds, fail, total: results.length, mode, reason };
    },
    onSuccess: ({ ok, okIds, fail, mode, reason }) => {
      const base =
        mode === 'Published'
          ? `В ленте: ${ok}`
          : `Не в ленту · ${reason ? REJECT_REASON_LABELS[reason] : ''}: ${ok}`;
      if (fail > 0) {
        const verb = mode === 'Published' ? 'опубликовано' : 'отклонено';
        showToast(`${verb} ${ok}, ошибок ${fail} — неудачные остались выбранными`, 'error');
        // Keep failed ids selected so the admin can retry just those.
        setSelectedIds((prev) => {
          const copy = new Set(prev);
          okIds.forEach((okId) => copy.delete(okId));
          return copy;
        });
        setBatchModal(null);
        setBatchFocus(undefined);
        setConfirmPublishClosed(false);
      } else {
        showToast(base, 'success');
        clearSelection();
      }
      void qc.invalidateQueries({ queryKey: ['admin', 'import'] });
    },
    onError: (err: { message?: string }) => {
      showToast(err?.message ?? 'Не удалось применить решение', 'error');
    },
  });

  const openPublish = () => {
    if (!selectedItems.some(isSelectable)) return;
    setBatchFocus(undefined);
    setBatchModal('publish');
  };

  const openReject = () => {
    if (!selectedItems.some(isSelectable)) return;
    setBatchModal('reject');
  };

  const runPublish = (overrideClosed = false) => {
    if (!batchFocus || publishableSelected.length === 0) return;
    if (!overrideClosed && closedSelected.length > 0) {
      setConfirmPublishClosed(true);
      return;
    }
    if (overrideSelected.length > 0) {
      showToast(
        `Пропущено ${overrideSelected.length}: бэкенд предлагает отклонить — решите их по одному в досье`,
        'info',
      );
    }
    batchMutation.mutate({
      mode: 'Published',
      targets: publishableSelected,
      coffeeFocus: batchFocus,
      overrideClosed,
    });
  };

  const loadedCount = items.length;
  const columns: ColumnDef<ImportCandidate>[] = [
    {
      id: 'selection',
      header: () => <Input type="checkbox" checked={allSelectableChecked} ref={(element) => { if (element) element.indeterminate = someSelectableChecked && !allSelectableChecked; }} onChange={toggleAllVisible} disabled={!selectableItems.length} aria-label="Выбрать все загруженные" />,
      cell: ({ row }) => <Input type="checkbox" checked={selectedIds.has(row.original.id)} disabled={!isSelectable(row.original)} onChange={(event) => toggleOne(row.original.id, event.target.checked)} aria-label={`Выбрать ${displayShopName(row.original.name, row.original.brand)}`} />,
      meta: { headerClassName: 'w-10 pl-4 pr-1', className: 'w-10 pl-4 pr-1' },
    },
    {
      accessorKey: 'name',
      header: () => <div className="flex min-w-52 flex-col gap-1.5"><SortButton label="Название" column="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} /><Input value={localSearch} onChange={(event) => setLocalSearch(event.target.value)} placeholder="Название, адрес..." className="h-8 text-xs" /><NativeSelect value={source} onChange={(event) => patchParams({ source: event.target.value })} className={headerControl} aria-label="Источник"><option value="">Все источники</option><option value="File">Внешний импорт</option><option value="Osm">OSM</option></NativeSelect></div>,
      cell: ({ row }) => {
        const candidate = row.original;
        const candidateSearch = new URLSearchParams(searchParams);
        candidateSearch.set('panel', 'list');
        return (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={{ pathname: `/import/${candidate.id}`, search: candidateSearch.toString() }}
                className="font-medium text-text-main hover:text-primary dark:text-white"
              >
                {displayShopName(candidate.name, candidate.brand)}
              </Link>
              <SourceBadge source={String(candidate.source)} importedFromFile={candidate.importedFromFile} />
            </div>
            {candidate.address && <p className="max-w-xs truncate text-xs text-text-muted dark:text-stone-500">{candidate.address}</p>}
          </div>
        );
      },
      meta: { className: 'px-3' },
    },
    {
      accessorKey: 'coffeeFocus',
      header: () => <div className="flex flex-col gap-1.5"><SortButton label="Focus" column="focus" sortKey={sortKey} sortDir={sortDir} onSort={onSort} /><NativeSelect value={focus} onChange={(event) => patchParams({ focus: event.target.value })} className={headerControl}><option value="">Любой</option>{COFFEE_FOCUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</NativeSelect></div>,
      cell: ({ row }) => <FocusBadge focus={row.original.coffeeFocus} />,
    },
    {
      accessorKey: 'googleBusinessStatus',
      header: () => <SortButton label="Google" column="google" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />,
      cell: ({ row }) => row.original.googleBusinessStatus ? <GoogleStatusBadge status={row.original.googleBusinessStatus} /> : <span className="text-xs text-text-muted">—</span>,
      meta: { headerClassName: 'hidden md:table-cell', className: 'hidden md:table-cell' },
    },
    {
      accessorKey: 'osmAgeDays',
      header: () => <SortButton label="OSM" column="osm" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />,
      cell: ({ row }) => <span className="text-xs text-text-muted">{row.original.osmAgeDays != null ? `${row.original.osmAgeDays} дн.` : '—'}</span>,
      meta: { headerClassName: 'hidden lg:table-cell', className: 'hidden lg:table-cell' },
    },
    {
      accessorKey: 'collectorBucket',
      header: () => <div className="flex flex-col gap-1.5"><SortButton label="Корзина" column="bucket" sortKey={sortKey} sortDir={sortDir} onSort={onSort} /><NativeSelect value={bucket} onChange={(event) => patchParams({ bucket: event.target.value })} className={headerControl}>{BUCKETS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</NativeSelect></div>,
      cell: ({ row }) => <span className="text-xs text-text-muted">{row.original.collectorBucket ? BUCKET_LABELS[row.original.collectorBucket] : '—'}</span>,
      meta: { headerClassName: 'hidden md:table-cell', className: 'hidden md:table-cell' },
    },
    {
      accessorKey: 'queueStatus',
      header: () => <div className="flex flex-col gap-1.5"><SortButton label="Статус" column="status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} /><NativeSelect value={status} onChange={(event) => { const nextStatus = event.target.value; patchParams({ status: nextStatus, rejectReason: nextStatus === 'Rejected' ? rejectReason : '' }); }} className={headerControl}>{STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</NativeSelect>{status === 'Rejected' && <NativeSelect value={rejectReason} onChange={(event) => patchParams({ rejectReason: event.target.value })} className={headerControl} aria-label="Причина отклонения"><option value="">Любая причина</option>{REJECT_REASON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</NativeSelect>}</div>,
      cell: ({ row }) => <Badge variant={row.original.queueStatus === 'Published' ? 'approved' : row.original.queueStatus === 'Rejected' ? 'rejected' : 'pending'}>{QUEUE_STATUS_LABELS[row.original.queueStatus]}{row.original.queueStatus === 'Rejected' && row.original.rejectReason ? ` · ${REJECT_REASON_LABELS[row.original.rejectReason]}` : ''}</Badge>,
    },
  ];

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm font-body text-text-main dark:text-white">
        <p className="tabular-nums">В выборке: <span className="font-semibold">{totalInFilter != null ? totalInFilter : loadedCount}</span></p>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {isError && !isFetchNextPageError && (
          <p className="p-6 text-sm text-red-600 dark:text-red-400">
            Не удалось загрузить список.
          </p>
        )}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
          <DataTable
            columns={columns}
            data={items}
            loading={isLoading}
            emptyText="Ничего не найдено"
            tableClassName="text-sm"
            getRowId={(item) => item.id}
            getRowClassName={(item) => [
              selectedIds.has(item.id) ? 'bg-primary/5 dark:bg-primary/10' : '',
              selectedId === item.id ? 'bg-primary/10 dark:bg-primary/15' : '',
            ].join(' ')}
          />
          {/* Sentinel lives inside the scroll container so the observer root actually scrolls it. */}
          <div
            ref={loadMoreRef}
            className="px-5 py-3 border-t border-border-light dark:border-border-dark"
          >
            {isFetchingNextPage && (
              <p className="text-center text-xs text-text-muted dark:text-stone-500">Загрузка…</p>
            )}
            {isFetchNextPageError && !isFetchingNextPage && (
              <div className="flex items-center justify-center gap-3">
                <p className="text-xs text-red-600 dark:text-red-400">Не удалось загрузить ещё</p>
                <Button variant="secondary" size="sm" onClick={() => void fetchNextPage()}>
                  Повторить
                </Button>
              </div>
            )}
            {!hasNextPage && items.length > 0 && (
              <p className="text-center text-xs text-text-muted dark:text-stone-500">
                {items.length}
                {totalInFilter != null && totalInFilter !== items.length
                  ? ` из ${totalInFilter}`
                  : ''}
              </p>
            )}
          </div>
        </div>
      </Card>

      {selectedIds.size > 0 && (
        <div className="shrink-0 border-t border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-4 py-3">
          <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-body text-text-main dark:text-white">
              Выбрано: <span className="font-semibold">{selectedIds.size}</span>
              {(totalInFilter != null || loadedCount > 0) && (
                <span className="text-text-muted dark:text-stone-400">
                  {' '}
                  из {totalInFilter != null ? totalInFilter : loadedCount}
                </span>
              )}
              <button
                type="button"
                className="ml-3 text-xs text-text-muted dark:text-stone-400 hover:text-primary"
                onClick={clearSelection}
              >
                Сбросить
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={batchMutation.isPending} onClick={openPublish}>
                В ленту
              </Button>
              <Button variant="danger" disabled={batchMutation.isPending} onClick={openReject}>
                Не в ленту
              </Button>
            </div>
          </div>
        </div>
      )}

      {batchModal === 'publish' && (
        <Dialog open onOpenChange={(open) => !open && !batchMutation.isPending && setBatchModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogTitle>В ленту · {publishableSelected.length}</DialogTitle>
            <DialogDescription>Один coffee focus на всю пачку.</DialogDescription>
            {skippedNoName > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                Без нормального имени пропущены: {skippedNoName}.
              </p>
            )}
            {overrideSelected.length > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                Бэкенд предлагает отклонить: {overrideSelected.length}. Пачкой не публикуем — только по
                одному в досье.
              </p>
            )}
            {closedSelected.length > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-3">
                Google пометил закрытыми: {closedSelected.length}. Перед публикацией спросим
                подтверждение.
              </p>
            )}
            <CoffeeFocusPicker
              value={batchFocus}
              onChange={setBatchFocus}
              disabled={batchMutation.isPending}
            />
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <Button
                variant="primary"
                className="flex-1 min-h-[44px]"
                disabled={!batchFocus || publishableSelected.length === 0 || batchMutation.isPending}
                loading={batchMutation.isPending}
                onClick={() => runPublish(false)}
              >
                Опубликовать
              </Button>
              <Button
                variant="ghost"
                className="min-h-[44px]"
                disabled={batchMutation.isPending}
                onClick={() => setBatchModal(null)}
              >
                Отмена
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {batchModal === 'reject' && (
        <Dialog open onOpenChange={(open) => !open && !batchMutation.isPending && setBatchModal(null)}>
          <DialogContent className="max-w-md">
            <DialogTitle>Почему не в ленту? · {selectedItems.filter(isSelectable).length}</DialogTitle>
            <DialogDescription>Одна причина на всю пачку.</DialogDescription>
            <div className="flex flex-col gap-2">
              {REJECT_REASON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={batchMutation.isPending}
                  onClick={() =>
                    batchMutation.mutate({
                      mode: 'Rejected',
                      targets: selectedItems.filter(isSelectable),
                      rejectReason: opt.value,
                    })
                  }
                  className="flex flex-col items-start gap-0.5 rounded-xl border border-border-light dark:border-border-dark hover:border-primary/60 px-3 py-3 text-left min-h-[56px] transition-colors disabled:opacity-50"
                >
                  <span className="text-sm font-semibold text-text-main dark:text-white font-display">
                    {opt.key}. {opt.label}
                  </span>
                  <span className="text-xs text-text-muted dark:text-stone-400 font-body">
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full min-h-[44px]"
              onClick={() => setBatchModal(null)}
              disabled={batchMutation.isPending}
            >
              Отмена
            </Button>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        isOpen={confirmPublishClosed}
        title="Есть закрытые по Google"
        message={`Среди выбранных ${closedSelected.length} с статусом «Закрыто». Опубликовать их всё равно?`}
        confirmLabel="Всё равно в ленту"
        variant="danger"
        onCancel={() => setConfirmPublishClosed(false)}
        onConfirm={() => {
          setConfirmPublishClosed(false);
          runPublish(true);
        }}
      />
    </div>
  );
};
