import { DataTable } from '@/src/components/ui/DataTable';
import { Input } from '@/src/components/ui/Input';
import type { ColumnDef } from '@tanstack/react-table';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { MetricCard } from '../components/dashboard/MetricCard';
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

const IconUsers = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

function formatSessionDate(value: string): string {
  try {
    return new Date(value).toLocaleString('ru');
  } catch {
    return value;
  }
}

const UserSessionsPanel: React.FC<{ user: AdminUser }> = ({ user }) => {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [confirmSessionId, setConfirmSessionId] = useState<string | null>(null);

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
            disabled={!list.some((session) => !session.isRevoked) || revokeAllMutation.isPending}
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
            {list.map((session) => (
              <div key={session.id} className="grid min-w-0 gap-3 rounded-lg border border-border-light bg-white p-3 font-body text-sm dark:border-border-dark dark:bg-surface-dark sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
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
                  <Badge variant={session.isRevoked ? 'rejected' : 'approved'}>{session.isRevoked ? 'Отозвана' : 'Активна'}</Badge>
                  {!session.isRevoked && (
                    <Button variant="ghost" size="sm" className="text-red-500" loading={revokingSessionId === session.id && revokeOneMutation.isPending} onClick={() => setConfirmSessionId(session.id)}>
                      Отозвать
                    </Button>
                  )}
                </div>
              </div>
            ))}
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
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const roleFilter = (searchParams.get('role') ?? '') as UserRole | '';
  const [localSearch, setLocalSearch] = useState(search);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [sessionsUser, setSessionsUser] = useState<AdminUser | null>(null);
  const [kickingUser, setKickingUser] = useState<AdminUser | null>(null);
  const [blockingUser, setBlockingUser] = useState<AdminUser | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ['admin', 'users', 'stats'],
    queryFn: () => getUserStats().then((r) => r.data),
    staleTime: 1000 * 60,
  });

  const { data, isLoading } = useQuery({
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
      showToast('Пользователь удалён (soft delete)', 'success');
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

  const columns: ColumnDef<AdminUser>[] = [
    {
      header: 'Пользователь',
      cell: ({ row }) => {
        const user = row.original;
        return <div className="flex items-center gap-3">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 font-display text-xs font-bold text-primary">{user.userName?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}</div>}<div className="min-w-0"><p className="flex max-w-[160px] items-center gap-1.5 truncate font-body text-xs font-medium text-text-main dark:text-white">{user.userName ?? user.email}{user.isBlocked && <Badge variant="rejected">Заблокирован</Badge>}</p>{user.userName && <p className="max-w-[160px] truncate font-body text-xs text-stone-400">{user.email}</p>}</div></div>;
      },
    },
    { header: 'Роли', cell: ({ row }) => <div className="flex flex-wrap gap-1">{row.original.roles.length ? row.original.roles.map((role) => <UserRoleBadge key={role} role={role as UserRole} />) : <Badge>—</Badge>}</div> },
    { accessorKey: 'checkInCount', header: 'Чекинов', meta: { className: 'hidden md:table-cell', headerClassName: 'hidden md:table-cell' }, cell: ({ row }) => row.original.checkInCount ?? 0 },
    { accessorKey: 'addedShopsCount', header: 'Кофеен', meta: { className: 'hidden lg:table-cell', headerClassName: 'hidden lg:table-cell' }, cell: ({ row }) => row.original.addedShopsCount ?? 0 },
    { accessorKey: 'createdAtUtc', header: 'Дата', meta: { className: 'hidden lg:table-cell', headerClassName: 'hidden lg:table-cell' }, cell: ({ row }) => new Date(row.original.createdAtUtc).toLocaleDateString('ru') },
    {
      id: 'actions',
      cell: ({ row }) => {
        const user = row.original;
        const sessionsExpanded = sessionsUser?.id === user.id;
        return (
          <div className="flex min-w-[220px] flex-wrap gap-2">
            <Button variant="ghost" size="sm" className="text-amber-500" onClick={() => setKickingUser(user)}>Оборвать</Button>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={sessionsExpanded}
              aria-controls={sessionsExpanded ? `user-sessions-${user.id}` : undefined}
              onClick={() => setSessionsUser((current) => current?.id === user.id ? null : user)}
            >
              {sessionsExpanded ? 'Скрыть сессии' : 'Сессии'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditingUser(user)}>Роль</Button>
            <Button variant="ghost" size="sm" className={user.isBlocked ? 'text-green-500' : 'text-amber-500'} onClick={() => setBlockingUser(user)}>{user.isBlocked ? 'Разблок.' : 'Блок'}</Button>
            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-500" aria-label="Удалить" onClick={() => setDeletingUserId(user.id)}>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">
          Пользователи
        </h2>
        <p className="text-sm text-text-muted dark:text-stone-400 font-body mt-0.5">
          Управление пользователями, ролями и статистика
        </p>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard label="Всего" value={stats.totalUsers} icon={<IconUsers />} />
          <MetricCard label="Сегодня" value={stats.registeredToday} icon={<IconUsers />} color="text-green-500" />
          <MetricCard label="Активных" value={stats.activeUsers} icon={<IconUsers />} color="text-blue-500" />
          <MetricCard label="Заблокированных" value={stats.blockedUsers} icon={<IconUsers />} color="text-red-500" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-border-light bg-white p-3 shadow-sm dark:border-border-dark dark:bg-surface-dark sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {(['', ...ROLES] as (UserRole | '')[]).map((r) => (
            <Button
              type="button"
              size="sm"
              key={r || 'all'}
              onClick={() => setParam('role', r)}
              variant={roleFilter === r ? 'primary' : 'secondary'}
            >
              {r || 'Все'}
            </Button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setParam('search', localSearch); }}
          className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row"
        >
          <Input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Email или имя..."
            className="w-full sm:w-72"
          />
          <Button type="submit" variant="secondary" size="sm" className="w-full sm:w-auto min-h-[44px] sm:min-h-0">Найти</Button>
        </form>
      </div>

      <Card className="p-6">
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          loading={isLoading}
          emptyText="Пользователи не найдены"
          getRowId={(user) => user.id}
          expandedRowId={sessionsUser?.id}
          renderExpandedRow={(user) => <UserSessionsPanel user={user} />}
        />
        {data && data.totalPages > 1 && (
          <div className="border-t border-border-light px-5 py-3 dark:border-border-dark">
            <Pagination page={page} totalPages={data.totalPages} onPageChange={(nextPage) => setParam('page', String(nextPage))} />
          </div>
        )}
      </Card>

      {editingUser && (
        <EditRoleModal
          key={editingUser.id}
          user={editingUser}
          onSave={async (id, role) => {
            await updateRoleMutation.mutateAsync({ id, role });
          }}
          onClose={() => setEditingUser(null)}
        />
      )}

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
        title="Удалить пользователя (soft delete)?"
        message="Пользователь будет помечен как удалённый, все сессии отозваны. Отдельно от блокировки."
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={async () => {
          if (deletingUserId) await deleteMutation.mutateAsync(deletingUserId);
        }}
        onCancel={() => setDeletingUserId(null)}
      />
    </div>
  );
};
