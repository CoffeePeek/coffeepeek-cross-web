import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assignBusinessOwner, assignmentSchema, ownershipError, ownershipKeys, type BusinessType } from '../../api/businessOwnership';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function BusinessOwnerPanel({ businessType, businessId, currentOwnerUserId }: {
  businessType: BusinessType; businessId: string; currentOwnerUserId?: string | null;
}) {
  const { isAdmin } = useUser();
  const client = useQueryClient();
  const { showToast } = useToast();
  const [pending, setPending] = useState<{ ownerUserId: string | null; reason: string } | null>(null);
  const [error, setError] = useState('');
  const form = useForm({ resolver: zodResolver(assignmentSchema), defaultValues: { ownerUserId: '', reason: '' } });
  const mutation = useMutation({
    mutationFn: (value: NonNullable<typeof pending>) => assignBusinessOwner(businessType, businessId, value.ownerUserId, value.reason),
    retry: false,
    onSuccess: async () => {
      showToast(pending?.ownerUserId ? 'Владелец назначен' : 'Доступ владельца отозван', 'success');
      setPending(null);
      setError('');
      form.reset();
      await Promise.all([
        client.invalidateQueries({ queryKey: ownershipKeys.all }),
        client.invalidateQueries({ queryKey: ['admin', businessType === 'CoffeeShop' ? 'published-shop' : 'roaster', businessId] }),
      ]);
    },
    onError: async error => {
      setError(ownershipError(error));
      await Promise.all([
        client.invalidateQueries({ queryKey: ownershipKeys.all }),
        client.invalidateQueries({ queryKey: ['admin', businessType === 'CoffeeShop' ? 'published-shop' : 'roaster', businessId] }),
      ]);
    },
  });
  const prepare = (revoke: boolean) => {
    if (revoke) form.setValue('ownerUserId', '');
    return form.handleSubmit(values => {
      if (!revoke && !values.ownerUserId) {
        form.setError('ownerUserId', { message: 'Введите UUID пользователя' }, { shouldFocus: true });
        return;
      }
      setError('');
      setPending({ ownerUserId: revoke ? null : values.ownerUserId, reason: values.reason });
    })();
  };
  if (!isAdmin) return null;
  return <Card className="p-5 space-y-4">
    <h2 className="font-display text-lg font-semibold">Владелец бизнеса</h2>
    {currentOwnerUserId !== undefined && <p className="text-sm break-all">Текущий владелец: {currentOwnerUserId ?? 'не назначен'}</p>}
    <p className="text-sm text-text-muted dark:text-stone-400">Назначьте пользователя или отзовите доступ, в том числе после удаления его аккаунта. Глобальная роль Owner не требуется.</p>
    <label className="grid gap-1 text-sm">ID нового владельца
      <Input {...form.register('ownerUserId')} placeholder="UUID пользователя" disabled={mutation.isPending} aria-invalid={!!form.formState.errors.ownerUserId} />
    </label>
    {form.formState.errors.ownerUserId && <p role="alert" className="text-sm text-red-600">{form.formState.errors.ownerUserId.message}</p>}
    <label className="grid gap-1 text-sm">Причина изменения доступа
      <Textarea {...form.register('reason')} maxLength={2000} disabled={mutation.isPending} aria-invalid={!!form.formState.errors.reason} />
    </label>
    <p className="text-xs text-text-muted">Обязательна для записи в аудит, до 2000 символов.</p>
    {form.formState.errors.reason && <p role="alert" className="text-sm text-red-600">{form.formState.errors.reason.message}</p>}
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={mutation.isPending} onClick={() => void prepare(false)}>Назначить владельца</Button>
      <Button variant="danger" disabled={mutation.isPending || currentOwnerUserId === null} onClick={() => void prepare(true)}>Отозвать доступ</Button>
      <Button asChild variant="ghost"><Link to={`/ownership-changes?businessType=${businessType}&businessId=${encodeURIComponent(businessId)}`}>История доступа</Link></Button>
    </div>
    <ConfirmDialog isOpen={!!pending} title={pending?.ownerUserId ? 'Назначить владельца?' : 'Отозвать доступ?'}
      message={pending?.ownerUserId ? `Пользователь ${pending.ownerUserId} получит доступ к профилю бизнеса. Предыдущий владелец потеряет доступ.` : 'Текущий владелец потеряет доступ со следующего запроса. История заявок сохранится.'}
      error={error} confirmLabel={pending?.ownerUserId ? 'Назначить' : 'Отозвать'} variant={pending?.ownerUserId ? 'primary' : 'danger'}
      onCancel={() => setPending(null)} onConfirm={async () => {
        if (pending && !mutation.isPending) await mutation.mutateAsync(pending).catch(() => undefined);
      }} />
  </Card>;
}
