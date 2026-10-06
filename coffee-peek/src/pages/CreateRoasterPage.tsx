import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendRoasterToModeration } from '../api/moderation';
import { getCities, type City } from '../api/coffeeshop';
import { getRoasterUploadUrls } from '../api/photos';
import Button from '../components/Button';
import MaterialSelect from '../components/MaterialSelect';
import { ShopDetailSkeleton } from '../components/skeletons';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { getThemeClasses } from '../utils/theme';
import { isApiRequestError } from '../api/core/apiError';
import { getErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { usePageTitle } from '../hooks/usePageTitle';
import { usePhotoUpload } from '../hooks/usePhotoUpload';
import { AppIcon } from '../components/icons';
import { MapPin, Images } from '@/components/Icon';

const NAME_MAX_LENGTH = 100;

interface FormState {
  name: string;
  about: string;
  cityId: string;
  address: string;
  instagramLink: string;
  siteLink: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  about: '',
  cityId: '',
  address: '',
  instagramLink: '',
  siteLink: '',
};

const CreateRoasterPage: React.FC = () => {
  usePageTitle('Добавить обжарщика');
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const themeClasses = getThemeClasses(theme);

  const [cities, setCities] = useState<City[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(true);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const { selectedFiles, uploadingPhotos, error: uploadError, handleFileSelect, removeFile, uploadPhotos, clearFiles } =
    usePhotoUpload({ getUrls: getRoasterUploadUrls });

  useEffect(() => {
    const loadCities = async () => {
      try {
        const res = await getCities();
        setCities(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        logger.error('Error loading cities:', err);
      } finally {
        setIsLoadingCities(false);
      }
    };
    loadCities();
  }, []);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'name') setNameError(null);
  };

  const handleBack = () => navigate('/settings');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNameError(null);

    const name = form.name.trim();
    if (!name) {
      setNameError('Укажите название обжарщика');
      return;
    }
    if (name.length > NAME_MAX_LENGTH) {
      setNameError(`Название не должно превышать ${NAME_MAX_LENGTH} символов`);
      return;
    }

    try {
      setIsSubmitting(true);
      const uploadedPhotos = await uploadPhotos();
      const response = await sendRoasterToModeration({
        name,
        about: form.about.trim(),
        cityId: form.cityId,
        address: form.address.trim(),
        instagramLink: form.instagramLink.trim(),
        siteLink: form.siteLink.trim(),
        photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
      });

      if (response.data?.isAddressValidated === false) {
        showToast('Заявка принята, адрес проверит модератор', 'warning');
      } else {
        showToast('Заявка отправлена на модерацию', 'success');
      }
      clearFiles();
      handleBack();
    } catch (err: unknown) {
      if (isApiRequestError(err) && err.status === 409) {
        setNameError('Обжарщик с таким названием уже существует');
      } else {
        setError(getErrorMessage(err));
      }
      logger.error('Error submitting roaster:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const bgClass = theme === 'dark' ? 'bg-[#1A1412]' : 'bg-[#FCFBFA]';

  if (isLoadingCities) {
    return <ShopDetailSkeleton />;
  }

  return (
    <div className={`min-h-screen ${bgClass} pt-4 sm:pt-6 pb-8 sm:pb-12 px-4 sm:px-6 overflow-x-hidden`}>
      <div className="max-w-2xl mx-auto min-w-0">
        <div className="mb-6 sm:mb-8">
          <button
            onClick={handleBack}
            className={`mb-3 sm:mb-6 flex items-center gap-2 ${themeClasses.text.secondary} hover:${themeClasses.text.primary} transition-colors`}
          >
            <AppIcon name="chevron_left" size={24} />
            <span>Назад</span>
          </button>
          <h1 className={`text-2xl sm:text-4xl font-bold ${themeClasses.text.primary} mb-2 break-words`}>Добавить обжарщика</h1>
          <p className={`${themeClasses.text.secondary} text-sm sm:text-base`}>Заявка уйдёт на модерацию и появится в каталоге после проверки</p>
        </div>

        {(error || uploadError) && (
          <div className={`mb-6 p-4 ${theme === 'dark' ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'} border rounded-2xl`}>
            <p className={`text-sm ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>{error || uploadError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-8 min-w-0">
          <div className={`${themeClasses.bg.card} border ${themeClasses.border.default} rounded-2xl sm:rounded-3xl p-4 sm:p-8 space-y-4`}>
            <div>
              <label className={`${themeClasses.text.secondary} text-sm mb-2 block font-medium`}>Название *</label>
              <input
                type="text"
                required
                maxLength={NAME_MAX_LENGTH}
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`w-full ${themeClasses.bg.input} border-2 ${themeClasses.border.default} rounded-2xl py-3 px-4 ${themeClasses.text.primary} focus:outline-none focus:border-[#EAB308] transition-all ${nameError ? 'border-red-500 focus:border-red-500' : ''}`}
                placeholder="Название обжарщика"
              />
              {nameError && (
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>{nameError}</p>
              )}
            </div>

            <div>
              <label className={`${themeClasses.text.secondary} text-sm mb-2 block font-medium`}>О компании</label>
              <textarea
                value={form.about}
                onChange={(e) => handleChange('about', e.target.value)}
                className={`w-full ${themeClasses.bg.input} border-2 ${themeClasses.border.default} rounded-2xl py-3 px-4 ${themeClasses.text.primary} focus:outline-none focus:border-[#EAB308] transition-all`}
                rows={4}
                placeholder="Чем занимается обжарщик"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MaterialSelect
                label="Город"
                value={form.cityId}
                onChange={(value) => handleChange('cityId', value)}
                options={[
                  { value: '', label: 'Не указан' },
                  ...cities.map((c) => ({ value: c.id, label: c.name })),
                ]}
                icon={<MapPin size={20} />}
              />

              <div>
                <label className={`${themeClasses.text.secondary} text-sm mb-2 block font-medium`}>Адрес</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className={`w-full ${themeClasses.bg.input} border-2 ${themeClasses.border.default} rounded-2xl py-3 px-4 ${themeClasses.text.primary} focus:outline-none focus:border-[#EAB308] transition-all`}
                  placeholder="Улица и дом"
                />
              </div>
            </div>
            {form.address && !form.cityId && (
              <p className={`text-xs ${themeClasses.text.secondary}`}>Выберите город, чтобы адрес отображался в профиле</p>
            )}
          </div>

          <div className={`${themeClasses.bg.card} border ${themeClasses.border.default} rounded-2xl sm:rounded-3xl p-4 sm:p-8 space-y-4`}>
            <h3 className={`text-xl sm:text-2xl font-semibold ${themeClasses.text.primary} mb-4 sm:mb-6`}>Контакты</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`${themeClasses.text.secondary} text-sm mb-2 block font-medium`}>Instagram</label>
                <input
                  type="text"
                  value={form.instagramLink}
                  onChange={(e) => handleChange('instagramLink', e.target.value)}
                  className={`w-full ${themeClasses.bg.input} border-2 ${themeClasses.border.default} rounded-2xl py-3 px-4 ${themeClasses.text.primary} focus:outline-none focus:border-[#EAB308] transition-all`}
                  placeholder="https://instagram.com/..."
                />
              </div>
              <div>
                <label className={`${themeClasses.text.secondary} text-sm mb-2 block font-medium`}>Сайт</label>
                <input
                  type="url"
                  value={form.siteLink}
                  onChange={(e) => handleChange('siteLink', e.target.value)}
                  className={`w-full ${themeClasses.bg.input} border-2 ${themeClasses.border.default} rounded-2xl py-3 px-4 ${themeClasses.text.primary} focus:outline-none focus:border-[#EAB308] transition-all`}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <div className={`${themeClasses.bg.card} border ${themeClasses.border.default} rounded-2xl sm:rounded-3xl p-4 sm:p-8 space-y-4`}>
            <h3 className={`text-xl sm:text-2xl font-semibold ${themeClasses.text.primary} mb-4 sm:mb-6`}>Фотографии</h3>
            <div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="roaster-photo-upload"
              />
              <label
                htmlFor="roaster-photo-upload"
                className={`block w-full ${themeClasses.bg.input} border-2 border-dashed ${themeClasses.border.default} rounded-2xl py-8 px-4 text-center cursor-pointer hover:border-[#EAB308] transition-all`}
              >
                <Images size={48} className={`mx-auto mb-2 ${themeClasses.text.secondary}`} />
                <span className={themeClasses.text.secondary}>Нажмите для выбора фотографий</span>
              </label>
            </div>

            {selectedFiles.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 border-t ${themeClasses.border.default}`}>
            <Button
              type="submit"
              variant="primary"
              className="w-full sm:flex-1 whitespace-nowrap"
              isLoading={isSubmitting || uploadingPhotos}
              disabled={isSubmitting || uploadingPhotos}
            >
              {uploadingPhotos ? 'Загрузка фотографий...' : isSubmitting ? 'Отправка...' : 'Отправить на модерацию'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleBack}
              className="w-full sm:w-auto sm:min-w-32"
              disabled={isSubmitting || uploadingPhotos}
            >
              Отмена
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoasterPage;
