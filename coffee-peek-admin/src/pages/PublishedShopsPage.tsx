import { Input } from '@/src/components/ui/Input';
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useSearchParams, Link } from 'react-router-dom';
import { getPublishedShops, setPublishedShopVisibility, CoffeeShopStatus, type PublishedShop } from '../api/admin';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LoadError } from '../components/ui/LoadError';
import { Pagination } from '../components/ui/Pagination';
import { useToast } from '../contexts/ToastContext';
import {
  COFFEE_SHOP_STATUS_LABELS,
  coffeeShopStatusBadgeVariant,
} from '../constants/coffeeShopStatus';
import { FocusBadge } from '../components/import/catalogControls';
import { getErrorMessage } from '../utils/errors';
import { DataTable } from '../components/ui/DataTable';

const PAGE_SIZE = 20;
type SortKey = 'name' | 'coffeeFocus' | 'dataCompletenessScore' | 'status' | 'createdAtUtc';
type SortDirection = 'asc' | 'desc';

const STATUS_OPTIONS: { value: CoffeeShopStatus | ''; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'Active', label: 'Открыта' },
  { value: 'TemporarilyClosed', label: 'Временно закрыта' },
  { value: 'PermanentlyClosed', label: 'Закрыта навсегда' },
];

const SortHeader: React.FC<{
  sort: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  children: React.ReactNode;
}> = ({ sort, sortKey, sortDirection, onSort, children }) => {
  const active = sortKey === sort;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={`Сортировать: ${String(children)}`}
      className="-ml-3 h-8 px-3 text-xs uppercase tracking-wide"
      onClick={() => onSort(sort)}
    >
      {children}
      <span aria-hidden className={active ? 'text-text-main dark:text-white' : 'text-stone-300 dark:text-stone-600'}>
        {active ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </Button>
  );
};

