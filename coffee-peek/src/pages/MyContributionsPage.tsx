import React from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import {
  getMyContributions, type ContributionKind, type ContributionPage, type ModerationStatus,
} from '../api/myContributions';
import { ListSkeleton } from '../components/skeletons';
import { useTheme } from '../contexts/ThemeContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { getErrorMessage } from '../utils/errorHandler';
import { AppIcon } from '../components/icons';
import { SHOP_CHANGE_ICONS } from '../components/icons/iconMap';

const KINDS: Record<ContributionKind, { title: string; empty: string; icon: string }> = {
  shops: { title: 'Мои кофейни', empty: 'Вы ещё не добавляли кофейни.', icon: 'coffee' },
  roasters: { title: 'Мои обжарщики', empty: 'Вы ещё не добавляли обжарщиков.', icon: 'coffee-bean' },
  edits: { title: 'Мои правки кофеен', empty: 'Вы ещё не предлагали изменений.', icon: 'note-pencil' },
};

const TABS: { status: ModerationStatus; label: string; color: string }[] = [
  { status: 'Approved', label: 'Опубликовано', color: '#22C55E' },
  { status: 'Pending', label: 'На модерации', color: '#EAB308' },
  { status: 'Rejected', label: 'Отклонено', color: '#EF4444' },
];

const PAGE_SIZE = 20;

const MyContributionsPage: React.FC = () => {
  const { kind = '' } = useParams<{ kind: string }>();
  const isKnownKind = kind in KINDS;
  const config = KINDS[kind as ContributionKind];
  usePageTitle(config?.title ?? 'Мой вклад');
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#171210' : '#F5F4F2', surface: isDark ? '#2B211C' : '#FFFFFF',
    border: isDark ? '#46362F' : '#E7E5E4', text: isDark ? '#FFFFFF' : '#1C1917',
    muted: isDark ? '#A39E93' : '#78716C', gold: '#EAB308',
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('status');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  // ponytail: one query per status gives both tab counts and the list; 3 requests per view.
  const results = useQueries({
    queries: TABS.map(({ status }) => {
      const statusPage = status === requested ? page : 1;
      return {
        queryKey: ['my-contributions', kind, status, statusPage],
        queryFn: () => getMyContributions(kind as ContributionKind, { status, page: statusPage, pageSize: PAGE_SIZE }),
        enabled: isKnownKind,
        staleTime: 0,
        // Keep the list on screen while paging, but never show another kind's items.
        placeholderData: (previous: ContributionPage | undefined, previousQuery?: { queryKey: readonly unknown[] }) =>
          previousQuery?.queryKey[1] === kind ? previous : undefined,
      };
    }),
  });

  if (!isKnownKind) return <Navigate to="/profile" replace />;

  const isLoading = results.some(result => result.isLoading);
  const error = results.find(result => result.error)?.error;
  const visibleTabs = TABS.filter((_, index) => (results[index].data?.totalItems ?? 0) > 0);
  const activeTab = visibleTabs.find(tab => tab.status === requested) ?? visibleTabs[0];
  const current = activeTab ? results[TABS.indexOf(activeTab)].data : undefined;
  const currentPage = activeTab?.status === requested ? page : 1;

  const select = (status: ModerationStatus, nextPage = 1) => setSearchParams({ status, page: String(nextPage) }, { replace: true });

  return (
    <main className="min-h-screen px-5 pb-12 pt-8 sm:px-8" style={{ background: colors.bg }}>
      <div className="mx-auto w-full max-w-[680px]">
        <h1 className="mb-5 text-[26px] font-extrabold sm:text-3xl" style={{ color: colors.text }}>{config.title}</h1>

        {isLoading ? <ListSkeleton count={3} showAvatar={false} /> : error ? (
          <div className="rounded-2xl border p-5 text-center" style={{ borderColor: colors.border, background: colors.surface }}>
            <p className="mb-4 text-sm text-red-500">{getErrorMessage(error)}</p>
            <button type="button" onClick={() => results.forEach(result => void result.refetch())} className="min-h-11 rounded-xl px-4 font-bold" style={{ background: colors.gold, color: '#1A1412' }}>Повторить</button>
          </div>
        ) : !activeTab ? (
          <p className="rounded-2xl border p-5 text-center text-sm" style={{ borderColor: colors.border, background: colors.surface, color: colors.muted }}>{config.empty}</p>
        ) : (
          <>
            <div role="tablist" aria-label="Статус модерации" className="mb-4 flex gap-2 overflow-x-auto">
              {visibleTabs.map(tab => {
                const active = tab === activeTab;
                return (
                  <button key={tab.status} type="button" role="tab" aria-selected={active} onClick={() => select(tab.status)}
                    className="min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold"
                    style={{ borderColor: active ? colors.gold : colors.border, background: active ? colors.gold : colors.surface, color: active ? '#1A1412' : colors.text }}>
                    {tab.label} · {results[TABS.indexOf(tab)].data?.totalItems}
                  </button>
                );
              })}
            </div>


            <ul role="tabpanel" className="space-y-3">
              {current?.items.map(item => (
                <li key={item.id} className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: colors.border, background: colors.surface }}>
                  <div className="flex items-start justify-between gap-3">
                    <AppIcon name={item.section && Object.hasOwn(SHOP_CHANGE_ICONS, item.section) ? SHOP_CHANGE_ICONS[item.section] : config.icon} size={22} color={colors.gold} />
                    <div className="min-w-0 flex-1">
                      {item.link
                        ? <Link to={item.link} className="font-bold hover:underline" style={{ color: colors.text }}>{item.title}</Link>
                        : <p className="font-bold" style={{ color: colors.text }}>{item.title}</p>}
                      {item.subtitle && <p className="mt-1 line-clamp-2 text-sm" style={{ color: colors.muted }}>{item.subtitle}</p>}
                      {kind === 'shops' && item.status === 'Approved' && !item.link && <p className="mt-1 text-sm" style={{ color: colors.muted }}>Ссылка пока недоступна</p>}
                      {item.date && <p className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: colors.muted }}><AppIcon name="calendar-blank" size={14} />{new Date(item.date).toLocaleDateString('ru-RU')}</p>}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold" style={{ color: activeTab.color, background: `${activeTab.color}22` }}><AppIcon name={activeTab.status === 'Pending' ? 'clock' : activeTab.status === 'Approved' ? 'check' : 'warning-circle'} size={14} />{activeTab.label}</span>
                  </div>
                  {item.reason && <p className="mt-3 rounded-xl p-3 text-sm text-red-500" style={{ background: 'rgba(239,68,68,.1)' }}>Причина: {item.reason}</p>}
                </li>
              ))}
            </ul>

            {(current?.totalPages ?? 0) > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3" style={{ color: colors.text }}>
                <button type="button" disabled={currentPage <= 1} onClick={() => select(activeTab.status, currentPage - 1)} className="min-h-11 rounded-xl border px-4 disabled:opacity-40" style={{ borderColor: colors.border }} aria-label="Предыдущая страница"><AppIcon name="caret-left" size={20} /></button>
                <span>{currentPage} / {current?.totalPages}</span>
                <button type="button" disabled={currentPage >= (current?.totalPages ?? 1)} onClick={() => select(activeTab.status, currentPage + 1)} className="min-h-11 rounded-xl border px-4 disabled:opacity-40" style={{ borderColor: colors.border }} aria-label="Следующая страница"><AppIcon name="caret-right" size={20} /></button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default MyContributionsPage;
