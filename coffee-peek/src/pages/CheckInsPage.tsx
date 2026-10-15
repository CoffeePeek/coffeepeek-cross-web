import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getBrewMethods, getCheckIns, getCheckInsByDateRange, type CheckInDto } from '../api/coffeeshop';
import { getHomeCalendar, getHomeCheckIns, type HomeCheckIn } from '../api/homeCheckIns';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../constants/colors';
import { usePageTitle } from '../hooks/usePageTitle';
import { getErrorMessage } from '../utils/errorHandler';
import { savedDrinkName } from '../utils/consumedDrinks';
import CheckInCard from '../components/CheckInCard';
import HomeCheckInCard from '../components/HomeCheckInCard';
import CheckInDrinkPhoto from '../components/CheckInDrinkPhoto';
import { brewMethodName } from '../utils/brewMethodName';
import { AppIcon } from '../components/icons';

type Entry = { kind: 'Shop'; value: CheckInDto } | { kind: 'Home'; value: HomeCheckIn };
type Segment = 'all' | 'shop' | 'home';
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const itemTime = (entry: Entry) => new Date(entry.kind === 'Shop' ? entry.value.visitedAt || entry.value.createdAtUtc : entry.value.preparedAtUtc || entry.value.preparedAt || `${entry.value.preparedOn}T12:00:00`);
const localKey = (entry: Entry) => entry.kind === 'Home' ? entry.value.preparedOn || dateKey(itemTime(entry)) : dateKey(itemTime(entry));
const combine = (shops: CheckInDto[], homes: HomeCheckIn[]): Entry[] => [
  ...shops.map(value => ({ kind: 'Shop' as const, value })), ...homes.map(value => ({ kind: 'Home' as const, value })),
].sort((a, b) => itemTime(b).getTime() - itemTime(a).getTime());

