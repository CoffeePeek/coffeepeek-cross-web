import { useState, type CSSProperties } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CaretLeft, ShareNetwork, PencilSimple } from '@phosphor-icons/react';
import { usePublicResolution } from '../components/PublicAddressPage';
import { getUserPublicProfile, type PublicUserProfile } from '../api/user';
import { publicProfileKey, useProfileFollow } from '../hooks/queries/usePublicProfile';
import PhotoLightbox from '../components/PhotoLightbox';
import PublicProfileActivity from '../components/profile/PublicProfileActivity';
import PublicProfileFavorites from '../components/profile/PublicProfileFavorites';
import PublicProfileCheckIns from '../components/profile/PublicProfileCheckIns';
import ProfileConnections from '../components/profile/ProfileConnections';
import { ProfileAvatar, ProfileDialog, ProfileError, ProfileLoading } from '../components/profile/ProfileUI';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { getCatalogScope } from '../lib/catalogSession';
import { brand, dark, light } from '../design-system';
import './UserProfilePage.css';

export default function UserProfilePage() {
  const { userId: routeId = '' } = useParams<{ userId: string }>();
  const resolution = usePublicResolution();
  const { isLoading } = useUser();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const slug = resolution?.id ?? routeId;
  const query = useQuery({
    queryKey: [...publicProfileKey(slug), 'detail'],
    queryFn: async () => {
      const response = await getUserPublicProfile(slug);
      if (!response.success || !response.data) throw new Error('Не удалось загрузить профиль');
      return response.data;
    },
    enabled: !resolution && !!slug && !isLoading, gcTime: 0,
  });
  const profile: PublicUserProfile | undefined = resolution ? { ...resolution.data, id: resolution.id } : query.data;
  usePageTitle(profile?.userName || 'Профиль пользователя', { description: profile?.about, canonicalPath: profile?.canonicalPath });
  const colors = theme === 'dark' ? dark : light;
  return <main className="public-profile min-h-screen" style={{
    '--profile-bg': colors.background,
    '--profile-surface': colors.surface,
    '--profile-border': colors.border,
    '--profile-text': colors.textPrimary,
    '--profile-muted': colors.textSecondary,
    '--profile-gold': brand.primary,
    '--profile-gold-warm': brand.goldWarm,
  } as CSSProperties}>
    <div className="profile-shell mx-auto w-full px-4 pb-10 pt-3 sm:px-8 sm:pt-6">
      {!profile ? <>
        <div className="mb-4 flex items-center gap-3"><BackButton onBack={() => navigate(-1)} /><h1 className="text-xl font-bold">Профиль</h1></div>
        {slug && query.isPending ? <ProfileLoading label="Загрузка профиля…" /> : <ProfileError message="Не удалось загрузить профиль пользователя" onRetry={() => void query.refetch()} />}
      </> : <PublicProfileContent key={`${getCatalogScope()}:${slug}`} profile={profile} />}
    </div>
  </main>;
}

function BackButton({ onBack }: { onBack: () => void }) {
  return <button type="button" className="profile-icon-button" aria-label="Назад" onClick={onBack}><CaretLeft size={23} /></button>;
}

