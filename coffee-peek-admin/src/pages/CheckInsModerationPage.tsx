import { CheckInModerationCard } from '../components/CheckInModerationCard';
import { Input } from '@/src/components/ui/Input';
import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getModerationCheckIns, approveCheckIn, rejectCheckIn, ModerationStatus } from '../api/admin';
import { useToast } from '../contexts/ToastContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Pagination } from '../components/ui/Pagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { getErrorMessage } from '../utils/errors';
import { LoadError } from '../components/ui/LoadError';

const PAGE_SIZE = 15;

const STATUS_OPTIONS: { value: ModerationStatus | ''; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'Pending', label: 'На модерации' },
  { value: 'Approved', label: 'Одобренные' },
  { value: 'Rejected', label: 'Отклонённые' },
];

export const CheckInsModerationPage: React.FC = () => {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get('status') ?? 'Pending') as ModerationStatus | '';
  const page = parseInt(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const [localSearch, setLocalSearch] = useState(search);
  useEffect(() => setLocalSearch(search), [search]);
  const [pendingAction, setPendingAction] = useState<{ id: string; type: 'approve' | 'reject' } | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
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
    <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-3 sm:space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold sm:text-2xl tracking-tight text-text-main dark:text-white">
          Чекины на проверке
        </h2>
        <p className="text-sm text-text-muted dark:text-stone-400 font-body mt-0.5">
          {data ? `${status === 'Pending' ? 'Ожидают решения' : status === 'Approved' ? 'Одобренные чекины' : status === 'Rejected' ? 'Отклонённые чекины' : 'Все чекины'} · ${data.totalCount}` : 'Загрузка...'}
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
        <Card className="overflow-hidden">
          {isLoading ? (
            <div role="status" aria-label="Загрузка чекинов" className="space-y-3 p-3">
              {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-lg bg-stone-100 dark:bg-white/5" />)}
            </div>
          ) : data?.items.length ? (
            <ul aria-label="Чекины на проверке" className="divide-y divide-border-light dark:divide-border-dark">
              {data.items.map((checkIn) => (
                <li key={checkIn.id}>
                  <CheckInModerationCard checkIn={checkIn} onApprove={() => openAction(checkIn.id, 'approve')} onReject={() => openAction(checkIn.id, 'reject')} />
                </li>
              ))}
            </ul>
          ) : <p className="p-8 text-center text-sm text-text-muted dark:text-stone-400">Чекины не найдены</p>}
          {data && data.totalPages > 1 && <div className="border-t border-border-light px-3 py-2 dark:border-border-dark"><Pagination page={page} totalPages={data.totalPages} onPageChange={(nextPage) => setParam('page', String(nextPage))} /></div>}
        </Card>
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
