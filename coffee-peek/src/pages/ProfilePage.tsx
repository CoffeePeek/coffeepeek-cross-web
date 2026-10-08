import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getProfile, updateAbout, updateAvatar, updateEmail, updateUsername, type UserProfile,
} from '../api/auth';
import { getAvatarUploadUrl, putPhotoToStorage } from '../api/photos';
import WobbleRing from '../components/WobbleRing';
import GuestAuthCard from '../components/GuestAuthCard';
import { usePageTitle } from '../hooks/usePageTitle';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';
import {
  CaretRight,
  Camera,
  Heart,
  CoffeeBean,
  MapPin,
  NotePencil,
  PencilSimple,
  Plus,
  SignOut,
} from '@/components/Icon';

const ProfilePage: React.FC = () => {
  usePageTitle('Профиль');
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, isLoading: isUserLoading, logout, updateUserProfile } = useUser();
  const userId = user?.id;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState({ userName: '', email: '', about: '' });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    getProfile()
      .then(response => { if (!cancelled) setProfile(response.data); })
      .catch(error => logger.error('Error loading profile:', error))
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [isUserLoading, userId]);

  const isDark = theme === 'dark';
  const colors: ProfileColors = {
    bg: isDark ? '#171210' : '#F5F4F2',
    surface: isDark ? '#2B211C' : '#FFFFFF',
    border: isDark ? '#46362F' : '#E7E5E4',
    text: isDark ? '#FFFFFF' : '#1C1917',
    muted: isDark ? '#A39E93' : '#78716C',
    gold: '#EAB308',
  };

  const favorites = [
    { title: 'Избранные кофейни', subtitle: 'Кофейни, которые вы сохранили', Icon: Heart, color: '#FB7185', bg: 'rgba(244,63,94,.16)', route: '/shops?filter=favorite' },
  ];
  const activities = [
    { title: 'Чекины', subtitle: 'Места, которые вы уже посетили', Icon: MapPin, color: '#68B9E8', bg: 'rgba(56,153,211,.16)', route: '/check-ins' },
  ];
  const moderation = [
    { title: 'Правки кофеен', subtitle: 'Изменения, которые вы отправили', Icon: NotePencil, color: '#D8A743', bg: 'rgba(202,145,28,.16)', route: '/my/edits' },
    { title: 'Отправленные кофейни', subtitle: 'Кофейни, которые вы добавили', Icon: Plus, color: '#74C98B', bg: 'rgba(65,158,88,.18)', route: '/my/shops' },
    { title: 'Отправленные обжарщики', subtitle: 'Обжарщики, которых вы добавили', Icon: CoffeeBean, color: '#68B9E8', bg: 'rgba(56,153,211,.16)', route: '/my/roasters' },
  ];

  if (isLoading || isUserLoading) {
    return <div className="flex min-h-[70vh] items-center justify-center" style={{ background: colors.bg }}><WobbleRing size={48} /></div>;
  }

  if (!user) {
    return (
      <main className="min-h-screen px-5 pb-12 pt-8 sm:px-8" style={{ background: colors.bg }}>
        <div className="mx-auto w-full max-w-[680px]">
          <h1 className="mb-6 text-[26px] font-extrabold sm:text-3xl" style={{ color: colors.text }}>Профиль</h1>
          <GuestAuthCard {...colors} />
          <ProfileSection title="Избранное" activities={favorites} colors={colors} onNavigate={navigate} />
          <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider sm:mt-6" style={{ color: colors.muted }}>Моя активность</p>
          <ProfileActivityList activities={activities} colors={colors} onNavigate={navigate} />
        </div>
      </main>
    );
  }

  if (!profile) {
    return <div className="flex min-h-[70vh] items-center justify-center px-6 text-center" style={{ background: colors.bg, color: colors.text }}>Не удалось загрузить профиль</div>;
  }

  const initial = profile.userName?.[0]?.toUpperCase() ?? '?';
  const startEditing = () => {
    setDraft({ userName: profile.userName, email: profile.email, about: profile.about ?? '' });
    setAvatar(null);
    setError('');
    setIsEditing(true);
  };
  const cancelEditing = () => {
    setAvatar(null);
    setError('');
    setIsEditing(false);
  };
  const saveProfile = async () => {
    if (!draft.userName.trim() || !/^\S+@\S+\.\S+$/.test(draft.email)) return setError('Проверьте имя и email');
    if (avatar && (!avatar.type.startsWith('image/') || avatar.size > 5 * 1024 * 1024)) return setError('Выберите изображение размером до 5 МБ');
    setIsSaving(true);
    try {
      const updates: Promise<unknown>[] = [];
      if (draft.userName.trim() !== profile.userName) updates.push(updateUsername({ username: draft.userName.trim() }));
      if (draft.email.trim() !== profile.email) updates.push(updateEmail({ email: draft.email.trim() }));
      if (draft.about.trim() !== (profile.about ?? '')) updates.push(updateAbout({ about: draft.about.trim() }));
      if (avatar) {
        const upload = await getAvatarUploadUrl({ fileName: avatar.name, contentType: avatar.type, sizeBytes: avatar.size });
        if (!upload.data) throw new Error('Не удалось подготовить загрузку фотографии');
        const response = await putPhotoToStorage(upload.data.uploadUrl, avatar);
        if (!response.ok) throw new Error('Не удалось загрузить фотографию');
        updates.push(updateAvatar({ uploadedPhoto: { fileName: avatar.name, contentType: avatar.type, storageKey: upload.data.storageKey, size: avatar.size } }));
      }
      await Promise.all(updates);
      const next = (await getProfile()).data;
      setProfile(next);
      updateUserProfile(next);
      setIsEditing(false);
      setAvatar(null);
      setError('');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <main className="min-h-screen px-5 pb-12 pt-8 sm:px-8" style={{ background: colors.bg }}>
      <div className="mx-auto w-full max-w-[680px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-[26px] font-extrabold" style={{ color: colors.text }}>Профиль</h1>
          <div className="flex items-center gap-2">
            {isEditing && (
              <button type="button" onClick={cancelEditing} disabled={isSaving} className="min-h-11 rounded-full border px-4 text-sm font-bold" style={{ borderColor: colors.border, background: colors.surface, color: colors.text }}>Отмена</button>
            )}
            <button
              type="button"
              onClick={() => { if (isEditing) void saveProfile(); else startEditing(); }}
              disabled={isSaving}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-60"
              style={{ borderColor: isEditing ? colors.gold : colors.border, background: isEditing ? colors.gold : colors.surface, color: isEditing ? '#1A1412' : colors.text }}
            >
              <PencilSimple size={18} />
              {isSaving ? 'Сохраняем…' : isEditing ? 'Сохранить' : 'Редактировать'}
            </button>
          </div>
        </div>

        {error && <div className="mb-5 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(239,68,68,.45)', background: colors.surface, color: '#EF4444' }}>{error}</div>}

        <section className="grid grid-cols-[96px_1fr] gap-4 sm:grid-cols-[120px_1fr] sm:gap-6">
          <div className="h-24 w-24 sm:h-[120px] sm:w-[120px]">
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border" style={{ borderColor: colors.border, background: `${colors.gold}18` }}>
              {profile.avatarUrl
                ? <img src={profile.avatarUrl} alt={profile.userName} className="h-full w-full object-cover" />
                : <span className="text-4xl font-extrabold" style={{ color: colors.gold }}>{initial}</span>}
              {isEditing && (
                <label className="absolute inset-x-0 bottom-0 flex min-h-11 cursor-pointer items-center justify-center bg-black/65 text-white" aria-label="Изменить фотографию профиля">
                  <Camera size={20} />
                  <input type="file" accept="image/*" onChange={event => setAvatar(event.target.files?.[0] ?? null)} className="sr-only" />
                </label>
              )}
            </div>
          </div>

          <div className="min-w-0 pt-1 sm:pt-2">
            {isEditing ? (
              <>
                <input aria-label="Имя" value={draft.userName} onChange={event => setDraft(value => ({ ...value, userName: event.target.value }))} className="h-11 w-full rounded-xl border px-3 text-xl font-extrabold outline-none" style={{ borderColor: colors.border, background: colors.surface, color: colors.text }} />
                <input aria-label="Email" type="email" value={draft.email} onChange={event => setDraft(value => ({ ...value, email: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border px-3 text-sm outline-none" style={{ borderColor: colors.border, background: colors.surface, color: colors.text }} />
              </>
            ) : (
              <>
                <h2 className="truncate text-xl font-extrabold sm:text-2xl" style={{ color: colors.text }}>{profile.userName}</h2>
                <p className="mt-1 truncate text-sm sm:text-base" style={{ color: colors.muted }}>{profile.email}</p>
              </>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
              <ProfileStat value={profile.checkInCount ?? 0} label="Чекины" to="/check-ins" text={colors.text} muted={colors.muted} />
              <ProfileStat value={profile.addedShopsCount ?? 0} label="Кофейни" to="/my/shops" text={colors.text} muted={colors.muted} />
            </div>
          </div>
        </section>

        {isEditing ? (
          <textarea aria-label="О себе" value={draft.about} onChange={event => setDraft(value => ({ ...value, about: event.target.value }))} placeholder="Расскажите о себе" rows={2} className="mt-5 w-full resize-y rounded-xl border px-3 py-2 text-base outline-none" style={{ borderColor: colors.border, background: colors.surface, color: colors.text }} />
        ) : profile.about ? <p className="mt-4 text-sm leading-relaxed sm:mt-5 sm:text-base" style={{ color: colors.muted }}>{profile.about}</p> : null}

        <ProfileSection title="Избранное" activities={favorites} colors={colors} onNavigate={navigate} />
        <ProfileSection title="Моя активность" activities={activities} colors={colors} onNavigate={navigate} />
        <ProfileSection title="Модерация" activities={moderation} colors={colors} onNavigate={navigate} />

        <button
          type="button"
          onClick={() => { void logout().then(() => navigate('/')); }}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full text-base font-bold"
          style={{ background: isDark ? 'rgba(127,29,29,.23)' : '#FEE2E2', color: '#EF4444' }}
        >
          <SignOut size={22} />
          Выйти
        </button>
        <Link
          to="/profile/delete"
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full border text-sm font-bold transition-opacity hover:opacity-80"
          style={{ borderColor: colors.border, color: isDark ? '#FCA5A5' : '#B91C1C' }}
        >
          Удалить аккаунт
        </Link>
      </div>
    </main>
  );
};

const ProfileStat: React.FC<{ value: number; label: string; to: string; text: string; muted: string }> = ({ value, label, to, text, muted }) => (
  <Link to={to} className="block rounded-xl transition-opacity hover:opacity-80">
    <strong className="block text-lg sm:text-xl" style={{ color: text }}>{value}</strong>
    <span className="text-xs sm:text-sm" style={{ color: muted }}>{label}</span>
  </Link>
);

type ProfileColors = { bg: string; surface: string; border: string; text: string; muted: string; gold: string };

type ProfileActivity = { title: string; subtitle: string; Icon: React.ComponentType<{ className?: string }>; color: string; bg: string; route: string };

const ProfileSection: React.FC<{ title: string; activities: ProfileActivity[]; colors: ProfileColors; onNavigate: (route: string) => void }> = ({ title, activities, colors, onNavigate }) => (
  <>
    <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider sm:mt-6" style={{ color: colors.muted }}>{title}</p>
    <ProfileActivityList activities={activities} colors={colors} onNavigate={onNavigate} />
  </>
);

const ProfileActivityList: React.FC<{ activities: ProfileActivity[]; colors: ProfileColors; onNavigate: (route: string) => void }> = ({ activities, colors, onNavigate }) => (
  <section className="overflow-hidden rounded-[20px] border sm:rounded-3xl" style={{ borderColor: colors.border, background: colors.surface }}>
    {activities.map(({ title, subtitle, Icon, color, bg, route }, index) => (
      <button key={title} type="button" onClick={() => onNavigate(route)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-opacity hover:opacity-80 sm:px-5 sm:py-3.5" style={{ borderTop: index ? `1px solid ${colors.border}` : undefined }}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: bg, color }}><Icon className="h-[22px] w-[22px]" /></span>
        <span className="min-w-0 flex-1"><span className="block text-base font-medium" style={{ color: colors.text }}>{title}</span><span className="mt-0.5 block text-xs leading-snug" style={{ color: colors.muted }}>{subtitle}</span></span>
        <CaretRight className="h-5 w-5" color={colors.muted} />
      </button>
    ))}
  </section>
);

export default ProfilePage;