export const PublishedShopsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const status = (searchParams.get('status') ?? '') as CoffeeShopStatus | '';
  const importedFromFile = searchParams.get('importedFromFile') === '1';
  const sortKey = (searchParams.get('sort') ?? 'createdAtUtc') as SortKey;
  const sortDirection = (searchParams.get('direction') ?? 'desc') as SortDirection;
  const [localSearch, setLocalSearch] = useState(search);
  const { showToast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'published-shops', { page, search, status, importedFromFile, sortKey, sortDirection }],
    queryFn: () =>
      getPublishedShops({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: status || undefined,
        importedFromFile: importedFromFile || undefined,
        // Completeness is sorted client-side because this field is not part of
        // the documented backend sorting contract.
        sortBy: sortKey === 'dataCompletenessScore' ? undefined : sortKey,
        sortDirection,
      }).then((r) => r.data),
  });

  const sortedItems = useMemo(() => {
    const items = [...(data?.items ?? [])];
    const direction = sortDirection === 'asc' ? 1 : -1;

    return items.sort((left, right) => {
      if (sortKey === 'createdAtUtc') {
        return (new Date(left.createdAtUtc).getTime() - new Date(right.createdAtUtc).getTime()) * direction;
      }

      if (sortKey === 'dataCompletenessScore') {
        return (left.dataCompletenessScore - right.dataCompletenessScore) * direction;
      }

      return String(left[sortKey] ?? '').localeCompare(String(right[sortKey] ?? ''), 'ru', {
        sensitivity: 'base',
      }) * direction;
    });
  }, [data?.items, sortDirection, sortKey]);

  const visibilityMutation = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) =>
      setPublishedShopVisibility(id, hidden),
    onSuccess: (_response, { hidden }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'published-shops'] });
      qc.invalidateQueries({ queryKey: ['browse'] });
      showToast(hidden ? 'Кофейня скрыта из приложения' : 'Кофейня снова видна в приложении', 'success');
    },
    onError: (err) => showToast(getErrorMessage(err, 'Не удалось изменить видимость'), 'error'),
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const toggleSort = (key: SortKey) => {
    const next = new URLSearchParams(searchParams);
    next.set('sort', key);
    next.set('direction', sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc');
    next.delete('page');
    setSearchParams(next);
  };

  const sortProps = { sortKey, sortDirection, onSort: toggleSort };
  const columns: ColumnDef<PublishedShop>[] = [
    {
      accessorKey: 'name',
      header: () => <SortHeader sort="name" {...sortProps}>Название</SortHeader>,
      cell: ({ row }) => <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{row.original.name}</span>{row.original.isHidden && <Badge variant="rejected">Скрыта</Badge>}</div>,
      meta: { headerClassName: 'pl-5', className: 'pl-5' },
    },
    { accessorKey: 'coffeeFocus', header: () => <SortHeader sort="coffeeFocus" {...sortProps}>Фокус</SortHeader>, cell: ({ row }) => <FocusBadge focus={row.original.coffeeFocus} /> },
    { accessorKey: 'dataCompletenessScore', header: () => <SortHeader sort="dataCompletenessScore" {...sortProps}>Заполненность</SortHeader>, cell: ({ row }) => <Badge variant="info">{row.original.dataCompletenessScore}%</Badge> },
    { accessorKey: 'status', header: () => <SortHeader sort="status" {...sortProps}>Статус</SortHeader>, cell: ({ row }) => <Badge variant={coffeeShopStatusBadgeVariant(row.original.status)}>{COFFEE_SHOP_STATUS_LABELS[row.original.status]}</Badge> },
    { accessorKey: 'createdAtUtc', header: () => <SortHeader sort="createdAtUtc" {...sortProps}>Создана</SortHeader>, cell: ({ row }) => <span className="text-xs text-text-muted dark:text-stone-400">{new Date(row.original.createdAtUtc).toLocaleDateString('ru')}</span> },
    {
      id: 'actions',
      cell: ({ row }) => <div className="flex justify-end gap-1"><Button variant="ghost" size="sm" loading={visibilityMutation.isPending && visibilityMutation.variables?.id === row.original.id} onClick={() => visibilityMutation.mutate({ id: row.original.id, hidden: !row.original.isHidden })}>{row.original.isHidden ? 'Показать' : 'Скрыть'}</Button><Button asChild variant="ghost" size="sm"><Link to={`/published-shops/${row.original.id}`}>Редактировать</Link></Button></div>,
      meta: { className: 'text-right' },
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">Все кофейни</h2>
        <p className="text-sm text-text-muted dark:text-stone-400 font-body mt-0.5">
          Управление созданными и опубликованными кофейнями
          {sortKey === 'dataCompletenessScore' && ' · сортировка на странице'}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border-light bg-white p-3 shadow-sm dark:border-border-dark dark:bg-surface-dark sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {STATUS_OPTIONS.map((opt) => (
            <Button
              type="button"
              size="sm"
              key={opt.value || 'all'}
              onClick={() => setParam('status', opt.value)}
              variant={status === opt.value ? 'primary' : 'secondary'}
            >
              {opt.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            onClick={() => setParam('importedFromFile', importedFromFile ? '' : '1')}
            variant={importedFromFile ? 'primary' : 'secondary'}
          >
            Импорт из файла
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParam('search', localSearch);
          }}
          className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row"
        >
          <Input
            type="text"
            aria-label="Поиск кофеен по названию"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Название..."
            className="w-full sm:w-72"
          />
          <Button type="submit" variant="secondary" size="sm" className="w-full sm:w-auto min-h-[44px] sm:min-h-0">
            Найти
          </Button>
        </form>
      </div>

      {isError && <LoadError message={data ? 'Не удалось обновить список кофеен. Показаны последние загруженные данные.' : 'Не удалось загрузить список кофеен.'} onRetry={() => void refetch()} retrying={isFetching} />}
      {(!isError || data) && <Card>
        <DataTable columns={columns} data={sortedItems} loading={isLoading} emptyText="Кофейни не найдены" getRowId={(shop) => shop.id} />
        {data && data.totalPages > 1 && <div className="border-t border-border-light px-5 py-3 dark:border-border-dark"><Pagination page={page} totalPages={data.totalPages} onPageChange={(nextPage) => setParam('page', String(nextPage))} /></div>}
      </Card>}
    </div>
  );
};
