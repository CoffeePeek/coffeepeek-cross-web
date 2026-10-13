import { DataTable } from '@/src/components/ui/DataTable';
import { Input } from '@/src/components/ui/Input';
import { NativeSelect } from '@/src/components/ui/NativeSelect';
import type { ColumnDef } from '@tanstack/react-table';
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import {
  getModerationShops,
  approveShop,
  rejectShop,
  ModerationStatus,
} from '../api/admin';
import { useToast } from '../contexts/ToastContext';
import { Badge, statusToBadgeVariant, statusLabels } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LoadError } from '../components/ui/LoadError';
import { Pagination } from '../components/ui/Pagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { getErrorMessage } from '../utils/errors';

const PAGE_SIZE = 15;
type SortKey = 'name' | 'address' | 'description' | 'dataCompletenessScore' | 'status';
type SortDir = 'asc' | 'desc';
type ModerationShop = Awaited<ReturnType<typeof getModerationShops>>['data']['items'][number];

const STATUS_OPTIONS: { value: ModerationStatus | ''; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'Pending', label: 'На модерации' },
  { value: 'Approved', label: 'Одобренные' },
  { value: 'Rejected', label: 'Отклонённые' },
];

function compareShops(a: ModerationShop, b: ModerationShop, key: SortKey): number {
  if (key === 'dataCompletenessScore') {
    return a.dataCompletenessScore - b.dataCompletenessScore;
  }
  const value = (shop: typeof a) => {
    if (key === 'status') return statusLabels[shop.status];
    return shop[key] ?? '';
  };
  const aValue = value(a);
  const bValue = value(b);
  if (!aValue && bValue) return 1;
  if (aValue && !bValue) return -1;
  return aValue.localeCompare(bValue, 'ru', { sensitivity: 'base', numeric: true });
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
    title="Сортировка на текущей странице"
    className="inline-flex items-center gap-1 text-xs font-medium text-text-muted dark:text-stone-400 hover:text-text-main dark:hover:text-white font-body"
  >
    {label}
    <span className="text-[10px] leading-none w-2.5" aria-hidden="true">
      {sortKey === column ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </span>
  </button>
);

export const ShopsModerationPage: React.FC = () => {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get('status') ?? '') as ModerationStatus | '';
  const page = parseInt(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const sortKey = (searchParams.get('sort') ?? '') as SortKey | '';
  const sortDir = (searchParams.get('dir') === 'desc' ? 'desc' : 'asc') as SortDir;

  const [rejectionId, setRejectionId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkApprovalIds, setBulkApprovalIds] = useState<string[] | null>(null);
  const [localSearch, setLocalSearch] = useState(search);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'moderation', 'shops', { status, page, search }],
    queryFn: () =>
      getModerationShops({
        status: status || undefined,
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
      }).then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await approveShop(id);
      if (response.isSuccess === false) throw new Error(response.message || 'Не удалось одобрить кофейню');
      return response;
    },
    onSuccess: (_response, id) => {
      showToast('Кофейня одобрена', 'success');
      setSelectedIds((previous) => new Set([...previous].filter((selectedId) => selectedId !== id)));
      qc.invalidateQueries({ queryKey: ['admin', 'moderation', 'shops'] });
      qc.invalidateQueries({ queryKey: ['admin', 'published-shops'] });
    },
    onError: (err) => showToast(getErrorMessage(err, 'Ошибка'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      rejectShop(id, comment ? { comment } : undefined),
    onSuccess: () => {
      showToast('Кофейня отклонена', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'moderation', 'shops'] });
      setRejectionId(null);
    },
    onError: (err) => showToast(getErrorMessage(err, 'Ошибка'), 'error'),
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  // After acting on the last item of page N>1 the page becomes empty — step back instead of stranding the user.
  useEffect(() => {
    if (data && page > 1 && !data.items.length) {
      const next = new URLSearchParams(searchParams);
      next.set('page', String(page - 1));
      setSearchParams(next, { replace: true });
    }
  }, [data, page, searchParams, setSearchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setParam('search', localSearch);
  };

  const handleSort = (column: SortKey) => {
    const next = new URLSearchParams(searchParams);
    const nextDirection = sortKey === column && sortDir === 'asc' ? 'desc' : 'asc';
    next.set('sort', column);
    next.set('dir', nextDirection);
    next.delete('page');
    setSearchParams(next);
  };

  const items = useMemo(() => {
    const list = data?.items ?? [];
    if (!sortKey) return list;
    const direction = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => compareShops(a, b, sortKey) * direction);
  }, [data?.items, sortDir, sortKey]);

  const pendingItems = items.filter((item) => item.status === 'Pending');
  const selectedPendingIds = pendingItems.filter((item) => selectedIds.has(item.id)).map((item) => item.id);
  const allPendingSelected = pendingItems.length > 0 && selectedPendingIds.length === pendingItems.length;

  useEffect(() => {
    setSelectedIds(new Set());
    setBulkApprovalIds(null);
  }, [page, status, search]);

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const toggleAllPending = () => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      pendingItems.forEach((item) => {
        if (allPendingSelected) next.delete(item.id); else next.add(item.id);
      });
      return next;
    });
  };

  const approveSelected = async () => {
    if (!bulkApprovalIds?.length) return;
    const approved: string[] = [];
    const failed: unknown[] = [];
    for (const id of bulkApprovalIds) {
      try {
        const response = await approveShop(id);
        if (response.isSuccess === false) throw new Error(response.message || 'Не удалось одобрить кофейню');
        approved.push(id);
      } catch (error) {
        failed.push(error);
      }
    }
    if (approved.length) {
      setSelectedIds((previous) => new Set([...previous].filter((id) => !approved.includes(id))));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin', 'moderation', 'shops'] }),
        qc.invalidateQueries({ queryKey: ['admin', 'published-shops'] }),
      ]);
    }
    if (failed.length) {
      showToast(`Одобрено: ${approved.length}. Не удалось: ${failed.length}. ${getErrorMessage(failed[0], 'Повторите попытку.')}`, 'error');
    } else {
      showToast(`Кофеен одобрено: ${approved.length}`, 'success');
    }
    setBulkApprovalIds(null);
  };

  const columns: ColumnDef<ModerationShop>[] = [
    {
      id: 'select',
      header: () => <Input type="checkbox" checked={allPendingSelected} ref={(element) => { if (element) element.indeterminate = selectedPendingIds.length > 0 && !allPendingSelected; }} onChange={toggleAllPending} disabled={!pendingItems.length || approveMutation.isPending} aria-label="Выбрать все ожидающие кофейни на этой странице" />,
      cell: ({ row }) => <Input type="checkbox" checked={selectedIds.has(row.original.id)} disabled={row.original.status !== 'Pending' || approveMutation.isPending} onChange={(event) => toggleOne(row.original.id, event.target.checked)} aria-label={`Выбрать кофейню ${row.original.name}`} />,
      meta: { className: 'w-10', headerClassName: 'w-10' },
    },
    {
      id: 'photo',
      header: '',
      meta: { className: 'w-16' },
      cell: ({ row }) => row.original.photos?.[0] ? <img src={row.original.photos[0].fullUrl} alt="" className="h-12 w-12 rounded-lg border border-border-light object-cover dark:border-border-dark" /> : <div className="h-12 w-12 rounded-lg border border-border-light bg-gray-100 dark:border-border-dark dark:bg-white/5" />,
    },
    {
      id: 'name',
      header: () => <SortButton label="Название" column="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />,
      cell: ({ row }) => <><Link to={`/shops/${row.original.id}`} className="font-body font-medium text-text-main transition-colors hover:text-primary dark:text-white">{row.original.name}</Link><p className="mt-1 font-body text-xs text-text-muted dark:text-stone-500">{row.original.photos?.length ? `${row.original.photos.length} фото` : 'Без фото'}</p></>,
      meta: { className: 'max-w-[200px]' },
    },
    { id: 'address', header: () => <SortButton label="Адрес" column="address" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />, cell: ({ row }) => <span className="line-clamp-3">{row.original.address}</span>, meta: { className: 'max-w-[220px]' } },
    { id: 'description', header: () => <SortButton label="Описание" column="description" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />, cell: ({ row }) => <span className="line-clamp-3">{row.original.description || '—'}</span>, meta: { className: 'max-w-[260px]' } },
    { id: 'completeness', header: () => <SortButton label="Заполненность" column="dataCompletenessScore" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />, cell: ({ row }) => <Badge variant="info">{row.original.dataCompletenessScore}%</Badge> },
    { id: 'status', header: () => <SortButton label="Статус" column="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />, cell: ({ row }) => <Badge variant={statusToBadgeVariant(row.original.status)}>{statusLabels[row.original.status]}</Badge> },
    {
      id: 'actions',
      header: 'Действия',
      meta: { className: 'w-[7.25rem] align-top' },
      cell: ({ row }) => <div className="ml-auto flex w-[7.25rem] flex-col gap-1.5"><Button asChild variant="primary" size="sm" className="w-full whitespace-nowrap"><Link to={`/shops/${row.original.id}`}>Открыть</Link></Button>{row.original.status === 'Pending' && <><Button variant="success" size="sm" className="w-full whitespace-nowrap" aria-label={`Одобрить кофейню ${row.original.name}`} loading={approveMutation.isPending && approveMutation.variables === row.original.id} disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(row.original.id)}>Одобрить</Button><Button variant="danger" size="sm" className="w-full whitespace-nowrap" disabled={approveMutation.isPending} onClick={() => setRejectionId(row.original.id)}>Отклонить</Button></>}</div>,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">Заявки на добавление кофеен</h2>
        <p className="text-sm text-text-muted dark:text-stone-400 font-body mt-0.5">
          {data ? `Кофейни, отправленные пользователями · Всего: ${data.totalCount}` : 'Загрузка...'}
          {data && sortKey && ' · сортировка на странице'}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border-light bg-white p-3 shadow-sm dark:border-border-dark dark:bg-surface-dark sm:flex-row sm:flex-wrap sm:items-center">
        <label className="flex items-center gap-2 text-sm text-text-muted dark:text-stone-400 font-body">
          <span className="shrink-0">Статус</span>
          <NativeSelect
            value={status}
            onChange={(event) => setParam('status', event.target.value)}

          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </NativeSelect>
        </label>
        <form onSubmit={handleSearch} className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
          <Input
            type="text"
            aria-label="Поиск кофеен по названию"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Поиск по названию..."
            className="w-full sm:w-72"
          />
          <Button type="submit" variant="secondary" size="sm" className="w-full sm:w-auto min-h-[44px] sm:min-h-0">
            Найти
          </Button>
        </form>
      </div>

      {selectedPendingIds.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-light bg-white p-3 text-sm text-text-main dark:border-border-dark dark:bg-surface-dark dark:text-white">
        <span>Выбрано на этой странице: <strong>{selectedPendingIds.length}</strong></span>
        <Button variant="success" size="sm" disabled={approveMutation.isPending} onClick={() => setBulkApprovalIds(selectedPendingIds)}>Одобрить выбранные</Button>
        <Button variant="secondary" size="sm" disabled={approveMutation.isPending} onClick={() => setSelectedIds(new Set())}>Снять выбор</Button>
      </div>}

      {isError && <LoadError message={data ? 'Не удалось обновить заявки. Показаны последние загруженные данные.' : 'Не удалось загрузить заявки на кофейни.'} onRetry={() => void refetch()} retrying={isFetching} />}
      {(!isError || data) && <Card>
        <DataTable columns={columns} data={items} loading={isLoading} emptyText="Кофейни не найдены" getRowId={(shop) => shop.id} getRowClassName={(shop) => selectedIds.has(shop.id) ? 'bg-primary/5 dark:bg-primary/10' : undefined} />
      </Card>}
      {data && <Pagination page={page} totalPages={data.totalPages} onPageChange={(nextPage) => setParam('page', String(nextPage))} />}

      <ConfirmDialog
        isOpen={bulkApprovalIds !== null}
        title={`Одобрить выбранные кофейни (${bulkApprovalIds?.length ?? 0})?`}
        message="Кофейни станут видны пользователям. Заявки будут обработаны по очереди; ошибка одной не остановит остальные."
        confirmLabel="Одобрить выбранные"
        variant="success"
        onConfirm={approveSelected}
        onCancel={() => setBulkApprovalIds(null)}
      />

      <ConfirmDialog
        isOpen={rejectionId !== null}
        title="Отклонить кофейню?"
        message="Укажите причину отклонения."
        confirmLabel="Отклонить"
        variant="danger"
        withComment
        commentLabel="Причина отклонения"
        onConfirm={async (comment) => {
          if (rejectionId)
            await rejectMutation.mutateAsync({ id: rejectionId, comment });
        }}
        onCancel={() => setRejectionId(null)}
      />
    </div>
  );
};
