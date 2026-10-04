import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm, useWatch, type FieldErrors, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sendCoffeeShopToModeration } from '../api/moderation';
import { formatEquipmentName, getEquipmentCategoryLabel, getPhotoUrl } from '../api/coffeeshop';
import { useCities, useEquipments, useCoffeeBeans, useRoasters, useBrewMethods } from '../hooks/queries/useCatalogs';
import { usePhotoUpload, useMenuPhotoUpload } from '../hooks/usePhotoUpload';
import { usePageTitle } from '../hooks/usePageTitle';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { AddressMapField } from '../components/AddressMapField';
import { CatalogSelection } from '../components/shop-form/CatalogSelection';
import { PhotoUploadField } from '../components/shop-form/PhotoUploadField';
import { ShopScheduleStep } from '../components/shop-form/ShopScheduleStep';
import { CaretLeft, Phone, InstagramLogo, Globe, Envelope, Coffee, Flame, Factory, Leaf } from '../components/Icon';
import { BeanPriceMarks } from '../components/icons/CoffeeBeanSign';
import { brand, dark, light } from '../design-system/tokens';
import { buildShopSubmissionPayload } from '../utils/shopModerationForm';
import { parseShopModerationError } from '../utils/shopModerationFormErrors';
import { createShopDefaults, createShopSchema, type CreateShopFormValues } from '../utils/createShopWizard';
import { PRICE_FILTER_OPTIONS } from '../utils/priceRange';
import { logger } from '../utils/logger';
import './CreateCoffeeShopPage.css';

const STEPS = ['Основная информация', 'Контакты', 'Фотографии', 'Оборудование', 'Расписание'];
const BASIC_FIELDS: FieldPath<CreateShopFormValues>[] = ['name', 'description', 'cityId', 'notValidatedAddress'];
const CONTACT_FIELDS: FieldPath<CreateShopFormValues>[] = ['shopContact.phone', 'shopContact.instagram', 'shopContact.website', 'shopContact.email'];

function catalogItems<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const nested = (data as Record<string, unknown>)[key];
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="shop-wizard-error" role="alert">{message}</p> : null;
}

function scheduleError(errors: FieldErrors<CreateShopFormValues>): string | undefined {
  return errors.schedules?.message ?? errors.schedules?.root?.message ?? errors.schedules?.find?.((item) => item?.closeTime)?.closeTime?.message
    ?? errors.schedules?.find?.((item) => item?.openTime)?.openTime?.message;
}

interface CreateCoffeeShopPageProps { onBack?: () => void }

