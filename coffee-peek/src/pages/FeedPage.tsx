import { useSearchParams } from 'react-router-dom';
import { useEffect, useRef } from 'react';
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
  const marker = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);
  useEffect(() => {
    if ((feed.error as { status?: number } | null)?.status === 400 && feed.data?.pages.length) void client.resetQueries({ queryKey: ['checkIns', 'feed'] });
  }, [feed.error, feed.data?.pages.length, client]);
  useEffect(() => {
    const element = marker.current;
    if (!element || !feed.hasNextPage || feed.isFetchingNextPage) return;
    const observer = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) void feed.fetchNextPage(); }, { rootMargin: '300px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed.fetchNextPage]);
  return <main onTouchStart={event => { if (window.scrollY < 20) touchStart.current = event.touches[0].clientY; }} onTouchEnd={event => { if (touchStart.current !== null && event.changedTouches[0].clientY - touchStart.current > 80) void client.resetQueries({ queryKey: ['checkIns', 'feed'] }); touchStart.current = null; }} className={`min-h-screen px-4 pb-32 pt-3 sm:py-8 ${classes.bg.primary} ${classes.text.primary}`}><div className="mx-auto max-w-3xl">
    <div className="mb-4 flex items-center justify-between gap-4"><h1 className="text-2xl font-bold">Лента</h1><button type="button" className="min-h-11" disabled={feed.isFetching} onClick={() => void client.resetQueries({ queryKey: ['checkIns', 'feed'] })}>Обновить</button></div>
    {feed.isLoading && <div className="flex justify-center py-10"><WobbleRing /></div>}
    {feed.error && <p role="alert" className="text-red-500">{getErrorMessage(feed.error)}</p>}
    {!feed.isLoading && !feed.error && !items.length && <div className="py-8 text-center"><Mascot pose="book" size={120} /><p>Пока нет опубликованных чек-инов.</p></div>}
    <div className="space-y-0 sm:space-y-4">{items.map(({ checkIn }) => <CheckInCard key={checkIn.id} item={checkIn} feed />)}</div>
    {feed.hasNextPage && <div ref={marker}><button type="button" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()} className={`min-h-12 w-full rounded-2xl font-bold disabled:opacity-50 ${classes.primary.bg} ${classes.text.inverse}`}>{feed.isFetchingNextPage ? 'Загрузка…' : 'Загрузить ещё'}</button></div>}
    {feed.error && !!items.length && <button type="button" onClick={() => void feed.fetchNextPage()} className="min-h-11 underline">Повторить загрузку</button>}
  </div></main>;
}
