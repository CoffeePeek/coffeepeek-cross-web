import React, { useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getModerationInsights,
  getShopsInsights,
  getShopsTimeseries,
  getUsersTimeseries,
  type AdminDailyCount,
  type AdminModerationQueueName,
  type AdminModerationInsights,
  type AdminShopsInsights,
  type AdminTopShop,
  type OverviewStats,
} from '../../api/admin';
import { getUserPublicProfile } from '../../api/users';
import { Card } from '../ui/Card';
import { DataTable } from '../ui/DataTable';
import { Button } from '../ui/Button';
import { TrendChart } from './TrendChart';
import { AudienceGrowthStats } from './AudienceGrowthStats';
import { ShopCoverageStats } from './ShopCoverageStats';

const QUEUES: Record<AdminModerationQueueName, { label: string; to: string }> = {
  shops: { label: 'Кофейни', to: '/shops' },
  checkIns: { label: 'Чекины', to: '/check-ins' },
  roasters: { label: 'Обжарщики', to: '/roasters' },
  changeRequests: { label: 'Правки кофеен', to: '/shop-change-requests' },
  issueReports: { label: 'Жалобы на данные', to: '/shop-reports' },
};
const DAY_OPTIONS = [7, 30, 90] as const;
const numberFormatter = new Intl.NumberFormat('ru-RU');
const formatNumber = (value: number) => numberFormatter.format(value);
const fmtHours = (hours: number | null) => hours === null ? '—' : hours >= 48 ? `${Math.round(hours / 24)} дн` : `${Math.round(hours)} ч`;

type Moderator = AdminModerationInsights['topModerators30Days'][number];
type DownloadChannel = AdminShopsInsights['downloads']['byChannel'][number];
type DownloadCountry = AdminShopsInsights['downloads']['topCountries30Days'][number];

const Unavailable = ({ onRetry }: { onRetry?: () => void }) => (
  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted dark:text-stone-400">
    <span>Данные недоступны</span>
    {onRetry && <Button size="sm" variant="ghost" onClick={onRetry}>Повторить</Button>}
  </div>
);

const Loading = () => <div role="status" className="h-24 animate-pulse rounded-lg bg-stone-100 motion-reduce:animate-none dark:bg-white/5"><span className="sr-only">Загрузка статистики</span></div>;

function Details({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="group/details min-w-0" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 shrink-0 text-text-muted transition-transform group-open/details:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
        <span className="font-medium">{title}</span>
        {hint && <span className="ml-auto shrink-0 text-xs tabular-nums text-text-muted dark:text-stone-400">{hint}</span>}
      </summary>
      {open && <div className="pb-4 pt-1">{children}</div>}
    </details>
  );
}

function GrowthMetric({ label, total, today, points, days, unavailable, error, onRetry, to }: {
  label: string;
  total: number;
  today: number;
  points?: AdminDailyCount[];
  days: number;
  unavailable?: boolean;
  error: boolean;
  onRetry: () => void;
  to?: string;
}) {
  const periodTotal = points?.reduce((acc, point) => acc + point.count, 0);
  return (
    <section className="min-w-0 px-4 py-4" aria-label={label}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm text-text-muted dark:text-stone-400">
          {to ? <Link to={to} className="rounded hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-primary">{label}</Link> : label}
        </h3>
        {!unavailable && <span className="text-xs text-text-muted dark:text-stone-400">+{formatNumber(today)} сегодня</span>}
      </div>
      <p className="mt-1 font-display text-3xl font-semibold tracking-tight tabular-nums">
        {unavailable ? '—' : formatNumber(total)}
        <span className="ml-2 text-xs font-normal tracking-normal text-text-muted dark:text-stone-400">всего</span>
      </p>
      <div className="mb-2 mt-3 text-xs text-text-muted dark:text-stone-400">
        {periodTotal !== undefined && !unavailable ? <><strong className="font-semibold tabular-nums text-primary-dark dark:text-primary">+{formatNumber(periodTotal)}</strong> за {days} дней</> : 'Новые за период'}
      </div>
      {unavailable ? <div className="flex h-28 items-center"><Unavailable /></div>
        : points ? <TrendChart key={days} label={label} points={points} />
          : error ? <div className="flex h-28 items-center"><Unavailable onRetry={onRetry} /></div>
            : <Loading />}
    </section>
  );
}

