import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useFeed } from '../hooks/queries/useCheckIns';
import { usePageTitle } from '../hooks/usePageTitle';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/theme';
import { getErrorMessage } from '../utils/errorHandler';
import CheckInCard from '../components/CheckInCard';
import WobbleRing from '../components/WobbleRing';
import Mascot from '../components/Mascot';
import './FeedPage.css';

export default function FeedPage() {
  usePageTitle('Лента');
  const [params] = useSearchParams();
  const client = useQueryClient();
  const { theme } = useTheme();
  const classes = getThemeClasses(theme);
  const feed = useFeed({ citySlug: params.get('citySlug') || undefined, coffeeShopSlug: params.get('coffeeShopSlug') || undefined, authorSlug: params.get('authorSlug') || undefined });
  const items = feed.data?.pages.flatMap(page => page.items) ?? [];
  return <main className={`min-h-screen px-4 pb-6 pt-3 sm:py-8 ${classes.bg.primary} ${classes.text.primary}`}><div className="mx-auto max-w-3xl">
    <div className="mb-4 flex items-center justify-between gap-4"><h1 className="text-2xl font-bold">Лента</h1><button type="button" className="hidden min-h-11 sm:block" disabled={feed.isFetching} onClick={() => void client.resetQueries({ queryKey: ['checkIns', 'feed'] })}>Обновить</button></div>
    {feed.isLoading && <div className="flex justify-center py-10"><WobbleRing /></div>}
    {feed.error && <p role="alert" className="text-red-500">{getErrorMessage(feed.error)}</p>}
    {!feed.isLoading && !feed.error && !items.length && <div className="py-8 text-center"><Mascot pose="book" size={120} /><p>Пока нет публичных чекинов</p></div>}
    <div className="space-y-0 sm:space-y-4">{items.map(({ checkIn }) => <CheckInCard key={checkIn.id} item={checkIn} feed />)}</div>
    {feed.hasNextPage && <button type="button" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()} className={`min-h-12 w-full rounded-2xl font-bold disabled:opacity-50 ${classes.primary.bg} ${classes.text.inverse}`}>{feed.isFetchingNextPage ? 'Загрузка…' : 'Загрузить ещё'}</button>}
  </div></main>;
}
