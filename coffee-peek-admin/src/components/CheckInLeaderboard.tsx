import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, Trophy } from 'lucide-react';
import { setCheckInLeaderboardDecision, type ModerationCheckIn } from '../api/admin';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { checkInKind } from '../utils/checkInKind';
import { getErrorMessage } from '../utils/errors';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/Dialog';

const GEO_LABELS: Record<string, string> = {
  WithinRange: 'Подходит: в пределах 50 м',
  OutsideRadius: 'Дальше 50 м от кофейни',
  MissingLocation: 'Нет геолокации',
  InvalidLocation: 'Некорректные данные геолокации',
  MissingShopLocation: 'Нет координат кофейни',
  InaccurateLocation: 'Недостаточная точность геолокации',
  StaleLocation: 'Несвоевременное определение местоположения',
};

const reasonSchema = z.object({ reason: z.string().trim().min(1, 'Укажите причину').max(1000, 'Не более 1000 символов') });

export function CheckInLeaderboard({ checkIn }: { checkIn: ModerationCheckIn }) {
  const { isAdmin } = useUser();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [decision, setDecision] = useState<boolean | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof reasonSchema>>({
    resolver: zodResolver(reasonSchema), defaultValues: { reason: '' },
  });
  const save = useMutation({
    mutationFn: ({ counted, reason }: { counted: boolean; reason: string }) => setCheckInLeaderboardDecision(checkIn, counted, reason),
    onSuccess: () => {
      showToast('Решение об участии в рейтинге сохранено', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'moderation', 'checkIns'] });
      qc.invalidateQueries({ queryKey: ['admin', 'audit', 'moderation'] });
      qc.invalidateQueries({ queryKey: ['admin', 'leaderboard'] });
      setDecision(null);
    },
  });
  const isHome = checkInKind(checkIn) === 'Home';
  const canInclude = !isHome && Boolean(checkIn.shopId) && checkIn.moderationStatus === 'Approved';
  const openDecision = (counted: boolean) => {
    reset({ reason: '' });
    save.reset();
    setDecision(counted);
  };

  return <section aria-label="Участие в рейтинге" className="min-w-0 border-t border-border-light text-xs dark:border-border-dark">
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded px-3 py-2 outline-none hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary dark:hover:bg-white/5 sm:px-4 [&::-webkit-details-marker]:hidden">
        <Trophy className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />
        <span className="shrink-0 font-medium">Рейтинг</span>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-text-muted [overflow-wrap:anywhere] dark:text-stone-400">
          <span>{isHome ? 'Домашние чекины не участвуют в рейтинге' : `Геопроверка: ${GEO_LABELS[checkIn.leaderboardGeoStatus ?? ''] ?? checkIn.leaderboardGeoStatus ?? 'Нет данных'}`}</span>
          {checkIn.leaderboardOverride != null && <span className="font-medium text-text-main dark:text-stone-200">Ручное решение: {checkIn.leaderboardOverride ? 'Засчитывать' : 'Не засчитывать'}</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-3 bg-stone-50 px-3 pb-3 pt-1 dark:bg-white/[0.03] sm:px-4">
        {!isHome && <dl className="grid gap-2 text-text-muted dark:text-stone-400 sm:grid-cols-3">
          <div><dt>Расстояние до кофейни</dt><dd className="mt-0.5 font-medium text-text-main dark:text-stone-200">{checkIn.shopDistanceMeters == null ? '—' : `${checkIn.shopDistanceMeters.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} м`}</dd></div>
          <div><dt>Точность</dt><dd className="mt-0.5 font-medium text-text-main dark:text-stone-200">{checkIn.locationAccuracyMeters == null ? '—' : `${checkIn.locationAccuracyMeters.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} м`}</dd></div>
          <div><dt>Местоположение определено</dt><dd className="mt-0.5 font-medium text-text-main dark:text-stone-200">{checkIn.locationCapturedAtUtc ? new Date(checkIn.locationCapturedAtUtc).toLocaleString('ru-RU') : '—'}</dd></div>
        </dl>}
        {checkIn.leaderboardOverride == null && <p>Ручное решение: Нет</p>}
        {checkIn.leaderboardReason && <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">Причина: {checkIn.leaderboardReason}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-text-muted dark:text-stone-400">Зачёт требует публичного одобренного чекина. После редактирования ручное решение сбрасывается.</p>
          {isAdmin && <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="success" className="min-h-11 sm:min-h-8" disabled={!canInclude} onClick={() => openDecision(true)}>Засчитать</Button>
            <Button size="sm" variant="danger" className="min-h-11 sm:min-h-8" onClick={() => openDecision(false)}>Не засчитывать</Button>
          </div>}
        </div>
        {isAdmin && !canInclude && !isHome && <p className="text-text-muted dark:text-stone-400">Для включения сначала одобрите чекин в кофейне.</p>}
      </div>
    </details>
    <Dialog open={isAdmin && decision !== null} onOpenChange={(open) => { if (!open && !save.isPending) setDecision(null); }}>
      <DialogContent onEscapeKeyDown={(event) => { if (save.isPending) event.preventDefault(); }} onPointerDownOutside={(event) => { if (save.isPending) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{decision ? 'Засчитать чекин?' : 'Не засчитывать чекин?'}</DialogTitle>
          <DialogDescription>Изменится только ручное решение об участии в рейтинге. Причина обязательна: от 1 до 1000 символов.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(({ reason }) => { if (isAdmin && decision !== null && (!decision || canInclude)) save.mutate({ counted: decision, reason }); })}>
          <label className="block space-y-1 text-sm">
            <span>Причина решения</span>
            <Textarea rows={4} maxLength={1000} disabled={save.isPending} aria-required="true" aria-invalid={Boolean(errors.reason)} {...register('reason')} />
          </label>
          {errors.reason && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{errors.reason.message}</p>}
          {save.isError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{getErrorMessage(save.error, 'Не удалось сохранить решение')}</p>}
          <DialogFooter>
            <Button variant="secondary" disabled={save.isPending} onClick={() => setDecision(null)}>Отмена</Button>
            <Button type="submit" variant={decision ? 'success' : 'danger'} loading={save.isPending}>{decision ? 'Засчитать' : 'Не засчитывать'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
