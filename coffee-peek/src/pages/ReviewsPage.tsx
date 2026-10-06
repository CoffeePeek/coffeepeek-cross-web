import { displayDrinkName } from '../utils/consumedDrinks';
import { usePublicNavigate } from '../hooks/usePublicNavigate';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { COLORS, getThemeColors } from '../constants/colors';
import { usePageTitle } from '../hooks/usePageTitle';
import { useUserReviews } from '../hooks/queries/useReviews';
import { getPhotoUrl } from '../api/coffeeshop';
import WobbleRing from '../components/WobbleRing';
import { AppIcon, StarIcon } from '../components/icons';
import Mascot from '../components/Mascot';
import { getErrorMessage } from '../utils/errorHandler';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1990) return 'Дата не указана';
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const PAGE_SIZE = 10;

const ReviewsPage: React.FC = () => {
  usePageTitle('Мои отзывы');
  const navigate = useNavigate();
  const openPublic = usePublicNavigate();
  const { user } = useUser();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const isDark = theme === 'dark';
  const gold = COLORS.primary;

  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, error, refetch } = useUserReviews(
    user?.address?.slug ?? null,
    page,
    PAGE_SIZE,
    Boolean(user?.id)
  );

  const items = data?.reviews ?? [];
  const totalItems = data?.totalCount ?? 0;
  const totalPages = Math.max(1, data?.totalPages ?? 1);

  return (
    <div style={{ minHeight: '100%', background: colors.background }}>
      <div style={{
        borderBottom: `1px solid ${colors.border}`,
        background: isDark ? 'rgba(45,36,31,0.7)' : colors.surface,
        backdropFilter: 'blur(12px)',
      }}>
        <div
          className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8"
          style={{ height: 56, display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Назад"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, padding: 0, flexShrink: 0,
              border: 'none', borderRadius: 8, background: 'transparent',
              color: colors.textPrimary, cursor: 'pointer',
            }}
          >
            <AppIcon name="chevron_left" size={20} color="currentColor" />
          </button>
          <h1 style={{
            margin: 0, fontFamily: '"Manrope"', fontWeight: 700,
            fontSize: 18, color: colors.textPrimary, letterSpacing: '-0.01em',
          }}>
            Мои отзывы
          </h1>
          {totalItems > 0 && (
            <span style={{
              fontFamily: '"Manrope", sans-serif', fontSize: 13, color: colors.textSecondary,
            }}>
              {totalItems}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <WobbleRing size={48} />
          </div>
        ) : error ? (
          <div style={{
            padding: 24, borderRadius: 16, border: `1px solid ${colors.border}`,
            background: colors.surface, textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 16px', fontFamily: '"Manrope", sans-serif', fontSize: 14, color: '#EF4444' }}>
              {getErrorMessage(error)}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              style={{
                padding: '10px 18px', borderRadius: 12, border: 'none', background: gold,
                color: '#1A1412', fontFamily: '"Manrope", sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              Повторить
            </button>
          </div>
        ) : items.length === 0 ? (
          <div style={{
            padding: '48px 24px', borderRadius: 20, border: `1px solid ${colors.border}`,
            background: colors.surface, textAlign: 'center',
          }}>
            <div style={{ margin: '0 auto 8px', display: 'flex', justifyContent: 'center' }} aria-hidden>
              <Mascot pose="book" size={128} />
            </div>
            <h2 style={{
              margin: '0 0 8px', fontFamily: '"Manrope", sans-serif', fontWeight: 700,
              fontSize: 18, color: colors.textPrimary,
            }}>
              Пока нет отзывов
            </h2>
            <p style={{ margin: '0 0 20px', fontFamily: '"Manrope", sans-serif', fontSize: 14, color: colors.textSecondary }}>
              Публичный чекин или отзыв на странице кофейни появится здесь.
            </p>
            <button
              type="button"
              onClick={() => navigate('/shops')}
              style={{
                padding: '10px 20px', borderRadius: 12, border: 'none', background: gold,
                color: '#1A1412', fontFamily: '"Manrope", sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              Открыть каталог
            </button>
          </div>
        ) : (
          <>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12, opacity: isFetching ? 0.7 : 1, transition: 'opacity .2s' }}>
              {items.map((item) => {
                const avg = (item.ratingCoffee + item.ratingService + item.ratingPlace) / 3;
                const photos = (item.photos ?? []).filter((photo) => getPhotoUrl(photo, 'thumbnail'));
                const shopId = item.coffeeShopId;

                return (
                  <li
                    key={item.id}
                    style={{
                      padding: '16px 18px', borderRadius: 16, border: `1px solid ${colors.border}`,
                      background: colors.surface,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => shopId && openPublic('shops', item.shop)}
                        disabled={!shopId}
                        style={{
                          flex: 1, textAlign: 'left', border: 'none', background: 'transparent',
                          padding: 0, cursor: shopId ? 'pointer' : 'default',
                        }}
                      >
                        <p style={{
                          margin: 0, fontFamily: '"Manrope", sans-serif', fontWeight: 700,
                          fontSize: 16, color: colors.textPrimary,
                        }}>
                          {item.shopName || item.header || 'Отзыв о кофейне'}
                        </p>
                        <p style={{
                          margin: '6px 0 0', fontFamily: '"Manrope", sans-serif', fontSize: 13, color: colors.textSecondary,
                        }}>
                          {formatDate(item.visitedAt || item.createdAt)}
                        </p>
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <StarIcon
                                key={star}
                                size={14}
                                filled={star <= Math.round(avg)}
                                color={star <= Math.round(avg) ? gold : (isDark ? '#3D2F28' : '#E7E5E4')}
                              />
                            ))}
                          </div>
                          <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: 12, color: colors.textSecondary }}>
                            Кофе {item.ratingCoffee} · Сервис {item.ratingService} · Атмосф. {item.ratingPlace}
                          </span>
                        </div>
                      </button>

                      {shopId && (
                        <button
                          type="button"
                          onClick={() => openPublic('shops', item.shop, '/reviews/edit', { state: { reviewId: item.id } })}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '5px 10px', borderRadius: 8,
                            border: `1px solid ${isDark ? '#3D2F28' : '#E7E5E4'}`,
                            background: 'transparent', color: gold,
                            fontFamily: '"Manrope", sans-serif', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <AppIcon name="rate_review" size={14} color="currentColor" />
                          Изменить
                        </button>
                      )}
                    </div>

                    {item.header && item.shopName && (
                      <p style={{
                        margin: '12px 0 0', fontFamily: '"Manrope", sans-serif', fontWeight: 600,
                        fontSize: 14, color: colors.textPrimary,
                      }}>
                        {item.header}
                      </p>
                    )}

                    <p className="my-2 text-sm">Напиток: {displayDrinkName(item)}</p>
                    {item.comment ? (
                      <p style={{
                        margin: item.header && item.shopName ? '6px 0 0' : '12px 0 0',
                        paddingTop: item.header && item.shopName ? 0 : 12,
                        borderTop: item.header && item.shopName ? 'none' : `1px solid ${colors.border}`,
                        fontFamily: '"Manrope", sans-serif', fontSize: 14, color: colors.textPrimary, lineHeight: 1.5,
                      }}>
                        {item.comment}
                      </p>
                    ) : null}

                    {photos.length > 0 && (
                      <div style={{ marginTop: 12, display: 'flex', gap: 8, overflowX: 'auto' }}>
                        {photos.map((photo) => (
                          <img
                            key={photo.storageKey || photo.fullUrl || photo.fileName}
                            src={getPhotoUrl(photo, 'thumbnail')}
                            alt=""
                            style={{
                              width: 64, height: 64, objectFit: 'cover', borderRadius: 10,
                              border: `1px solid ${colors.border}`, flexShrink: 0,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {totalPages > 1 && (
              <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    type="button"
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    style={{
                      padding: '10px 18px', borderRadius: 12,
                      border: `1px solid ${colors.border}`,
                      background: page <= 1 ? colors.border : colors.surface,
                      color: page <= 1 ? `${colors.textSecondary}80` : colors.textPrimary,
                      fontFamily: '"Manrope", sans-serif', fontWeight: 600, fontSize: 14,
                      cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ← Назад
                  </button>
                  <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: 14, color: colors.textSecondary }}>
                    Страница <span style={{ fontWeight: 700, color: gold }}>{page}</span> из {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages || isFetching}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    style={{
                      padding: '10px 18px', borderRadius: 12,
                      border: `1px solid ${colors.border}`,
                      background: page >= totalPages ? colors.border : colors.surface,
                      color: page >= totalPages ? `${colors.textSecondary}80` : colors.textPrimary,
                      fontFamily: '"Manrope", sans-serif', fontWeight: 600, fontSize: 14,
                      cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Вперёд →
                  </button>
                </div>
                <p style={{ margin: 0, fontFamily: '"Manrope", sans-serif', fontSize: 13, color: colors.textSecondary }}>
                  Показано {items.length} из {totalItems}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReviewsPage;
