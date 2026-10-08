import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CaretRight, Heart } from '@phosphor-icons/react';
import type { CheckInDto } from '../api/coffeeshop';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useCheckInHelpful, useCheckInVisibility, useDeleteCheckIn } from '../hooks/queries/useCheckIns';
import { getThemeClasses } from '../utils/theme';
import { formatCheckInDate } from '../utils/checkInForm';
import { savedDrinkName } from '../utils/consumedDrinks';
import { getMockDrinkPhoto } from '../utils/drinkPhotos';
import { getErrorMessage } from '../utils/errorHandler';
import { StarIcon } from './icons';
import CheckInPhotos from './CheckInPhotos';
import CheckInStatus from './CheckInStatus';
import PhotoLightbox from './PhotoLightbox';
import ReportCheckInButton from './ReportCheckInButton';

export default function CheckInCard({ item, own = false, showShop = true }: { item: CheckInDto; own?: boolean; showShop?: boolean }) {
  const { user } = useUser();
  const { theme } = useTheme();
  const classes = getThemeClasses(theme);
  const { showToast } = useToast();
  const [now, setNow] = useState(() => new Date());
  const [drinkOpen, setDrinkOpen] = useState(false);
  const helpful = useCheckInHelpful();
  const visibility = useCheckInVisibility();
  const deletion = useDeleteCheckIn();
  const isOwn = own || (!!user?.address?.slug && item.author?.slug === user.address.slug);
  const average = (item.rating.coffee + item.rating.service + item.rating.place) / 3;
  const published = item.visibility === 'Public' && item.moderationState === 'Approved';
  const actionError = helpful.error || visibility.error || deletion.error;
  const username = item.username || 'Пользователь';
  const drinkName = savedDrinkName(item) || (item.drinkSlug ? 'Напиток' : '');
  const drinkPhoto = getMockDrinkPhoto(item);
  const avatar = isOwn ? user?.avatarUrl : undefined;
  const menuActionClass = 'flex min-h-11 w-full items-center rounded-xl px-3 text-left hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  return <article className={`min-w-0 rounded-[20px] border p-4 sm:p-5 ${classes.bg.card} ${classes.border.default} ${classes.text.primary}`}>
    <header className="mb-4 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-semibold ${classes.bg.tertiary} ${classes.text.secondary}`}>
          {username.charAt(0).toUpperCase()}
          {avatar && <img key={avatar} src={avatar} alt="" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = 'none'; }} />}
        </span>
        <div className="min-w-0">
          {item.author ? <Link to={item.author.canonicalPath} className="block truncate text-sm font-semibold hover:underline">{username}</Link> : <p className="truncate text-sm font-semibold">{username}</p>}
          <p className={`mt-0.5 text-xs sm:text-sm ${classes.text.secondary}`}>{formatCheckInDate(item, now)}</p>
        </div>
      </div>
      {(isOwn || published) && <ReportCheckInButton checkInId={item.id} actions={isOwn ? close => <>
        <Link to={`/check-ins/${encodeURIComponent(item.id)}/edit`} autoFocus onClick={close} className={menuActionClass}>Изменить</Link>
        <button type="button" disabled={visibility.isPending} className={menuActionClass} onClick={() => visibility.mutate({ id: item.id, visibility: item.visibility === 'Public' ? 'Private' : 'Public' }, { onSuccess: () => { close(); showToast(item.visibility === 'Public' ? 'Чекин стал личным' : 'Чекин отправлен на модерацию', 'success'); } })}>{item.visibility === 'Public' ? 'Сделать личным' : 'Сделать публичным'}</button>
        <button type="button" disabled={deletion.isPending} className={`${menuActionClass} text-red-500`} onClick={() => { if (window.confirm('Удалить этот чекин?')) deletion.mutate(item.id, { onSuccess: close }); }}>Удалить</button>
      </> : undefined} />}
    </header>
    {showShop && (item.shop ? <Link to={item.shop.canonicalPath} className="mb-2 block break-words text-xl font-bold leading-snug hover:underline">{item.shopName || 'Кофейня'}</Link> : <p className="mb-2 break-words text-xl font-bold leading-snug">{item.shopName || 'Кофейня'}</p>)}
    <div className="mb-3 flex items-center gap-2" role="img" aria-label={`Оценка ${average.toFixed(1)} из 5. Кофе ${item.rating.coffee}, сервис ${item.rating.service}, атмосфера ${item.rating.place}`}>
      <div aria-hidden="true" className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, index) => <span key={index} className="relative block h-5 w-5">
          <StarIcon size={20} className={theme === 'light' ? 'text-gray-300' : 'text-stone-500'} />
          <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${Math.max(0, Math.min(1, average - index)) * 100}%` }}><StarIcon filled size={20} className={`max-w-none ${classes.primary.text}`} /></span>
        </span>)}
      </div>
      <span aria-hidden="true" className="text-sm font-medium tabular-nums">{average.toFixed(1)}</span>
    </div>
    {isOwn && <div className="mb-3"><CheckInStatus item={item} /></div>}
    {drinkName && <button type="button" onClick={() => setDrinkOpen(true)} aria-label={`Посмотреть фото напитка: ${drinkName}`} className={`mb-4 flex min-h-14 w-full items-center gap-3 rounded-2xl p-1.5 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#EAB308] ${theme === 'light' ? classes.bg.secondary : classes.bg.tertiary}`}>
      <img src={drinkPhoto} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
      <span className="min-w-0 flex-1 break-words text-sm font-medium">{drinkName}</span>
      <CaretRight aria-hidden="true" size={18} className="mr-2 shrink-0" />
    </button>}
    <p className="whitespace-pre-line break-words text-base leading-[1.55]">{item.text}</p>
    <CheckInPhotos photos={item.photos} shopName={item.shopName} />
    {(published || isOwn) && <div className="mt-3">
      {!isOwn && user && published ? <button type="button" aria-label={item.isHelpfulByCurrentUser ? 'Убрать отметку «Нравится»' : 'Нравится'} aria-pressed={item.isHelpfulByCurrentUser} disabled={helpful.isPending} className={`-ml-2 inline-flex min-h-11 items-center gap-2 rounded-full px-2 pr-3 text-sm transition-colors hover:bg-red-500/10 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#EAB308] ${item.isHelpfulByCurrentUser ? 'bg-red-500/10' : ''}`} onClick={() => helpful.mutate({ id: item.id, helpful: !item.isHelpfulByCurrentUser })}>
        <Heart aria-hidden="true" size={26} weight="fill" className="text-red-500" /><span className="tabular-nums">{item.helpfulCount}</span>
      </button> : <span aria-label={`Отметок «Нравится»: ${item.helpfulCount}`} className="inline-flex min-h-11 items-center gap-2 text-sm"><Heart aria-hidden="true" size={26} weight="fill" className="text-red-500" /><span className="tabular-nums">{item.helpfulCount}</span></span>}
    </div>}
    {actionError && <p role="alert" className="mt-2 text-sm text-red-500">{getErrorMessage(actionError)}</p>}
    {drinkOpen && <PhotoLightbox images={[drinkPhoto]} shopName={drinkName} onClose={() => setDrinkOpen(false)} />}
  </article>;
}
