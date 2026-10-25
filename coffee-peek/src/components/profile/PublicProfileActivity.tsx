import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useUser } from '../../contexts/UserContext';
import { profileActivityQuery, useProfileActivity } from '../../hooks/queries/usePublicProfile';
import { checkInCountLabel, profileMonthCells, profileMonthTitle, profileToday, profileWeek, profileWeekdays, shiftProfileMonth } from '../../utils/profileActivity';
import { ProfileDialog, ProfileError, ProfileLoading } from './ProfileUI';

export default function PublicProfileActivity({ slug }: { slug: string }) {
  const { isLoading } = useUser();
  const today = profileToday();
  const week = profileWeek(today);
  // A week can cross a month or year boundary: load both months, not only today's.
  const months = [...new Set(week.map(date => date.slice(0, 7)))];
  const queries = useQueries({ queries: months.map(month => ({ ...profileActivityQuery(slug, month), enabled: !isLoading })) });
  const [expanded, setExpanded] = useState(false);
  const counts = new Map(queries.flatMap(query => query.data?.days.map(day => [day.date, day.checkInCount] as const) ?? []));
  const loading = queries.some(query => query.isPending);
  const failed = queries.some(query => query.isError);

  return <section aria-label="Активность пользователя">
    <button type="button" className="profile-week profile-panel w-full rounded-[20px] border p-3 text-left" onClick={() => setExpanded(true)} aria-label="Открыть календарь активности">
      <span className="mb-3 flex items-center justify-between text-sm font-semibold"><span>Активность за неделю</span><CalendarBlank size={18} className="profile-muted" /></span>
      <span className="grid grid-cols-7 gap-1 sm:gap-2">
        {week.map((date, index) => <span key={date} className="min-w-0 text-center" aria-label={`${date}: ${loading ? 'загрузка' : failed && !counts.has(date) ? 'данные недоступны' : checkInCountLabel(counts.get(date) ?? 0)}`}>
          <span className="mb-1.5 block text-[11px] profile-muted">{profileWeekdays[index]}</span>
          <span className={`profile-calendar-day ${date === today ? 'is-today' : ''} ${(counts.get(date) ?? 0) > 0 ? 'is-active' : ''} ${date > today ? 'is-future' : ''}`}>
            <span>{Number(date.slice(-2))}</span>
            {(counts.get(date) ?? 0) > 0 && <span className="profile-day-dot" />}
          </span>
        </span>)}
      </span>
      {loading && <span role="status" className="mt-2 block text-xs profile-muted">Загрузка активности…</span>}
    </button>
    {failed && <div className="mt-2"><ProfileError message="Не удалось загрузить активность" onRetry={() => { queries.forEach(query => { void query.refetch(); }); }} /></div>}
    {expanded && <ProfileDialog title="Активность" onClose={() => setExpanded(false)}><ProfileActivityCalendar slug={slug} /></ProfileDialog>}
  </section>;
}

function ProfileActivityCalendar({ slug }: { slug: string }) {
  const today = profileToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const activity = useProfileActivity(slug, month);
  const counts = new Map(activity.data?.days.map(day => [day.date, day.checkInCount]));
  return <section aria-label="Календарь публичных чекинов">
    <div className="mb-4 flex items-center justify-between gap-2">
      <h3 className="text-lg font-semibold first-letter:uppercase" aria-live="polite">{profileMonthTitle(month)}</h3>
      <div className="flex">
        <button type="button" className="profile-icon-button" aria-label="Предыдущий месяц" disabled={month <= '2000-01'} onClick={() => setMonth(shiftProfileMonth(month, -1))}><CaretLeft size={20} /></button>
        <button type="button" className="profile-icon-button" aria-label="Следующий месяц" disabled={month >= '2100-12'} onClick={() => setMonth(shiftProfileMonth(month, 1))}><CaretRight size={20} /></button>
      </div>
    </div>
    {activity.isPending ? <ProfileLoading label="Загрузка активности…" /> : activity.isError ? <ProfileError message="Не удалось загрузить активность" onRetry={() => void activity.refetch()} /> : <>
      <p className="mb-4 text-sm profile-muted">{checkInCountLabel(activity.data.totalCheckIns)} за месяц</p>
      <div className="grid grid-cols-7 gap-1.5">
        {profileWeekdays.map(day => <span key={day} className="pb-2 text-center text-xs profile-muted">{day}</span>)}
        {profileMonthCells(month).map((date, index) => date ? <div key={date} className={`profile-calendar-day ${date === today ? 'is-today' : ''} ${(counts.get(date) ?? 0) > 0 ? 'is-active' : ''}`}
          aria-label={`${date}: ${checkInCountLabel(counts.get(date) ?? 0)}`}>
          {Number(date.slice(-2))}{(counts.get(date) ?? 0) > 0 && <span className="profile-day-dot" />}
        </div> : <span key={`empty-${index}`} />)}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs profile-muted"><span className="h-1.5 w-1.5 rounded-full bg-[#EAB308]" />Дни с публичными чекинами</p>
      <p className="mt-2 text-xs profile-muted">Время Минска</p>
    </>}
  </section>;
}
