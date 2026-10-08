import { usePublicResolution } from '../components/PublicAddressPage';
import { usePublicNavigate } from '../hooks/usePublicNavigate';
import WobbleRing from '../components/WobbleRing';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import type { CreateCheckInRequest } from '../api/coffeeshop';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../constants/colors';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useToast } from '../contexts/ToastContext';
import { useCheckInPhotoUpload } from '../hooks/usePhotoUpload';
import { MAX_CHECKIN_PHOTOS } from '../api/photos';
import { logger } from '../utils/logger';
import { buildCheckInRequest, CheckInValidationError } from '../utils/checkInForm';
import { useCreateCheckIn } from '../hooks/queries/useCheckIns';
import { useCheckInDraft } from '../hooks/useCheckInDraft';
import { getErrorMessage } from '../utils/errorHandler';
import { usePageTitle } from '../hooks/usePageTitle';
import { CaretLeft } from '../components/Icon';
import CheckInForm from '../components/CheckInForm';

interface ShopBasicInfo {
  name: string;
  address: string;
  photo: string;
}


const CreateCheckInPage: React.FC = () => {
  const { shopId: routeId } = useParams<{ shopId: string }>();
  const shopId = usePublicResolution()?.id ?? routeId;
  const navigate = useNavigate();
  const openPublic = usePublicNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { requireAuth } = useRequireAuth();
  const { showToast } = useToast();
  const shopFromState = (location.state as { shop?: ShopBasicInfo })?.shop;

  usePageTitle('Чекин');

  useEffect(() => {
    if (!shopId) {
      navigate('/shops');
      return;
    }
    if (!shopFromState) {
      openPublic('shops', shopId!);
    }
  }, [shopFromState, shopId, navigate]);

  const { mutateAsync: submitCheckIn } = useCreateCheckIn();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { draft, updateDraft, clearDraft } = useCheckInDraft(shopId);
  const { selectedFiles, uploadingPhotos, setSelectedFiles, uploadPhotos, clearFiles } = useCheckInPhotoUpload();

  useEffect(() => {
    if (!draft) return;
    setSelectedFiles(draft.selectedFiles.slice(0, MAX_CHECKIN_PHOTOS));
  }, [draft?.coffeeShopId, setSelectedFiles]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const nextFiles = [...selectedFiles, ...Array.from(event.target.files)].slice(0, MAX_CHECKIN_PHOTOS);
    setSelectedFiles(nextFiles);
    updateDraft({ selectedFiles: nextFiles });
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    const nextFiles = selectedFiles.filter((_, fileIndex) => fileIndex !== index);
    setSelectedFiles(nextFiles);
    updateDraft({ selectedFiles: nextFiles });
  };

  const handleSubmit = async () => {
    if (isSubmitting || !requireAuth()) return;
    if (!shopId || !draft) return;

    let request: CreateCheckInRequest;
    try {
      request = buildCheckInRequest({
        coffeeShopId: shopId,
        isPublic: draft.isPublic,
        note: draft.note,
        visitedDate: draft.visitedDate,
        rating: draft.rating,
        drinkSlug: draft.drinkSlug,
        customDrinkName: draft.customDrinkName,
      });
    } catch (err) {
      showToast(err instanceof CheckInValidationError ? err.message : 'Проверьте данные чекина', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      request.photos = await uploadPhotos();
      const response = await submitCheckIn(request);
      if (!response.success || response.isSuccess === false) throw new Error('Не удалось создать чекин');
      if (response.success) {
        showToast(draft.isPublic ? 'Публичный чекин отправлен на модерацию.' : 'Чекин успешно создан!', 'success');
        clearDraft();
        clearFiles();
        openPublic('shops', shopId!);
      }
    } catch (err) {
      logger.error('Error submitting check-in:', err);
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!shopFromState || !draft) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.background }}>
        <WobbleRing size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-[var(--app-content-height,100dvh)]" style={{ backgroundColor: colors.background }}>
      <main className="sm:max-w-[420px] sm:mx-auto sm:px-4 sm:py-6 h-[var(--app-content-height,100dvh)] sm:h-auto flex flex-col">
        <button
          type="button"
          onClick={() => openPublic('shops', shopId!)}
          className="hidden sm:flex items-center gap-2 mb-5 font-body text-sm"
          style={{ color: colors.textSecondary }}
        >
          <CaretLeft size={18} />
          Назад
        </button>
        <div
          className="mt-auto sm:mt-0 flex flex-col min-h-0 max-h-[min(85dvh,100%)] sm:max-h-none overflow-hidden rounded-t-[28px] sm:rounded-[28px] shadow-[0_-8px_40px_rgba(0,0,0,0.12)] sm:shadow-none"
          style={{ backgroundColor: colors.card }}
        >
          <div className="sm:hidden shrink-0 pt-2.5 pb-1">
            <div className="mx-auto h-1 w-10 rounded-full" style={{ backgroundColor: colors.border }} />
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <CheckInForm
              shopName={shopFromState.name}
              drinkSlug={draft.drinkSlug || ''}
              customDrinkName={draft.customDrinkName || ''}
              onDrinkChange={(drinkSlug, customDrinkName) => updateDraft({ drinkSlug, customDrinkName })}
              note={draft.note}
              onNoteChange={(note) => updateDraft({ note })}
              isPublic={draft.isPublic}
              onPublicChange={(isPublic) => updateDraft({ isPublic })}
              visitedDate={draft.visitedDate}
              onVisitedDateChange={(visitedDate) => updateDraft({ visitedDate })}
              ratingCoffee={draft.rating.coffee}
              ratingService={draft.rating.service}
              ratingPlace={draft.rating.place}
              onRatingCoffee={(coffee) => updateDraft({ rating: { ...draft.rating, coffee } })}
              onRatingService={(service) => updateDraft({ rating: { ...draft.rating, service } })}
              onRatingPlace={(place) => updateDraft({ rating: { ...draft.rating, place } })}
              selectedFiles={selectedFiles}
              onFileSelect={handleFileSelect}
              onRemoveFile={removeFile}
              uploadingPhotos={uploadingPhotos}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateCheckInPage;
