import { usePublicResolution } from '../components/PublicAddressPage';
import WobbleRing from '../components/WobbleRing';
import React from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { getUserPublicProfile, type PublicUserProfile } from '../api/user';
import { usePublicCheckIns } from '../hooks/queries/useCheckIns';
import CheckInCard from '../components/CheckInCard';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { getThemeClasses } from '../utils/theme';
import Button from '../components/Button';
import { logger } from '../utils/logger';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  SealCheck, ShoppingCart, Star,
  CaretLeft,
} from '@/components/Icon';
import Mascot from '../components/Mascot';

const UserProfilePage: React.FC = () => {
  const { userId: routeId } = useParams<{ userId: string }>();
  const resolution = usePublicResolution();
  const userId = resolution?.id ?? routeId;
  const navigate = useNavigate();
  const { user } = useUser();
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  
  const [profile, setProfile] = React.useState<PublicUserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  const publicCheckIns = usePublicCheckIns({ authorSlug: userId, pageSize: 10 }, !!userId && !!profile);
  const checkIns = publicCheckIns.data?.pages.flatMap(page => page.items) ?? [];

  // Устанавливаем title с именем пользователя
  usePageTitle(profile?.userName || 'Профиль пользователя');

  // Load profile
  React.useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (resolution) { setProfile({ ...resolution.data, id: resolution.id }); setError(null); setIsLoadingProfile(false); return; }
      if (!userId || user?.id === userId) return;
      
      try {
        setIsLoadingProfile(true);
        setProfile(null);
        setError(null);
        const response = await getUserPublicProfile(userId);
        
        if (cancelled) return;
        
        if (response.success && response.data) {
          setProfile(response.data);
        } else {
          setError('Не удалось загрузить профиль пользователя');
        }
      } catch (err) {
        if (!cancelled) {
          logger.error('Error loading profile:', err);
          setError('Произошла ошибка при загрузке профиля');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [userId, user?.id, resolution]);

  const bgClass = themeClasses.bg.primary;
  const bgSurface = theme === 'dark' ? themeClasses.bg.secondary : themeClasses.bg.card;
  const borderClass = themeClasses.border.default;
  const textMain = themeClasses.text.primary;
  const textMuted = themeClasses.text.secondary;

  if (!resolution && userId && user?.id === userId) {
    return <Navigate to="/profile" replace />;
  }

  if (isLoadingProfile) {
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center`}>
        <WobbleRing size={48} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <div className="text-center">
          <div className="flex justify-center mb-2" aria-hidden>
            <Mascot pose="astonishment" size={148} />
          </div>
          <p className={`text-xl ${textMain} mb-4`}>
            {error || 'Профиль не найден'}
          </p>
          <Button onClick={() => navigate(-1)} variant="primary">
            Вернуться назад
          </Button>
        </div>
      </div>
    );
  }

  const averageRating = checkIns.length > 0
    ? (checkIns.reduce((sum, r) => sum + ((r.rating.coffee + r.rating.service + r.rating.place) / 3), 0) / checkIns.length).toFixed(1)
    : '0.0';

  return (
    <div className={`min-h-screen ${bgClass} pt-16`}>
      {/* Back button */}
      <div className="fixed top-20 left-4 z-10">
        <Button onClick={() => navigate(-1)} variant="secondary">
          <CaretLeft size={20} />
          Назад
        </Button>
      </div>

      {/* Profile header */}
      <header className={`${bgSurface} border-b ${borderClass} px-4 sm:px-12 py-6 sm:py-10`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-8">
              <div className="relative flex-shrink-0">
                <div className={`w-20 h-20 sm:w-32 sm:h-32 rounded-full border-4 ${theme === 'dark' ? themeClasses.border.default : 'border-white'} shadow-xl overflow-hidden`}>
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.userName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className={`w-full h-full ${themeClasses.primary.bg} flex items-center justify-center`}>
                      <span className="text-3xl sm:text-5xl font-bold text-white">
                        {profile.userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:gap-3 text-center sm:text-left">
                <h1 className={`text-2xl sm:text-4xl font-bold ${textMain} tracking-tight`}>
                  {profile.userName}
                </h1>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  {profile.nickname && (
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${themeClasses.primary.bgLight} ${themeClasses.primary.borderLighter} border`}>
                      <SealCheck size={16} className={themeClasses.primary.text} />
                      <span className={`${themeClasses.primary.text} text-xs font-bold uppercase tracking-widest`}>
                        @{profile.nickname}
                      </span>
                    </div>
                  )}
                  {profile.createdAtUtc && (
                    <span className={`${textMuted} text-sm`}>
                      На сайте с {new Date(profile.createdAtUtc).getFullYear()}
                    </span>
                  )}
                </div>
                {profile.about && (
                  <p className={`${textMuted} text-sm max-w-lg`}>
                    {profile.about}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-12 py-6 sm:py-10 space-y-8 sm:space-y-12">
        {/* Statistics */}
        <section>
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <div className={`${bgSurface} p-8 rounded-3xl border ${borderClass} shadow-sm flex flex-col items-center text-center group ${themeClasses.border.activeHover} transition-all`}>
              <div className={`w-12 h-12 rounded-2xl ${themeClasses.primary.bgLight} ${themeClasses.primary.text} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <ShoppingCart size={30} />
              </div>
              <span className={`text-4xl font-bold ${textMain}`}>
                {profile.checkInCount ?? 0}
              </span>
              <span className={`text-xs font-bold ${textMuted} uppercase tracking-[0.2em] mt-2`}>
                ЧЕКИНЫ
              </span>
            </div>
            <div className={`${bgSurface} p-8 rounded-3xl border ${borderClass} shadow-sm flex flex-col items-center text-center group ${themeClasses.border.activeHover} transition-all`}>
              <div className={`w-12 h-12 rounded-2xl ${themeClasses.primary.bgLight} ${themeClasses.primary.text} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Star size={30} weight="fill" />
              </div>
              <span className={`text-4xl font-bold ${textMain}`}>
                {averageRating}
              </span>
              <span className={`text-xs font-bold ${textMuted} uppercase tracking-[0.2em] mt-2`}>
                РЕЙТИНГ
              </span>
            </div>
          </div>
        </section>

        <section>
          <h2 className={`mb-6 text-2xl font-bold ${textMain}`}>Публичные чекины</h2>
          {publicCheckIns.isLoading ? <WobbleRing /> : publicCheckIns.error ? <p role="alert">Не удалось загрузить чекины. <button type="button" onClick={() => void publicCheckIns.refetch()}>Повторить</button></p> : checkIns.length ? <div className="space-y-4">{checkIns.map(item => <CheckInCard key={item.id} item={item} />)}</div> : <div className={`${bgSurface} rounded-2xl border p-12 text-center ${borderClass}`}><Mascot pose="book" size={132} /><p className={textMuted}>Пользователь пока не опубликовал ни одного чекина</p></div>}
          {publicCheckIns.hasNextPage && <Button className="mt-6" disabled={publicCheckIns.isFetchingNextPage} onClick={() => void publicCheckIns.fetchNextPage()}>Загрузить ещё</Button>}
        </section>
      </div>
    </div>
  );
};

export default UserProfilePage;
