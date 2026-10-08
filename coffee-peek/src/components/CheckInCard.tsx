import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CheckInDto } from '../api/coffeeshop';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useCheckInHelpful, useCheckInVisibility, useDeleteCheckIn } from '../hooks/queries/useCheckIns';
import { getThemeClasses } from '../utils/theme';
import { formatCheckInDate } from '../utils/checkInForm';
import { displayDrinkName } from '../utils/consumedDrinks';
import { getErrorMessage } from '../utils/errorHandler';
import { StarIcon } from './icons';
import CheckInPhotos from './CheckInPhotos';
import CheckInStatus from './CheckInStatus';
import ReportCheckInButton from './ReportCheckInButton';

export default function CheckInCard({ item, own = false, showShop = true }: { item: CheckInDto; own?: boolean; showShop?: boolean }) {
  const { user } = useUser();
  const { theme } = useTheme();
  const classes = getThemeClasses(theme);
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const helpful = useCheckInHelpful();
  const visibility = useCheckInVisibility();
  const deletion = useDeleteCheckIn();
  const isOwn = own || (!!user?.address?.slug && item.author?.slug === user.address.slug);
  const average = (item.rating.coffee + item.rating.service + item.rating.place) / 3;
  const long = item.text.length > 220;
  const published = item.visibility === 'Public' && item.moderationState === 'Approved';
  const actionError = helpful.error || visibility.error || deletion.error;

  return <article className={`rounded-[28px] border p-4 sm:p-5 ${classes.bg.card} ${classes.border.default} ${classes.text.primary}`}>
    <div className="mb-4 flex items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-xl font-bold ${classes.primary.borderLight}`}>{(item.username || '?').charAt(0).toUpperCase()}</span>
        <div className="min-w-0">
          {item.author ? <Link to={item.author.canonicalPath} className="block truncate font-bold hover:underline">{item.username}</Link> : <p className="font-bold">{item.username || 'Пользователь'}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="flex items-center gap-1 font-bold"><StarIcon filled size={18} className={classes.primary.text} />{average.toFixed(1)}</span><span className={`text-xs ${classes.text.secondary}`}>{formatCheckInDate(item)}</span></div>
        </div>
      </div>
      {!isOwn && published && <ReportCheckInButton checkInId={item.id} />}
    </div>
    {showShop && (item.shop ? <Link to={item.shop.canonicalPath} className="mb-2 block text-lg font-bold hover:underline">{item.shopName}</Link> : <p className="mb-2 font-bold">{item.shopName || 'Кофейня'}</p>)}
    {isOwn && <CheckInStatus item={item} />}
    <p className={`my-2 text-sm ${classes.text.secondary}`}>Кофе {item.rating.coffee} · Сервис {item.rating.service} · Атмосфера {item.rating.place}</p>
    <p className="my-2 text-sm">Напиток: {displayDrinkName(item)}</p>
    <p className={`whitespace-pre-line leading-relaxed ${classes.text.secondary} ${long && !expanded ? 'line-clamp-4' : ''}`}>{item.text}</p>
    {long && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className={`mt-2 min-h-11 font-semibold ${classes.primary.text}`}>{expanded ? 'Свернуть' : 'Читать полностью'}</button>}
    <CheckInPhotos photos={item.photos} shopName={item.shopName} />
    {isOwn ? <div className="mt-4 flex flex-wrap gap-3 text-sm">
      <Link to={`/check-ins/${encodeURIComponent(item.id)}/edit`} className={`flex min-h-11 items-center font-bold ${classes.primary.text}`}>Изменить</Link>
      <button type="button" disabled={visibility.isPending} className="min-h-11 disabled:opacity-50" onClick={() => visibility.mutate({ id: item.id, visibility: item.visibility === 'Public' ? 'Private' : 'Public' }, { onSuccess: () => showToast(item.visibility === 'Public' ? 'Чекин стал личным' : 'Чекин отправлен на модерацию', 'success') })}>{item.visibility === 'Public' ? 'Сделать личным' : 'Сделать публичным'}</button>
      <button type="button" disabled={deletion.isPending} className="min-h-11 text-red-500 disabled:opacity-50" onClick={() => { if (window.confirm('Удалить этот чекин?')) deletion.mutate(item.id); }}>Удалить</button>
    </div> : published && <button type="button" aria-pressed={item.isHelpfulByCurrentUser} disabled={!user || helpful.isPending} className={`mt-3 min-h-11 text-sm font-semibold disabled:opacity-50 ${item.isHelpfulByCurrentUser ? classes.primary.text : classes.text.secondary}`} onClick={() => helpful.mutate({ id: item.id, helpful: !item.isHelpfulByCurrentUser })}>Полезно · {item.helpfulCount}</button>}
    {actionError && <p role="alert" className="mt-2 text-sm text-red-500">{getErrorMessage(actionError)}</p>}
  </article>;
}
