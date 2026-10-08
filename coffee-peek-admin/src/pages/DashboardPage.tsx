import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Coffee, MessageSquareText, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getOverviewStats } from '../api/admin';
import { AdminStatsPanel } from '../components/dashboard/AdminStatsPanel';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { LoadError } from '../components/ui/LoadError';
import { useUser } from '../contexts/UserContext';

const roleName = (isAdmin: boolean, isModerator: boolean, isOwner: boolean) =>
  isAdmin ? 'Администратор' : isModerator ? 'Модератор' : isOwner ? 'Владелец' : 'Пользователь';

const StatSkeleton = () => <div className="h-28 animate-pulse rounded-xl bg-stone-100 dark:bg-white/5" />;

export const DashboardPage = () => {
  const { user, isAdmin, isModerator, isOwner } = useUser();
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'stats', 'overview'],
    queryFn: () => getOverviewStats().then((response) => response.data),
    staleTime: 60_000,
    enabled: isAdmin,
  });

  const stats = data ? [
    { label: 'Пользователи', value: data.totalUsers, hint: `+${data.usersRegisteredToday} сегодня`, icon: Users },
    { label: 'Кофейни', value: data.shopsAvailable ? data.totalCoffeeShops : '—', hint: data.shopsAvailable ? `+${data.newCoffeeShopsToday} сегодня` : 'Сервис недоступен', icon: Coffee },
    { label: 'Чекины', value: data.shopsAvailable ? data.totalCheckIns : '—', hint: data.shopsAvailable && data.newCheckInsToday ? `+${data.newCheckInsToday} сегодня` : 'Без новых', icon: MessageSquareText },
    { label: 'На модерации', value: data.moderationAvailable ? data.pendingModerationShops + data.pendingModerationCheckIns : '—', hint: data.moderationAvailable ? `${data.pendingModerationShops} кофеен · ${data.pendingModerationCheckIns} чекинов` : 'Сервис недоступен', icon: ShieldCheck },
  ] : [];

  const workLinks = [
    ...(!isAdmin && isModerator ? [
      { to: '/shops', label: 'Заявки на кофейни', detail: 'Проверить новые кофейни' },
      { to: '/check-ins', label: 'Чекины на проверке', detail: 'Принять решение по публикациям' },
      { to: '/shop-change-requests', label: 'Правки кофеен', detail: 'Рассмотреть изменения данных' },
      { to: '/import', label: 'Импорт данных', detail: 'Разобрать очередь импорта' },
    ] : []),
    ...(isOwner ? [
      { to: '/my-shops', label: 'Мои кофейни', detail: 'Открыть и обновить свои кофейни' },
    ] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary-dark dark:text-primary">{roleName(isAdmin, isModerator, isOwner)}</p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">
            Добро пожаловать{user?.email ? `, ${user.email.split('@')[0]}` : ''}
          </h2>
          <p className="mt-1 text-sm text-text-muted dark:text-stone-400">
            {isAdmin ? 'Сводка CoffeePeek и задачи, требующие внимания.' : 'Выберите раздел для работы.'}
          </p>
        </div>
        {isModerator && <Button asChild><Link to="/import">Открыть импорт<ArrowRight className="h-4 w-4" /></Link></Button>}
      </div>

      {isAdmin && isError && (
        <LoadError
          message={data ? 'Не удалось обновить сводку. Показаны последние загруженные данные.' : 'Не удалось загрузить сводку. Проверьте соединение и повторите попытку.'}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      )}

      {workLinks.length > 0 && (
        <section aria-label="Рабочие разделы" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {workLinks.map(({ to, label, detail }) => (
            <Link key={to} to={to} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <Card className="h-full p-4 transition-colors hover:border-primary/60">
                <span className="flex items-center justify-between gap-2 font-semibold">
                  {label}<ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </span>
                <p className="mt-2 text-sm text-text-muted dark:text-stone-400">{detail}</p>
              </Card>
            </Link>
          ))}
        </section>
      )}

      {isAdmin && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading ? Array.from({ length: 4 }, (_, index) => <StatSkeleton key={index} />) : stats.map(({ label, value, hint, icon: Icon }) => (
            <Card key={label} className="p-4">
              <CardHeader className="flex-row items-center justify-between space-y-0 p-0 pb-2">
                <CardTitle className="text-sm font-medium text-text-muted dark:text-stone-400">{label}</CardTitle>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary-dark dark:text-primary"><Icon className="h-4 w-4" /></span>
              </CardHeader>
              <CardContent className="p-0">
                <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
                <CardDescription className="mt-1 text-xs">{hint}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isAdmin && data && <AdminStatsPanel overview={data} />}
    </div>
  );
};
