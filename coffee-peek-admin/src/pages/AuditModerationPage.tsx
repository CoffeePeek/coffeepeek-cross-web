import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import {
  getModerationAuditLog,
  AuditEntityType,
  AuditAction,
  ModerationAuditEntry,
} from '../api/admin';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Pagination } from '../components/ui/Pagination';
import { DataTable } from '../components/ui/DataTable';

const PAGE_SIZE = 20;

const ENTITY_OPTIONS: { value: AuditEntityType | ''; label: string }[] = [
  { value: '', label: 'Все типы' },
  { value: 'Shop', label: 'Кофейни' },
  { value: 'CheckIn', label: 'Чекины' },
];

const ACTION_OPTIONS: { value: AuditAction | ''; label: string }[] = [
  { value: '', label: 'Все действия' },
  { value: 'Approved', label: 'Одобрено' },
  { value: 'Rejected', label: 'Отклонено' },
  { value: 'Pending', label: 'На модерации' },
];

const ACTION_LABELS: Record<AuditAction, string> = {
  Approved: 'Одобрено',
  Rejected: 'Отклонено',
  Pending: 'На модерации',
};

const ACTION_VARIANT: Record<AuditAction, 'approved' | 'rejected' | 'pending'> = {
  Approved: 'approved',
  Rejected: 'rejected',
  Pending: 'pending',
};

const columns: ColumnDef<ModerationAuditEntry>[] = [
  { accessorKey: 'createdAtUtc', header: 'Дата', cell: ({ row }) => <span className="whitespace-nowrap text-xs text-text-muted">{new Date(row.original.createdAtUtc).toLocaleString('ru')}</span>, meta: { headerClassName: 'pl-5', className: 'pl-5' } },
  { accessorKey: 'entityType', header: 'Тип', cell: ({ row }) => <Badge>{row.original.entityType === 'Shop' ? 'Кофейня' : row.original.entityType === 'CheckIn' ? 'Чекин' : 'Пост'}</Badge> },
  { accessorKey: 'entityName', header: 'Сущность', cell: ({ row }) => <span className="block max-w-[200px] truncate">{row.original.entityName}</span> },
  { accessorKey: 'action', header: 'Действие', cell: ({ row }) => <Badge variant={ACTION_VARIANT[row.original.action]}>{ACTION_LABELS[row.original.action]}</Badge> },
  { accessorKey: 'moderatorUserId', header: 'Модератор', cell: ({ row }) => <span className="font-mono text-xs text-text-muted">{row.original.moderatorUserId.slice(0, 8)}…</span>, meta: { headerClassName: 'hidden md:table-cell', className: 'hidden md:table-cell' } },
  { accessorKey: 'comment', header: 'Комментарий', cell: ({ row }) => <span className="block max-w-[240px] truncate text-xs text-text-muted">{row.original.comment ?? '—'}</span>, meta: { headerClassName: 'hidden lg:table-cell', className: 'hidden lg:table-cell' } },
];

export const AuditModerationPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') ?? '1');
  const entityType = (searchParams.get('entityType') ?? '') as AuditEntityType | '';
  const action = (searchParams.get('action') ?? '') as AuditAction | '';

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', 'moderation', { page, entityType, action }],
    queryFn: () =>
      getModerationAuditLog({
        page,
        pageSize: PAGE_SIZE,
        entityType: entityType || undefined,
        action: action || undefined,
      }).then((r) => r.data),
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">Audit log модерации</h2>
        <p className="text-sm text-text-muted dark:text-stone-400 font-body mt-0.5">
          История approve / reject / pending по кофейням, чекинам и постам
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border-light bg-white p-3 shadow-sm dark:border-border-dark dark:bg-surface-dark sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {ENTITY_OPTIONS.map((opt) => (
            <Button
              type="button"
              size="sm"
              key={opt.value || 'all-entity'}
              onClick={() => setParam('entityType', opt.value)}
              variant={entityType === opt.value ? 'primary' : 'secondary'}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {ACTION_OPTIONS.map((opt) => (
            <Button
              type="button"
              size="sm"
              key={opt.value || 'all-action'}
              onClick={() => setParam('action', opt.value)}
              variant={action === opt.value ? 'primary' : 'secondary'}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <DataTable columns={columns} data={data?.items ?? []} loading={isLoading} emptyText="Записей не найдено" getRowId={(entry) => entry.id} />
        {data && data.totalPages > 1 && <div className="border-t border-border-light px-5 py-3 dark:border-border-dark"><Pagination page={page} totalPages={data.totalPages} onPageChange={(nextPage) => setParam('page', String(nextPage))} /></div>}
      </Card>
    </div>
  );
};
