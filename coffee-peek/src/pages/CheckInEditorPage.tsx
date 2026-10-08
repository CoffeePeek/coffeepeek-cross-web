import DrinkSelector from '../components/DrinkSelector';
import { drinkSelection } from '../utils/consumedDrinks';
import { usePublicResolution } from '../components/PublicAddressPage';
import { usePublicNavigate } from '../hooks/usePublicNavigate';
import WobbleRing from '../components/WobbleRing';
import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCheckIn, useCreateCheckIn, useUpdateCheckIn } from '../hooks/queries/useCheckIns';
import { getPhotoUrl } from '../api/coffeeshop';
import { useCheckInPhotoUpload } from '../hooks/usePhotoUpload';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/theme';
import { getThemeColors, COLORS } from '../constants/colors';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useToast } from '../contexts/ToastContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { AppIcon, StarIcon } from '../components/icons';
import CheckInPhotos from '../components/CheckInPhotos';
import CheckInStatus from '../components/CheckInStatus';
import { PhotoThumb } from '../components/CheckInForm';
import { buildCheckInRequest, todayInputValue, formatCheckInDate } from '../utils/checkInForm';
import { getErrorMessage } from '../utils/errorHandler';

const schema = z.object({
  text: z.string().trim().min(1, 'Введите текст чекина').max(1000, 'Не больше 1000 символов'),
  coffee: z.number().int().min(1).max(5),
  service: z.number().int().min(1).max(5),
  place: z.number().int().min(1).max(5),
  drinkSlug: z.string(), customDrinkName: z.string(),
});

