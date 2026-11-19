import { CalendarDays, Coffee, House, Star, Trash2, UserRound } from 'lucide-react';
import type { CurrentModerationCheckIn, ModerationCheckIn } from '../api/admin';
import { checkInDate, checkInKind, homeRecipe } from '../utils/checkInKind';
import { CheckInLeaderboard } from './CheckInLeaderboard';
import ModerationPhotos from './ModerationPhotos';
import { PublishedShopLink } from './PublishedShopLink';
import { Badge, statusLabels, statusToBadgeVariant } from './ui/Badge';
import { Button } from './ui/Button';

function displayDrinkName(checkIn: ModerationCheckIn): string {
  if (checkIn.drinkSlug === 'other' && checkIn.customDrinkName) return checkIn.customDrinkName;
  const isEnglish = typeof document !== 'undefined' && document.documentElement.lang.toLowerCase().startsWith('en');
  return (isEnglish ? checkIn.drinkNameEn || checkIn.drinkNameRu : checkIn.drinkNameRu || checkIn.drinkNameEn)
    || checkIn.customDrinkName
    || (isEnglish ? 'Not specified' : 'Не указан');
}

function displayRecipe(checkIn: ModerationCheckIn): string {
  const recipe = homeRecipe(checkIn);
  return [recipe.beanName, recipe.brewMethodCode,
    recipe.doseGrams != null ? `${recipe.doseGrams} г` : '',
    recipe.brewDurationSeconds != null ? `${recipe.brewDurationSeconds} с` : ''].filter(Boolean).join(' · ');
}