function PublicProfileContent({ profile }: { profile: PublicUserProfile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { showToast } = useToast();
  const [showAvatar, setShowAvatar] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const follow = useProfileFollow(profile.id);
  const blocked = !!profile.isBlockedByViewer;
  const nickname = (profile.nickname || profile.userName || profile.id).replace(/^@+/, '');
  const isOwn = user?.address?.slug === profile.id || (!!user?.address?.canonicalPath && user.address.canonicalPath === profile.canonicalPath);
  // The mutation response is authoritative even if the background profile refresh fails.
  const isFollowing = follow.data?.isFollowing ?? profile.isFollowing ?? false;
  const followersCount = follow.data?.followersCount ?? profile.followersCount ?? 0;
  const onBack = () => {
    if (typeof window.history.state?.idx === 'number' && window.history.state.idx > 0) navigate(-1);
    else navigate('/feed', { replace: true });
  };
  const share = async () => {
    const url = new URL(profile.canonicalPath || `/users/${encodeURIComponent(profile.id)}`, window.location.origin).href;
    if (navigator.share) {
      try { await navigator.share({ title: `@${nickname} в CoffeePeek`, url }); return; }
      catch (error) { if (error instanceof Error && error.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); showToast('Ссылка на профиль скопирована', 'success'); }
    catch { setShareUrl(url); }
  };

  return <>
    <div className="mb-5 grid grid-cols-[44px_1fr_44px] items-center gap-3">
      <BackButton onBack={onBack} />
      <h1 className="text-center text-xl font-bold">Профиль</h1>
      <button type="button" className="profile-icon-button" aria-label="Поделиться профилем" onClick={() => void share()}><ShareNetwork size={22} /></button>
    </div>
    {blocked ? <div className="profile-panel rounded-2xl border px-6 py-10 text-center">
      <h2 className="text-xl font-bold">Автор заблокирован</h2>
      <p className="mt-3 text-sm profile-muted">Вы заблокировали @{nickname}. Его активность скрыта.</p>
    </div> : <div className="profile-columns">
      <div className="profile-overview min-w-0 space-y-5">
        <section aria-label={`Профиль @${nickname}`}>
          <div className="flex items-center gap-3 sm:gap-5">
            {profile.avatarUrl ? <button type="button" className="shrink-0 rounded-full border-0 p-0" aria-label={`Открыть аватар @${nickname}`} onClick={() => setShowAvatar(true)}>
              <ProfileAvatar name={nickname} url={profile.avatarUrl} className="profile-main-avatar" />
            </button> : <ProfileAvatar name={nickname} className="profile-main-avatar shrink-0" />}
            <div className="min-w-0 flex-1">
              <h2 className="break-words text-[22px] font-bold leading-tight tracking-tight sm:text-3xl">@{nickname}</h2>
              <dl className="mt-3 grid grid-cols-3 gap-1 sm:gap-4">
                <div className="min-w-0"><dt className="profile-stat-label">Чекины</dt><dd className="profile-stat-value">{profile.checkInCount ?? 0}</dd></div>
                <div className="min-w-0"><dt className="profile-stat-label">Кофейни</dt><dd className="profile-stat-value">{profile.addedShopsCount ?? 0}</dd></div>
                <div className="min-w-0"><dt className="sr-only">Подписчики</dt><dd><button type="button" className="profile-followers min-h-11 text-left" onClick={() => setShowConnections(true)} aria-label={`Подписчики: ${followersCount}. Открыть список`}>
                  <span className="profile-stat-value">{followersCount}</span><span className="profile-stat-label">Подписчики</span>
                </button></dd></div>
              </dl>
            </div>
          </div>
          {profile.about?.trim() && <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed profile-muted">{profile.about}</p>}
          <div className="mt-3">
            {isOwn ? <Link to="/profile" className="profile-pill inline-flex items-center gap-2"><PencilSimple size={16} />Редактировать профиль</Link>
              : <button type="button" className={`profile-pill ${isFollowing ? 'is-selected' : ''}`} aria-pressed={isFollowing} aria-label={`${isFollowing ? 'Отписаться от' : 'Подписаться на'} @${nickname}`} disabled={follow.isPending} onClick={() => {
                if (!user) navigate('/login', { state: { from: location } });
                else follow.mutate(!isFollowing);
              }}>{follow.isPending ? 'Сохраняем…' : isFollowing ? 'Вы подписаны' : 'Подписаться'}</button>}
          </div>
          {follow.isError && <div className="mt-3"><ProfileError message="Не удалось изменить подписку" onRetry={() => follow.mutate(!isFollowing)} /></div>}
        </section>
        <PublicProfileActivity slug={profile.id} />
        <PublicProfileFavorites slug={profile.id} />
      </div>
      <PublicProfileCheckIns slug={profile.id} />
    </div>}
    {!blocked && showAvatar && profile.avatarUrl && <PhotoLightbox images={[profile.avatarUrl]} shopName={`@${nickname}`} onClose={() => setShowAvatar(false)} />}
    {!blocked && showConnections && <ProfileConnections slug={profile.id} onClose={() => setShowConnections(false)} />}
    {shareUrl && <ProfileDialog title="Ссылка на профиль" onClose={() => setShareUrl('')}><p className="mb-3 text-sm profile-muted">Скопируйте ссылку, чтобы поделиться профилем.</p><input aria-label="Ссылка на профиль" readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} className="profile-panel min-h-11 w-full rounded-xl border px-3 text-sm" /></ProfileDialog>}
  </>;
}
