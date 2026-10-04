import { PublishedShopLink } from '../components/PublishedShopLink';
import { Input } from '@/src/components/ui/Input';
import { DataTable } from '@/src/components/ui/DataTable';
import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { getModerationReviews, approveReview, rejectReview, ModerationStatus, AdminReview } from '../api/admin';
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

function displayDrinkName(review: AdminReview): string {
  if (review.drinkSlug === 'other' && review.customDrinkName) return review.customDrinkName;
  const isEnglish = typeof document !== 'undefined' && document.documentElement.lang.toLowerCase().startsWith('en');
  return (isEnglish ? review.drinkNameEn || review.drinkNameRu : review.drinkNameRu || review.drinkNameEn)
    || review.customDrinkName
    || (isEnglish ? 'Not specified' : 'Не указан');
}

export const ReviewsModerationPage: React.FC = () => {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get('status') ?? '') as ModerationStatus | '';
  const page = parseInt(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const [localSearch, setLocalSearch] = useState(search);
  const [pendingAction, setPendingAction] = useState<{ id: string; type: 'approve' | 'reject' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'moderation', 'reviews', { status, page, search }],
    queryFn: () =>
      getModerationReviews({
        status: status || undefined,
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
      }).then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      approveReview(id, comment ? { comment } : undefined),
    onSuccess: () => {
      showToast('Отзыв одобрен', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'moderation', 'reviews'] });
      setPendingAction(null);
    },
    onError: (err) => showToast(getErrorMessage(err, 'Ошибка'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      rejectReview(id, comment ? { comment } : undefined),
    onSuccess: () => {
      showToast('Отзыв отклонён', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'moderation', 'reviews'] });
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

  const columns: ColumnDef<AdminReview>[] = [
    { accessorKey: 'header', header: 'Отзыв', cell: ({ row }) => <div className="max-w-[360px]"><p className="font-medium text-text-main dark:text-white">{row.original.header}</p><p className="text-xs text-text-muted">Напиток: {displayDrinkName(row.original)}</p><p className="line-clamp-2 text-xs text-text-muted">{row.original.comment}</p></div> },
    { accessorKey: 'shopName', header: 'Кофейня', cell: ({ row }) => <PublishedShopLink shopId={row.original.shopId} className="font-medium text-blue-600 hover:underline dark:text-blue-400">{row.original.shopName}</PublishedShopLink> },
    { id: 'author', header: 'Автор', cell: ({ row }) => row.original.authorName ?? row.original.authorEmail },
    { id: 'ratings', header: 'Оценки', cell: ({ row }) => `К ${row.original.ratingCoffee} · С ${row.original.ratingService} · М ${row.original.ratingPlace}` },
    { accessorKey: 'status', header: 'Статус', cell: ({ row }) => <Badge variant={statusToBadgeVariant(row.original.status)}>{statusLabels[row.original.status]}</Badge> },
    { accessorKey: 'createdAtUtc', header: 'Дата', cell: ({ row }) => new Date(row.original.createdAtUtc).toLocaleDateString('ru') },
    { id: 'actions', cell: ({ row }) => row.original.status === 'Pending' ? <div className="flex gap-2"><Button variant="success" size="sm" onClick={() => setPendingAction({ id: row.original.id, type: 'approve' })}>Одобрить</Button><Button variant="danger" size="sm" onClick={() => setPendingAction({ id: row.original.id, type: 'reject' })}>Отклонить</Button></div> : null },
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
          Отзывы на проверке
        </h2>
        <p className="text-sm text-text-muted dark:text-stone-400 font-body mt-0.5">
          {data ? `Отзывы пользователей, ожидающие решения · Всего: ${data.totalCount}` : 'Загрузка...'}
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

      <Card>
        <DataTable columns={columns} data={data?.items ?? []} loading={isLoading} emptyText="Отзывы не найдены" getRowId={(review) => review.id} />
        {data && <div className="border-t border-border-light px-5 py-3 dark:border-border-dark"><Pagination page={page} totalPages={data.totalPages} onPageChange={(nextPage) => setParam('page', String(nextPage))} /></div>}
      </Card>

      <ConfirmDialog
        isOpen={pendingAction?.type === 'approve'}
        title="Одобрить отзыв?"
        message="Отзыв будет опубликован и виден всем пользователям."
        confirmLabel="Одобрить"
        variant="success"
        withComment
        commentLabel="Комментарий (необязательно)"
        onConfirm={async (comment) => {
          if (pendingAction) await approveMutation.mutateAsync({ id: pendingAction.id, comment });
        }}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        isOpen={pendingAction?.type === 'reject'}
        title="Отклонить отзыв?"
        message="Укажите причину отклонения."
        confirmLabel="Отклонить"
        variant="danger"
        withComment
        commentLabel="Причина отклонения"
        onConfirm={async (comment) => {
          if (pendingAction) await rejectMutation.mutateAsync({ id: pendingAction.id, comment });
        }}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};
