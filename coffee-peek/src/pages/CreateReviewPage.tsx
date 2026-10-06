import DrinkSelector from '../components/DrinkSelector';
import { reviewDrinkSelection, savedDrinkName } from '../utils/consumedDrinks';
import { usePublicResolution } from '../components/PublicAddressPage';
import { usePublicNavigate } from '../hooks/usePublicNavigate';
import WobbleRing from '../components/WobbleRing';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { coffeeShopKeys, reviewKeys } from '../hooks/queries';
import { createReview, type CreateReviewRequest, getReviewById, updateReview, type ShortPhotoMetadataDto, getPhotoUrl } from '../api/coffeeshop';
import { getReviewUploadUrls, photoContentType, putPhotoToStorage } from '../api/photos';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/theme';
import { getThemeColors, COLORS } from '../constants/colors';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';
import { usePageTitle } from '../hooks/usePageTitle';
import { AppIcon, StarIcon } from '../components/icons';

interface ShopBasicInfo {
  name: string;
  address: string;
  photo: string;
  averageRating?: number;
}

const CreateReviewPage: React.FC = () => {
  const { shopId: routeId, reviewId: routeReviewId } = useParams<{ shopId: string; reviewId?: string }>();
  const resolution = usePublicResolution();
  const shopId = resolution?.id ?? routeId ?? '';
  const navigate = useNavigate();
  const openPublic = usePublicNavigate();
  const location = useLocation();
  const reviewId = routeReviewId || (location.state as { reviewId?: string } | null)?.reviewId;
  
  const isEditMode = !!reviewId;
  usePageTitle(isEditMode ? 'Редактирование отзыва' : 'Создание отзыва');
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const { user, requireAuth } = useRequireAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // The public route has already loaded shop details, including on direct edit links.
  const shopFromState: ShopBasicInfo | undefined = (location.state as { shop?: ShopBasicInfo })?.shop
    ?? (resolution?.data ? {
      name: resolution.data.name,
      address: resolution.data.address ?? '',
      photo: resolution.data.photos?.[0] ? getPhotoUrl(resolution.data.photos[0], 'card') : '',
      averageRating: resolution.data.averageRating,
    } : undefined);
  
  // Redirect only if neither the route nor navigation supplied shop details.
  useEffect(() => {
    if (!shopId) {
      navigate('/shops', { replace: true });
    } else if (!shopFromState && !isEditMode) {
      openPublic('shops', shopId);
    }
  }, [shopFromState, isEditMode, shopId, navigate]);

  // Review data
  const [drinkSlug, setDrinkSlug] = useState('');
  const [customDrinkName, setCustomDrinkName] = useState('');
  const [originalDrink, setOriginalDrink] = useState({ slug: '', name: '', savedName: '' });
  const [header, setHeader] = useState('');
  const [description, setDescription] = useState('');
  const [ratingCoffee, setRatingCoffee] = useState(5);
  const [ratingService, setRatingService] = useState(5);
  const [ratingPlace, setRatingPlace] = useState(5);
  const [moderationReviewId, setModerationReviewId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExistingReview, setIsLoadingExistingReview] = useState(false);
  
  // Photo states
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [reviewPhotos, setReviewPhotos] = useState<ShortPhotoMetadataDto[]>([]);

  // Color values for inline styles (based on theme constants)
  const themeColors = getThemeColors(theme);
  const colors = {
    primary: COLORS.primary,
    primaryHover: COLORS.primaryDark,
    primaryLight: COLORS.primaryLight,
    base: themeColors.background,
    surface: themeColors.surface,
    borderSubtle: themeColors.border,
    textMain: themeColors.textPrimary,
    textMuted: themeColors.textSecondary,
  };

  // Если редактируем — подгружаем отзыв и префилим поля
  useEffect(() => {
    let cancelled = false;

    const loadExistingReview = async () => {
      if (!reviewId) return;
      if (!user) return;

      try {
        setIsLoadingExistingReview(true);
        setModerationReviewId(null);
        const response = await getReviewById(reviewId);
        if (cancelled) return;

        if (response.success && response.data) {
          const r = response.data;
          if (r.coffeeShopId && r.coffeeShopId !== shopId) {
            showToast('Отзыв относится к другой кофейне', 'error');
            return;
          }
          setModerationReviewId(r.moderationReviewId || null);
          if (!r.moderationReviewId) showToast('Этот отзыв пока недоступен для редактирования', 'error');
          setDrinkSlug(r.drinkSlug || '');
          setCustomDrinkName(r.customDrinkName || '');
          setOriginalDrink({ slug: r.drinkSlug || '', name: r.customDrinkName || '', savedName: savedDrinkName(r) });
          setHeader(r.header || '');
          setDescription(r.comment || '');
          setRatingCoffee(r.ratingCoffee || 5);
          setRatingService(r.ratingService || 5);
          setRatingPlace(r.ratingPlace || 5);
          setReviewPhotos(r.photos || []);
        } else {
          showToast('Не удалось загрузить отзыв для редактирования', 'error');
        }
      } catch (err) {
        if (!cancelled) {
          logger.error('Error loading review to edit:', err);
          showToast('Не удалось загрузить отзыв для редактирования', 'error');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingExistingReview(false);
        }
      }
    };

    loadExistingReview();

    return () => {
      cancelled = true;
    };
  }, [reviewId, shopId, user?.id, showToast]);

  const getAverageRating = () => {
    return ((ratingCoffee + ratingService + ratingPlace) / 3).toFixed(1);
  };

  const getRatingText = () => {
    const avg = parseFloat(getAverageRating());
    if (avg >= 4.5) return 'Excellent Experience';
    if (avg >= 3.5) return 'Great Experience';
    if (avg >= 2.5) return 'Good Experience';
    if (avg >= 1.5) return 'Fair Experience';
    return 'Needs Improvement';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeReviewPhoto = (storageKey: string) => {
    setReviewPhotos(prev => prev.filter(photo => photo.storageKey !== storageKey));
  };

  const uploadPhotos = async (): Promise<Array<{ fileName: string; contentType: string; storageKey: string; size: number }>> => {
    if (selectedFiles.length === 0) return [];

    const uploadRequests = selectedFiles.map(file => ({
      fileName: file.name,
      contentType: photoContentType(file),
      sizeBytes: file.size,
    }));

    const uploadUrlsResponse = await getReviewUploadUrls(uploadRequests);
    if (!uploadUrlsResponse.success || !uploadUrlsResponse.data) {
      throw new Error('Ошибка при получении URL для загрузки');
    }

    const uploadPromises = selectedFiles.map(async (file, index) => {
      const { uploadUrl, storageKey } = uploadUrlsResponse.data[index];

      const uploadResponse = await putPhotoToStorage(uploadUrl, file);

      if (!uploadResponse.ok) {
        throw new Error(`Ошибка загрузки файла ${file.name}`);
      }

      return {
        fileName: file.name,
        contentType: photoContentType(file),
        storageKey: storageKey,
        size: file.size,
      };
    });

    return Promise.all(uploadPromises);
  };

  const handleSubmit = async () => {
    if (!shopId || !requireAuth()) return;

    if (!description.trim()) {
      showToast('Заполните описание', 'error');
      return;
    }

    let selection: { drinkSlug?: string; customDrinkName?: string; clearDrink?: boolean };
    try {
      selection = reviewDrinkSelection(drinkSlug, customDrinkName, isEditMode
        ? { drinkSlug: originalDrink.slug, customDrinkName: originalDrink.name }
        : undefined);
    } catch (error) {
      showToast((error as Error).message, 'error');
      return;
    }

    if (isEditMode && !moderationReviewId) {
      showToast('Не удалось определить заявку для редактирования отзыва', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      setUploadingPhotos(true);
      
      // Загружаем новые фотографии
      const uploadedPhotos = await uploadPhotos();
      setUploadingPhotos(false);
      
      // Формируем список фотографий: существующие (не удаленные) + новые
      const existingPhotos = reviewPhotos
        .map(photo => {
          // Определяем contentType по расширению файла
          const extension = photo.fileName.split('.').pop()?.toLowerCase();
          const contentTypeMap: Record<string, string> = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
          };
          const contentType = extension ? (contentTypeMap[extension] || 'image/jpeg') : 'image/jpeg';
          
          return {
            fileName: photo.fileName,
            contentType: contentType,
            storageKey: photo.storageKey,
            size: 0, // размер не критичен для существующих фото
          };
        });
      
      const allPhotos = [...existingPhotos, ...uploadedPhotos];
      
      const request: CreateReviewRequest = {
        ...selection,
        shop: shopId,
        header: header.trim() || null,
        comment: description.trim(),
        ratingCoffee,
        ratingService,
        ratingPlace,
        photos: allPhotos,
      };

      const response = reviewId
        ? await updateReview(moderationReviewId!, {
            ...selection,
            header: request.header,
            comment: request.comment,
            rating: { coffee: ratingCoffee, service: ratingService, place: ratingPlace },
            photos: allPhotos,
          })
        : await createReview(request);
      if (response.success) {
        void queryClient.invalidateQueries({ queryKey: reviewKeys.all });
        void queryClient.invalidateQueries({ queryKey: coffeeShopKeys.all });
        showToast(reviewId ? 'Изменения отзыва отправлены на модерацию' : 'Отзыв отправлен на модерацию', 'success');
        openPublic('shops', shopId);
      } else {
        showToast(response.message || (reviewId ? 'Не удалось обновить отзыв' : 'Не удалось отправить отзыв'), 'error');
      }
    } catch (err) {
      logger.error('Error submitting review:', err);
      setUploadingPhotos(false);
      showToast(reviewId ? 'Не удалось обновить отзыв' : 'Не удалось отправить отзыв', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!shopId || isLoadingExistingReview) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.surface }}>
        <WobbleRing size={48} />
      </div>
    );
  }

  // Если нет данных о кофейне при создании отзыва, показываем загрузку (редирект произойдет)
  if (!shopFromState && !isEditMode) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.surface }}>
        <WobbleRing size={48} />
      </div>
    );
  }

  const shop = shopFromState;
  const shopImage = shop?.photo || '';

  return (
    <div className="min-h-screen pt-16" style={{ backgroundColor: colors.surface }}>
      <main className="max-w-6xl mx-auto px-8 py-12">
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: colors.textMain }}>
              {reviewId ? 'Редактировать отзыв' : 'Поделиться впечатлением'}
            </h1>
            <p className="mt-1" style={{ color: colors.textMuted }}>
              {reviewId
                ? `Обновите ваш отзыв о ${shop?.name || 'кофейне'}`
                : `Расскажите сообществу о вашем последнем визите в ${shop?.name || 'кофейне'}`}
            </p>
          </div>
          <button
            onClick={() => openPublic('shops', shopId)}
            className="flex items-center gap-2 font-semibold hover:opacity-70 transition-opacity"
            style={{ color: colors.textMuted }}
          >
            <AppIcon name="chevron_left" size={24} />
            Назад
          </button>
        </div>

        <div className="grid grid-cols-12 gap-12 items-start">
          {/* Sidebar */}
          <aside className="col-span-12 lg:col-span-4">
            <div
              className="rounded-3xl p-8 border shadow-soft text-center"
              style={{ backgroundColor: colors.base, borderColor: colors.borderSubtle }}
            >
              <div className="relative w-32 h-32 mx-auto mb-6">
                <div className="w-full h-full rounded-full overflow-hidden border-4 shadow-lg" style={{ borderColor: colors.primaryLight }}>
                  {shopImage ? (
                    <img alt={shop?.name || 'Кофейня'} className="w-full h-full object-cover" src={shopImage} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: colors.surface }}>
                      <AppIcon name="store" size={36} color={colors.textMuted} />
                    </div>
                  )}
                </div>
                <div className={`absolute -bottom-2 -right-2 ${themeClasses.primary.bg} text-white p-2 rounded-full shadow-lg`}>
                  <AppIcon name="verified" size={14} className="block" />
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-2" style={{ color: colors.textMain }}>
                {shop?.name || 'Кофейня'}
              </h2>

              <div className="flex items-center justify-center gap-1.5 mb-8" style={{ color: colors.textMuted }}>
                <AppIcon name="location_on" size={18} className={themeClasses.primary.text} />
                <span className="text-sm font-medium">
                  {shop?.address || 'Адрес не указан'}
                </span>
              </div>

              <div className="pt-8 border-t" style={{ borderColor: `${colors.borderSubtle}80` }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: colors.textMuted }}>
                  Общая оценка
                </p>
                <div className="flex justify-center gap-2 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon
                      key={star}
                      filled={star <= parseFloat(getAverageRating())}
                      size={32}
                      className={star <= parseFloat(getAverageRating()) ? themeClasses.primary.text : undefined}
                      style={star > parseFloat(getAverageRating()) ? { color: `${colors.primary}30` } : undefined}
                    />
                  ))}
                </div>
                <p className={`${themeClasses.primary.text} font-bold text-base mb-6`}>
                  {getAverageRating()} {getRatingText()}
                </p>

              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="col-span-12 lg:col-span-8 space-y-10">
            {/* Ratings section */}
            <section
              className="rounded-3xl p-8 border shadow-soft space-y-8"
              style={{ backgroundColor: colors.base, borderColor: colors.borderSubtle }}
            >
              <div className="grid grid-cols-1 gap-8">
                {/* Ratings */}
                <div className="space-y-6">
                  {/* Coffee Quality */}
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-bold" style={{ color: colors.textMain }}>
                      Качество кофе
                    </span>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRatingCoffee(star)}
                          className="hover:scale-110 transition-transform"
                        >
                          <StarIcon
                            filled={star <= ratingCoffee}
                            size={28}
                            className={star <= ratingCoffee ? themeClasses.primary.text : undefined}
                            style={star > ratingCoffee ? { color: `${colors.primary}20` } : undefined}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Service Quality */}
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-bold" style={{ color: colors.textMain }}>
                      Качество сервиса
                    </span>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRatingService(star)}
                          className="hover:scale-110 transition-transform"
                        >
                          <StarIcon
                            filled={star <= ratingService}
                            size={28}
                            className={star <= ratingService ? themeClasses.primary.text : undefined}
                            style={star > ratingService ? { color: `${colors.primary}20` } : undefined}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Atmosphere */}
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-bold" style={{ color: colors.textMain }}>
                      Атмосфера/Место
                    </span>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRatingPlace(star)}
                          className="hover:scale-110 transition-transform"
                        >
                          <StarIcon
                            filled={star <= ratingPlace}
                            size={28}
                            className={star <= ratingPlace ? themeClasses.primary.text : undefined}
                            style={star > ratingPlace ? { color: `${colors.primary}20` } : undefined}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <DrinkSelector drinkSlug={drinkSlug} customDrinkName={customDrinkName} savedName={drinkSlug === originalDrink.slug ? originalDrink.savedName : undefined} disabled={isSubmitting} onChange={(slug, name) => { setDrinkSlug(slug); setCustomDrinkName(name); }} />

              {/* Header and Description */}
              <div className="space-y-6 pt-6 border-t" style={{ borderColor: `${colors.borderSubtle}80` }}>
                <div className="space-y-2">
                  <label className="block text-sm font-bold" htmlFor="header" style={{ color: colors.textMain }}>
                    Заголовок (необязательно)
                  </label>
                  <input
                    id="header"
                    type="text"
                    value={header}
                    onChange={(e) => setHeader(e.target.value)}
                    className={`w-full border rounded-xl px-5 py-4 placeholder:opacity-40 ${themeClasses.primary.ringFocus} ${themeClasses.border.focus} outline-none transition-all font-semibold`}
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.borderSubtle,
                      color: colors.textMain,
                    }}
                    placeholder="Дайте заголовок вашему отзыву (например: Лучший кортадо в городе!)"
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold" htmlFor="description" style={{ color: colors.textMain }}>
                    Описание
                  </label>
                  <div className="relative">
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={`w-full border rounded-xl p-5 placeholder:opacity-40 ${themeClasses.primary.ringFocus} ${themeClasses.border.focus} outline-none transition-all resize-none h-40`}
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.borderSubtle,
                        color: colors.textMain,
                      }}
                      placeholder="Поделитесь подробностями о вашем визите..."
                    />
                    <div className="absolute bottom-4 right-4 pointer-events-none" style={{ color: `${colors.textMuted}33` }}>
                      <AppIcon name="edit_note" size={24} />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Photos section */}
            <section
              className="rounded-3xl p-8 border shadow-soft space-y-6"
              style={{ backgroundColor: colors.base, borderColor: colors.borderSubtle }}
            >
              <div className="space-y-2">
                <label className="block text-sm font-bold" style={{ color: colors.textMain }}>
                  Фотографии
                </label>
                <p className="text-sm" style={{ color: colors.textMuted }}>
                  Добавьте фотографии к вашему отзыву (необязательно)
                </p>
              </div>

              {/* File input */}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="photo-upload"
                />
                <label
                  htmlFor="photo-upload"
                  className={`block w-full border-2 border-dashed rounded-2xl py-8 px-4 text-center cursor-pointer ${themeClasses.primary.borderHover} transition-all`}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                  }}
                >
                  <svg className="mx-auto h-12 w-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: colors.textMuted }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span style={{ color: colors.textMuted }}>Нажмите для выбора фотографий</span>
                </label>
              </div>

              {/* Existing photos (edit mode) */}
              {reviewPhotos.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-3" style={{ color: colors.textMain }}>
                    Существующие фотографии:
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {reviewPhotos.map((photo, index) => (
                      <div key={photo.storageKey || index} className="relative group">
                        <img
                          src={getPhotoUrl(photo, 'thumbnail')}
                          alt={`Review photo ${index + 1}`}
                          className="w-full h-24 object-cover rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => removeReviewPhoto(photo.storageKey)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New selected photos preview */}
              {selectedFiles.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-3" style={{ color: colors.textMain }}>
                    Новые фотографии:
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-24 object-cover rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uploadingPhotos && (
                <div className="flex items-center justify-center py-4">
                  <WobbleRing size={32} />
                  <span className="ml-3 text-sm" style={{ color: colors.textMuted }}>
                    Загрузка фотографий...
                  </span>
                </div>
              )}
            </section>

            {/* Submit button */}
            <div className="pt-6 flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || (isEditMode && !moderationReviewId)}
                className={`px-10 py-5 ${themeClasses.primary.bg} ${themeClasses.primary.bgHover} text-white rounded-2xl font-bold text-lg flex items-center gap-3 shadow-lg ${themeClasses.primary.shadow} transition-all active:scale-95 group disabled:opacity-50`}
              >
                {isSubmitting ? (reviewId ? 'Сохранение...' : 'Отправка...') : (reviewId ? 'Сохранить изменения' : 'Отправить отзыв')}
                <AppIcon name="send" size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </main>

      <div className="h-20"></div>
    </div>
  );
};

export default CreateReviewPage;
