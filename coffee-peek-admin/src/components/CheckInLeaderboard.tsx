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

  return <section aria-label="Рейтинг активности" className="min-w-0 border-t border-border-light bg-stone-50/70 text-sm dark:border-border-dark dark:bg-white/[0.02]">
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-4 py-3 outline-none hover:bg-stone-100/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary dark:hover:bg-white/5 sm:px-5 [&::-webkit-details-marker]:hidden">
        <Trophy className="h-4 w-4 shrink-0 text-text-muted dark:text-stone-400" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">Рейтинг активности</span>
          <span className="text-xs text-text-muted dark:text-stone-400">{isHome ? 'Не участвует' : checkIn.leaderboardOverride == null ? 'Автопроверка' : checkIn.leaderboardOverride ? 'Включён вручную' : 'Исключён вручную'}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-4 px-4 pb-4 pt-1 sm:px-5">
        <p className="text-sm text-text-muted dark:text-stone-400">{isHome ? 'Домашние чекины не участвуют в рейтинге' : `Геопроверка: ${GEO_LABELS[checkIn.leaderboardGeoStatus ?? ''] ?? checkIn.leaderboardGeoStatus ?? 'Нет данных'}`}</p>
        {!isHome && <dl className="grid gap-2 text-text-muted dark:text-stone-400 sm:grid-cols-3">
          <div><dt>Расстояние до кофейни</dt><dd className="mt-0.5 font-medium text-text-main dark:text-stone-200">{checkIn.shopDistanceMeters == null ? '—' : `${checkIn.shopDistanceMeters.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} м`}</dd></div>
          <div><dt>Точность</dt><dd className="mt-0.5 font-medium text-text-main dark:text-stone-200">{checkIn.locationAccuracyMeters == null ? '—' : `${checkIn.locationAccuracyMeters.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} м`}</dd></div>
          <div><dt>Местоположение определено</dt><dd className="mt-0.5 font-medium text-text-main dark:text-stone-200">{checkIn.locationCapturedAtUtc ? new Date(checkIn.locationCapturedAtUtc).toLocaleString('ru-RU') : '—'}</dd></div>
        </dl>}
        <p className="text-xs text-text-muted dark:text-stone-400">Ручное решение: {checkIn.leaderboardOverride == null ? 'Нет' : checkIn.leaderboardOverride ? 'Засчитывать' : 'Не засчитывать'}</p>
        {checkIn.leaderboardReason && <div className="rounded-lg border border-border-light bg-white p-3 dark:border-border-dark dark:bg-surface-dark"><p className="mb-1 text-xs font-medium text-text-muted dark:text-stone-400">Причина решения</p><p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{checkIn.leaderboardReason}</p></div>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-text-muted dark:text-stone-400">Одобренный публичный чекин может принести баллы автору. Редактирование сбрасывает ручное решение.</p>
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
          <DialogTitle>{decision ? 'Засчитать чекин в рейтинге?' : 'Исключить чекин из рейтинга?'}</DialogTitle>
          <DialogDescription>Решение влияет на баллы автора в рейтинге активности. Укажите причину от 1 до 1000 символов.</DialogDescription>
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