export default function CheckInEditorPage() {
  const { shopId: routeShopId, checkInId } = useParams();
  const resolution = usePublicResolution();
  const location = useLocation();
  const openPublic = usePublicNavigate();
  const { theme } = useTheme();
  const { user, requireAuth } = useRequireAuth();
  const { showToast } = useToast();
  const detail = useCheckIn(checkInId);
  const existing = detail.data;
  const isEditMode = !!checkInId;
  usePageTitle(isEditMode ? 'Редактирование чекина' : 'Создание чекина');
  const shopId = resolution?.id ?? routeShopId ?? existing?.shop?.slug;
  const shopFromState = (location.state as { shop?: { name: string; address: string; photo: string } })?.shop
    ?? (resolution?.data ? { name: resolution.data.name, address: resolution.data.location?.address ?? '', photo: resolution.data.photos?.[0] ? getPhotoUrl(resolution.data.photos[0], 'card') : '' }
      : existing ? { name: existing.shopName, address: '', photo: '' } : undefined);
  const themeClasses = getThemeClasses(theme);
  const themeColors = getThemeColors(theme);
  const colors = { primary: COLORS.primary, primaryHover: COLORS.primaryDark, primaryLight: COLORS.primaryLight, base: themeColors.background, surface: themeColors.surface, borderSubtle: themeColors.border, textMain: themeColors.textPrimary, textMuted: themeColors.textSecondary };
  const { watch, setValue, reset, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { text: '', coffee: 5, service: 5, place: 5, drinkSlug: '', customDrinkName: '' } });
  const values = watch();
  const description = values.text;
  const { drinkSlug, customDrinkName } = values;
  const ratingCoffee = values.coffee, ratingService = values.service, ratingPlace = values.place;
  const setRatingCoffee = (value: number) => setValue('coffee', value);
  const setRatingService = (value: number) => setValue('service', value);
  const setRatingPlace = (value: number) => setValue('place', value);
  const [isPublic, setIsPublic] = useState(false);
  const [visitedDate, setVisitedDate] = useState(todayInputValue);
  const create = useCreateCheckIn();
  const update = useUpdateCheckIn();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { selectedFiles, handleFileSelect, removeFile, uploadPhotos, uploadingPhotos } = useCheckInPhotoUpload();
  useEffect(() => {
    if (!existing) return;
    reset({ text: existing.text, coffee: existing.rating.coffee, service: existing.rating.service, place: existing.rating.place, drinkSlug: existing.drinkSlug ?? '', customDrinkName: existing.customDrinkName ?? '' });
  }, [existing, reset]);

  const submit = handleSubmit(async form => {
    if (isSubmitting || !requireAuth() || (isEditMode && !existing)) return;
    try {
      const rating = { coffee: form.coffee, service: form.service, place: form.place };
      const selection = drinkSelection(form.drinkSlug, form.customDrinkName);
      // Validate the complete create command before uploading any files.
      const request = isEditMode ? null : buildCheckInRequest({ coffeeShopId: shopId ?? '', note: form.text, rating, isPublic, visitedDate, ...selection });
      setIsSubmitting(true);
      if (existing && checkInId) await update.mutateAsync({ id: checkInId, request: { text: form.text, rating, ...selection } });
      else if (request) { request.photos = await uploadPhotos(); await create.mutateAsync(request); }
      showToast(existing?.visibility === 'Public' || isPublic ? 'Чекин отправлен на модерацию' : 'Чекин сохранён', 'success');
      if (existing?.shop) await openPublic('shops', existing.shop);
      else if (shopId) await openPublic('shops', shopId);
    } catch (error) { showToast(getErrorMessage(error), 'error'); }
    finally { setIsSubmitting(false); }
  });
  const getAverageRating = () => ((ratingCoffee + ratingService + ratingPlace) / 3).toFixed(1);
  const getRatingText = () => 'Средняя оценка';
  if (isEditMode && detail.isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><WobbleRing /></div>;
  if (detail.error) return <p role="alert" className="p-8">{getErrorMessage(detail.error)}</p>;
  if (existing && existing.author?.slug !== user?.address?.slug) return <p className="p-8">Редактировать чекин может только автор.</p>;
  if (!shopFromState) return <p className="p-8">Кофейня недоступна</p>;
  const handleSubmitClick = () => void submit();
  const shop = shopFromState;
  const shopImage = shop?.photo || '';

  return (
    <div className="min-h-screen pt-16" style={{ backgroundColor: colors.surface }}>
      <main className="max-w-6xl mx-auto px-4 py-6 sm:px-8 sm:py-12">
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: colors.textMain }}>
              {checkInId ? 'Редактировать чекин' : 'Поделиться впечатлением'}
            </h1>
            <p className="mt-1" style={{ color: colors.textMuted }}>
              {checkInId
                ? `Обновите ваш чекин о ${shop?.name || 'кофейне'}`
                : `Расскажите сообществу о вашем последнем визите в ${shop?.name || 'кофейне'}`}
            </p>
          </div>
          <button
            onClick={() => openPublic('shops', existing?.shop ?? shopId)}
            className="flex items-center gap-2 font-semibold hover:opacity-70 transition-opacity"
            style={{ color: colors.textMuted }}
          >
            <AppIcon name="chevron_left" size={24} />
            Назад
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6 sm:gap-12 items-start">
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
            <fieldset disabled={isSubmitting} className="contents">
            {/* Ratings section */}
            <section
              className="rounded-3xl p-5 sm:p-8 border shadow-soft space-y-8"
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
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          aria-label={`Кофе: ${star} из 5`}
                          onClick={() => setRatingCoffee(star)}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center p-0 hover:scale-110 transition-transform"
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
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          aria-label={`Сервис: ${star} из 5`}
                          onClick={() => setRatingService(star)}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center p-0 hover:scale-110 transition-transform"
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
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          aria-label={`Атмосфера: ${star} из 5`}
                          onClick={() => setRatingPlace(star)}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center p-0 hover:scale-110 transition-transform"
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

              <DrinkSelector drinkSlug={drinkSlug} customDrinkName={customDrinkName} savedName={existing?.drinkNameRu || existing?.drinkNameEn || undefined} disabled={isSubmitting} onChange={(slug, name) => { setValue("drinkSlug", slug); setValue("customDrinkName", name); }} />

              {/* Text */}
              <div className="space-y-6 pt-6 border-t" style={{ borderColor: `${colors.borderSubtle}80` }}>

                <div className="space-y-2">
                  <label className="block text-sm font-bold" htmlFor="description" style={{ color: colors.textMain }}>
                    Описание
                  </label>
                  <div className="relative">
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setValue("text", e.target.value)}
                      required
                      maxLength={1000}
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

            <section className="rounded-3xl border p-6 sm:p-8" style={{ backgroundColor: colors.base, borderColor: colors.borderSubtle }}>
              {isEditMode && existing ? <><CheckInStatus item={existing} /><p className="mt-3 text-sm" style={{ color: colors.textMuted }}>Дата посещения: {formatCheckInDate(existing)}. Дата и фотографии сохраняются при редактировании.</p><CheckInPhotos photos={existing.photos} shopName={existing.shopName} /></> : <>
                <label htmlFor="visited-date" className="block font-bold">Дата посещения</label>
                <input id="visited-date" type="date" max={todayInputValue()} value={visitedDate} onChange={e => setVisitedDate(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border p-3" style={{ backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textMain, colorScheme: theme }} />
                <label className="mt-4 flex min-h-11 items-center gap-3"><input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />Публичный чекин</label>
                <p className="mb-4 text-sm" style={{ color: colors.textMuted }}>{isPublic ? 'Появится в ленте после модерации' : 'Виден только вам'}</p>
                <p className="font-bold">Фотографии · {selectedFiles.length}/5</p>
                {selectedFiles.length < 5 && <label htmlFor="photo-upload" className="mt-3 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center" style={{ borderColor: colors.borderSubtle, color: colors.textMuted }}><AppIcon name="add_a_photo" size={32} /><span>Добавить фотографии визита</span></label>}
                <input id="photo-upload" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/avif" multiple onChange={handleFileSelect} className="hidden" />
                <div className="mt-3 flex gap-3 overflow-x-auto">{selectedFiles.map((file, index) => <PhotoThumb key={`${file.name}-${file.size}-${index}`} file={file} onRemove={() => removeFile(index)} />)}</div>
                {uploadingPhotos && <p className="mt-3">Загрузка фотографий…</p>}
              </>}
            </section>

            {errors.text && <p role="alert" className="text-red-500">{errors.text.message}</p>}
            {/* Submit button */}
            <div className="pt-6 flex justify-end">
              <button
                onClick={handleSubmitClick}
                disabled={isSubmitting || (isEditMode && !existing)}
                className={`px-10 py-5 ${themeClasses.primary.bg} ${themeClasses.primary.bgHover} text-white rounded-2xl font-bold text-lg flex items-center gap-3 shadow-lg ${themeClasses.primary.shadow} transition-all active:scale-95 group disabled:opacity-50`}
              >
                {isSubmitting ? (checkInId ? 'Сохранение...' : 'Отправка...') : (checkInId ? 'Сохранить изменения' : 'Создать чекин')}
                <AppIcon name="send" size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </button>
            </div>
            </fieldset>
          </div>
        </div>
      </main>

      <div className="h-20"></div>
    </div>
  );
};
