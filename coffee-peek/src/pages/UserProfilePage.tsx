import { displayDrinkName } from '../utils/consumedDrinks';
import { usePublicNavigate } from '../hooks/usePublicNavigate';
import { usePublicResolution } from '../components/PublicAddressPage';
import WobbleRing from '../components/WobbleRing';
import React from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { getUserPublicProfile, type PublicUserProfile } from '../api/user';
import { getReviewsByUserId, type Review } from '../api/coffeeshop';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { getThemeClasses } from '../utils/theme';
import Button from '../components/Button';
import { logger } from '../utils/logger';
import { usePageTitle } from '../hooks/usePageTitle';
import { StarIcon } from '../components/icons';
import {
  SealCheck, ShoppingCart, ChatCenteredText, Star,
  NotePencil, ArrowRight, CaretLeft, CaretRight,
} from '@/components/Icon';
import Mascot from '../components/Mascot';
import ReportReviewButton from '../components/ReportReviewButton';

const UserProfilePage: React.FC = () => {
  const { userId: routeId } = useParams<{ userId: string }>();
  const resolution = usePublicResolution();
  const userId = resolution?.id ?? routeId;
  const navigate = useNavigate();
  const openPublic = usePublicNavigate();
  const { user } = useUser();
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  
  const [profile, setProfile] = React.useState<PublicUserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Load user reviews
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = React.useState(false);
  const [reviewsPage, setReviewsPage] = React.useState(1);
  const [reviewsTotalPages, setReviewsTotalPages] = React.useState(1);

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

  // Load user reviews
  React.useEffect(() => {
    let cancelled = false;

    const loadReviews = async () => {
      if (!userId || !profile) return;
      
      try {
        setIsLoadingReviews(true);
        const response = await getReviewsByUserId(userId, reviewsPage, 10);
        
        if (cancelled) return;
        
        if (response.success && response.data) {
          setReviews(response.data.reviews || []);
          setReviewsTotalPages(response.data.totalPages || 1);
        }
      } catch (err) {
        if (!cancelled) {
          logger.error('Error loading reviews:', err);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingReviews(false);
        }
      }
    };

    loadReviews();

    return () => {
      cancelled = true;
    };
  }, [userId, reviewsPage, profile]);

  const handlePreviousPage = () => {
    if (reviewsPage > 1) {
      setReviewsPage(reviewsPage - 1);
    }
  };

  const handleNextPage = () => {
    if (reviewsPage < reviewsTotalPages) {
      setReviewsPage(reviewsPage + 1);
    }
  };

  const handleShopSelect = (shopId: string) => {
    openPublic('shops', reviews.find(review => review.coffeeShopId === shopId)?.shop);
  };

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

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + ((r.ratingCoffee + r.ratingService + r.ratingPlace) / 3), 0) / reviews.length).toFixed(1)
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
          <div className="grid grid-cols-3 gap-3 sm:gap-6">
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
                <ChatCenteredText size={30} />
              </div>
              <span className={`text-4xl font-bold ${textMain}`}>
                {profile.reviewCount ?? 0}
              </span>
              <span className={`text-xs font-bold ${textMuted} uppercase tracking-[0.2em] mt-2`}>
                ОТЗЫВОВ
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

        {/* Reviews */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col gap-1">
              <h2 className={`text-2xl font-bold ${textMain}`}>Последние отзывы</h2>
              <p className={`${textMuted} text-sm`}>
                {profile.reviewCount ? `Всего отзывов: ${profile.reviewCount}` : 'Пока нет отзывов'}
              </p>
            </div>
          </div>

          {isLoadingReviews ? (
            <div className="flex items-center justify-center py-12">
              <WobbleRing size={48} />
            </div>
          ) : reviews.length > 0 ? (
            <>
              <div className="space-y-4">
                {reviews.map((review) => {
                  const reviewDate = new Date(review.createdAt);
                  const formattedDate = reviewDate.toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  });
                  const avgRating = ((review.ratingCoffee + review.ratingService + review.ratingPlace) / 3).toFixed(1);

                  return (
                    <div
                      key={review.id}
                      className={`${bgSurface} p-6 rounded-2xl border ${borderClass} shadow-sm flex items-start gap-4 hover:shadow-md transition-all`}
                    >
                      <div className={`w-12 h-12 rounded-full ${theme === 'dark' ? themeClasses.bg.secondary : 'bg-stone-100'} flex items-center justify-center shrink-0`}>
                        <NotePencil size={20} className={themeClasses.primary.text} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          {review.header ? (
                            <p className={`font-bold ${textMain}`}>{review.header}</p>
                          ) : (
                            <p className={`font-bold ${textMain}`}>Отзыв о кофейне</p>
                          )}
                          <div className="flex shrink-0 items-center gap-2"><span className={`text-xs ${textMuted}`}>{formattedDate}</span><ReportReviewButton reviewId={review.id} /></div>
                        </div>
                        <p className="my-2 text-sm">Напиток: {displayDrinkName(review)}</p>
                        {review.comment && (
                          <p className={`text-sm ${textMuted} mt-1 leading-relaxed`}>
                            {review.comment}
                          </p>
                        )}
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <StarIcon
                                key={star}
                                size={14}
                                filled={star <= Math.round(parseFloat(avgRating))}
                                className={
                                  star <= Math.round(parseFloat(avgRating))
                                    ? themeClasses.primary.text
                                    : theme === 'dark' ? themeClasses.border.default : 'text-stone-300'
                                }
                              />
                            ))}
                          </div>
                          <button
                            onClick={() => handleShopSelect(review.coffeeShopId)}
                            className={`text-xs ${themeClasses.primary.text} ${themeClasses.primary.hover} font-medium transition-colors flex items-center gap-1`}
                          >
                            <ArrowRight size={14} />
                            Перейти к кофейне
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {reviewsTotalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                  <Button
                    onClick={handlePreviousPage}
                    disabled={reviewsPage === 1}
                    variant="secondary"
                  >
                    <CaretLeft size={20} />
                    Предыдущая
                  </Button>
                  <span className={`px-4 py-2 ${textMain} font-medium`}>
                    Страница {reviewsPage} из {reviewsTotalPages}
                  </span>
                  <Button
                    onClick={handleNextPage}
                    disabled={reviewsPage === reviewsTotalPages}
                    variant="secondary"
                  >
                    Следующая
                    <CaretRight size={20} />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className={`${bgSurface} p-12 rounded-2xl border ${borderClass} text-center`}>
              <div className="flex justify-center mb-2" aria-hidden>
                <Mascot pose="book" size={132} />
              </div>
              <p className={`${textMuted} text-lg`}>
                Пользователь пока не оставил ни одного отзыва
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default UserProfilePage;