export default function CheckInsPage() {
  usePageTitle('Чекины');
  const navigate = useNavigate();
  const { user } = useUser();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [segment, setSegment] = useState<Segment>('all');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState('');
  const [opened, setOpened] = useState<Entry | null>(null);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const from = dateKey(first), to = dateKey(last);
  const scope = user?.id;
  const shopPages = useInfiniteQuery({ queryKey: ['checkIns', 'mineCombined', scope], initialPageParam: 1,
    queryFn: ({ pageParam }) => getCheckIns(pageParam, 20).then(r => r.data), getNextPageParam: (page, pages) => pages.length * 20 < page.totalCount ? pages.length + 1 : undefined, enabled: !!scope });
  const homePages = useInfiniteQuery({ queryKey: ['homeCheckIns', 'mine', scope], initialPageParam: 1,
    queryFn: ({ pageParam }) => getHomeCheckIns(pageParam, 20), getNextPageParam: (page, pages) => pages.length * 20 < page.totalCount ? pages.length + 1 : undefined, enabled: !!scope });
  const shopMonth = useQuery({ queryKey: ['checkIns', 'month', scope, from], queryFn: () => getCheckInsByDateRange({ from: first.toISOString(), to: next.toISOString() }), enabled: !!scope });
  const homeMonth = useQuery({ queryKey: ['homeCheckIns', 'month', scope, from], queryFn: async () => {
    const start = await getHomeCheckIns(1, 100, { from, to });
    const pages = await Promise.all(Array.from({ length: Math.max(0, Math.ceil(start.totalCount / 100) - 1) }, (_, index) => getHomeCheckIns(index + 2, 100, { from, to })));
    return [start, ...pages].flatMap(page => page.items);
  }, enabled: !!scope });
  const homeCalendar = useQuery({ queryKey: ['homeCheckIns', 'calendar', scope, from], queryFn: () => getHomeCalendar(from, to), enabled: !!scope });
  const methods = useQuery({ queryKey: ['brewMethods'], queryFn: () => getBrewMethods().then(response => response.data) });
  const monthEntries = useMemo(() => combine(shopMonth.data || [], homeMonth.data || []), [shopMonth.data, homeMonth.data]);
  const visibleEntries = useMemo(() => {
    const source = selected ? monthEntries : combine(shopPages.data?.pages.flatMap(page => page.items) || [], homePages.data?.pages.flatMap(page => page.items) || []);
    return source.filter(entry => (!selected || localKey(entry) === selected) && (segment === 'all' || (segment === 'shop' ? entry.kind === 'Shop' : entry.kind === 'Home')));
  }, [selected, monthEntries, shopPages.data, homePages.data, segment]);
  const days = useMemo(() => {
    const result = new Map<string, { shop: number; home: number }>();
    for (const entry of monthEntries) { const day = localKey(entry); const count = result.get(day) || { shop: 0, home: 0 }; count[entry.kind === 'Shop' ? 'shop' : 'home']++; result.set(day, count); }
    for (const day of homeCalendar.data || []) { const count = result.get(day.preparedOn) || { shop: 0, home: 0 }; count.home = Math.max(count.home, day.brewCount); result.set(day.preparedOn, count); }
    return result;
  }, [monthEntries, homeCalendar.data]);
  const groups = useMemo(() => {
    const result = new Map<string, Entry[]>();
    for (const entry of visibleEntries) { const day = localKey(entry); result.set(day, [...(result.get(day) || []), entry]); }
    return [...result.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [visibleEntries]);
  const loading = shopPages.isLoading || homePages.isLoading || (selected && (shopMonth.isLoading || homeMonth.isLoading));
  const failure = shopPages.error || homePages.error || shopMonth.error || homeMonth.error || homeCalendar.error;
  const loadMore = () => void Promise.all([shopPages.hasNextPage ? shopPages.fetchNextPage() : Promise.resolve(), homePages.hasNextPage ? homePages.fetchNextPage() : Promise.resolve()]);
  const changeMonth = (offset: number) => { setMonth(value => new Date(value.getFullYear(), value.getMonth() + offset, 1)); setSelected(''); };
  return <main className="min-h-screen px-4 pb-32 pt-6 sm:px-6" style={{ background: colors.background, color: colors.textPrimary }}><div className="mx-auto max-w-[760px]">
    <header className="mb-5 grid grid-cols-[44px_1fr_44px] items-center">
      <button type="button" onClick={() => navigate('/profile')} aria-label="Назад" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border p-0 shadow-sm" style={{ borderColor: colors.border, color: colors.textPrimary, background: colors.surface }}>
        <AppIcon name="chevron_left" size={20} />
      </button>
      <h1 className="text-center text-2xl font-bold">Чекины</h1>
    </header>
    <div role="tablist" aria-label="Вид чекинов" className="mb-4 grid grid-cols-3 rounded-full p-1" style={{ background: theme === 'dark' ? '#3D2F28' : '#F1F1F3' }}>{([['all', 'Все'], ['shop', 'В кофейне'], ['home', 'Дома']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={segment === value} onClick={() => setSegment(value)} className="min-h-11 rounded-full px-1 text-sm" style={{ background: segment === value ? colors.surface : 'transparent', border: segment === value ? `1px solid ${colors.border}` : '1px solid transparent', boxShadow: segment === value ? '0 2px 5px rgba(0,0,0,.08)' : 'none', color: segment === value ? colors.textPrimary : colors.textSecondary }}>{label}</button>)}</div>
    <section className="rounded-[24px] border p-4" style={{ borderColor: colors.border, background: colors.surface }} aria-label="Календарь чекинов">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</h2>
        <div className="flex shrink-0 gap-1">
          <button type="button" aria-label="Предыдущий месяц" onClick={() => changeMonth(-1)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0" style={{ background: colors.background }}>
            <AppIcon name="chevron_left" size={20} />
          </button>
          <button type="button" aria-label="Следующий месяц" disabled={next > new Date()} onClick={() => changeMonth(1)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 disabled:opacity-30" style={{ background: colors.background }}>
            <AppIcon name="chevron_right" size={20} />
          </button>
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between text-sm"><p style={{ color: colors.textSecondary }}>{[...days.values()].reduce((sum, day) => sum + (segment === 'shop' ? day.shop : segment === 'home' ? day.home : day.shop + day.home), 0)} чекинов · {[...days.values()].reduce((sum, day) => sum + day.home, 0)} дома</p><button type="button" onClick={() => { setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelected(dateKey(new Date())); }} className="min-h-11 px-2 font-semibold text-[#D7A900]">Сегодня</button></div>
      <div className="grid grid-cols-7 border-b pb-1 text-center text-xs" style={{ color: colors.textSecondary, borderColor: colors.border }}>{weekdays.map((day, index) => <span key={index} className="py-2">{day}</span>)}</div><div className="mt-2 grid grid-cols-7 gap-1">{Array.from({ length: (first.getDay() + 6) % 7 }, (_, index) => <span key={`pad-${index}`} />)}{Array.from({ length: last.getDate() }, (_, index) => { const day = index + 1; const date = dateKey(new Date(month.getFullYear(), month.getMonth(), day)); const count = days.get(date); const amount = segment === 'shop' ? count?.shop || 0 : segment === 'home' ? count?.home || 0 : (count?.shop || 0) + (count?.home || 0); return <button key={date} type="button" disabled={date > dateKey(new Date())} aria-label={`${date}, чекинов: ${amount}`} aria-pressed={selected === date} onClick={() => setSelected(value => value === date ? '' : date)} className="flex min-h-14 min-w-0 flex-col items-center justify-center rounded-full p-0 text-sm disabled:opacity-30" style={{ outline: selected === date ? '1px solid #EAB308' : 'none', outlineOffset: '-5px', background: selected === date ? '#EAB3080D' : 'transparent' }}>{day}<span className="flex h-2 gap-0.5">{Array.from({ length: Math.min(3, amount) }, (_, point) => <i key={point} className="h-1.5 w-1.5 rounded-full bg-[#EAB308]" />)}</span></button>; })}</div>
      {selected && <button type="button" onClick={() => setSelected('')} className="mt-2 min-h-11 px-2 text-sm underline">Показать все даты</button>}
    </section>
    {loading && <p className="py-8 text-center">Загрузка чекинов…</p>}
    {failure && <div role="alert" className="mt-4 text-red-500">{getErrorMessage(failure)} <button type="button" className="min-h-11 underline" onClick={() => void Promise.all([shopPages.refetch(), homePages.refetch(), shopMonth.refetch(), homeMonth.refetch(), homeCalendar.refetch()])}>Попробовать снова</button></div>}
    {!loading && !failure && !groups.length && <p className="py-10 text-center">{selected ? 'В этот день чекинов не было' : 'Пока нет чекинов'}</p>}
    <div className="mt-5 space-y-6">{groups.map(([day, entries]) => <section key={day}>
      <h2 className="mb-3 text-lg font-bold">{new Date(`${day}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
      <div className="space-y-3 border-r-2 pr-3" style={{ borderColor: colors.border }}>
        {entries.map(entry => {
          const item = entry.value;
          const home = entry.kind === 'Home';
          const recipe = home ? item as HomeCheckIn : null;
          const photo = !home ? (item as CheckInDto).drinkPhotoUrl || (item.photos || [])[0]?.url : undefined;
          const homeStatus = recipe?.visibility === 'Private' ? 'Скрытый' : recipe?.moderationState === 'Approved' ? 'Виден всем' : recipe?.moderationState === 'Rejected' ? 'Отклонён' : 'На модерации';
          const method = brewMethodName(recipe?.brewMethodCode || recipe?.home?.brewMethodCode, methods.data);
          const dose = recipe?.doseGrams ?? recipe?.home?.doseGrams;
          const score = recipe?.tasteScore ?? recipe?.home?.tasteScore;
          return <button type="button" key={`${entry.kind}-${item.id}`} onClick={() => setOpened(entry)} className="relative flex min-h-24 w-full items-start gap-3 rounded-[20px] border p-[18px] text-left" style={{ background: colors.surface, borderColor: colors.border }}>
            <span className="absolute -right-[20px] top-6 h-3 w-3 rounded-full border-2" style={{ background: home ? '#EAB308' : colors.textSecondary, borderColor: colors.surface }} />
            {!home && (photo ? <CheckInDrinkPhoto url={photo} alt="Миниатюра чекина" thumbnail crop={!(item as CheckInDto).drinkPhotoUrl} /> : <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#EAB308]/10 text-[#B88600]"><AppIcon name="coffee" size={24} /></span>)}
            <span className="min-w-0 flex-1">
              <span className="block text-sm" style={{ color: colors.textSecondary }}>{home ? '☕ Дома' : '⌖ В кофейне'} · {itemTime(entry).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}{home && <span className="ml-3 text-xs">{homeStatus}</span>}</span>
              <span className="mt-2 block truncate font-bold">{home ? recipe?.beanName || recipe?.home?.beanName || 'Кофе дома' : (item as CheckInDto).shopName}</span>
              {home ? <><span className="mt-1 block text-sm" style={{ color: colors.textSecondary }}>{[method, dose != null ? `${dose} г` : ''].filter(Boolean).join(' · ')}</span><span className="mt-1 block text-sm"><span className="text-[#EAB308]">★</span> {score || '—'}/5</span></> : <span className="mt-1 block text-sm text-[#D7A900]">{savedDrinkName(item as CheckInDto)}</span>}
              {item.text && <span className="mt-2 line-clamp-2 text-sm" style={{ color: colors.textSecondary }}>{item.text}</span>}
            </span>
          </button>;
        })}
      </div>
    </section>)}</div>
    {!selected && (shopPages.hasNextPage || homePages.hasNextPage) && <button type="button" onClick={loadMore} disabled={shopPages.isFetchingNextPage || homePages.isFetchingNextPage} className="mt-6 min-h-11 w-full rounded-full border font-bold" style={{ borderColor: colors.border }}>Показать ещё</button>}
    {opened?.kind === 'Home' && <HomeCheckInCard item={opened.value} own detailOnly onDetailClose={() => setOpened(null)} />}
    {opened?.kind === 'Shop' && <div role="presentation" className="fixed inset-0 z-[1350] flex items-end justify-center bg-black/55 sm:items-center" onMouseDown={event => { if (event.target === event.currentTarget) setOpened(null); }}><section role="dialog" aria-modal="true" aria-label="Чекин в кофейне" className="max-h-[90dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] p-4 sm:rounded-[28px]" style={{ background: colors.surface }}><button type="button" aria-label="Закрыть" onClick={() => setOpened(null)} className="float-right flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0"><AppIcon name="close" size={20} /></button><CheckInCard item={opened.value} own /><button type="button" onClick={() => { if (opened.value.shop?.canonicalPath) navigate(opened.value.shop.canonicalPath); }} className="mt-3 min-h-11 w-full rounded-full bg-[#EAB308] font-bold text-[#1A1412]">Открыть кофейню</button></section></div>}
  </div></main>;
}
