import DrinkSelector from '../components/DrinkSelector';
import { drinkSelection } from '../utils/consumedDrinks';
import { usePublicResolution } from '../components/PublicAddressPage';
import { usePublicNavigate } from '../hooks/usePublicNavigate';
import WobbleRing from '../components/WobbleRing';
import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
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
import CheckInPhotoThumb from '../components/CheckInPhotoThumb';
import Mascot from '../components/Mascot';
import { buildCheckInRequest, todayInputValue, formatCheckInDate } from '../utils/checkInForm';
import { getErrorMessage } from '../utils/errorHandler';
import { CheckInAnalytics, readCheckInFlow } from '../lib/checkInAnalytics';

const schema = z.object({
  text: z.string().trim().max(1000, 'Не больше 1000 символов'),
  coffee: z.number().int().min(1).max(5),
  service: z.number().int().min(1).max(5),
  place: z.number().int().min(1).max(5),
  drinkSlug: z.string(), customDrinkName: z.string(),
});

// File objects cannot be serialized into sessionStorage. Keep them for this tab's SPA lifetime.
const photoDrafts = new Map<string, File[]>();

export default function CheckInEditorPage() {
  const { shopId: routeShopId, checkInId } = useParams();
  const resolution = usePublicResolution();
  const location = useLocation();
  const navigate = useNavigate();
  const openPublic = usePublicNavigate();
  const { theme } = useTheme();
  const { user, requireAuth } = useRequireAuth();
  const { showToast } = useToast();
  const detail = useCheckIn(checkInId);
  const existing = detail.data;
  const isEditMode = !!checkInId;
  const [analytics] = useState(() => new CheckInAnalytics(readCheckInFlow(location.state?.checkInFlow, isEditMode ? 'my_check_ins' : 'direct'), 'visit', isEditMode ? 'edit' : 'create'));
  usePageTitle(isEditMode ? 'Редактирование чекина' : 'Создание чекина');
  const shopId = resolution?.data?.publicAddress?.slug ?? existing?.shop?.slug ?? routeShopId;
  const shopFromState = (location.state as { shop?: { name: string; address: string; photo: string } })?.shop
    ?? (resolution?.data ? { name: resolution.data.name, address: resolution.data.location?.address ?? '', photo: resolution.data.photos?.[0] ? getPhotoUrl(resolution.data.photos[0], 'card') : '' }
      : existing ? { name: existing.shopName, address: '', photo: '' } : undefined);
  const themeClasses = getThemeClasses(theme);
  const themeColors = getThemeColors(theme);
  const colors = { primary: COLORS.primary, primaryHover: COLORS.primaryDark, primaryLight: COLORS.primaryLight, base: themeColors.background, surface: themeColors.surface, borderSubtle: themeColors.border, textMain: themeColors.textPrimary, textMuted: themeColors.textSecondary };
  const { watch, setValue, reset, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { text: '', coffee: 4, service: 4, place: 4, drinkSlug: '', customDrinkName: '' } });
  const values = watch();
  const description = values.text;
  const { drinkSlug, customDrinkName } = values;
  const ratingCoffee = values.coffee, ratingService = values.service, ratingPlace = values.place;
  const setRatingCoffee = (value: number) => { analytics.field('coffee'); setValue('coffee', value); };
  const setRatingService = (value: number) => { analytics.field('service'); setValue('service', value); };
  const setRatingPlace = (value: number) => { analytics.field('place'); setValue('place', value); };
  const [isPublic, setIsPublic] = useState(false);
  const [visitedDate, setVisitedDate] = useState(todayInputValue);
  const create = useCreateCheckIn(analytics.flow);
  const update = useUpdateCheckIn();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdVisibility, setCreatedVisibility] = useState<'Private' | 'Public' | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [photoDraftKey, setPhotoDraftKey] = useState('');
  const { selectedFiles, setSelectedFiles, handleFileSelect, removeFile, uploadPhotos, uploadingPhotos } = useCheckInPhotoUpload();
  const draftKey = shopId && user?.id && !isEditMode ? `check-in-draft:${user.id}:${shopId}` : '';
  useEffect(() => {
    const track = () => {
      analytics.start();
      if (!isSubmitting && !createdVisibility && shopFromState && (!isEditMode || (existing && existing.author?.slug === user?.address?.slug))) analytics.view('editor');
    };
    track();
    window.addEventListener('coffeepeek:analytics-ready', track);
    return () => window.removeEventListener('coffeepeek:analytics-ready', track);
  }, [analytics, shopFromState, isEditMode, existing, user?.address?.slug, isSubmitting, createdVisibility]);
  useEffect(() => { if (detail.error) analytics.failure(detail.error, 'load'); }, [analytics, detail.error]);
  useEffect(() => {
    if (!draftKey) return;
    setSelectedFiles(photoDrafts.get(draftKey) || []);
    setPhotoDraftKey(draftKey);
  }, [draftKey, setSelectedFiles]);
  useEffect(() => {
    if (draftKey && photoDraftKey === draftKey && !createdVisibility) photoDrafts.set(draftKey, selectedFiles);
  }, [draftKey, photoDraftKey, selectedFiles, createdVisibility]);
  useEffect(() => {
    if (!existing) return;
    reset({ text: existing.text, coffee: existing.rating?.coffee ?? 4, service: existing.rating?.service ?? 4, place: existing.rating?.place ?? 4, drinkSlug: existing.drinkSlug ?? '', customDrinkName: existing.customDrinkName ?? '' });
  }, [existing, reset]);
  useEffect(() => {
    if (!shopId || isEditMode || !user?.id) return;
    try {
      const saved = sessionStorage.getItem(`check-in-draft:${user.id}:${shopId}`);
      if (saved) {
        const draft = JSON.parse(saved) as { form?: z.infer<typeof schema>; isPublic?: boolean; visitedDate?: string };
        if (draft.form) reset(draft.form);
        if (typeof draft.isPublic === 'boolean') setIsPublic(draft.isPublic);
        if (draft.visitedDate) setVisitedDate(draft.visitedDate);
      }
    } catch { /* An invalid draft starts a fresh form. */ }
    setDraftLoaded(true);
  }, [shopId, isEditMode, user?.id, reset]);
  useEffect(() => {
    if (!draftLoaded || !shopId || isEditMode || !user?.id || createdVisibility) return;
    sessionStorage.setItem(`check-in-draft:${user.id}:${shopId}`, JSON.stringify({ form: values, isPublic, visitedDate }));
  }, [draftLoaded, shopId, isEditMode, user?.id, values, isPublic, visitedDate, createdVisibility]);

  const submit = handleSubmit(async form => {
    if (isSubmitting || !requireAuth('check_in') || (isEditMode && !existing)) return;
    setSubmitError('');
    let stage: 'validation' | 'photo_upload' | 'save' = 'validation';
    let validationField = 'drinkSlug';
    try {
      const rating = { coffee: form.coffee, service: form.service, place: form.place };
      const selection = drinkSelection(form.drinkSlug, form.customDrinkName);
      // Validate the complete create command before uploading any files.
      validationField = shopId ? 'visitedDate' : 'coffeeShopId';
      const request = isEditMode ? null : buildCheckInRequest({ coffeeShopId: shopId ?? '', note: form.text, rating, isPublic, visitedDate, ...selection });
      setIsSubmitting(true);
      if (existing && checkInId) {
        stage = 'save';
        await update.mutateAsync({ id: checkInId, request: { text: form.text, rating, ...selection } });
        analytics.saved(existing.visibility, !!existing.photos?.length);
      } else if (request) {
        stage = 'photo_upload';
        request.photos = await uploadPhotos();
        stage = 'save';
        const result = await create.mutateAsync(request);
        analytics.saved(result.data.visibility, !!request.photos.length);
        setCreatedVisibility(result.data.visibility);
        if (draftKey) { sessionStorage.removeItem(draftKey); photoDrafts.delete(draftKey); }
      }
      showToast(existing?.visibility === 'Public' || isPublic ? 'Чекин отправлен на модерацию' : 'Чекин сохранён', 'success');
      if (existing?.shop) await openPublic('shops', existing.shop);
    } catch (error) {
      if (stage === 'validation') analytics.validation([validationField]);
      else {
        analytics.failure(error, stage);
        const response = error as { status?: number; errors?: Record<string, unknown> } | null;
        if (response?.status === 400 || response?.status === 422) analytics.validation(Object.keys(response.errors || {}), 'server');
      }
      const message = error instanceof TypeError ? 'Соединение прервалось. Проверьте «Мои чекины» перед повтором.' : getErrorMessage(error);
      setSubmitError(message);
      showToast(message, 'error');
    }
    finally { setIsSubmitting(false); }
  }, invalid => analytics.validation(Object.keys(invalid)));
  const getAverageRating = () => ((ratingCoffee + ratingService + ratingPlace) / 3).toFixed(1);
  const getRatingText = () => 'Средняя оценка';
  if (isEditMode && detail.isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><WobbleRing /></div>;
  if (detail.error) return <p role="alert" className="p-8">{getErrorMessage(detail.error)}</p>;
  if (existing && existing.author?.slug !== user?.address?.slug) return <p className="p-8">Редактировать чекин может только автор.</p>;
  if (!shopFromState) return <p className="p-8">Кофейня недоступна</p>;
  if (createdVisibility) return <main className="mx-auto flex min-h-[75dvh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center"><div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[#EAB308]/20 text-5xl">✓</div><h1 className="text-2xl font-bold">Чекин создан!</h1><p>{createdVisibility === 'Public' ? 'Чекин появится в ленте после проверки.' : 'Запись видна только вам.'}</p><button type="button" onClick={() => navigate('/feed')} className="min-h-11 w-full rounded-full bg-[#EAB308] font-bold text-[#1A1412]">К ленте</button><button type="button" onClick={() => navigate('/check-ins')} className="min-h-11 w-full rounded-full border">Мои чекины</button></main>;
  if (isSubmitting) return <main role="status" className="fixed inset-0 z-[1300] flex flex-col items-center justify-center bg-[#1A1412]/80 px-6 text-center text-white"><WobbleRing size={88} /><h1 className="mt-5 text-2xl font-bold">Отправляем чекин…</h1><p className="mt-2">Сохраняем ваш кофейный момент</p></main>;
  const handleSubmitClick = () => { if (!isSubmitting) { analytics.submit(); void submit(); } };
  const shop = shopFromState;
  const shopImage = shop?.photo || '';

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/55 sm:items-center">
      <main role="dialog" aria-modal="true" aria-label={checkInId ? 'Редактировать чекин' : 'Чекин'} className="max-h-[76dvh] w-full max-w-[720px] overflow-y-auto rounded-t-[28px] border px-4 py-6 sm:rounded-[28px] sm:px-8" style={{ backgroundColor: colors.surface, borderColor: colors.borderSubtle }}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: colors.textMain }}>
              {checkInId ? 'Редактировать чекин' : 'Чекин'}
            </h1>
            <p className="mt-1" style={{ color: colors.textMuted }}>
              {checkInId
                ? `Обновите ваш чекин о ${shop?.name || 'кофейне'}`
                : shop?.name || 'Кофейня'}
            </p>
          </div>
          <button
            onClick={() => { analytics.cancel('editor', 'back'); void openPublic('shops', existing?.shop ?? shopId); }}
            className="flex items-center gap-2 font-semibold hover:opacity-70 transition-opacity"
            style={{ color: colors.textMuted }}
          >
            <AppIcon name="chevron_left" size={24} />
            Назад
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Sidebar */}
          <aside className="hidden">
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
          <div className="col-span-12 space-y-6">
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
                  <div className="flex flex-col gap-2 rounded-2xl border p-4" style={{ borderColor: colors.borderSubtle }}>
                    <Mascot pose="cup" size={52} />
                    <span className="text-sm font-bold" style={{ color: colors.textMain }}>
                      Кофе
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
                  <div className="flex flex-col gap-2 rounded-2xl border p-4" style={{ borderColor: colors.borderSubtle }}>
                    <Mascot pose="happy" size={52} />
                    <span className="text-sm font-bold" style={{ color: colors.textMain }}>
                      Сервис
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
                  <div className="flex flex-col gap-2 rounded-2xl border p-4" style={{ borderColor: colors.borderSubtle }}>
                    <Mascot pose="dance" size={52} />
                    <span className="text-sm font-bold" style={{ color: colors.textMain }}>
                      Атмосфера
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

            </section>

            <section className="border-l-2 border-[#EAB308] pl-4">
              {isEditMode && existing ? <><CheckInStatus item={existing} /><p className="mt-3 text-sm" style={{ color: colors.textMuted }}>Дата посещения: {formatCheckInDate(existing)}. Дата и фотографии сохраняются при редактировании.</p></> : <>
                <label htmlFor="visited-date" className="block font-bold">Дата посещения</label>
                <input id="visited-date" type="date" max={todayInputValue()} value={visitedDate} onChange={e => { analytics.field('visitedDate'); setVisitedDate(e.target.value); }} className="mt-2 min-h-11 w-full rounded-full border p-3" style={{ backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textMain, colorScheme: theme }} />
              </>}
            </section>

            <section className="border-l-2 border-dashed border-[#EAB308] pl-4">
              <label className="block text-sm font-bold" htmlFor="description" style={{ color: colors.textMain }}>Заметка (необязательно)</label>
              <textarea id="description" value={description} onChange={event => { analytics.field('text'); setValue('text', event.target.value); }} maxLength={1000} className="mt-2 min-h-28 w-full resize-none rounded-2xl border p-4 outline-none focus:border-[#EAB308]" style={{ backgroundColor: colors.base, borderColor: colors.borderSubtle, color: colors.textMain }} placeholder="Поделитесь подробностями о вашем визите..." />
            </section>

            <section className="border-l-2 border-dashed border-[#EAB308] pl-4">
              <p className="font-bold">Фотографии (необязательно) · {isEditMode ? existing?.photos?.length || 0 : selectedFiles.length}/5</p>
              {isEditMode && existing ? <CheckInPhotos photos={existing.photos} shopName={existing.shopName} /> : <>
                <p className="mt-1 text-sm" style={{ color: colors.textMuted }}>Добавлено: {selectedFiles.length}/5</p>
                {selectedFiles.length < 5 && <label htmlFor="photo-upload" className="mt-3 flex h-24 w-24 cursor-pointer items-center justify-center rounded-2xl border border-dashed text-3xl" style={{ borderColor: colors.borderSubtle, color: colors.textMuted }}>+</label>}
                <input id="photo-upload" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/avif" multiple onChange={event => { analytics.field('photos'); handleFileSelect(event); }} className="sr-only" />
                <div className="mt-3 flex gap-3 overflow-x-auto">{selectedFiles.map((file, index) => <CheckInPhotoThumb key={`${file.name}-${file.size}-${index}`} file={file} onRemove={() => { analytics.field('photos'); removeFile(index); }} />)}</div>
                {uploadingPhotos && <p className="mt-3">Загрузка фотографий…</p>}
              </>}
            </section>

            <section className="border-l-2 border-dashed border-[#EAB308] pl-4"><DrinkSelector drinkSlug={drinkSlug} customDrinkName={customDrinkName} savedName={existing?.drinkNameRu || existing?.drinkNameEn || undefined} disabled={isSubmitting} onChange={(slug, name) => { analytics.field('drinkSlug'); setValue('drinkSlug', slug); setValue('customDrinkName', name); }} /></section>

            {!isEditMode && <section className="rounded-2xl border p-4" style={{ borderColor: colors.borderSubtle }}><label className="flex min-h-11 items-center justify-between gap-3 font-bold">Сделать публичным<input type="checkbox" role="switch" checked={isPublic} onChange={event => { analytics.field('isPublic'); setIsPublic(event.target.checked); }} className="h-6 w-6 accent-[#EAB308]" /></label><p className="text-sm" style={{ color: colors.textMuted }}>{isPublic ? 'Появится в ленте после модерации' : 'Виден только вам'}</p></section>}

            {errors.text && <p role="alert" className="text-red-500">{errors.text.message}</p>}
            {submitError && <p role="alert" className="text-red-500">{submitError}</p>}
            {/* Submit button */}
            <div className="sticky bottom-0 flex justify-end py-3" style={{ backgroundColor: colors.surface }}>
              <button
                onClick={handleSubmitClick}
                disabled={isSubmitting || (isEditMode && !existing)}
                className={`min-h-11 w-full justify-center px-5 py-2 ${themeClasses.primary.bg} ${themeClasses.primary.bgHover} rounded-full font-bold text-lg flex items-center gap-3 shadow-lg ${themeClasses.primary.shadow} transition-all active:scale-95 group disabled:opacity-50`}
                style={{ color: '#1A1412' }}
              >
                {isSubmitting ? (checkInId ? 'Сохранение...' : 'Отправка...') : (checkInId ? 'Сохранить изменения' : 'Чекин')}
              </button>
            </div>
            </fieldset>
          </div>
        </div>
      </main>

    </div>
  );
};
