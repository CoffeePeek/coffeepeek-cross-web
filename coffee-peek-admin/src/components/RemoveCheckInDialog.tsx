import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { removeCheckIn, type ModerationCheckIn } from '../api/admin';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errors';
import { Button } from './ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/Dialog';
import { Textarea } from './ui/Textarea';

const reasonSchema = z.object({ reason: z.string().trim().min(1, 'Укажите причину удаления').max(1000, 'Не более 1000 символов') });

export function RemoveCheckInDialog({ checkIn, onClose }: { checkIn: ModerationCheckIn; onClose: () => void }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof reasonSchema>>({
    resolver: zodResolver(reasonSchema),
    defaultValues: { reason: '' },
  });
  const removal = useMutation({
    mutationFn: ({ reason }: z.infer<typeof reasonSchema>) => removeCheckIn(checkIn.checkInId, checkIn.contentRevision, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'moderation', 'checkIns'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'check-in-reports'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'leaderboard'] });
      showToast('Чекин удалён', 'success');
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !removal.isPending) onClose(); }}>
      <DialogContent onEscapeKeyDown={(event) => { if (removal.isPending) event.preventDefault(); }} onPointerDownOutside={(event) => { if (removal.isPending) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Удалить чекин?</DialogTitle>
          <DialogDescription>Чекин исчезнет из публичной ленты и появится во вкладке «Удалённые».</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit((values) => removal.mutate(values))}>
          <label className="block space-y-1 text-sm">
            <span>Причина удаления</span>
            <Textarea rows={4} maxLength={1000} disabled={removal.isPending} aria-required="true" aria-invalid={Boolean(errors.reason)} {...register('reason')} />
          </label>
          {errors.reason && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{errors.reason.message}</p>}
          {removal.isError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{getErrorMessage(removal.error, 'Не удалось удалить чекин')}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={removal.isPending} onClick={onClose}>Отмена</Button>
            <Button type="submit" variant="danger" loading={removal.isPending}>Удалить</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
