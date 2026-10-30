import { Input } from '@/src/components/ui/Input';
import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Ban, Bell, LogOut, Monitor, Search, ShieldCheck, Trash2 } from 'lucide-react';
import {
  getAdminUsers,
  getUserStats,
  updateUserRole,
  deleteAdminUser,
  blockUser,
  getUserSessions,
  revokeUserSession,
  revokeAllUserSessions,
  AdminUser,
  UserRole,
  UserSession,
} from '../api/admin';
import { useToast } from '../contexts/ToastContext';
import { useUser } from '../contexts/UserContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { NativeSelect } from '../components/ui/NativeSelect';
import { LoadError } from '../components/ui/LoadError';
import { UserActionsMenu } from '../components/users/UserActionsMenu';
import { Pagination } from '../components/ui/Pagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/Dialog';
import { getErrorMessage } from '../utils/errors';

const PAGE_SIZE = 20;

const ROLES: UserRole[] = ['User', 'Moderator', 'Admin', 'Owner', 'Employee', 'Roaster'];

const ROLE_COLORS: Record<UserRole, string> = {
  User: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-stone-300',
  Moderator: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
  Admin: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300',
  Owner: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  Employee: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300',
  Roaster: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300',
};
const UserRoleBadge: React.FC<{ role: UserRole }> = ({ role }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-body ${ROLE_COLORS[role]}`}>
    {role}
  </span>
);

function formatUserDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru');
}

function UserAvatar({ user }: { user: AdminUser }) {
  return user.avatarUrl ? (
    <img src={user.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-amber-700 dark:text-primary">
      {(user.userName || user.email || '?')[0].toUpperCase()}
    </span>
  );
}

function UserRoles({ user }: { user: AdminUser }) {
  return <div className="flex flex-wrap items-center gap-1">{user.roles.length ? user.roles.map((role) => <UserRoleBadge key={role} role={role} />) : <span className="text-xs text-text-muted">Без роли</span>}</div>;
}

function formatSessionDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ru');
}

const SESSION_BADGES = {
  revoked: { label: 'Отозвана', variant: 'rejected' },
  expired: { label: 'Истекла', variant: 'default' },
  valid: { label: 'Действует', variant: 'approved' },
  unknown: { label: 'Срок неизвестен', variant: 'pending' },
} as const;

function sessionStatus(session: UserSession, now: number): keyof typeof SESSION_BADGES {
  if (session.isRevoked) return 'revoked';
  const expiresAt = Date.parse(session.expiryDate);
  if (Number.isNaN(expiresAt)) return 'unknown';
  return expiresAt <= now ? 'expired' : 'valid';
}

const UserSessionsPanel: React.FC<{ user: AdminUser }> = ({ user }) => {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [confirmSessionId, setConfirmSessionId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const { data: sessions, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'users', user.id, 'sessions'],
    queryFn: () => getUserSessions(user.id).then((r) => r.data ?? []),
  });

  const revokeOneMutation = useMutation({
    mutationFn: (sessionId: string) => revokeUserSession(user.id, sessionId),
    onSuccess: () => {
      showToast('Сессия отозвана', 'success');
      setRevokingSessionId(null);
      qc.invalidateQueries({ queryKey: ['admin', 'users', user.id, 'sessions'] });
    },
    onError: (err) => {
      setRevokingSessionId(null);
      showToast(getErrorMessage(err, 'Ошибка'), 'error');
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => revokeAllUserSessions(user.id),
    onSuccess: () => {
      showToast('Все сессии отозваны', 'success');
      setConfirmRevokeAll(false);
      qc.invalidateQueries({ queryKey: ['admin', 'users', user.id, 'sessions'] });
    },
    onError: (err) => showToast(getErrorMessage(err, 'Ошибка'), 'error'),
  });

  const list: UserSession[] = sessions ?? [];
  const canRevoke = (session: UserSession) => {
    const status = sessionStatus(session, now);
    return status === 'valid' || status === 'unknown';
  };

  return (
    <>
      <div id={`user-sessions-${user.id}`} className="space-y-4 p-3 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold text-text-main dark:text-white">Сессии пользователя</h3>
            <p className="break-all font-body text-xs text-text-muted dark:text-stone-400">{user.email}</p>
          </div>
          <Button
            variant="danger"
            size="sm"
            disabled={!list.some(canRevoke) || revokeAllMutation.isPending}
            onClick={() => setConfirmRevokeAll(true)}
          >
            Отозвать все
          </Button>
        </div>

        {isLoading ? (
          <p className="py-4 text-sm text-text-muted">Загрузка сессий…</p>
        ) : isError ? (
          <p className="py-4 text-sm text-red-500">{getErrorMessage(error, 'Не удалось загрузить сессии')}</p>
        ) : list.length === 0 ? (
          <p className="py-4 text-sm text-text-muted">Сессий нет</p>
        ) : (
          <div className="space-y-2">
            {list.map((session) => {
              const status = sessionStatus(session, now);
              return <div key={session.id} className="grid min-w-0 gap-3 rounded-lg border border-border-light bg-white p-3 font-body text-sm dark:border-border-dark dark:bg-surface-dark sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
                <div className="min-w-0 sm:col-span-2 xl:col-span-1">
                  <p className="mb-1 text-xs text-text-muted dark:text-stone-400">Устройство</p>
                  <p className="break-all text-text-main dark:text-white">{session.deviceName || 'Неизвестное устройство'}</p>
                </div>
                <div className="min-w-0">
                  <p className="mb-1 text-xs text-text-muted dark:text-stone-400">IP</p>
                  <p className="break-all text-text-main dark:text-white">{session.ipAddress || '—'}</p>
                </div>
                <div className="min-w-0">
                  <p className="mb-1 text-xs text-text-muted dark:text-stone-400">Создана</p>
                  <p className="text-text-main dark:text-white">{session.createdAtUtc ? formatSessionDate(session.createdAtUtc) : '—'}</p>
                </div>
                <div className="min-w-0">
                  <p className="mb-1 text-xs text-text-muted dark:text-stone-400">Истекает</p>
                  <p className="text-text-main dark:text-white">{session.expiryDate ? formatSessionDate(session.expiryDate) : '—'}</p>
                </div>
                <div className="flex items-start justify-between gap-2 sm:col-span-2 xl:col-span-1 xl:flex-col xl:items-end">
                  <Badge variant={SESSION_BADGES[status].variant}>{SESSION_BADGES[status].label}</Badge>
                  {canRevoke(session) && (
                    <Button variant="ghost" size="sm" className="text-red-500" loading={revokingSessionId === session.id && revokeOneMutation.isPending} onClick={() => setConfirmSessionId(session.id)}>
                      Отозвать
                    </Button>
                  )}
                </div>
              </div>;
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmRevokeAll}
        title="Отозвать все сессии?"
        message="Пользователь будет разлогинен на всех устройствах сразу."
        confirmLabel="Отозвать все"
        variant="danger"
        onConfirm={async () => {
          await revokeAllMutation.mutateAsync();
        }}
        onCancel={() => setConfirmRevokeAll(false)}
      />

      <ConfirmDialog
        isOpen={!!confirmSessionId}
        title="Отозвать сессию?"
        message="Пользователь будет разлогинен на этом устройстве сразу, если оно подключено к realtime."
        confirmLabel="Отозвать"
        variant="danger"
        onConfirm={async () => {
          if (!confirmSessionId) return;
          setRevokingSessionId(confirmSessionId);
          await revokeOneMutation.mutateAsync(confirmSessionId);
          setConfirmSessionId(null);
        }}
        onCancel={() => setConfirmSessionId(null)}
      />
    </>
  );
};

const EditRoleModal: React.FC<{
  user: AdminUser | null;
  onSave: (userId: string, role: UserRole) => Promise<void>;
  onClose: () => void;
}> = ({ user, onSave, onClose }) => {
  const [role, setRole] = useState<UserRole>((user?.roles?.[0] as UserRole) ?? 'User');
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(user.id, role);
      onClose();
    } catch {
      // Error toast is shown by the mutation's onError.
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Изменить роль</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mb-5">
          {ROLES.map((r) => (
            <label key={r} className="flex items-center gap-3 cursor-pointer">
              <Input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                className="accent-primary"
              />
              <UserRoleBadge role={r} />
              <span className="text-sm text-text-main dark:text-stone-300 font-body">{getRoleDescription(r)}</span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading} className="w-full sm:w-auto min-h-[44px] sm:min-h-0">Отмена</Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={loading} className="w-full sm:w-auto min-h-[44px] sm:min-h-0">Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function getRoleDescription(role: UserRole): string {
  switch (role) {
    case 'User': return 'Обычный пользователь';
    case 'Moderator': return 'Модератор контента';
    case 'Admin': return 'Полный доступ';
    case 'Owner': return 'Владелец кофейни';
    case 'Employee': return 'Сотрудник кофейни';
    case 'Roaster': return 'Обжарщик';
  }
}

export const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUser();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedPage = Number(searchParams.get('page') ?? '1');
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const search = searchParams.get('search') ?? '';
  const roleFilter = (searchParams.get('role') ?? '') as UserRole | '';
  const [localSearch, setLocalSearch] = useState(search);
  const [detailsUser, setDetailsUser] = useState<AdminUser | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [sessionsUser, setSessionsUser] = useState<AdminUser | null>(null);
  const [kickingUser, setKickingUser] = useState<AdminUser | null>(null);
  const [blockingUser, setBlockingUser] = useState<AdminUser | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => setLocalSearch(search), [search]);

  const { data: stats, isError: statsError, refetch: refetchStats, isFetching: fetchingStats } = useQuery({
    queryKey: ['admin', 'users', 'stats'],
    queryFn: () => getUserStats().then((r) => r.data),
    staleTime: 1000 * 60,
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'users', { page, search, roleFilter }],
    queryFn: () =>
      getAdminUsers({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        role: roleFilter || undefined,
      }).then((r) => r.data),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => updateUserRole(id, { role }),
    onSuccess: () => {
      showToast('Роль обновлена', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => showToast(getErrorMessage(err, 'Ошибка'), 'error'),
  });

  const blockMutation = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) => blockUser(id, { blocked }),
    onSuccess: (_, { blocked }) => {
      showToast(blocked ? 'Пользователь заблокирован' : 'Пользователь разблокирован', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setBlockingUser(null);
    },
    onError: (err) => showToast(getErrorMessage(err, 'Ошибка'), 'error'),
  });

  const revokeAllMutation = useMutation({
    mutationFn: (id: string) => revokeAllUserSessions(id),
    onSuccess: () => {
      showToast('Все сессии отозваны. Пользователь будет разлогинен.', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setKickingUser(null);
      if (sessionsUser) {
        qc.invalidateQueries({ queryKey: ['admin', 'users', sessionsUser.id, 'sessions'] });
      }
    },
    onError: (err) => showToast(getErrorMessage(err, 'Ошибка'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminUser(id),
    onSuccess: () => {
      showToast('Пользователь удалён', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setDeletingUserId(null);
    },
    onError: (err) => showToast(getErrorMessage(err, 'Ошибка'), 'error'),
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSessionsUser(null);
    setSearchParams(next);
  };

  const metrics = [
    { label: 'Всего', value: stats?.totalUsers, color: '' },
    { label: 'Сегодня', value: stats?.registeredToday, color: 'text-emerald-700 dark:text-emerald-400' },
    { label: 'С доступом', value: stats?.activeUsers, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Заблокировано', value: stats?.blockedUsers, color: 'text-red-600 dark:text-red-400' },
  ];
  const roleCount = (role: UserRole | '') => role ? stats?.usersByRole?.[role] : stats?.totalUsers;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-3 sm:space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-text-main dark:text-white sm:text-2xl">Пользователи</h2>
        <p className="mt-0.5 font-body text-xs text-text-muted dark:text-stone-400 sm:text-sm">
          {isAdmin ? 'Управление пользователями и ролями' : 'Пользователи и статистика · Только чтение'}
        </p>
        <p className="mt-1 text-xs text-text-muted dark:text-stone-400">Статус показывает, разрешён ли вход в аккаунт.</p>
      </div>

      {statsError ? (
        <LoadError message="Не удалось загрузить статистику" onRetry={() => void refetchStats()} retrying={fetchingStats} />
      ) : (
        <Card>
          <dl className="grid grid-cols-2 sm:grid-cols-4">
            {metrics.map(({ label, value, color }, index) => (
              <div key={label} className={`flex min-w-0 items-center justify-between gap-2 px-3 py-2.5 sm:block sm:px-4 ${index % 2 ? 'border-l border-border-light dark:border-border-dark' : ''} ${index > 1 ? 'border-t border-border-light dark:border-border-dark sm:border-t-0 sm:border-l' : ''}`}>
                <dt className="text-xs text-text-muted dark:text-stone-400">{label}</dt>
                <dd className={`font-display text-xl font-semibold tabular-nums sm:mt-1 sm:text-2xl ${color}`}>{value?.toLocaleString('ru') ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={(event) => { event.preventDefault(); setParam('search', localSearch.trim()); }} className="flex min-w-0 flex-1 gap-1.5">
            <Input type="search" aria-label="Email или имя" value={localSearch} onChange={(event) => setLocalSearch(event.target.value)} placeholder="Email или имя" className="h-11 min-w-0 sm:h-9" />
            <Button type="submit" variant="secondary" size="icon" className="h-11 w-11 shrink-0 sm:h-9 sm:w-9" aria-label="Найти пользователей"><Search className="h-4 w-4" aria-hidden="true" /></Button>
          </form>
          <div className="w-full sm:w-52 lg:hidden">
            <NativeSelect aria-label="Фильтр по роли" value={roleFilter} onChange={(event) => setParam('role', event.target.value)} className="h-11 sm:h-9">
              {(['', ...ROLES] as const).map((role) => <option key={role || 'all'} value={role}>{role || 'Все роли'}{roleCount(role) !== undefined ? ` · ${roleCount(role)}` : ''}</option>)}
            </NativeSelect>
          </div>
          <span className="hidden text-xs tabular-nums text-text-muted dark:text-stone-400 sm:block" role="status">{data ? `Найдено: ${data.totalCount.toLocaleString('ru')}` : 'Загрузка…'}</span>
        </div>
        <div className="hidden flex-wrap gap-1.5 lg:flex" aria-label="Фильтр по роли">
          {(['', ...ROLES] as const).map((role) => (
            <Button key={role || 'all'} size="sm" variant={roleFilter === role ? 'primary' : 'secondary'} aria-pressed={roleFilter === role} onClick={() => setParam('role', role)}>
              {role || 'Все'}{roleCount(role) !== undefined && <span className="tabular-nums opacity-70">{roleCount(role)}</span>}
            </Button>
          ))}
        </div>
      </div>

      {isError ? <LoadError message={getErrorMessage(error, 'Не удалось загрузить пользователей')} onRetry={() => void refetch()} retrying={isFetching} /> : (
        <Card className="overflow-hidden">
          <div aria-hidden="true" className={`hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)] items-center gap-4 border-b border-border-light bg-stone-50 px-4 py-2 text-xs text-text-muted dark:border-border-dark dark:bg-white/[0.03] dark:text-stone-400 xl:grid ${isAdmin ? 'pr-[76px]' : ''}`}>
            <span>Пользователь</span><span>Роли и статус</span><span>Активность и регистрация</span>
          </div>
          {isLoading ? (
            <div className="space-y-3 p-3" role="status" aria-label="Загрузка пользователей">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-lg bg-stone-100 dark:bg-white/5" />)}</div>
          ) : !data?.items.length ? (
            <p className="p-8 text-center text-sm text-text-muted dark:text-stone-400">Пользователи не найдены</p>
          ) : (
            <ul aria-label="Пользователи" className="divide-y divide-border-light dark:divide-border-dark">
              {data.items.map((user) => (
                <li key={user.id} className="px-3 py-2.5 sm:px-4">
                  <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2 xl:items-center xl:gap-x-4 ${isAdmin ? 'xl:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_44px]' : 'xl:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)]'}`}>
                    <div className="flex min-w-0 items-start gap-2.5">
                      <UserAvatar user={user} />
                      <div className="min-w-0">
                        <button type="button" onClick={() => setDetailsUser(user)} className="block max-w-full rounded text-left text-sm font-semibold text-text-main underline-offset-2 [overflow-wrap:anywhere] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-white" aria-label={`Профиль: ${user.userName || user.email}`}>{user.userName || user.email}</button>
                        {user.userName && <p className="text-xs text-text-muted [overflow-wrap:anywhere] dark:text-stone-400">{user.email}</p>}
                      </div>
                    </div>
                    {isAdmin && <div className="col-start-2 row-start-1 -my-1 xl:col-start-4"><UserActionsMenu name={user.userName || user.email} actions={[
                      { label: 'Отправить уведомление', icon: Bell, onSelect: () => navigate(`/notifications?userId=${encodeURIComponent(user.id)}`) },
                      { label: 'Сессии', icon: Monitor, onSelect: () => setSessionsUser(user) },
                      { label: 'Изменить роль', icon: ShieldCheck, onSelect: () => setEditingUser(user) },
                      { label: 'Оборвать все сессии', icon: LogOut, onSelect: () => setKickingUser(user) },
                      { label: user.isBlocked ? 'Разблокировать' : 'Заблокировать', icon: Ban, onSelect: () => setBlockingUser(user) },
                      { label: 'Удалить пользователя', icon: Trash2, danger: true, onSelect: () => setDeletingUserId(user.id) },
                    ]} /></div>}
                    <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-1.5 xl:col-span-1 xl:col-start-2 xl:row-start-1">
                      <UserRoles user={user} />
                      <span className={`inline-flex items-center gap-1 text-[11px] ${user.isBlocked ? 'text-red-600 dark:text-red-400' : 'text-text-muted dark:text-stone-400'}`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${user.isBlocked ? 'bg-red-500' : 'bg-emerald-500'}`} />{user.isBlocked ? 'Заблокирован' : 'Доступен'}</span>
                    </div>
                    <dl className="col-span-2 grid min-w-0 grid-cols-[1fr_1fr_1.4fr] gap-2 text-xs xl:col-span-1 xl:col-start-3 xl:row-start-1">
                      <div><dt className="text-[11px] text-text-muted dark:text-stone-400">Чекины</dt><dd className="mt-0.5 font-medium tabular-nums">{user.checkInCount?.toLocaleString('ru') ?? '—'}</dd></div>
                      <div><dt className="text-[11px] text-text-muted dark:text-stone-400">Кофейни</dt><dd className="mt-0.5 font-medium tabular-nums">{user.addedShopsCount?.toLocaleString('ru') ?? '—'}</dd></div>
                      <div><dt className="text-[11px] text-text-muted dark:text-stone-400">Регистрация</dt><dd className="mt-0.5 tabular-nums">{formatUserDate(user.createdAtUtc)}</dd></div>
                    </dl>
                    {user.about && <p className="col-span-full line-clamp-2 whitespace-pre-wrap text-xs text-text-muted [overflow-wrap:anywhere] dark:text-stone-400"><span className="font-medium">О себе: </span>{user.about}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {data && <div className="border-t border-border-light px-3 py-2 dark:border-border-dark">
            <p className="text-center text-xs tabular-nums text-text-muted dark:text-stone-400">{data.totalCount ? `${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + data.items.length} из ${data.totalCount}` : '0 пользователей'}</p>
            <Pagination page={page} totalPages={data.totalPages} onPageChange={(nextPage) => setParam('page', String(nextPage))} />
          </div>}
        </Card>
      )}

      <Dialog open={Boolean(detailsUser)} onOpenChange={(open) => !open && setDetailsUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Профиль пользователя</DialogTitle><DialogDescription>Данные учётной записи</DialogDescription></DialogHeader>
          {detailsUser && <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3"><UserAvatar user={detailsUser} /><div className="min-w-0"><p className="font-semibold [overflow-wrap:anywhere]">{detailsUser.userName || 'Без имени'}</p><p className="text-text-muted [overflow-wrap:anywhere] dark:text-stone-400">{detailsUser.email}</p></div></div>
            <UserRoles user={detailsUser} />
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-xs text-text-muted">Статус</dt><dd>{detailsUser.isBlocked ? 'Заблокирован' : 'Доступен'}</dd></div>
              <div><dt className="text-xs text-text-muted">Регистрация</dt><dd>{formatSessionDate(detailsUser.createdAtUtc)}</dd></div>
              <div><dt className="text-xs text-text-muted">Чекины</dt><dd>{detailsUser.checkInCount ?? '—'}</dd></div>
              <div><dt className="text-xs text-text-muted">Добавленные кофейни</dt><dd>{detailsUser.addedShopsCount ?? '—'}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-text-muted">О себе</dt><dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{detailsUser.about || 'Не указано'}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-text-muted">ID</dt><dd className="select-all break-all font-mono text-xs">{detailsUser.id}</dd></div>
            </dl>
          </div>}
        </DialogContent>
      </Dialog>

      {isAdmin && <Dialog open={Boolean(sessionsUser)} onOpenChange={(open) => !open && setSessionsUser(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Устройства и сессии</DialogTitle><DialogDescription>Управление входами пользователя</DialogDescription></DialogHeader>
          {sessionsUser && <UserSessionsPanel user={sessionsUser} />}
        </DialogContent>
      </Dialog>}

      {isAdmin && editingUser && (
        <EditRoleModal
          key={editingUser.id}
          user={editingUser}
          onSave={async (id, role) => {
            await updateRoleMutation.mutateAsync({ id, role });
          }}
          onClose={() => setEditingUser(null)}
        />
      )}

      {isAdmin && (
        <>
          <ConfirmDialog
            isOpen={!!kickingUser}
            title="Оборвать все сессии?"
            message={`${kickingUser?.email ?? 'Пользователь'} будет разлогинен на всех устройствах сразу.`}
            confirmLabel="Оборвать"
            variant="danger"
            onConfirm={async () => {
              if (kickingUser) await revokeAllMutation.mutateAsync(kickingUser.id);
            }}
            onCancel={() => setKickingUser(null)}
          />

          <ConfirmDialog
            isOpen={!!blockingUser}
            title={blockingUser?.isBlocked ? 'Разблокировать пользователя?' : 'Заблокировать пользователя?'}
            message={
              blockingUser?.isBlocked
                ? 'Пользователь снова сможет входить в систему.'
                : 'Все активные сессии будут отозваны. Вход будет запрещён до разблокировки.'
            }
            confirmLabel={blockingUser?.isBlocked ? 'Разблокировать' : 'Заблокировать'}
            variant={blockingUser?.isBlocked ? 'primary' : 'danger'}
            onConfirm={async () => {
              if (blockingUser) {
                await blockMutation.mutateAsync({
                  id: blockingUser.id,
                  blocked: !blockingUser.isBlocked,
                });
              }
            }}
            onCancel={() => setBlockingUser(null)}
          />

          <ConfirmDialog
            isOpen={!!deletingUserId}
            title="Удалить пользователя?"
            message="Учётная запись будет помечена как удалённая, все сессии отозваны. Вход в систему станет недоступен."
            confirmLabel="Удалить"
            variant="danger"
            onConfirm={async () => {
              if (deletingUserId) await deleteMutation.mutateAsync(deletingUserId);
            }}
            onCancel={() => setDeletingUserId(null)}
          />
        </>
      )}
    </div>
  );
};
