import { CheckInModerationCard } from '../components/CheckInModerationCard';
import { Input } from '@/src/components/ui/Input';
import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getModerationCheckIns, approveCheckIn, rejectCheckIn, type CheckInCurrentState, type CurrentModerationCheckIn } from '../api/admin';
import { useToast } from '../contexts/ToastContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Pagination } from '../components/ui/Pagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { getErrorMessage } from '../utils/errors';
import { LoadError } from '../components/ui/LoadError';
import { RemoveCheckInDialog } from '../components/RemoveCheckInDialog';
import { moderationQueueRefresh } from '../lib/queryClient';

const PAGE_SIZE = 15;

const STATUS_OPTIONS: { value: CheckInCurrentState | ''; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'Pending', label: 'На модерации' },
  { value: 'Published', label: 'Опубликованные' },
  { value: 'Rejected', label: 'Отклонённые' },
  { value: 'Deleted', label: 'Удалённые' },
];

export const CheckInsModerationPage: React.FC = () => {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = searchParams.get('status');
  const status = STATUS_OPTIONS.find((option) => option.value === (statusParam === 'Approved' ? 'Published' : statusParam))?.value ?? 'Pending';
  const page = parseInt(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const [localSearch, setLocalSearch] = useState(search);
  useEffect(() => setLocalSearch(search), [search]);
  const [pendingAction, setPendingAction] = useState<{ id: string; type: 'approve' | 'reject' } | null>(null);
  const [checkInToRemove, setCheckInToRemove] = useState<CurrentModerationCheckIn | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    ...moderationQueueRefresh,
    queryKey: ['admin', 'moderation', 'checkIns', { status, page, search }],
    queryFn: ({ signal }) =>
      getModerationCheckIns({
        currentState: status || undefined,
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
      }, signal).then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      approveCheckIn(id, comment ? { comment } : undefined),
    onSuccess: () => {
      showToast('Чекин одобрен', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'moderation', 'checkIns'] });
      qc.invalidateQueries({ queryKey: ['admin', 'audit', 'moderation'] });
      qc.invalidateQueries({ queryKey: ['admin', 'leaderboard'] });
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
      qc.invalidateQueries({ queryKey: ['admin', 'audit', 'moderation'] });
      qc.invalidateQueries({ queryKey: ['admin', 'leaderboard'] });
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

  // After acting on the last item of page N>1 the page becomes empty — step back instead of stranding the user.
  useEffect(() => {
    if (data && page > 1 && !data.items.length) {
      const next = new URLSearchParams(searchParams);
      next.set('page', String(page - 1));
      setSearchParams(next, { replace: true });
    }
  }, [data, page, searchParams, setSearchParams]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1200px] space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold sm:text-2xl tracking-tight text-text-main dark:text-white">
          Модерация чекинов
        </h2>
        <p className="text-sm text-text-muted dark:text-stone-400 font-body mt-0.5">
          {data ? `Найдено: ${data.totalCount}` : 'Загрузка...'}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border-light bg-white p-3 shadow-sm dark:border-border-dark dark:bg-surface-dark sm:flex-row sm:flex-wrap sm:items-center">
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
          {STATUS_OPTIONS.map((opt) => (
            <Button
              type="button"
              size="sm"
              key={opt.value}
              onClick={() => setParam('status', opt.value)}
              aria-pressed={status === opt.value}
              className="min-h-11 sm:min-h-8"
              variant={status === opt.value ? 'primary' : 'secondary'}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setParam('search', localSearch.trim()); }}
          className="flex w-full min-w-0 gap-2 sm:ml-auto sm:w-auto"
        >
          <Input
            type="search"
            aria-label="Поиск по тексту"
            maxLength={100}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Поиск по тексту..."
            className="h-11 min-w-0 sm:h-9 sm:w-64"
          />
          <Button type="submit" variant="secondary" size="sm" className="h-11 shrink-0 sm:h-9">
            Найти
          </Button>
        </form>
      </div>

      {error ? <LoadError message={getErrorMessage(error, 'Не удалось загрузить чекины')} onRetry={() => void refetch()} retrying={isFetching} /> : (
        <div className="space-y-4">
          {isLoading ? (
            <div role="status" aria-label="Загрузка чекинов" className="space-y-4">
              {Array.from({ length: 5 }, (_, index) => <Card key={index} className="h-52 animate-pulse bg-stone-100 dark:bg-white/5" />)}
            </div>
          ) : data?.items.length ? (
            <ul aria-label="Чекины" className="space-y-4">
              {data.items.map((checkIn) => (
                <li key={checkIn.checkInId}>
                  <CheckInModerationCard checkIn={checkIn} onApprove={() => openAction(checkIn.id, 'approve')} onReject={() => openAction(checkIn.id, 'reject')} onRemove={() => setCheckInToRemove(checkIn)} />
                </li>
              ))}
            </ul>
          ) : <Card className="p-8 text-center text-sm text-text-muted dark:text-stone-400">Чекины не найдены</Card>}
          {data && data.totalPages > 1 && <div className="py-2"><Pagination page={page} totalPages={data.totalPages} onPageChange={(nextPage) => setParam('page', String(nextPage))} /></div>}
        </div>
      )}

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
      {checkInToRemove && <RemoveCheckInDialog checkIn={checkInToRemove} onClose={() => setCheckInToRemove(null)} />}

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
