import { useSearchParams } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import type { TouchEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFeed } from '../hooks/queries/useCheckIns';
import { usePageTitle } from '../hooks/usePageTitle';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/theme';
import { getErrorMessage } from '../utils/errorHandler';
import CheckInCard from '../components/CheckInCard';
import WobbleRing from '../components/WobbleRing';
import Mascot from '../components/Mascot';
import { analyticsGeneration, captureAnalyticsEvent } from '../lib/analytics';
import { useFeatureExposure } from '../hooks/useFeatureExposure';
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
  const touchStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const refreshing = useRef(false);
  const viewedQuery = useRef<string | null>(null);
  const queryIdentity = params.toString();
  const exposureRef = useFeatureExposure<HTMLHeadingElement>('feed', 'feed');
  const firstPageCount = feed.data?.pages[0]?.items.length;
  useEffect(() => {
    const captureView = () => {
      const visit = `${analyticsGeneration()}:${queryIdentity}`;
      if (!feed.isSuccess || firstPageCount === undefined || viewedQuery.current === visit) return;
      if (captureAnalyticsEvent('feed_viewed', { result_count: firstPageCount, is_empty: firstPageCount === 0 })) viewedQuery.current = visit;
    };
    captureView();
    window.addEventListener('coffeepeek:analytics-ready', captureView);
    return () => window.removeEventListener('coffeepeek:analytics-ready', captureView);
  }, [feed.isSuccess, firstPageCount, queryIdentity]);
  const refresh = async () => {
    if (feed.isFetching || refreshing.current) return;
    refreshing.current = true;
    captureAnalyticsEvent('feed_action_clicked', { action: 'refresh', trigger: 'gesture' });
    try {
      await client.resetQueries({ queryKey: ['checkIns', 'feed'] });
    } finally {
      refreshing.current = false;
    }
  };
  const startRefreshGesture = (event: TouchEvent<HTMLElement>) => {
    touchStart.current = null;
    const touch = event.touches[0];
    if (window.scrollY > 0 || feed.isFetching || refreshing.current || event.touches.length !== 1 || !touch) return;
    touchStart.current = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
  };
  const moveRefreshGesture = (event: TouchEvent<HTMLElement>) => {
    const start = touchStart.current;
    const touch = event.touches[0];
    if (!start) return;
    if (!touch || event.touches.length !== 1 || touch.identifier !== start.id || window.scrollY > 0
      || touch.clientY < start.y - 8 || Math.abs(touch.clientX - start.x) > Math.max(8, touch.clientY - start.y)) touchStart.current = null;
  };
  const endRefreshGesture = (event: TouchEvent<HTMLElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch || event.touches.length || touch.identifier !== start.id || window.scrollY > 0) return;
    const distance = touch.clientY - start.y;
    if (distance > 80 && distance > Math.abs(touch.clientX - start.x)) void refresh();
  };
  const loadMore = (trigger: 'button' | 'scroll', retry = false) => {
    captureAnalyticsEvent('feed_action_clicked', { action: retry ? 'retry' : 'load_more', trigger });
    void feed.fetchNextPage();
  };
  useEffect(() => {
    if ((feed.error as { status?: number } | null)?.status === 400 && feed.data?.pages.length) void client.resetQueries({ queryKey: ['checkIns', 'feed'] });
  }, [feed.error, feed.data?.pages.length, client]);
  useEffect(() => {
    const element = marker.current;
    if (!element || !feed.hasNextPage || feed.isFetchingNextPage) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) {
        captureAnalyticsEvent('feed_action_clicked', { action: 'load_more', trigger: 'scroll' });
        void feed.fetchNextPage();
      }
    }, { rootMargin: '300px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed.fetchNextPage]);
  return <main onTouchStart={startRefreshGesture} onTouchMove={moveRefreshGesture} onTouchEnd={endRefreshGesture} onTouchCancel={() => { touchStart.current = null; }} className={`min-h-screen px-4 pb-32 pt-3 sm:py-8 ${classes.bg.primary} ${classes.text.primary}`}><div className="mx-auto max-w-3xl">
    <h1 ref={exposureRef} className="mb-4 text-2xl font-bold">Лента</h1>
    {feed.isLoading && <div className="flex justify-center py-10"><WobbleRing /></div>}
    {feed.error && <p role="alert" className="text-red-500">{getErrorMessage(feed.error)}</p>}
    {!feed.isLoading && !feed.error && !items.length && <div className="py-8 text-center"><Mascot pose="book" size={120} /><p>Пока нет опубликованных чек-инов.</p></div>}
    <div className="space-y-0 sm:space-y-4">{items.map(({ checkIn }) => <CheckInCard key={checkIn.id} item={checkIn} feed />)}</div>
    {feed.hasNextPage && <div ref={marker}><button type="button" disabled={feed.isFetchingNextPage} onClick={() => loadMore('button')} className={`min-h-12 w-full rounded-2xl font-bold disabled:opacity-50 ${classes.primary.bg} ${classes.text.inverse}`}>{feed.isFetchingNextPage ? 'Загрузка…' : 'Загрузить ещё'}</button></div>}
    {feed.error && !!items.length && <button type="button" onClick={() => loadMore('button', true)} className="min-h-11 underline">Повторить загрузку</button>}
  </div></main>;
}
