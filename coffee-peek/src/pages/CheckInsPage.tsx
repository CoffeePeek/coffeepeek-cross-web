import CheckInCard from '../components/CheckInCard';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CheckInDto } from '../api/coffeeshop';
import Mascot from '../components/Mascot';
import WobbleRing from '../components/WobbleRing';
import { AppIcon } from '../components/icons';
import { COLORS, getThemeColors } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';
import { useCheckIns, useCheckInsByDateRange } from '../hooks/queries/useCheckIns';
import { usePageTitle } from '../hooks/usePageTitle';
import { getErrorMessage } from '../utils/errorHandler';

const PAGE_SIZE = 10;
const WEEKDAYS = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];

const visitDate = (item: CheckInDto) => new Date(item.visitedAt || item.createdAtUtc);
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const CheckInsPage: React.FC = () => {
  usePageTitle('Мои чекины');
  const navigate = useNavigate();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const gold = COLORS.primary;
  const [view, setView] = useState<'calendar' | 'feed'>('feed');
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState('');

  const range = useMemo(() => ({
    from: month.toISOString(),
    to: new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString(),
  }), [month]);
  const feed = useCheckIns(page, PAGE_SIZE, view === 'feed');
  const calendar = useCheckInsByDateRange(range.from, range.to, view === 'calendar');
  const calendarItems = calendar.data ?? [];
  const itemsByDate = useMemo(() => {
    const grouped = new Map<string, CheckInDto[]>();
    calendarItems.forEach(item => {
      const key = dateKey(visitDate(item));
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    });
    return grouped;
  }, [calendarItems]);

  useEffect(() => {
    if (view !== 'calendar' || itemsByDate.has(selectedDate)) return;
    setSelectedDate([...itemsByDate.keys()].sort().at(-1) ?? dateKey(month));
  }, [itemsByDate, month, selectedDate, view]);

  const items = view === 'feed' ? feed.data?.items ?? [] : itemsByDate.get(selectedDate) ?? [];
  const isLoading = view === 'feed' ? feed.isLoading : calendar.isLoading;
  const error = view === 'feed' ? feed.error : calendar.error;
  const retry = () => { void (view === 'feed' ? feed.refetch() : calendar.refetch()); };

  return (
    <main className="min-h-screen px-4 pb-14 pt-6 sm:px-6 sm:pt-8" style={{ background: colors.background }}>
      <div className="mx-auto w-full max-w-[760px]">
        <header className="mb-6 grid grid-cols-[52px_1fr_52px] items-center sm:mb-8">
          <button type="button" onClick={() => navigate(-1)} aria-label="Назад" className="flex h-12 w-12 items-center justify-center rounded-full border shadow-sm" style={{ borderColor: colors.border, background: colors.surface, color: colors.textPrimary }}>
            <AppIcon name="chevron_left" size={24} color="currentColor" />
          </button>
          <h1 className="text-center text-2xl font-extrabold sm:text-3xl" style={{ color: colors.textPrimary }}>Мои чекины</h1>
        </header>

        <div role="tablist" aria-label="Режим просмотра чекинов" className="mb-6 grid grid-cols-2 rounded-full p-1" style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>
          {([['calendar', 'Календарь'], ['feed', 'Лента']] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className="min-h-12 rounded-full px-4 text-base font-bold transition-colors" style={{ background: view === id ? (theme === 'dark' ? '#241C18' : '#F1EEEA') : 'transparent', color: view === id ? colors.textPrimary : colors.textSecondary }}>{label}</button>
          ))}
        </div>

        {view === 'calendar' && (
          <CheckInCalendar month={month} items={calendarItems} itemsByDate={itemsByDate} selectedDate={selectedDate} colors={colors} onMonthChange={offset => setMonth(value => new Date(value.getFullYear(), value.getMonth() + offset, 1))} onSelectDate={setSelectedDate} />
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><WobbleRing size={48} /></div>
        ) : error ? (
          <div className="rounded-3xl border p-6 text-center" style={{ borderColor: colors.border, background: colors.surface }}>
            <p className="mb-4 text-sm text-red-500">{getErrorMessage(error)}</p>
            <button type="button" onClick={retry} className="min-h-11 rounded-xl px-5 font-bold" style={{ background: gold, color: '#1A1412' }}>Повторить</button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border px-6 py-10 text-center" style={{ borderColor: colors.border, background: colors.surface }}>
            <Mascot pose="happy" size={112} />
            <h2 className="mt-2 text-lg font-bold" style={{ color: colors.textPrimary }}>{view === 'calendar' ? 'В этот день чекинов нет' : 'Пока нет чекинов'}</h2>
          </div>
        ) : (
          <>
            {view === 'calendar' && <h2 className="mb-4 mt-7 text-2xl font-extrabold" style={{ color: colors.textPrimary }}>{visitDate(items[0]).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>}
            <div className="space-y-4" style={{ opacity: feed.isFetching || calendar.isFetching ? 0.7 : 1 }}>
              {items.map(item => <CheckInCard key={item.id} item={item} own />)}
            </div>
          </>
        )}

        {view === 'feed' && (feed.data?.totalPages ?? 0) > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3" style={{ color: colors.textPrimary }}>
            <button type="button" disabled={page <= 1 || feed.isFetching} onClick={() => setPage(value => value - 1)} className="min-h-11 rounded-xl border px-4 disabled:opacity-40" style={{ borderColor: colors.border }} aria-label="Предыдущая страница"><AppIcon name="caret-left" size={20} /></button>
            <span>{page} / {feed.data?.totalPages}</span>
            <button type="button" disabled={page >= (feed.data?.totalPages ?? 1) || feed.isFetching} onClick={() => setPage(value => value + 1)} className="min-h-11 rounded-xl border px-4 disabled:opacity-40" style={{ borderColor: colors.border }} aria-label="Следующая страница"><AppIcon name="caret-right" size={20} /></button>
          </div>
        )}
      </div>
    </main>
  );
};

