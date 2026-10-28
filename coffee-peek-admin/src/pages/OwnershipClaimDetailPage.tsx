import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getOwnershipClaim, reviewOwnershipClaim, ownershipKeys, businessLabels, businessEditPath, claimStatusLabels, decisionSchema, ownershipError } from '../api/businessOwnership';
import { OwnershipHistory } from '../components/ownership/OwnershipHistory';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge, statusToBadgeVariant } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Textarea } from '../components/ui/Textarea';
import { LoadError } from '../components/ui/LoadError';
import { useToast } from '../contexts/ToastContext';
import { useUser } from '../contexts/UserContext';

export function OwnershipClaimDetailPage() {
  const { id = '' } = useParams();
  return <ClaimDetail key={id} id={id} />;
}
function ClaimDetail({ id }: { id: string }) {
  const { isAdmin } = useUser();
  const { search } = useLocation();
  const client = useQueryClient();
  const { showToast } = useToast();
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [actionError, setActionError] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const form = useForm({ resolver: zodResolver(decisionSchema), defaultValues: { reason: '' } });
  const query = useQuery({ queryKey: ownershipKeys.claim(id), queryFn: ({ signal }) => getOwnershipClaim(id, signal), enabled: isAdmin && !!id, retry: false });
  const claim = query.data;
  const mutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') => reviewOwnershipClaim(id, action, form.getValues('reason')),
    retry: false,
    onSuccess: async updated => {
      client.setQueryData(ownershipKeys.claim(id), updated);
      setDecision(null);
      setActionError('');
      form.reset();
      showToast(updated.status === 'Approved' ? 'Заявка одобрена' : 'Заявка отклонена', 'success');
      await Promise.all([
        client.invalidateQueries({ queryKey: ownershipKeys.all }),
        client.invalidateQueries({ queryKey: ['admin', updated.businessType === 'CoffeeShop' ? 'published-shop' : 'roaster', updated.businessId] }),
      ]);
    },
    onError: async error => {
      setActionError(ownershipError(error));
      await Promise.all([
        client.invalidateQueries({ queryKey: ownershipKeys.all }),
        ...(claim ? [client.invalidateQueries({ queryKey: ['admin', claim.businessType === 'CoffeeShop' ? 'published-shop' : 'roaster', claim.businessId] })] : []),
      ]);
    },
  });
  const openDecision = async (action: 'approve' | 'reject') => {
    if (!await form.trigger()) return;
    if (action === 'reject' && !form.getValues('reason').trim()) {
      form.setError('reason', { message: 'Укажите причину отказа' }, { shouldFocus: true });
      return;
    }
    setActionError('');
    setDecision(action);
  };
  const canReview = !!claim && claim.status === 'Pending' && !query.isError && !query.isFetching;
  if (!isAdmin) return null;
  return <div className="space-y-5">
    <Button asChild variant="ghost"><Link to={`/ownership-claims${search}`}>← К заявкам</Link></Button>
    {query.isError && <LoadError message="Не удалось загрузить актуальную заявку. Решения недоступны до обновления." onRetry={() => void query.refetch()} retrying={query.isFetching} />}
    {query.isPending && <p role="status">Загрузка заявки…</p>}
    {claim && <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm text-text-muted">{businessLabels[claim.businessType]}</p><h1 className="font-display text-2xl font-bold break-words">{claim.businessNameSnapshot}</h1><p className="text-sm text-text-muted break-all">{claim.businessSlugSnapshot}</p></div>
        <Badge variant={statusToBadgeVariant(claim.status)}>{claimStatusLabels[claim.status]}</Badge>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="min-w-0 p-5 space-y-4"><h2 className="font-display text-lg font-semibold">Заявитель и подтверждение</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-text-muted">ID заявителя</dt><dd className="break-all">{claim.applicantUserId}</dd></div>
            <div><dt className="text-text-muted">Контакт</dt><dd className="whitespace-pre-wrap break-all">{claim.contact}</dd></div>
            <div><dt className="text-text-muted">Подтверждение полномочий</dt><dd className="whitespace-pre-wrap break-words">{claim.evidence}</dd></div>
            <div><dt className="text-text-muted">Дата подачи</dt><dd>{new Date(claim.createdAtUtc).toLocaleString('ru-RU')}</dd></div>
          </dl>
        </Card>
        <Card className="min-w-0 p-5 space-y-4"><h2 className="font-display text-lg font-semibold">Текущий доступ</h2>
          <p className="text-sm">{claim.hasCurrentAccess ? 'Заявитель сейчас управляет бизнесом.' : 'У заявителя сейчас нет доступа к бизнесу.'}</p>
          <p className="text-sm break-all">Текущий владелец: {claim.currentOwnerUserId ?? 'не назначен'}</p>
          <p className="text-xs text-text-muted">Статус одобренной заявки сохраняется после отзыва доступа.</p>
          <Button asChild variant="secondary"><Link to={businessEditPath(claim.businessType, claim.businessId)}>Управление бизнесом</Link></Button>
        </Card>
      </div>
      {claim.status !== 'Pending' && <Card className="p-5 space-y-2">
        <h2 className="font-display text-lg font-semibold">Решение администратора</h2>
        <p className="text-sm break-all">{claim.reviewedByUserId}</p>
        {claim.reviewedAtUtc && <p className="text-sm text-text-muted">{new Date(claim.reviewedAtUtc).toLocaleString('ru-RU')}</p>}
        <p className="whitespace-pre-wrap break-words text-sm">{claim.decisionReason || 'Комментарий не указан'}</p>
      </Card>}
      {claim.status === 'Pending' && <Card className="min-w-0 p-5 space-y-4">
        <h2 className="font-display text-lg font-semibold">Рассмотреть заявку</h2>
        {claim.currentOwnerUserId && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">У бизнеса уже есть владелец. Одобрение недоступно; сменить владельца можно в карточке бизнеса.</p>}
        <label className="grid gap-2 text-sm">Причина решения
          <Textarea {...form.register('reason')} maxLength={2000} rows={4} disabled={mutation.isPending} aria-invalid={!!form.formState.errors.reason} aria-describedby="decision-reason-help" />
        </label>
        <p id="decision-reason-help" className="text-xs text-text-muted">До 2000 символов. Причина обязательна при отказе и доступна заявителю.</p>
        {form.formState.errors.reason && <p role="alert" className="text-sm text-red-600">{form.formState.errors.reason.message}</p>}
        {actionError && !decision && <p role="alert" className="text-sm text-red-600">{actionError}</p>}
        <div className="flex flex-wrap gap-3">
          <Button variant="success" disabled={!canReview || mutation.isPending || !!claim.currentOwnerUserId} onClick={() => void openDecision('approve')}>Одобрить</Button>
          <Button variant="danger" disabled={!canReview || mutation.isPending} onClick={() => void openDecision('reject')}>Отклонить</Button>
        </div>
      </Card>}
      <Card className="min-w-0 p-5 space-y-4"><h2 className="font-display text-lg font-semibold">История доступа к бизнесу</h2>
        <OwnershipHistory filters={{ businessType: claim.businessType, businessId: claim.businessId, page: historyPage, pageSize: 20 }} onPageChange={setHistoryPage} />
      </Card>
    </>}
    <ConfirmDialog isOpen={!!decision} title={decision === 'approve' ? 'Одобрить заявку?' : 'Отклонить заявку?'}
      message={decision === 'approve' ? `Заявитель получит доступ к профилю «${claim?.businessNameSnapshot}». Его правки будут публиковаться сразу.` : 'Заявитель увидит причину отказа. Решение будет сохранено в истории.'}
      error={actionError} confirmLabel={decision === 'approve' ? 'Одобрить заявку' : 'Отклонить заявку'} variant={decision === 'approve' ? 'success' : 'danger'}
      onCancel={() => setDecision(null)} onConfirm={async () => {
        if (!decision || !canReview || mutation.isPending || decision === 'approve' && claim?.currentOwnerUserId) return;
        await mutation.mutateAsync(decision).catch(() => undefined);
      }} />
  </div>;
}
