import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AppWindow, BookOpen, ChevronDown, ChevronLeft, CircleGauge, Coffee,
  Flag, History, LogOut, Map, MessageSquareText, Tags, Trophy, Upload, UserRound, Users,
} from 'lucide-react';
import { getModerationInsights, type AdminModerationQueueName } from '../../api/admin';
import { getImportStats } from '../../api/import';
import { useUser } from '../../contexts/UserContext';
import { cn } from '../../lib/utils';
import LogoMark from '../LogoMark';
import { Button } from '../ui/Button';

type Icon = ComponentType<{ className?: string }>;

interface NavItem {
  path: string;
  label: string;
  icon: Icon;
  adminOnly?: boolean;
  moderatorOnly?: boolean;
  ownerOnly?: boolean;
  browseOnly?: boolean;
}

interface NavSection {
  id: string;
  label: string;
  collapsible?: boolean;
  items: NavItem[];
}

const DASHBOARD: NavItem = { path: '/dashboard', label: 'Обзор', icon: CircleGauge };
const NAV_SECTIONS: NavSection[] = [
  { id: 'browse', label: 'Поиск', items: [
    { path: '/coffee-shops', label: 'Кофейни', icon: Coffee, browseOnly: true },
    { path: '/map', label: 'Карта', icon: Map, browseOnly: true },
  ] },
  { id: 'moderation', label: 'Модерация', collapsible: true, items: [
    { path: '/shops', label: 'Заявки на кофейни', icon: Coffee, moderatorOnly: true },
    { path: '/shop-change-requests', label: 'Правки кофеен', icon: History, moderatorOnly: true },
    { path: '/roasters', label: 'Заявки на обжарщиков', icon: Coffee, moderatorOnly: true },
    { path: '/check-ins', label: 'Проверка чекинов', icon: MessageSquareText, moderatorOnly: true },
    { path: '/check-in-reports', label: 'Жалобы на чекины', icon: Flag, adminOnly: true },
    { path: '/shop-reports', label: 'Ошибки в данных', icon: Flag, moderatorOnly: true },
  ] },
  { id: 'catalog', label: 'Каталог', collapsible: true, items: [
    { path: '/published-shops', label: 'Кофейни', icon: Coffee, adminOnly: true },
    { path: '/coffees', label: 'Кофе', icon: Coffee, moderatorOnly: true },
    { path: '/coffee-zones', label: 'Кофейные зоны', icon: Map, moderatorOnly: true },
    { path: '/my-shops', label: 'Мои кофейни', icon: Coffee, ownerOnly: true },
  ] },
  { id: 'catalog-settings', label: 'Настройки каталога', collapsible: true, items: [
    { path: '/catalogs', label: 'Справочники', icon: BookOpen, adminOnly: true },
    { path: '/shop-tags', label: 'Теги кофеен', icon: Tags, adminOnly: true },
    { path: '/roaster-tags', label: 'Теги обжарщиков', icon: Tags, moderatorOnly: true },
    { path: '/coffee-filter-values', label: 'Характеристики кофе', icon: Tags, moderatorOnly: true },
  ] },
  { id: 'import', label: 'Импорт', collapsible: true, items: [
    { path: '/import', label: 'Импорт кофеен', icon: Upload, moderatorOnly: true },
    { path: '/coffee-import', label: 'Импорт кофе', icon: Upload, moderatorOnly: true },
  ] },
  { id: 'people', label: 'Пользователи и доступ', collapsible: true, items: [
    { path: '/users', label: 'Пользователи', icon: Users, moderatorOnly: true },
    { path: '/ownership-claims', label: 'Заявки на владение', icon: Users, adminOnly: true },
    { path: '/ownership-changes', label: 'История доступа', icon: History, adminOnly: true },
    { path: '/leaderboard', label: 'Рейтинг активности', icon: Trophy, moderatorOnly: true },
  ] },
  { id: 'system', label: 'Система', collapsible: true, items: [
    { path: '/notifications', label: 'Уведомления', icon: MessageSquareText, adminOnly: true },
    { path: '/app-distribution', label: 'Релизы приложений', icon: AppWindow, adminOnly: true },
    { path: '/audit', label: 'Журнал модерации', icon: History, adminOnly: true },
  ] },
];