export function CheckInModerationCard({ checkIn, onApprove, onReject, onRemove }: {
  checkIn: CurrentModerationCheckIn;
  onApprove: () => void;
  onReject: () => void;
  onRemove: () => void;
}) {
  const kind = checkInKind(checkIn);
  const KindIcon = kind === 'Home' ? House : Coffee;
  const deleted = checkIn.currentState === 'Deleted';
  const canReview = checkIn.currentState === 'Pending' && checkIn.hasCurrentSubmission && checkIn.moderationStatus === 'Pending';
  const status = checkIn.currentState === 'Published' ? 'Approved' : checkIn.currentState === 'Rejected' ? 'Rejected' : 'Pending';
  const ratings = kind === 'Home' ? [{ label: 'Вкус', value: homeRecipe(checkIn).tasteScore }]
    : kind === 'Shop' ? [
      { label: 'Кофе', value: checkIn.rating?.coffee },
      { label: 'Сервис', value: checkIn.rating?.service },
      { label: 'Место', value: checkIn.rating?.place },
    ] : [];
  const hasRating = ratings.some(rating => rating.value != null);
  const recipe = kind === 'Home' ? displayRecipe(checkIn) : '';
  const removalAction = <Button variant="ghost" size="sm" className="min-h-11 text-red-700 hover:bg-red-50 hover:text-red-800 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200 sm:min-h-10" onClick={onRemove}>
    <Trash2 className="h-4 w-4" aria-hidden="true" /> Удалить
  </Button>;

  return (
    <article aria-label={`Чекин: ${checkIn.userName || 'Неизвестный автор'}`} className="min-w-0 overflow-hidden rounded-2xl border border-border-light bg-white text-text-main shadow-sm dark:border-border-dark dark:bg-surface-dark dark:text-white">
      <header className="flex flex-col gap-3 px-4 pb-3 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600 dark:bg-white/5 dark:text-stone-300">
            <KindIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-2 [overflow-wrap:anywhere]">
            <h3 className="text-base font-semibold leading-6">
              {kind === 'Home' ? 'Кофе дома' : checkIn.shopId ? (
                <PublishedShopLink shopId={checkIn.shopId} className="block hover:text-amber-700 dark:hover:text-primary" />
              ) : kind === 'Shop' ? 'Кофейня недоступна' : 'Тип не указан'}
            </h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-text-muted dark:text-stone-400">
              <span className="flex min-w-0 items-center gap-1.5"><UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{checkIn.userName || 'Неизвестный автор'}</span>
              <span className="flex items-center gap-1.5 tabular-nums"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{checkInDate(checkIn)}</span>
              <span>Ревизия {checkIn.contentRevision}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:flex-col sm:items-end">
          <Badge className="shrink-0" variant={deleted ? 'default' : statusToBadgeVariant(status)}>{deleted ? 'Удалён' : status === 'Approved' ? 'Опубликован' : statusLabels[status]}</Badge>
          {!deleted && !canReview && removalAction}
        </div>
      </header>

      <div className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="flex min-w-0 flex-col items-start justify-between gap-4 md:flex-row md:gap-6">
          <div className="min-w-0 flex-1 space-y-3 [overflow-wrap:anywhere]">
            <p className={`whitespace-pre-wrap text-[15px] leading-relaxed ${checkIn.text?.trim() ? '' : 'text-text-muted dark:text-stone-400'}`}>{checkIn.text?.trim() ? checkIn.text : 'Без заметки'}</p>
            <div className="space-y-1 text-sm text-text-muted dark:text-stone-400">
              <p><span className="font-medium">Напиток</span> · {displayDrinkName(checkIn)}</p>
              {recipe && <p>{recipe}</p>}
            </div>
            <section aria-label="Оценки автора" className="w-fit max-w-full rounded-xl bg-stone-50 px-3 py-2.5 dark:bg-white/5">
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted dark:text-stone-400"><Star className="h-3.5 w-3.5 text-amber-600 dark:text-primary" aria-hidden="true" />Оценки автора</h4>
              {hasRating ? <dl className="flex flex-wrap gap-x-6 gap-y-2">
                {ratings.map(rating => <div key={rating.label} className="flex items-baseline gap-2">
                  <dt className="text-xs text-text-muted dark:text-stone-400">{rating.label}</dt>
                  <dd className="text-base font-semibold tabular-nums">{rating.value == null ? '—' : <>{rating.value}<span className="ml-0.5 text-xs font-normal text-text-muted dark:text-stone-400">/5</span></>}</dd>
                </div>)}
              </dl> : <p className="text-sm text-text-muted dark:text-stone-400">Без оценки</p>}
            </section>
          </div>
          {!!checkIn.photos?.length && <div aria-label="Фотографии чекина" className="max-w-full shrink-0 md:max-w-72"><ModerationPhotos photos={checkIn.photos} /></div>}
        </div>

        {deleted ? (
          <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm dark:border-border-dark dark:bg-white/5">
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]"><span className="font-semibold">Причина удаления</span> · {checkIn.deletionReason || 'Не указана'}</p>
            {checkIn.deletedAtUtc && <p className="text-xs text-text-muted dark:text-stone-400">Дата удаления · <time dateTime={checkIn.deletedAtUtc}>{new Date(checkIn.deletedAtUtc).toLocaleString('ru-RU')}</time></p>}
            {checkIn.deletedByModeratorId && <details className="text-xs text-text-muted dark:text-stone-400"><summary className="w-fit cursor-pointer rounded py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Кто удалил</summary><p className="mt-1 [overflow-wrap:anywhere]">ID модератора · {checkIn.deletedByModeratorId}</p></details>}
          </div>
        ) : checkIn.rejectedReason && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm dark:border-red-500/20 dark:bg-red-500/10"><p className="mb-1 font-semibold text-red-800 dark:text-red-300">Причина отклонения</p><p className="whitespace-pre-wrap text-red-800 [overflow-wrap:anywhere] dark:text-red-200">{checkIn.rejectedReason}</p></div>}
      </div>

      {canReview && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-light px-4 py-3 dark:border-border-dark sm:px-5">
        <div className="mr-auto flex flex-wrap gap-2">
          <Button variant="success" size="sm" className="min-h-11 px-4 sm:min-h-10" onClick={onApprove}>Одобрить</Button>
          <Button variant="secondary" size="sm" className="min-h-11 px-4 sm:min-h-10" onClick={onReject}>Отклонить</Button>
        </div>
        {removalAction}
      </div>}
      {!deleted && checkIn.hasCurrentSubmission && <CheckInLeaderboard checkIn={checkIn} />}
    </article>
  );
}
