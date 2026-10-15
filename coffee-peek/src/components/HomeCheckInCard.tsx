import { useState } from 'react';
import { Heart } from '@phosphor-icons/react';
import { getBrewMethods, type CheckInDto } from '../api/coffeeshop';
import { deleteHomeCheckIn, getHomeCheckIn, privateHomeUpdate, updateHomeCheckIn, type HomeCheckIn } from '../api/homeCheckIns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { getThemeColors } from '../constants/colors';
import { useCheckInHelpful } from '../hooks/queries/useCheckIns';
import { formatCheckInDate } from '../utils/checkInForm';
import { savedDrinkName } from '../utils/consumedDrinks';
import { getErrorMessage } from '../utils/errorHandler';
import { brewMethodName } from '../utils/brewMethodName';
import CheckInPhotos from './CheckInPhotos';
import CheckInStatus from './CheckInStatus';
import ReportCheckInButton from './ReportCheckInButton';
import HomeCheckInSheet from './HomeCheckInSheet';
import CheckInDrinkPhoto from './CheckInDrinkPhoto';
import { captureAnalyticsEvent } from '../lib/analytics';
import { useFeatureExposure } from '../hooks/useFeatureExposure';

const recipe = (item: CheckInDto | HomeCheckIn) => item.home || item;
const durationLabel = (seconds?: number | null) => seconds ? `${seconds} с` : '';