const TopShops: React.FC<{ title: string; shops: AdminTopShop[]; countLabel: string; canManageShops: boolean }> = ({ title, shops, countLabel, canManageShops }) => {
  const columns: ColumnDef<AdminTopShop>[] = [
    { accessorKey: 'name', header: title, cell: ({ row }) => canManageShops ? <Link to={`/published-shops/${row.original.shopId}`} className="text-text-main hover:text-primary dark:text-stone-200">{row.original.name}</Link> : row.original.name },
    { accessorKey: 'count', header: countLabel, meta: { className: 'text-right', headerClassName: 'text-right' } },
  ];
  return <DataTable columns={columns} data={shops} emptyText="Нет данных" getRowId={shop => shop.shopId} />;
};

const channelColumns: ColumnDef<DownloadChannel>[] = [
  { accessorKey: 'channel', header: 'Канал' },
  { accessorKey: 'total', header: 'Всего' },
  { accessorKey: 'last30Days', header: '30 дн.' },
];
const countryColumns: ColumnDef<DownloadCountry>[] = [
  { accessorKey: 'country', header: 'Страна', cell: ({ row }) => row.original.country === 'unknown' ? 'Неизвестно' : row.original.country },
  { accessorKey: 'count', header: 'За 30 дн.' },
];

function ModeratorTable({ moderators }: { moderators: Moderator[] }) {
  const profiles = useQueries({
    queries: moderators.map(moderator => ({
      queryKey: ['public-user-profile', moderator.moderatorUserId],
      queryFn: () => getUserPublicProfile(moderator.moderatorUserId).then(response => response.data),
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });
  const columns: ColumnDef<Moderator>[] = [
    { accessorKey: 'moderatorUserId', header: 'Модератор', cell: ({ row }) => profiles[row.index]?.data?.userName ?? row.original.moderatorUserId },
    { accessorKey: 'total', header: 'Всего' },
    { accessorKey: 'approved', header: 'Одобрено' },
    { accessorKey: 'rejected', header: 'Отклонено' },
  ];
  return <DataTable columns={columns} data={moderators} getRowId={row => row.moderatorUserId} />;
}

export const AdminStatsPanel: React.FC<{ overview: OverviewStats; canManageShops: boolean }> = ({ overview, canManageShops }) => {
  const [days, setDays] = useState<number>(30);
  const usersTs = useQuery({
    queryKey: ['admin', 'stats', 'users-timeseries', days],
    queryFn: () => getUsersTimeseries(days).then(response => response.data),
    staleTime: 60_000,
  });
  const shopsTs = useQuery({
    queryKey: ['admin', 'stats', 'shops-timeseries', days],
    queryFn: () => getShopsTimeseries(days).then(response => response.data),
    staleTime: 60_000,
    enabled: overview.shopsAvailable,
  });
  const shops = useQuery({
    queryKey: ['admin', 'stats', 'shops-insights'],
    queryFn: () => getShopsInsights().then(response => response.data),
    staleTime: 5 * 60_000,
    enabled: overview.shopsAvailable,
  });
  const moderation = useQuery({
    queryKey: ['admin', 'stats', 'moderation-insights'],
    queryFn: () => getModerationInsights().then(response => response.data),
    staleTime: 60_000,
    enabled: overview.moderationAvailable,
  });
  const pendingQueues = moderation.data?.queues.filter(queue => queue.pending > 0) ?? [];
  const ratings = shops.data?.ratings;
  const maxBucket = Math.max(1, ...(ratings?.distribution.map(bucket => bucket.count) ?? []));
  const audience = [
    { label: 'Активные аккаунты', value: overview.activeUsers },
    { label: 'Заблокированы', value: overview.blockedUsers },
    { label: 'Удалены', value: overview.deletedUsers },
    { label: 'Подтверждённый email', value: overview.emailConfirmedUsers },
  ];

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-light px-4 py-3 dark:border-border-dark">
          <div>
            <h2 className="text-sm font-semibold">Динамика</h2>
            <p className="mt-0.5 text-[11px] text-text-muted dark:text-stone-400">Новые за день · UTC · сегодня — неполный день</p>
          </div>
          <div className="flex gap-1" role="group" aria-label="Период графиков">
            {DAY_OPTIONS.map(day => (
              <Button key={day} size="sm" onClick={() => setDays(day)} aria-pressed={days === day} variant={days === day ? 'primary' : 'ghost'}>{day} дн</Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 divide-y divide-border-light dark:divide-border-dark md:grid-cols-3 md:divide-x md:divide-y-0">
          <GrowthMetric label="Пользователи" to="/users" total={overview.totalUsers} today={overview.usersRegisteredToday} points={usersTs.data?.newUsers} days={days} error={usersTs.isError} onRetry={() => void usersTs.refetch()} />
          <GrowthMetric label="Кофейни" to={canManageShops ? '/published-shops' : undefined} total={overview.totalCoffeeShops} today={overview.newCoffeeShopsToday} points={shopsTs.data?.newShops} days={days} unavailable={!overview.shopsAvailable} error={shopsTs.isError} onRetry={() => void shopsTs.refetch()} />
          <GrowthMetric label="Чекины" total={overview.totalCheckIns} today={overview.newCheckInsToday} points={shopsTs.data?.newCheckIns} days={days} unavailable={!overview.shopsAvailable} error={shopsTs.isError} onRetry={() => void shopsTs.refetch()} />
        </div>
      </Card>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Требуют модерации</h2>
          {!overview.moderationAvailable ? <Unavailable /> : moderation.data ? (
            pendingQueues.length ? (
              <div>
                <div className="mb-1 grid grid-cols-[1fr_3rem_5rem] gap-2 whitespace-nowrap text-right text-[10px] text-text-muted dark:text-stone-400" aria-hidden="true"><span /><span>В очереди</span><span>Старейшая</span></div>
                <ul className="divide-y divide-border-light dark:divide-border-dark">
                  {pendingQueues.map(queue => (
                    <li key={queue.queue}>
                      <Link to={QUEUES[queue.queue].to} className="grid grid-cols-[1fr_3rem_5rem] items-center gap-2 rounded py-2 text-sm hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-primary">
                        <span>{QUEUES[queue.queue].label}</span>
                        <span className="text-right font-semibold tabular-nums"><span className="sr-only">В очереди: </span>{formatNumber(queue.pending)}</span>
                        <span className="text-right text-xs tabular-nums text-text-muted dark:text-stone-400"><span className="sr-only">Старейшая заявка: </span>{fmtHours(queue.oldestPendingHours)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <p className="py-3 text-sm text-text-muted dark:text-stone-400">Очередь пуста — все заявки разобраны.</p>
          ) : moderation.isError ? <Unavailable onRetry={() => void moderation.refetch()} /> : <Loading />}
        </Card>

        <Card className="px-4 pt-4">
          <h2 className="text-sm font-semibold">Аудитория</h2>
          <p className="mt-1 text-xs text-text-muted dark:text-stone-400">Аккаунты с входом или обновлением сессии</p>
          <dl className="my-3 grid grid-cols-3 gap-3">
            {[
              { label: 'За 24 часа', value: overview.dailyActiveUsers },
              { label: 'За 7 дней', value: overview.weeklyActiveUsers },
              { label: 'За 30 дней', value: overview.monthlyActiveUsers },
            ].map(item => (
              <div key={item.label}>
                <dt className="text-[11px] text-text-muted dark:text-stone-400">{item.label}</dt>
                <dd className="mt-0.5 font-display text-xl font-semibold tabular-nums">{formatNumber(item.value)}</dd>
              </div>
            ))}
          </dl>
          <p className="mb-3 text-[11px] text-text-muted dark:text-stone-400">Действия в каталоге не учитываются.</p>
          <div className="border-t border-border-light dark:border-border-dark">
            <Details title="Активность по дням (DAU)" hint={`${days} дней`}>
              <p className="mb-3 text-[11px] text-text-muted dark:text-stone-400">Уникальные аккаунты с входом или обновлением сессии за день по UTC. Сегодня — неполный день.</p>
              {usersTs.data ? <TrendChart key={days} label="DAU" points={usersTs.data.dailyActiveUsers ?? []} />
                : usersTs.isError ? <Unavailable onRetry={() => void usersTs.refetch()} /> : <Loading />}
            </Details>
          </div>
          <div className="border-t border-border-light dark:border-border-dark">
            <Details title="Состав аудитории">
              <dl className="space-y-2 text-xs">
                {audience.map(item => (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <dt className="text-text-muted dark:text-stone-400">{item.label}</dt>
                    <dd className="tabular-nums"><strong className="font-semibold">{formatNumber(item.value)}</strong><span className="ml-2 inline-block w-9 text-right text-text-muted dark:text-stone-400">{overview.totalUsers ? Math.round(item.value / overview.totalUsers * 100) : 0}%</span></dd>
                  </div>
                ))}
              </dl>
            </Details>
          </div>
        </Card>
      </div>

      <Card className="divide-y divide-border-light px-4 dark:divide-border-dark">
        <Details title="Регистрация и возвращаемость">
          <AudienceGrowthStats overview={overview} />
        </Details>
        <Details title="Рейтинги, охват и топ кофеен" hint={overview.shopsAvailable && ratings ? `${ratings.averageRating.toFixed(2)} / 5` : undefined}>
          {!overview.shopsAvailable ? <Unavailable /> : shops.data && ratings ? (
            <div className="space-y-4">
              <ShopCoverageStats coverage={shops.data.coverage} />
              <div className="grid gap-4 sm:grid-cols-2">
                <dl className="space-y-2 text-sm">
                  {[
                    { label: 'Средний рейтинг', value: ratings.averageRating },
                    { label: 'Кофе', value: ratings.averageCoffee },
                    { label: 'Сервис', value: ratings.averageService },
                    { label: 'Место', value: ratings.averagePlace },
                  ].map(item => <div key={item.label} className="flex justify-between gap-2"><dt className="text-text-muted dark:text-stone-400">{item.label}</dt><dd className="font-semibold tabular-nums">{item.value.toFixed(2)}</dd></div>)}
                </dl>
                <div className="space-y-2">
                  {[...ratings.distribution].sort((a, b) => b.stars - a.stars).map(bucket => (
                    <div key={bucket.stars} className="flex items-center gap-2 text-xs">
                      <span className="w-6 text-text-muted dark:text-stone-400">{bucket.stars}★</span>
                      <div className="h-1.5 flex-1 rounded-full bg-stone-100 dark:bg-white/5"><div className="h-full rounded-full bg-primary" style={{ width: `${bucket.count / maxBucket * 100}%` }} /></div>
                      <span className="w-10 text-right tabular-nums text-text-muted dark:text-stone-400">{formatNumber(bucket.count)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <TopShops title="По чекинам за 30 дней" shops={shops.data.topShopsByCheckIns30Days} countLabel="Чекины" canManageShops={canManageShops} />
                {shops.data.topShopsByFavorites === undefined ? <div><p className="mb-2 text-sm font-medium">В избранном сейчас</p><Unavailable /></div>
                  : <TopShops title="В избранном сейчас" shops={shops.data.topShopsByFavorites} countLabel="Сохранили" canManageShops={canManageShops} />}
              </div>
            </div>
          ) : shops.isError ? <Unavailable onRetry={() => void shops.refetch()} /> : <Loading />}
        </Details>
        <Details title="Загрузки приложения" hint={overview.shopsAvailable && shops.data ? `+${formatNumber(shops.data.downloads.last30Days)} за 30 дн` : undefined}>
          {!overview.shopsAvailable ? <Unavailable /> : shops.data ? (
            <div>
              <p className="mb-3 text-xs text-text-muted dark:text-stone-400">Всего загрузок: <strong className="font-semibold tabular-nums">{formatNumber(shops.data.downloads.total)}</strong></p>
              <div className="grid gap-4 sm:grid-cols-2">
                <DataTable columns={channelColumns} data={shops.data.downloads.byChannel} getRowId={row => row.channel} />
                <DataTable columns={countryColumns} data={shops.data.downloads.topCountries30Days} getRowId={row => row.country} />
              </div>
            </div>
          ) : shops.isError ? <Unavailable onRetry={() => void shops.refetch()} /> : <Loading />}
        </Details>
        <Details title="Работа модераторов" hint="30 дней">
          {!overview.moderationAvailable ? <Unavailable /> : moderation.data ? <ModeratorTable moderators={moderation.data.topModerators30Days} />
            : moderation.isError ? <Unavailable onRetry={() => void moderation.refetch()} /> : <Loading />}
        </Details>
      </Card>
    </div>
  );
};
