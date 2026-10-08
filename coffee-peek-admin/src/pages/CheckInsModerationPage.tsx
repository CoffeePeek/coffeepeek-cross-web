import ModerationPhotos from '../components/ModerationPhotos';
import { PublishedShopLink } from '../components/PublishedShopLink';
import { Input } from '@/src/components/ui/Input';
import { DataTable } from '@/src/components/ui/DataTable';
import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { getModerationCheckIns, approveCheckIn, rejectCheckIn, ModerationStatus, ModerationCheckIn } from '../api/admin';
import { useToast } from '../contexts/ToastContext';
import { Badge, statusToBadgeVariant, statusLabels } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Pagination } from '../components/ui/Pagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { getErrorMessage } from '../utils/errors';

const PAGE_SIZE = 15;

const STATUS_OPTIONS: { value: ModerationStatus | ''; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'Pending', label: 'На модерации' },
  { value: 'Approved', label: 'Одобренные' },
  { value: 'Rejected', label: 'Отклонённые' },
];

function displayDrinkName(checkIn: ModerationCheckIn): string {
  if (checkIn.drinkSlug === 'other' && checkIn.customDrinkName) return checkIn.customDrinkName;
  const isEnglish = typeof document !== 'undefined' && document.documentElement.lang.toLowerCase().startsWith('en');
  return (isEnglish ? checkIn.drinkNameEn || checkIn.drinkNameRu : checkIn.drinkNameRu || checkIn.drinkNameEn)
    || checkIn.customDrinkName
    || (isEnglish ? 'Not specified' : 'Не указан');
}

export const CheckInsModerationPage: React.FC = () => {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get('status') ?? 'Pending') as ModerationStatus | '';
  const page = parseInt(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const [localSearch, setLocalSearch] = useState(search);
  const [pendingAction, setPendingAction] = useState<{ id: string; type: 'approve' | 'reject' } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'moderation', 'checkIns', { status, page, search }],
    queryFn: () =>
      getModerationCheckIns({
        status: status || undefined,
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
      }).then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      approveCheckIn(id, comment ? { comment } : undefined),
    onSuccess: () => {
      showToast('Чекин одобрен', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'moderation', 'checkIns'] });
      setPendingAction(null);
    },
    onError: (err) => showToast(getErrorMessage(err, 'Ошибка'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      rejectCheckIn(id, comment ? { comment } : undefined),
    onSuccess: () => {
      showToast('Чекин отклонён', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'moderation', 'checkIns'] });
      setPendingAction(null);
    },
    onError: (err) => showToast(getErrorMessage(err, 'Ошибка'), 'error'),
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value || key === 'status') next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const openAction = (id: string, type: 'approve' | 'reject') => {
    approveMutation.reset();
    rejectMutation.reset();
    setPendingAction({ id, type });
  };

  const columns: ColumnDef<ModerationCheckIn>[] = [
    { accessorKey: 'text', header: 'Чекин', cell: ({ row }) => <div className="max-w-[360px]"><p className="whitespace-pre-wrap text-text-main dark:text-white">{row.original.text}</p><p className="mt-1 text-xs text-text-muted">Напиток: {displayDrinkName(row.original)} · Ревизия {row.original.contentRevision}</p><ModerationPhotos photos={row.original.photos} /></div> },
    { accessorKey: 'shopName', header: 'Кофейня', cell: ({ row }) => <PublishedShopLink shopId={row.original.shopId} className="font-medium text-blue-600 hover:underline dark:text-blue-400">{row.original.shopId}</PublishedShopLink> },
    { id: 'author', header: 'Автор', cell: ({ row }) => row.original.userName },
    { id: 'ratings', header: 'Оценки', cell: ({ row }) => `К ${row.original.rating.coffee} · С ${row.original.rating.service} · М ${row.original.rating.place}` },
    { accessorKey: 'moderationStatus', header: 'Статус', cell: ({ row }) => <Badge variant={statusToBadgeVariant(row.original.moderationStatus)}>{statusLabels[row.original.moderationStatus]}</Badge> },
    { accessorKey: 'visitedAtUtc', header: 'Дата', cell: ({ row }) => new Date(row.original.visitedAtUtc).toLocaleDateString('ru') },
    { id: 'actions', cell: ({ row }) => row.original.moderationStatus === 'Pending' ? <div className="flex gap-2"><Button variant="success" size="sm" onClick={() => openAction(row.original.id, 'approve')}>Одобрить</Button><Button variant="danger" size="sm" onClick={() => openAction(row.original.id, 'reject')}>Отклонить</Button></div> : null },
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
        <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">
          Чекины на проверке
        </h2>
        <p className="text-sm text-text-muted dark:text-stone-400 font-body mt-0.5">
          {data ? `Чекины пользователей, ожидающие решения · Всего: ${data.totalCount}` : 'Загрузка...'}
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
        <form
          onSubmit={(e) => { e.preventDefault(); setParam('search', localSearch); }}
          className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row"
        >
          <Input
            type="text"
            maxLength={100}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Поиск по тексту..."
            className="w-full sm:w-72"
          />
          <Button type="submit" variant="secondary" size="sm" className="w-full sm:w-auto min-h-[44px] sm:min-h-0">
            Найти
          </Button>
        </form>
      </div>

      {error && <p role="alert" className="text-red-500">{getErrorMessage(error, "Не удалось загрузить чекины")} <button type="button" onClick={() => void refetch()}>Повторить</button></p>}
      <Card>
        <DataTable columns={columns} data={data?.items ?? []} loading={isLoading} emptyText="Чекины не найдены" getRowId={(checkIn) => checkIn.id} />
        {data && <div className="border-t border-border-light px-5 py-3 dark:border-border-dark"><Pagination page={page} totalPages={data.totalPages} onPageChange={(nextPage) => setParam('page', String(nextPage))} /></div>}
      </Card>

      <ConfirmDialog
        isOpen={pendingAction?.type === 'approve'}
        title="Одобрить чекин?"
        message="Чекин будет опубликован и виден всем пользователям."
        confirmLabel="Одобрить"
        variant="success"
        withComment
        commentLabel="Комментарий (необязательно)"
        error={approveMutation.error ? getErrorMessage(approveMutation.error, 'Не удалось сохранить решение') : undefined}
        onConfirm={async (comment) => {
          try { if (pendingAction) await approveMutation.mutateAsync({ id: pendingAction.id, comment }); }
          catch { /* Mutation error is displayed in the dialog. */ }
        }}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        isOpen={pendingAction?.type === 'reject'}
        title="Отклонить чекин?"
        message="Укажите причину отклонения."
        confirmLabel="Отклонить"
        variant="danger"
        withComment
        commentLabel="Причина отклонения (2–1000 символов)"
        error={rejectMutation.error ? getErrorMessage(rejectMutation.error, "Не удалось сохранить решение") : undefined}
        onConfirm={async (comment) => {
          try { if (pendingAction) await rejectMutation.mutateAsync({ id: pendingAction.id, comment }); }
          catch { /* Mutation error is displayed in the dialog. */ }
        }}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};
