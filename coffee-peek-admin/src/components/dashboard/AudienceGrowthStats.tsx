import type { OverviewStats } from '../../api/admin';
import { Card } from '../ui/Card';

const formatPercent = (value: number | null) => value === null
  ? '—'
  : `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)}%`;

export const AudienceGrowthStats = ({ overview }: { overview: OverviewStats }) => {
  const retention = overview.retention;
  const returned = retention?.afterRegistration;
  const providersAvailable = overview.appleUsers !== undefined && overview.emailUsers !== undefined;
  const providers = [
    { label: 'Google', count: overview.googleUsers },
    { label: 'Apple', count: overview.appleUsers ?? 0 },
    { label: 'Почта и пароль', count: overview.emailUsers ?? 0 },
    ...((overview.otherAuthUsers ?? 0) > 0 ? [{ label: 'Другие способы', count: overview.otherAuthUsers! }] : []),
  ];

  return (
    <Card className="space-y-5 p-4">
      <section aria-label="Способы регистрации">
        <h3 className="font-display text-sm font-semibold">Способы регистрации</h3>
        {providersAvailable ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {providers.map(({ label, count }) => (
              <div key={label} className="rounded-xl border border-border-light p-3 dark:border-border-dark">
                <p className="text-xs text-text-muted dark:text-stone-400">{label}</p>
                <p className="mt-1 font-display text-xl font-bold tabular-nums">{count}</p>
                <p className="text-xs text-text-muted dark:text-stone-400">
                  {formatPercent(overview.totalUsers ? count * 100 / overview.totalUsers : null)} от всех пользователей
                </p>
              </div>
            ))}
          </div>
        ) : <p className="mt-2 text-sm text-text-muted">Данные недоступны</p>}
      </section>

      <section aria-label="Возвращаемость после регистрации" className="border-t border-border-light pt-4 dark:border-border-dark">
        <h3 className="font-display text-sm font-semibold">Возвращаемость после регистрации</h3>
        {retention && returned ? (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-text-muted dark:text-stone-400">Вернулись после дня регистрации</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatPercent(returned.ratePercent)}</p>
                <p className="text-xs text-text-muted dark:text-stone-400">{returned.returnedUsers} из {returned.eligibleUsers} пользователей</p>
              </div>
              <div>
                <p className="text-xs text-text-muted dark:text-stone-400">Пока не вернулись</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums">{returned.eligibleUsers - returned.returnedUsers}</p>
                <p className="text-xs text-text-muted dark:text-stone-400">зарегистрировались до сегодняшнего дня UTC</p>
              </div>
              <p className="self-center text-xs text-text-muted dark:text-stone-400">На начало {retention.asOfDateUtc} UTC. Сегодняшняя активность появится после завершения дня.</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {([
                ['D1', retention.d1], ['D7', retention.d7], ['D30', retention.d30],
              ] as const).map(([label, metric]) => (
                <div key={label} className="rounded-xl bg-primary/5 p-3">
                  <p className="text-sm font-semibold">Retention {label}</p>
                  <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatPercent(metric.ratePercent)}</p>
                  <p className="text-xs text-text-muted dark:text-stone-400">
                    {metric.eligibleUsers ? `${metric.returnedUsers} из ${metric.eligibleUsers} пользователей` : 'Нет пользователей с полным периодом наблюдения'}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-muted dark:text-stone-400">
              D1 / D7 / D30 — вход или обновление сессии ровно на 1-й / 7-й / 30-й день после регистрации по UTC.
              Учитываются все сохранённые регистрации, для которых нужный день уже закончился.
              Данные основаны на сохранённой истории сессий; открытия без входа или обновления сессии не учитываются.
            </p>
          </>
        ) : <p className="mt-2 text-sm text-text-muted">Данные возвращаемости недоступны</p>}
      </section>
    </Card>
  );
};
