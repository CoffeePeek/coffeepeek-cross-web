import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

  return <section aria-label="Участие в рейтинге" className="mt-3 space-y-2 rounded-lg border border-border-light p-3 text-xs dark:border-border-dark">
    <h3 className="font-semibold">Участие в рейтинге</h3>
    <p>{isHome ? 'Домашние чекины не участвуют в рейтинге' : `Геопроверка: ${GEO_LABELS[checkIn.leaderboardGeoStatus ?? ''] ?? checkIn.leaderboardGeoStatus ?? 'Нет данных'}`}</p>
    <dl className="space-y-1 text-text-muted dark:text-stone-400">
      <div><dt className="inline">Расстояние до кофейни: </dt><dd className="inline">{checkIn.shopDistanceMeters == null ? '—' : `${checkIn.shopDistanceMeters.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} м`}</dd></div>
      <div><dt className="inline">Точность: </dt><dd className="inline">{checkIn.locationAccuracyMeters == null ? '—' : `${checkIn.locationAccuracyMeters.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} м`}</dd></div>
      <div><dt className="inline">Местоположение определено: </dt><dd className="inline">{checkIn.locationCapturedAtUtc ? new Date(checkIn.locationCapturedAtUtc).toLocaleString('ru-RU') : '—'}</dd></div>
    </dl>
    <p>Ручное решение: {checkIn.leaderboardOverride == null ? 'Нет' : checkIn.leaderboardOverride ? 'Засчитывать' : 'Не засчитывать'}</p>
    {checkIn.leaderboardReason && <p className="whitespace-pre-wrap break-words">Причина: {checkIn.leaderboardReason}</p>}
    <p className="text-text-muted dark:text-stone-400">Зачёт требует публичного одобренного чекина. После редактирования ручное решение сбрасывается.</p>
    {isAdmin && <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="success" disabled={!canInclude} onClick={() => openDecision(true)}>Засчитать</Button>
      <Button size="sm" variant="danger" onClick={() => openDecision(false)}>Не засчитывать</Button>
      {!canInclude && !isHome && <p className="w-full text-text-muted dark:text-stone-400">Для включения сначала одобрите чекин в кофейне.</p>}
    </div>}
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
