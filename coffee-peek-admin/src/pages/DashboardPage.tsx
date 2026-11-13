import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getOverviewStats } from '../api/admin';
import { AdminStatsPanel } from '../components/dashboard/AdminStatsPanel';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LoadError } from '../components/ui/LoadError';
import { useUser } from '../contexts/UserContext';

const roleName = (isAdmin: boolean, isModerator: boolean, isOwner: boolean) =>
  isAdmin ? 'Администратор' : isModerator ? 'Модератор' : isOwner ? 'Владелец' : 'Пользователь';

const StatSkeleton = () => <div className="h-64 animate-pulse rounded-xl bg-stone-100 motion-reduce:animate-none dark:bg-white/5" />;

export const DashboardPage = () => {
  const { user, isAdmin, isModerator, isOwner } = useUser();
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'stats', 'overview'],
    queryFn: () => getOverviewStats().then((response) => response.data),
    staleTime: 60_000,
    enabled: isModerator,
  });

  const workLinks = [
    ...(!isAdmin && isModerator ? [
      { to: '/shops', label: 'Заявки на кофейни', detail: 'Проверить новые кофейни' },
      { to: '/check-ins', label: 'Проверка чекинов', detail: 'Принять решение по публикациям' },
      { to: '/shop-change-requests', label: 'Правки кофеен', detail: 'Рассмотреть изменения данных' },
      { to: '/import', label: 'Импорт кофеен', detail: 'Разобрать очередь импорта' },
    ] : []),
    ...(isOwner ? [
      { to: '/my-shops', label: 'Мои кофейни', detail: 'Открыть и обновить свои кофейни' },
    ] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isModerator ? <h2 className="font-display text-xl font-semibold tracking-tight text-text-main dark:text-white">Обзор сервиса</h2> : <div>
          <p className="text-sm font-medium text-primary-dark dark:text-primary">{roleName(isAdmin, isModerator, isOwner)}</p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">
            Добро пожаловать{user?.email ? `, ${user.email.split('@')[0]}` : ''}
          </h2>
          <p className="mt-1 text-sm text-text-muted dark:text-stone-400">
            Выберите раздел для работы.
          </p>
        </div>}
        {isModerator && <Button asChild size="sm" variant="secondary"><Link to="/import">Открыть импорт<ArrowRight className="h-3.5 w-3.5" /></Link></Button>}
      </div>

      {isModerator && isError && (
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

      {isModerator && isLoading && <div role="status"><span className="sr-only">Загрузка сводки</span><StatSkeleton /></div>}

      {isModerator && data && <AdminStatsPanel overview={data} canManageShops={isAdmin} />}
    </div>
  );
};