export default function CreateCoffeeShopPage({ onBack }: CreateCoffeeShopPageProps) {
  usePageTitle('Добавить кофейню');
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const colors = theme === 'dark' ? dark : light;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CreateShopFormValues>({ resolver: zodResolver(createShopSchema), defaultValues: createShopDefaults(), mode: 'onTouched' });
  const values = useWatch({ control: form.control }) as CreateShopFormValues;
  const { errors, isSubmitting } = form.formState;
  const photos = usePhotoUpload({ maxFiles: 10 });
  const menuPhotos = useMenuPhotoUpload();
  const citiesQuery = useCities();
  const equipmentQuery = useEquipments();
  const beansQuery = useCoffeeBeans();
  const roastersQuery = useRoasters();
  const methodsQuery = useBrewMethods();
  const cities = catalogItems<NonNullable<typeof citiesQuery.data>[number]>(citiesQuery.data, 'cities');
  const equipments = catalogItems<NonNullable<typeof equipmentQuery.data>[number]>(equipmentQuery.data, 'equipments');
  const beans = catalogItems<NonNullable<typeof beansQuery.data>[number]>(beansQuery.data, 'beans');
  const roasters = catalogItems<NonNullable<typeof roastersQuery.data>[number]>(roastersQuery.data, 'roasters');
  const methods = catalogItems<NonNullable<typeof methodsQuery.data>[number]>(methodsQuery.data, 'methods');
  const busy = isSubmitting || photos.uploadingPhotos || menuPhotos.uploadingPhotos;
  const canContinue = !!values.name?.trim() && !!values.cityId && !!values.notValidatedAddress?.trim();
  const handleExit = onBack ?? (() => navigate('/shops'));

  useEffect(() => {
    const list = catalogItems<NonNullable<typeof citiesQuery.data>[number]>(citiesQuery.data, 'cities');
    const city = list.find((item) => /^мінск$|^минск$|^minsk$/i.test(item.name.trim())) ?? list[0];
    if (city && !form.getValues('cityId')) form.setValue('cityId', city.id);
  }, [citiesQuery.data, form]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [step]);

  const updateSelection = (field: 'equipmentIds' | 'coffeeBeanIds' | 'roasterIds' | 'brewMethodIds', ids: string[]) => {
    form.setValue(field, ids, { shouldDirty: true });
  };

  const submit = form.handleSubmit(async (data) => {
    setError(null);
    try {
      const [uploadedPhotos, uploadedMenuPhotos] = await Promise.all([photos.uploadPhotos(), menuPhotos.uploadPhotos()]);
      const website = data.shopContact.website;
      const payload = buildShopSubmissionPayload({ ...data, shopContact: { ...data.shopContact, website: website && !/^https?:\/\//i.test(website) ? `https://${website}` : website } });
      const response = await sendCoffeeShopToModeration(payload, uploadedPhotos.length ? uploadedPhotos : undefined, uploadedMenuPhotos.length ? uploadedMenuPhotos : undefined);
      showToast(response.data?.isAddressValidated ? 'Заявка отправлена на модерацию' : 'Заявка принята, адрес проверит модератор', response.data?.isAddressValidated ? 'success' : 'warning');
      photos.clearFiles();
      menuPhotos.clearFiles();
      handleExit();
    } catch (err: unknown) {
      const parsed = parseShopModerationError(err);
      for (const [field, message] of Object.entries(parsed.fieldErrors)) form.setError(field as FieldPath<CreateShopFormValues>, { type: 'server', message });
      if (Object.keys(parsed.fieldErrors).length) setStep(0);
      setError(parsed.globalError);
      logger.error('Error submitting coffee shop:', err);
    }
  }, (invalid) => {
    if (invalid.name || invalid.cityId || invalid.notValidatedAddress || invalid.description) setStep(0);
    else if (invalid.shopContact) setStep(1);
    else if (invalid.schedules) setStep(4);
  });

  const advance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (step === 4) { await submit(event); return; }
    const fields = step === 0 ? BASIC_FIELDS : step === 1 ? CONTACT_FIELDS : [];
    if (!fields.length || await form.trigger(fields, { shouldFocus: true })) { setError(null); setStep((current) => current + 1); }
  };

  const style = {
    '--wizard-bg': colors.background, '--wizard-surface': colors.surface,
    '--wizard-text': colors.textPrimary, '--wizard-muted': colors.textSecondary,
    '--wizard-border': colors.border, '--wizard-accent': brand.primary,
    '--wizard-accent-hover': brand.primaryHover, colorScheme: theme,
  } as CSSProperties;
  const priceIndex = values.priceRange ? PRICE_FILTER_OPTIONS.findIndex((option) => option.value === values.priceRange) + 1 : 0;

  return (
    <main className="shop-wizard" style={style}>
      <div className="shop-wizard-content">
        <header className="shop-wizard-header">
          <button type="button" className="shop-wizard-back" disabled={busy} aria-label={step === 0 ? 'Вернуться к кофейням' : 'Предыдущий шаг'} onClick={() => { if (step === 0) handleExit(); else { setError(null); setStep(step - 1); } }}><CaretLeft size={24} weight="light" /></button>
          <h1 ref={headingRef} tabIndex={-1}>{STEPS[step]}</h1>
        </header>
        <ol className="shop-wizard-progress" aria-label="Шаги добавления кофейни">
          {STEPS.map((title, index) => <li key={title} className={index === step ? 'is-current' : ''} aria-current={index === step ? 'step' : undefined}><span className="sr-only">Шаг {index + 1} из 5: {title}</span></li>)}
        </ol>
        <form onSubmit={advance} noValidate aria-label="Добавление кофейни">
          <fieldset disabled={busy} className="shop-wizard-fields">
            <div className="shop-wizard-intro">
              <p>{step === 0 ? 'Поля со * обязательны для заполнения' : 'Необязательно — можно пропустить'}</p>
              {step === 1 && <p className="shop-wizard-muted">Заполните поля, которые актуальны для вашего заведения.</p>}
              {step === 3 && <p className="shop-wizard-muted">Отметьте то, что есть в заведении.</p>}
              {step === 4 && <p className="shop-wizard-muted">По умолчанию кофейня открыта каждый день.</p>}
            </div>

            {step === 0 && (
              <div className="shop-wizard-basic shop-wizard-field-stack">
                <div>
                  <label className="shop-wizard-label" htmlFor="shop-name">Название кофейни *</label>
                  <input id="shop-name" className="shop-wizard-input" placeholder="Например, Surf Coffee" maxLength={55} required aria-invalid={!!errors.name} aria-describedby={errors.name ? 'shop-name-error' : 'shop-name-count'} {...form.register('name')} />
                  <p id="shop-name-count" className="shop-wizard-count">{values.name?.length ?? 0}/55</p>
                  <FieldError id="shop-name-error" message={errors.name?.message} />
                </div>
                <div>
                  <label className="shop-wizard-label" htmlFor="shop-description">Описание <span>необязательно</span></label>
                  <textarea id="shop-description" className="shop-wizard-input shop-wizard-textarea" rows={3} placeholder="Расскажите о концепции, атмосфере и фишках кофейни…" aria-invalid={!!errors.description} aria-describedby={errors.description ? 'shop-description-error' : undefined} {...form.register('description')} />
                  <FieldError id="shop-description-error" message={errors.description?.message} />
                </div>
                <div>
                  <label className="shop-wizard-label" htmlFor="shop-city">Город *</label>
                  <select id="shop-city" className="shop-wizard-input" required disabled={citiesQuery.isPending} aria-invalid={!!errors.cityId} aria-describedby={errors.cityId ? 'shop-city-error' : undefined} {...form.register('cityId')}>
                    {!cities.length && <option value="">{citiesQuery.isPending ? 'Загрузка городов…' : 'Выберите город'}</option>}
                    {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
                  </select>
                  <FieldError id="shop-city-error" message={errors.cityId?.message} />
                  {(citiesQuery.isError || (!citiesQuery.isPending && !cities.length)) && <p className="shop-wizard-error" role="alert">Не удалось загрузить города. <button type="button" className="shop-wizard-text-button" onClick={() => void citiesQuery.refetch()}>Повторить</button></p>}
                </div>
                <Controller control={form.control} name="notValidatedAddress" render={({ field }) => <AddressMapField compact value={field.value} onChange={field.onChange} error={errors.notValidatedAddress?.message} inputClassName="shop-wizard-input" />} />
                <div className="shop-wizard-price">
                  <label className="shop-wizard-label shop-wizard-price-label" htmlFor="shop-price">Цена</label>
                  <input id="shop-price" className="shop-wizard-price-range" type="range" min={0} max={3} step={1} value={priceIndex} aria-valuetext={priceIndex ? PRICE_FILTER_OPTIONS[priceIndex - 1].label : 'Не указана'} onChange={(event) => form.setValue('priceRange', PRICE_FILTER_OPTIONS[Number(event.target.value) - 1]?.value, { shouldDirty: true })} />
                  <div className="shop-wizard-price-marks">
                    <span aria-hidden="true" />
                    {PRICE_FILTER_OPTIONS.map((option) => <button type="button" key={option.value} aria-label={option.label} aria-pressed={values.priceRange === option.value} className={values.priceRange === option.value ? 'is-selected' : ''} onClick={() => form.setValue('priceRange', values.priceRange === option.value ? undefined : option.value, { shouldDirty: true })}><BeanPriceMarks count={option.tiers} size={19} color="currentColor" /></button>)}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="shop-wizard-field-stack shop-wizard-contacts">
                {[
                  { field: 'phone' as const, label: 'Номер телефона', placeholder: '+375', type: 'tel', icon: Phone },
                  { field: 'instagram' as const, label: 'Instagram профиль', placeholder: '@', type: 'text', icon: InstagramLogo },
                  { field: 'website' as const, label: 'Веб-сайт', placeholder: 'mycoffee.by', type: 'text', icon: Globe },
                  { field: 'email' as const, label: 'Email', placeholder: 'info@coffee.by', type: 'email', icon: Envelope },
                ].map(({ field, label, placeholder, type, icon: Icon }) => (
                  <div key={field}>
                    <label className="shop-wizard-label" htmlFor={`shop-${field}`}>{label} <span>необязательно</span></label>
                    <div className="shop-wizard-icon-input"><Icon size={23} weight="light" aria-hidden="true" /><input id={`shop-${field}`} type={type} className="shop-wizard-input" placeholder={placeholder} aria-invalid={!!errors.shopContact?.[field]} aria-describedby={errors.shopContact?.[field] ? `shop-${field}-error` : undefined} {...form.register(`shopContact.${field}`)} /></div>
                    <FieldError id={`shop-${field}-error`} message={errors.shopContact?.[field]?.message} />
                  </div>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="shop-wizard-photos">
                <PhotoUploadField id="shop-photo-upload" title="Фотографии кофейни" description="До 10 фотографий (необязательно). Можно выбрать несколько сразу." files={photos.selectedFiles} maxFiles={10} onSelect={photos.handleFileSelect} onRemove={photos.removeFile} />
                <PhotoUploadField id="menu-photo-upload" title="Фото меню" description="До 4 фото меню (необязательно). Не попадут в галерею кофейни." files={menuPhotos.selectedFiles} maxFiles={4} onSelect={menuPhotos.handleFileSelect} onRemove={menuPhotos.removeFile} />
              </div>
            )}

            {step === 3 && (
              <div className="shop-wizard-catalogs">
                <CatalogSelection title="Методы приготовления" items={methods} selectedIds={values.brewMethodIds} onChange={(ids) => updateSelection('brewMethodIds', ids)} icon={<Coffee size={25} weight="light" />} loading={methodsQuery.isPending} failed={methodsQuery.isError} onRetry={() => void methodsQuery.refetch()} />
                <CatalogSelection title="Обжарщики" items={roasters.map((roaster) => ({ ...roaster, image: roaster.photoUrl ?? (roaster.coverPhoto ? getPhotoUrl(roaster.coverPhoto, 'thumbnail') : undefined) }))} selectedIds={values.roasterIds} onChange={(ids) => updateSelection('roasterIds', ids)} icon={<Flame size={25} weight="light" />} loading={roastersQuery.isPending} failed={roastersQuery.isError} onRetry={() => void roastersQuery.refetch()} />
                <CatalogSelection title="Оборудование" items={equipments.map((item) => ({ id: item.id, name: formatEquipmentName(item), detail: getEquipmentCategoryLabel(item.category) }))} selectedIds={values.equipmentIds} onChange={(ids) => updateSelection('equipmentIds', ids)} icon={<Factory size={25} weight="light" />} loading={equipmentQuery.isPending} failed={equipmentQuery.isError} onRetry={() => void equipmentQuery.refetch()} />
                <CatalogSelection title="Кофейные зёрна" items={beans} selectedIds={values.coffeeBeanIds} onChange={(ids) => updateSelection('coffeeBeanIds', ids)} icon={<Leaf size={25} weight="light" />} loading={beansQuery.isPending} failed={beansQuery.isError} onRetry={() => void beansQuery.refetch()} />
              </div>
            )}

            <div hidden={step !== 4}><ShopScheduleStep schedules={values.schedules} onChange={(schedules) => form.setValue('schedules', schedules, { shouldDirty: true, shouldValidate: !!errors.schedules })} error={scheduleError(errors)} /></div>
          </fieldset>

          {(error || photos.error || menuPhotos.error) && <p className="shop-wizard-error shop-wizard-global-error" role="alert">{photos.error || menuPhotos.error || error}</p>}
          <button type="submit" className="shop-wizard-next" disabled={busy || (step === 0 && !canContinue)}>
            {photos.uploadingPhotos || menuPhotos.uploadingPhotos ? 'Загрузка фотографий…' : isSubmitting ? 'Отправка…' : step === 4 ? 'Отправить на модерацию' : 'Далее'}
          </button>
        </form>
      </div>
    </main>
  );
}
