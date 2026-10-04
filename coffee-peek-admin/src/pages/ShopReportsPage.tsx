import { PublishedShopLink } from '../components/PublishedShopLink';
import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { DataTable } from '../components/ui/DataTable';
import {
  getShopIssueReports,
  updateShopIssueReportStatus,
  ShopIssueReportStatus,
  ShopIssueCategory,
  AdminShopIssueReport,
} from '../api/admin';
import { useToast } from '../contexts/ToastContext';
import { Badge, BadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Pagination } from '../components/ui/Pagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { getErrorMessage } from '../utils/errors';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: ShopIssueReportStatus | ''; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'Submitted', label: 'Новые' },
  { value: 'Reviewed', label: 'Просмотренные' },
  { value: 'Fixed', label: 'Исправленные' },
  { value: 'Invalid', label: 'Недействительные' },
];

const STATUS_BADGE: Record<ShopIssueReportStatus, BadgeVariant> = {
  Submitted: 'pending',
  Reviewed: 'info',
  Fixed: 'approved',
  Invalid: 'rejected',
};

const STATUS_LABELS: Record<ShopIssueReportStatus, string> = {
  Submitted: 'Новая',
  Reviewed: 'Просмотрена',
  Fixed: 'Исправлена',
  Invalid: 'Недействительна',
};

const CATEGORY_LABELS: Record<ShopIssueCategory, string> = {
  OutdatedMenu: 'Устаревшее меню',
  ShopClosed: 'Кофейня закрыта',
  IncorrectAddress: 'Неверный адрес',
  WrongOpeningHours: 'Неверные часы работы',
  IncorrectPhotos: 'Фото не соответствуют',
  Other: 'Другое',
};

type ActionStatus = Exclude<ShopIssueReportStatus, 'Submitted'>;

const ACTION_LABELS: Record<ActionStatus, string> = {
  Reviewed: 'Отметить просмотренной',
  Fixed: 'Отметить исправленной',
  Invalid: 'Отметить недействительной',
};

export const ShopReportsPage: React.FC = () => {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get('status') ?? '') as ShopIssueReportStatus | '';
  const page = parseInt(searchParams.get('page') ?? '1');
  const [pendingAction, setPendingAction] = useState<{ id: string; status: ActionStatus } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'shop-reports', { status, page }],
    queryFn: () =>
      getShopIssueReports({
        status: status || undefined,
        page,
        pageSize: PAGE_SIZE,
      }).then((r) => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ActionStatus }) => updateShopIssueReportStatus(id, status),
    onSuccess: () => {
      showToast('Статус обновлён', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'shop-reports'] });
      setPendingAction(null);
    },
    onError: (err) => showToast(getErrorMessage(err, 'Ошибка'), 'error'),
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };
  const columns: ColumnDef<AdminShopIssueReport>[] = [
    { accessorKey: 'category', header: 'Категория', cell: ({ row }) => CATEGORY_LABELS[row.original.category] },
    { accessorKey: 'shopId', header: 'Кофейня', cell: ({ row }) => <PublishedShopLink shopId={row.original.shopId} className="font-mono text-primary hover:underline">{row.original.shopId}</PublishedShopLink> },
    { accessorKey: 'description', header: 'Описание', cell: ({ row }) => <span className="line-clamp-3 max-w-[420px]">{row.original.description || '—'}</span> },
    { accessorKey: 'status', header: 'Статус', cell: ({ row }) => <Badge variant={STATUS_BADGE[row.original.status]}>{STATUS_LABELS[row.original.status]}</Badge> },
    { accessorKey: 'createdAtUtc', header: 'Дата', cell: ({ row }) => new Date(row.original.createdAtUtc).toLocaleDateString('ru') },
    { id: 'actions', cell: ({ row }) => <div className="flex min-w-max gap-2">{(Object.keys(ACTION_LABELS) as ActionStatus[]).filter((nextStatus) => nextStatus !== row.original.status).map((nextStatus) => <Button key={nextStatus} variant={nextStatus === 'Invalid' ? 'danger' : nextStatus === 'Fixed' ? 'success' : 'secondary'} size="sm" onClick={() => setPendingAction({ id: row.original.id, status: nextStatus })}>{ACTION_LABELS[nextStatus]}</Button>)}</div> },
  ];

  // After acting on the last item of page N>1 the page becomes empty — step back instead of stranding the user.
  useEffect(() => {
    if (data && page > 1 && !data.items.length) {
      const next = new URLSearchParams(searchParams);
      next.set('page', String(page - 1));
      setSearchParams(next, { replace: true });
    }
  }, [data, page, searchParams, setSearchParams]);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">Жалобы на данные кофеен</h2>
        <p className="text-sm text-text-muted dark:text-stone-400 font-body mt-0.5">
          {data ? `Сообщения пользователей о неточных сведениях · Всего: ${data.totalItems}` : 'Загрузка...'}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border-light bg-white p-3 shadow-sm dark:border-border-dark dark:bg-surface-dark sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {STATUS_OPTIONS.map((opt) => (
            <Button
              type="button"
              size="sm"
              key={opt.value}
              onClick={() => setParam('status', opt.value)}
              variant={status === opt.value ? 'primary' : 'secondary'}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <DataTable columns={columns} data={data?.items ?? []} loading={isLoading} emptyText="Жалобы не найдены" getRowId={(report) => report.id} />
        {data && <div className="border-t border-border-light px-5 py-3 dark:border-border-dark"><Pagination page={data.currentPage} totalPages={data.totalPages} onPageChange={(nextPage) => setParam('page', String(nextPage))} /></div>}
      </Card>

      <ConfirmDialog
        isOpen={!!pendingAction}
        title={pendingAction ? ACTION_LABELS[pendingAction.status] : ''}
        message="Изменить статус этой жалобы?"
        confirmLabel="Подтвердить"
        variant={pendingAction?.status === 'Invalid' ? 'danger' : 'primary'}
        onConfirm={async () => {
          if (pendingAction) await statusMutation.mutateAsync(pendingAction);
        }}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};