type ThemeColors = ReturnType<typeof getThemeColors>;

const CheckInCalendar: React.FC<{ month: Date; items: CheckInDto[]; itemsByDate: Map<string, CheckInDto[]>; selectedDate: string; colors: ThemeColors; onMonthChange: (offset: number) => void; onSelectDate: (key: string) => void }> = ({ month, items, itemsByDate, selectedDate, colors, onMonthChange, onSelectDate }) => {
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (month.getDay() + 6) % 7;
  const uniqueShops = new Set(items.map(item => item.shop?.slug ?? item.id)).size;
  return (
    <section className="mb-1 rounded-[28px] border p-4 sm:p-6" style={{ borderColor: colors.border, background: colors.surface }}>
      <div className="mb-4 grid grid-cols-[44px_1fr_44px] items-center">
        <button type="button" onClick={() => onMonthChange(-1)} aria-label="Предыдущий месяц" className="flex h-11 w-11 items-center justify-center"><AppIcon name="chevron_left" size={26} color={colors.textPrimary} /></button>
        <div className="text-center"><h2 className="text-xl font-extrabold" style={{ color: colors.textPrimary }}>{month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</h2><p className="mt-0.5 text-sm" style={{ color: colors.textSecondary }}>{items.length} чекинов · {uniqueShops} кофеен</p></div>
        <button type="button" onClick={() => onMonthChange(1)} aria-label="Следующий месяц" className="flex h-11 w-11 items-center justify-center"><AppIcon name="chevron_right" size={26} color={colors.textSecondary} /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs" style={{ color: colors.textSecondary }}>{WEEKDAYS.map((day, index) => <span key={`${day}-${index}`} className="py-2">{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
          const checkIns = itemsByDate.get(key) ?? [];
          const selected = selectedDate === key;
          return (
            <button key={key} type="button" onClick={() => onSelectDate(key)} aria-label={`${day}, чекинов: ${checkIns.length}`} aria-pressed={selected} className="relative flex min-h-[62px] flex-col items-center justify-center overflow-hidden rounded-2xl border" style={{ borderColor: selected ? COLORS.primary : 'transparent', background: selected ? `${COLORS.primary}12` : 'transparent', color: colors.textPrimary }}>
              <span className="text-sm">{day}</span>
              {checkIns.length > 0 && <span className="mt-1 flex -space-x-2">{checkIns.slice(0, 2).map(item => {
                return <span key={item.id} className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border" style={{ borderColor: colors.surface, background: '#1A1412' }}><img src="/maskot-props/maskot-wthi-cup.png" alt="" className="h-10 w-10 max-w-none object-cover" /></span>;
              })}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default CheckInsPage;
