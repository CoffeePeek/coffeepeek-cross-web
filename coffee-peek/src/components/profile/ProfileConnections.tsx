import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProfileConnectionKind } from '../../api/user';
import { useProfileConnections } from '../../hooks/queries/usePublicProfile';
import { ProfileAvatar, ProfileDialog, ProfileError, ProfileLoading } from './ProfileUI';

export default function ProfileConnections({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [kind, setKind] = useState<ProfileConnectionKind>('followers');
  const query = useProfileConnections(slug, kind);
  const people = query.data?.pages.flatMap(page => page.items) ?? [];
  return <ProfileDialog title="Подписчики и подписки" onClose={onClose}>
    <div className="mb-4 flex gap-2" aria-label="Тип списка">
      {(['followers', 'following'] as const).map(value => <button key={value} type="button" className={`profile-pill flex-1 ${kind === value ? 'is-selected' : ''}`} aria-pressed={kind === value} onClick={() => setKind(value)}>{value === 'followers' ? 'Подписчики' : 'Подписки'}</button>)}
    </div>
    {query.isPending ? <ProfileLoading /> : <>
      <ul className="space-y-1">
        {people.map(person => <li key={person.address.slug}><Link to={person.address.canonicalPath} onClick={onClose} className="flex min-h-16 items-center gap-3 rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/5">
          <ProfileAvatar name={person.userName} url={person.avatarUrl} className="h-11 w-11 shrink-0 text-lg" />
          <span className="min-w-0 break-words text-sm font-semibold">@{person.userName.replace(/^@+/, '')}</span>
        </Link></li>)}
      </ul>
      {!people.length && !query.isError && <p className="py-8 text-center text-sm profile-muted">{kind === 'followers' ? 'Пока нет подписчиков' : 'Пока нет подписок'}</p>}
      {query.isError && <ProfileError message="Не удалось загрузить пользователей" onRetry={() => { void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch()); }} />}
      {query.hasNextPage && <button type="button" className="profile-pill mt-4 w-full" disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? 'Загрузка…' : 'Загрузить ещё'}</button>}
    </>}
  </ProfileDialog>;
}