const pathActive = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`);

const QUEUE_PATHS: Record<AdminModerationQueueName, string> = {
  shops: '/shops',
  checkIns: '/check-ins',
  roasters: '/roasters',
  changeRequests: '/shop-change-requests',
  issueReports: '/shop-reports',
};
const BADGE_POLL_MS = 60_000;

/** Pending counts per nav path. Query keys are shared with the dashboard and import stats pages. */
function useNavBadges(isModerator: boolean): Record<string, number> {
  const moderation = useQuery({
    queryKey: ['admin', 'stats', 'moderation-insights'],
    queryFn: () => getModerationInsights().then((r) => r.data),
    enabled: isModerator,
    refetchInterval: BADGE_POLL_MS,
  });
  const importStats = useQuery({
    queryKey: ['admin', 'import', 'stats'],
    queryFn: () => getImportStats().then((r) => r.data),
    enabled: isModerator,
    refetchInterval: BADGE_POLL_MS,
  });
  return useMemo(() => {
    const counts: Record<string, number> = {};
    for (const { queue, pending } of moderation.data?.queues ?? []) {
      if (QUEUE_PATHS[queue]) counts[QUEUE_PATHS[queue]] = pending;
    }
    if (importStats.data) counts['/import'] = importStats.data.pending + importStats.data.pendingDuplicates;
    return counts;
  }, [moderation.data, importStats.data]);
}

const CountBadge = ({ count }: { count: number }) => (
  <span className="ml-auto inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold tabular-nums text-white">
    {count > 99 ? '99+' : count}
  </span>
);

function canSee(item: NavItem, roles: { isAdmin: boolean; isModerator: boolean; isOwner: boolean }) {
  if (item.adminOnly) return roles.isAdmin;
  if (item.moderatorOnly) return roles.isModerator;
  if (item.ownerOnly) return roles.isOwner;
  if (item.browseOnly) return !roles.isAdmin && !roles.isModerator;
  return true;
}

function roleLabel(roles: string[]) {
  if (roles.includes('Admin')) return 'Администратор';
  if (roles.includes('Moderator')) return 'Модератор';
  if (roles.includes('Owner')) return 'Владелец';
  return roles[0] ?? 'Пользователь';
}

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  isDesktop: boolean;
  onNavigate: () => void;
  onToggle: () => void;
}

export const Sidebar = ({ collapsed, mobileOpen, isDesktop, onNavigate, onToggle }: SidebarProps) => {
  const { user, isAdmin, isModerator, isOwner, logout } = useUser();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>('moderation');
  const showLabels = !collapsed || mobileOpen;
  const roles = useMemo(() => ({ isAdmin, isModerator, isOwner }), [isAdmin, isModerator, isOwner]);
  const badges = useNavBadges(isModerator);
  const visibleSections = useMemo(
    () => NAV_SECTIONS.map((section) => ({ ...section, items: section.items.filter((item) => canSee(item, roles)) }))
      .filter((section) => section.items.length),
    [roles],
  );

  useEffect(() => {
    const active = visibleSections.find((section) => section.items.some((item) => pathActive(pathname, item.path)));
    if (active) setOpenSection(active.id);
  }, [pathname, visibleSections]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } finally { navigate('/login'); }
  };

  const renderLink = (item: NavItem) => {
    const Icon = item.icon;
    const count = badges[item.path] ?? 0;
    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={onNavigate}
        title={count > 0 ? `${item.label} (${count})` : item.label}
        className={({ isActive }) => cn(
          'group relative flex h-9 items-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          showLabels ? 'gap-3 px-3' : 'mx-auto w-9 justify-center',
          isActive || pathActive(pathname, item.path)
            ? 'bg-primary text-stone-950 shadow-sm'
            : 'text-stone-400 hover:bg-white/10 hover:text-white',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {showLabels && <span className="truncate">{item.label}</span>}
        {count > 0 && (showLabels
          ? <CountBadge count={count} />
          : <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" aria-hidden />)}
      </NavLink>
    );
  };

  return (
    <aside id="admin-sidebar" inert={!isDesktop && !mobileOpen} className={cn(
      'fixed inset-y-0 left-0 z-50 flex w-[min(272px,88vw)] flex-col border-r border-white/10 bg-stone-950 text-white shadow-xl transition-transform duration-200 motion-reduce:transition-none lg:static lg:z-auto lg:translate-x-0 lg:transition-[width]',
      mobileOpen ? 'translate-x-0' : '-translate-x-full',
      collapsed ? 'lg:w-16' : 'lg:w-64',
    )}>
      <div className={cn('flex h-16 shrink-0 items-center border-b border-white/10', showLabels ? 'gap-3 px-4' : 'justify-center px-2')}>
        <LogoMark size={34} variant="dark" className="rounded-full ring-1 ring-white/10" />
        {showLabels && <div className="min-w-0 flex-1"><p className="truncate font-display text-sm font-semibold">CoffeePeek</p><p className="text-xs text-stone-400">Admin Console</p></div>}
        {showLabels && <Button variant="ghost" size="icon" className="hidden text-stone-400 hover:bg-white/10 hover:text-white lg:inline-flex" onClick={onToggle} aria-label="Свернуть меню"><ChevronLeft className="h-4 w-4" /></Button>}
      </div>

      <nav className={cn('flex-1 space-y-4 overflow-y-auto py-4', showLabels ? 'px-3' : 'px-2')} aria-label="Основная навигация">
        {renderLink(DASHBOARD)}
        {visibleSections.map((section) => {
          const open = !section.collapsible || !showLabels || openSection === section.id;
          // Collapsed section hides its items, so surface their total on the header.
          const hiddenCount = open ? 0 : section.items.reduce((sum, item) => sum + (badges[item.path] ?? 0), 0);
          return (
            <section key={section.id}>
              {showLabels && (section.collapsible ? (
                <button type="button" className="mb-1 flex h-8 w-full items-center justify-between gap-2 rounded-md px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400 hover:text-stone-200" onClick={() => setOpenSection(open ? null : section.id)} aria-expanded={open}>
                  {section.label}
                  {hiddenCount > 0 && <CountBadge count={hiddenCount} />}
                  <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
                </button>
              ) : <h2 className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{section.label}</h2>)}
              {open && <div className="space-y-1">{section.items.map(renderLink)}</div>}
            </section>
          );
        })}
      </nav>

      <div className={cn('border-t border-white/10', showLabels ? 'p-3' : 'p-2')}>
        <div className={cn('flex items-center rounded-lg bg-white/5', showLabels ? 'gap-3 p-2' : 'justify-center p-1')}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-800 text-stone-300"><UserRound className="h-4 w-4" /></span>
          {showLabels && user && <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{user.email}</p><p className="truncate text-[11px] text-stone-400">{roleLabel(user.roles)}</p></div>}
          {showLabels && <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:bg-red-500/10 hover:text-red-300" onClick={handleLogout} disabled={loggingOut} aria-label="Выйти"><LogOut className="h-4 w-4" /></Button>}
        </div>
        {!showLabels && <Button variant="ghost" size="icon" className="mx-auto mt-2 text-stone-500 hover:bg-red-500/10 hover:text-red-300" onClick={handleLogout} disabled={loggingOut} aria-label="Выйти"><LogOut className="h-4 w-4" /></Button>}
      </div>
    </aside>
  );
};

export default Sidebar;
