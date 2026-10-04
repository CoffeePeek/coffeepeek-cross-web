import { PublishedShopLink } from '../components/PublishedShopLink';
import { useEffect, useState } from 'react';
import { Flag, MessageSquareText, Star, Trash2, ShieldCheck, X, ArrowUpRight, RefreshCw, Clock } from 'lucide-react';
import { Badge, type BadgeVariant } from '../components/ui/Badge';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { getReviewReports, getReviewReport, resolveReviewReport, type ReviewReport } from '../api/reviewReports';
import { DataTable } from '../components/ui/DataTable';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Pagination } from '../components/ui/Pagination';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/Dialog';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errors';

const statuses = [
  { value: 'Pending', label: 'Ожидают решения' },
  { value: 'Dismissed', label: 'Отклонены' },
  { value: 'ReviewDeleted', label: 'Отзыв удалён' },
  { value: '', label: 'Все' },
];
const labels = ['Ожидает решения', 'Жалоба отклонена', 'Отзыв удалён'];
const variants: BadgeVariant[] = ['pending', 'default', 'rejected'];
const date = (value: string | null) => value ? new Date(value).toLocaleString('ru-RU') : '—';

export function ReviewReportsPage() {
  const [params, setParams] = useSearchParams();
  const rawStatus = params.get('status') ?? 'Pending';
  const status = statuses.some(item => item.value === rawStatus) ? rawStatus : 'Pending';
  const rawPage = Number(params.get('page') ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const [selected, setSelected] = useState<string | null>(null);
  const [decision, setDecision] = useState<boolean | null>(null);
  const qc = useQueryClient();
  const { showToast } = useToast();
  const list = useQuery({ queryKey: ['admin', 'review-reports', status, page], queryFn: () => getReviewReports(status, page).then(r => r.data), staleTime: 0, gcTime: 0, refetchOnWindowFocus: true });
  const detail = useQuery({ queryKey: ['admin', 'review-reports', 'detail', selected], queryFn: () => getReviewReport(selected!).then(r => r.data), enabled: !!selected, staleTime: 0, gcTime: 0, refetchOnWindowFocus: true });
  const resolution = useMutation({
    mutationFn: ({ id, deleteReview }: { id: string; deleteReview: boolean }) => resolveReviewReport(id, deleteReview),
    onSuccess: () => {
      showToast('Решение сохранено', 'success');
      setDecision(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'review-reports'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'moderation', 'reviews'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      void qc.invalidateQueries({ queryKey: ['browse'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'published-shops'] });
    },
    onError: err => {
      setDecision(null);
      if ((err as { status?: number }).status === 409) {
        showToast('Жалоба или отзыв изменились. Проверьте обновлённые данные и повторите решение.', 'error');
        void qc.invalidateQueries({ queryKey: ['admin', 'review-reports'] });
      } else showToast(getErrorMessage(err, 'Не удалось сохранить решение'), 'error');
    },
  });
  const changePage = (nextPage: number) => { const next = new URLSearchParams(params); next.set('page', String(nextPage)); setParams(next); };
  useEffect(() => {
    if (list.data && !list.isFetching && page > 1 && !list.data.items.length) changePage(page - 1);
  }, [list.data, list.isFetching, page]);
  useEffect(() => { setDecision(null); }, [detail.data]);
  const columns: ColumnDef<ReviewReport>[] = [
    { accessorKey: 'text', header: 'Причина жалобы', cell: ({ row }) => <div className="flex max-w-lg items-start gap-3"><span className="rounded-lg bg-amber-500/10 p-2 text-amber-600"><Flag className="h-4 w-4" /></span><div><p className="line-clamp-2 whitespace-pre-wrap break-words font-medium">{row.original.text}</p><p className="mt-1 text-xs text-text-muted">Отзыв #{row.original.reviewId.slice(0, 8)}</p></div></div> },
    { accessorKey: 'status', header: 'Статус', cell: ({ row }) => <Badge variant={variants[row.original.status]}>{labels[row.original.status]}</Badge> },
    { accessorKey: 'createdAtUtc', header: 'Получена', cell: ({ row }) => <span className="text-sm text-text-muted">{date(row.original.createdAtUtc)}</span> },
    { id: 'actions', cell: ({ row }) => <Button size="sm" variant={row.original.status === 0 ? 'primary' : 'secondary'} onClick={() => { setSelected(row.original.id); setDecision(null); }}>{row.original.status === 0 ? 'Рассмотреть' : 'Посмотреть'}<ArrowUpRight className="h-4 w-4" /></Button> },
  ];
  const report = detail.data?.report;
  const review = detail.data?.review;
  return <div className="mx-auto w-full max-w-[1600px] space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-3"><span className="rounded-xl bg-primary/15 p-2.5 text-amber-600 dark:text-primary"><Flag className="h-5 w-5" /></span><h2 className="font-display text-2xl font-bold">Жалобы на отзывы</h2></div><p className="text-sm text-text-muted">Проверьте сообщение пользователя и решите, стоит ли удалять отзыв.</p></div>
      <Button variant="secondary" disabled={list.isFetching} onClick={() => void list.refetch()}><RefreshCw className={`h-4 w-4 ${list.isFetching ? 'animate-spin' : ''}`} />Обновить</Button>
    </div>
    <div className="flex flex-wrap gap-2">{statuses.map(item => <Button key={item.value} size="sm" variant={status === item.value ? 'primary' : 'secondary'} onClick={() => { const next = new URLSearchParams(); next.set('status', item.value); setParams(next); }}>{item.label}</Button>)}</div>
    {list.error ? <p role="alert">{getErrorMessage(list.error, 'Не удалось загрузить жалобы')}</p> : <Card>
      <div className="flex items-center justify-between border-b border-border-light px-5 py-4 dark:border-border-dark"><h3 className="font-semibold">{statuses.find(item => item.value === status)?.label}</h3><span className="text-sm text-text-muted">{list.data?.totalCount ?? 0} жалоб</span></div>
      <DataTable columns={columns} data={list.data?.items ?? []} loading={list.isLoading} emptyText="Жалоб в этом разделе пока нет" getRowId={item => item.id} />
      {list.data && <div className="border-t border-border-light p-4 dark:border-border-dark"><Pagination page={list.data.page} totalPages={Math.max(1, Math.ceil(list.data.totalCount / list.data.pageSize))} onPageChange={changePage} /></div>}
    </Card>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !resolution.isPending) { setSelected(null); setDecision(null); } }}>
      <DialogContent className="flex max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 border-b border-border-light px-6 py-5 dark:border-border-dark">
          <div className="mb-2 flex items-center gap-2 pr-6"><DialogTitle>Рассмотрение жалобы</DialogTitle>{report && <Badge variant={variants[report.status]}>{labels[report.status]}</Badge>}</div>
          <DialogDescription>Сравните причину жалобы с содержанием отзыва.</DialogDescription>
        </div>
        {detail.isLoading || (detail.isFetching && !report) ? <p className="p-6">Загрузка…</p> : detail.error ? <div className="p-6" role="alert">{getErrorMessage(detail.error, 'Не удалось загрузить жалобу')} <Button variant="secondary" onClick={() => void detail.refetch()}>Повторить</Button></div> : report && review && <>
          <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
            <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300"><Flag className="h-4 w-4" />Причина жалобы</h3><span className="flex items-center gap-1 text-xs text-text-muted"><Clock className="h-3.5 w-3.5" />{date(report.createdAtUtc)}</span></div>
              <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{report.text}</p>
            </section>
            <section className="rounded-2xl border border-border-light p-5 dark:border-border-dark">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold text-text-muted"><MessageSquareText className="h-4 w-4" />Отзыв пользователя</h3><PublishedShopLink className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:underline dark:text-primary" shopId={review.coffeeShopId}>Открыть кофейню<ArrowUpRight className="h-4 w-4" /></PublishedShopLink></div>
              <div className="mb-4 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-lg font-bold dark:bg-white/10">{(review.userName || '?').charAt(0).toUpperCase()}</span><div><p className="font-semibold">{review.userName || 'Пользователь'}</p><p className="flex items-center gap-1 text-sm text-text-muted"><Star className="h-3.5 w-3.5 fill-primary text-primary" />{((review.ratingCoffee + review.ratingService + review.ratingPlace) / 3).toFixed(1)}<span>· Средняя оценка</span></p></div></div>
              <h4 className="mb-2 break-words text-lg font-bold">{review.header || 'Отзыв без заголовка'}</h4><p className="whitespace-pre-wrap break-words leading-relaxed text-stone-600 dark:text-stone-300">{review.comment || 'Без комментария'}</p>
              <div className="mt-5 grid grid-cols-3 gap-2">{[['Кофе', review.ratingCoffee], ['Сервис', review.ratingService], ['Аура', review.ratingPlace]].map(([label, rating]) => <div key={label} className="rounded-xl bg-stone-50 px-3 py-2.5 text-center dark:bg-white/5"><p className="text-xs text-text-muted">{label}</p><p className="mt-1 font-semibold">{rating}<span className="text-xs font-normal text-text-muted"> / 5</span></p></div>)}</div>
              {(review.isSoftDelete || review.isRemovedByAdmin) && <p className="mt-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400"><Trash2 className="h-4 w-4" />{review.isRemovedByAdmin ? 'Отзыв уже удалён администратором' : 'Отзыв уже удалён'}</p>}
            </section>
            {report.status !== 0 && <div className="flex items-start gap-3 rounded-xl bg-stone-50 p-4 dark:bg-white/5"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><p className="font-semibold">{report.status === 2 ? 'Жалоба принята. Отзыв удалён.' : 'Жалоба отклонена. Отзыв сохранён.'}</p><p className="mt-1 text-sm text-text-muted">Решение принято {date(report.resolvedAtUtc)}</p></div></div>}
            <details className="text-xs text-text-muted"><summary className="min-h-8 cursor-pointer">Технические сведения</summary><dl className="mt-2 grid gap-2 break-all"><div><dt>Жалоба</dt><dd>{report.id}</dd></div><div><dt>Отзыв</dt><dd>{report.reviewId}</dd></div><div><dt>Заявитель</dt><dd>{report.reportedByUserId}</dd></div><div><dt>Автор отзыва</dt><dd>{review.userId}</dd></div>{report.resolvedByAdminId && <div><dt>Администратор</dt><dd>{report.resolvedByAdminId}</dd></div>}</dl></details>
          </div>
          <div className="shrink-0 border-t border-border-light bg-stone-50 px-6 py-4 dark:border-border-dark dark:bg-white/5">
            {report.status === 0 ? decision === null ? <div className="space-y-3"><p className="text-xs text-text-muted">Принять жалобу — удалить отзыв. Отклонить — оставить отзыв опубликованным.</p><div className="flex flex-col gap-2 sm:flex-row"><Button variant="danger" className="min-h-11 flex-1" onClick={() => setDecision(true)} disabled={resolution.isPending || detail.isFetching}><Trash2 className="h-4 w-4" />Принять и удалить отзыв</Button><Button variant="secondary" className="min-h-11 flex-1" onClick={() => setDecision(false)} disabled={resolution.isPending || detail.isFetching}><X className="h-4 w-4" />Отклонить жалобу</Button></div></div> : <div className="space-y-3"><p className="font-semibold">{decision ? 'Подтвердить удаление отзыва?' : 'Отклонить жалобу?'}</p><p className="text-sm text-text-muted">{decision ? 'Отзыв будет скрыт. Остальные жалобы на него останутся в очереди.' : 'Отзыв останется опубликованным. Изменить решение после сохранения нельзя.'}</p><div className="flex flex-col gap-2 sm:flex-row"><Button variant={decision ? 'danger' : 'primary'} className="min-h-11 flex-1" disabled={resolution.isPending || detail.isFetching} onClick={() => { if (!resolution.isPending) resolution.mutate({ id: report.id, deleteReview: decision }); }}>{resolution.isPending ? 'Сохранение…' : decision ? 'Да, удалить отзыв' : 'Да, отклонить жалобу'}</Button><Button variant="secondary" className="min-h-11" disabled={resolution.isPending} onClick={() => setDecision(null)}>Назад</Button></div></div> : <Button variant="secondary" className="min-h-11 w-full sm:w-auto" onClick={() => setSelected(null)}>Закрыть</Button>}
          </div>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}