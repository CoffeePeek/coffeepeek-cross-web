import { CalendarDays, Coffee, House, UserRound } from 'lucide-react';
import type { ModerationCheckIn } from '../api/admin';
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

function displayRating(checkIn: ModerationCheckIn): string {
  const kind = checkInKind(checkIn);
  if (kind === 'Home') {
    const score = homeRecipe(checkIn).tasteScore;
    return score == null ? 'Без оценки' : `Вкус ${score}/5`;
  }
  if (kind !== 'Shop') return 'Без оценки';
  const rating = checkIn.rating;
  if (rating?.coffee == null || rating.service == null || rating.place == null) return 'Без оценки';
  return `Кофе ${rating.coffee} · Сервис ${rating.service} · Место ${rating.place}`;
}

function displayRecipe(checkIn: ModerationCheckIn): string {
  const recipe = homeRecipe(checkIn);
  return [recipe.beanName, recipe.brewMethodCode,
    recipe.doseGrams != null ? `${recipe.doseGrams} г` : '',
    recipe.brewDurationSeconds != null ? `${recipe.brewDurationSeconds} с` : ''].filter(Boolean).join(' · ') || 'Без деталей рецепта';
}

export function CheckInModerationCard({ checkIn, onApprove, onReject }: {
  checkIn: ModerationCheckIn;
  onApprove: () => void;
  onReject: () => void;
}) {
  const kind = checkInKind(checkIn);
  const KindIcon = kind === 'Home' ? House : Coffee;

  return (
    <article aria-label={`Чекин: ${checkIn.userName || 'Неизвестный автор'}`} className="min-w-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(180px,0.7fr)] xl:gap-x-5">
        <header className="min-w-0 space-y-2 xl:row-span-2">
          <div className="flex min-w-0 items-start gap-2">
            <KindIcon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted dark:text-stone-400" aria-hidden="true" />
            <div className="min-w-0 text-sm [overflow-wrap:anywhere]">
              {kind === 'Home' ? <h3 className="font-semibold">Кофе дома</h3> : checkIn.shopId ? (
                <PublishedShopLink shopId={checkIn.shopId} className="font-semibold text-blue-600 hover:underline dark:text-blue-400" />
              ) : <h3 className="font-semibold">{kind === 'Shop' ? 'Кофейня недоступна' : 'Тип не указан'}</h3>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted dark:text-stone-400">
            <span className="flex min-w-0 items-center gap-1.5 [overflow-wrap:anywhere]"><UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{checkIn.userName || 'Неизвестный автор'}</span>
            <span className="flex items-center gap-1.5 tabular-nums"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{checkInDate(checkIn)}</span>
          </div>
        </header>

        <div className="col-span-2 row-start-2 flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between xl:col-span-1 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
            <p className="whitespace-pre-wrap text-sm text-text-main dark:text-white">{checkIn.text || 'Без заметки'}</p>
            {kind === 'Home' && <p className="text-xs text-text-muted dark:text-stone-400">{displayRecipe(checkIn)}</p>}
            <p className="text-xs text-text-muted dark:text-stone-400">Напиток: {displayDrinkName(checkIn)} · Ревизия {checkIn.contentRevision}</p>
            {checkIn.rejectedReason && <p className="whitespace-pre-wrap text-xs text-red-700 dark:text-red-300">Причина отклонения: {checkIn.rejectedReason}</p>}
          </div>
          <ModerationPhotos photos={checkIn.photos || []} compact />
        </div>

        <div className="col-start-2 row-start-1 max-w-32 space-y-1.5 text-right xl:col-start-3 xl:max-w-none xl:text-left">
          <Badge variant={statusToBadgeVariant(checkIn.moderationStatus)}>{statusLabels[checkIn.moderationStatus]}</Badge>
          <p className="text-xs text-text-muted dark:text-stone-400">{displayRating(checkIn)}</p>
        </div>
        {checkIn.moderationStatus === 'Pending' && (
          <div className="col-span-2 flex flex-wrap gap-1.5 xl:col-span-1 xl:col-start-3 xl:row-start-2">
            <Button variant="success" size="sm" className="min-h-11 sm:min-h-8" onClick={onApprove}>Одобрить</Button>
            <Button variant="danger" size="sm" className="min-h-11 sm:min-h-8" onClick={onReject}>Отклонить</Button>
          </div>
        )}
      </div>
      <CheckInLeaderboard checkIn={checkIn} />
    </article>
  );
}