export default function HomeCheckInCard({ item, own = false, feed = false, detailOnly = false, onDetailClose }: { item: CheckInDto | HomeCheckIn; own?: boolean; feed?: boolean; detailOnly?: boolean; onDetailClose?: () => void }) {
  const { user } = useUser();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { showToast } = useToast();
  const client = useQueryClient();
  const [detailOpen, setDetailOpen] = useState(detailOnly);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [error, setError] = useState('');
  const ownItem = own || (!!user?.address?.slug && item.author?.slug === user.address.slug);
  const full = useQuery({ queryKey: ['homeCheckIn', user?.id, item.id], queryFn: () => getHomeCheckIn(item.id), enabled: detailOpen && ownItem });
  const methods = useQuery({ queryKey: ['brewMethods'], queryFn: () => getBrewMethods().then(response => response.data) });
  const shown = full.data || item;
  const home = recipe(shown);
  const helpful = useCheckInHelpful();
  const drink = savedDrinkName(shown) || shown.customDrinkName || '';
  const name = ownItem ? item.username || 'Вы' : item.username || 'Пользователь';
  const published = item.visibility === 'Public' && item.moderationState === 'Approved';
  const exposureRef = useFeatureExposure<HTMLElement>('feed_home_check_in', 'feed', feed && !detailOnly);
  const open = () => {
    if (feed) captureAnalyticsEvent('feed_item_interacted', { action: 'home_detail', check_in_kind: 'home' });
    setDetailOpen(true);
  };
  const closeDetail = () => { setDetailOpen(false); onDetailClose?.(); };
  const remove = async () => {
    setDeleting(true); setError('');
    try { await deleteHomeCheckIn(item.id); await Promise.all([client.invalidateQueries({ queryKey: ['homeCheckIns'] }), client.invalidateQueries({ queryKey: ['checkIns'] })]); closeDetail(); }
    catch (cause) { setError(getErrorMessage(cause)); }
    finally { setDeleting(false); }
  };
  const hide = async () => {
    setHiding(true); setError('');
    try {
      const latest = await getHomeCheckIn(item.id);
      await updateHomeCheckIn(item.id, privateHomeUpdate(latest));
      await Promise.all([client.invalidateQueries({ queryKey: ['homeCheckIns'] }), client.invalidateQueries({ queryKey: ['checkIns'] })]);
      showToast('Чекин стал личным', 'success');
    } catch (cause) { setError(getErrorMessage(cause)); }
    finally { setHiding(false); }
  };
  const cardStyle = { background: colors.surface, borderColor: '#EAB308', color: colors.textPrimary };
  return <>
    {!detailOnly && <article ref={exposureRef} className="min-w-0 border p-4 sm:p-5" style={{ ...cardStyle, borderRadius: '28px 18px 28px 18px' }}>
      <header className="mb-3 flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: theme === 'dark' ? '#3D2F28' : '#F3EED9' }}>{name.charAt(0).toUpperCase()}</span><div className="min-w-0"><p className="truncate font-bold">{name}</p><p className="text-xs" style={{ color: colors.textSecondary }}>{formatCheckInDate({ createdAtUtc: item.createdAtUtc || item.preparedAtUtc || '', visitedAt: item.preparedAtUtc || item.preparedAt }, new Date())}</p></div></div>{(ownItem || published) && <ReportCheckInButton checkInId={item.id} actions={ownItem ? close => <><button type="button" onClick={() => { close(); setEditing(true); }} className="min-h-11 w-full px-3 text-left">Редактировать</button>{item.visibility === 'Public' && <button type="button" disabled={hiding} onClick={() => { close(); void hide(); }} className="min-h-11 w-full px-3 text-left">{hiding ? 'Скрываем…' : 'Сделать личным'}</button>}<button type="button" onClick={() => { close(); open(); }} className="min-h-11 w-full px-3 text-left">Открыть</button></> : undefined} />}</header>
      <button type="button" onClick={open} className="block min-h-11 w-full text-left text-xl font-bold text-[#D7A900]">Кофе дома</button>
      {home.beanName && <p className="font-semibold">{home.beanName}</p>}
      <p className="text-sm" style={{ color: colors.textSecondary }}>{[brewMethodName(home.brewMethodCode, methods.data), home.doseGrams != null ? `${home.doseGrams} г` : '', durationLabel(home.brewDurationSeconds), home.tasteScore ? `★ ${home.tasteScore}/5` : ''].filter(Boolean).join(' · ')}</p>
      {ownItem && !feed && <CheckInStatus item={shown as CheckInDto} />}
      {shown.text && <p className="mt-3 whitespace-pre-line break-words">{shown.text}</p>}
      <div onClickCapture={event => { if (feed && (event.target as HTMLElement).closest('button')?.querySelector('img')) captureAnalyticsEvent('feed_item_interacted', { action: 'photo', check_in_kind: 'home' }); }}><CheckInPhotos photos={shown.photos || []} shopName="Кофе дома" feed={feed} /></div>
      {drink && <p className="mt-2 text-sm">☕ {drink}</p>}
      {(published || ownItem) && <div className="mt-3">{!ownItem && user && published ? <button type="button" disabled={helpful.isPending} onClick={() => { if (feed) captureAnalyticsEvent('feed_item_interacted', { action: item.isHelpfulByCurrentUser ? 'unlike' : 'like', check_in_kind: 'home' }); helpful.mutate({ id: item.id, helpful: !item.isHelpfulByCurrentUser }); }} className="inline-flex min-h-11 items-center gap-2" aria-label={item.isHelpfulByCurrentUser ? 'Убрать лайк' : 'Лайк'}><Heart size={24} weight={item.isHelpfulByCurrentUser ? 'fill' : 'regular'} />{item.helpfulCount || 0}</button> : <span className="inline-flex min-h-11 items-center gap-2"><Heart size={24} />{item.helpfulCount || 0}</span>}</div>}
      {helpful.error && <p role="alert" className="text-sm text-red-500">{getErrorMessage(helpful.error)}</p>}
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    </article>}
    {detailOpen && <div role="presentation" className="fixed inset-0 z-[1360] flex items-end justify-center bg-black/55 sm:items-center" onMouseDown={event => { if (event.target === event.currentTarget && !deleting) closeDetail(); }}><section role="dialog" aria-modal="true" aria-label="Домашний чекин" className="max-h-[90dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] border p-5 sm:rounded-[28px]" style={cardStyle}><div className="flex justify-between"><h2 className="text-2xl font-bold">Кофе дома</h2><button type="button" aria-label="Закрыть" onClick={closeDetail} className="h-11 w-11 text-2xl">×</button></div>{full.isLoading && <p>Загрузка…</p>}{full.error && <button type="button" onClick={() => void full.refetch()} className="min-h-11 text-red-500">{getErrorMessage(full.error)} · Повторить</button>}<p className="mt-2 text-sm">{shown.preparedOn || shown.home?.preparedOn}</p><p className="mt-2">{[home.beanName, brewMethodName(home.brewMethodCode, methods.data), home.doseGrams != null ? `${home.doseGrams} г` : '', durationLabel(home.brewDurationSeconds)].filter(Boolean).join(' · ')}</p><p className="mt-2">Оценка: {home.tasteScore || '—'}/5</p>{shown.text && <p className="mt-3 whitespace-pre-line">{shown.text}</p>}<CheckInDrinkPhoto url={shown.drinkPhotoUrl} alt="Изображение напитка" /><CheckInPhotos photos={shown.photos || []} shopName="Кофе дома" />{ownItem && <div className="mt-5 flex gap-3"><button type="button" onClick={() => setEditing(true)} className="min-h-11 flex-1 rounded-full bg-[#EAB308] font-bold text-[#1A1412]">Редактировать</button><button type="button" onClick={() => { if (window.confirm('Удалить домашнюю запись? Она исчезнет из истории чекинов')) void remove(); }} disabled={deleting} className="min-h-11 flex-1 rounded-full border border-red-500 text-red-500">{deleting ? 'Удаляем…' : 'Удалить'}</button></div>}{error && <p role="alert" className="text-red-500">{error}</p>}</section></div>}
    {editing && <HomeCheckInSheet id={item.id} onClose={() => setEditing(false)} onSaved={() => { void full.refetch(); }} />}
  </>;
}
