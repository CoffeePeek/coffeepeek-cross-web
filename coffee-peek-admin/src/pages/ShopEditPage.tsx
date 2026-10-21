import { Input } from '@/src/components/ui/Input';
import { NativeSelect } from '@/src/components/ui/NativeSelect';
import { Textarea } from '@/src/components/ui/Textarea';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  getModerationShopById,
  updateCoffeeShop,
  approveShop,
  rejectShop,
  AdminShopSchedule,
} from '../api/admin';
import { useToast } from '../contexts/ToastContext';
import { useCatalogs } from '../hooks/useCatalogs';
import { Badge, statusToBadgeVariant, statusLabels } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PhotoGallery } from '../components/moderation/PhotoGallery';
import { ScheduleEditor, getDefaultSchedules } from '../components/moderation/ScheduleEditor';
import { CatalogMultiSelect } from '../components/moderation/CatalogMultiSelect';
import { PriceRangePicker } from '../components/PriceRangePicker';
import { MenuEditor } from '../components/menu/MenuEditor';
import {
  attachModerationShopMenuPhotos,
  parseModerationShopMenu,
  updateModerationShopMenu,
} from '../api/menu';
import { ShopSubmissionInfo } from '../components/ShopSubmissionInfo';
import { moderationContactShape, validateSchedules } from '../utils/shopForm';

const schema = z.object({
  name: z.string().min(1, 'Обязательное поле'),
  address: z.string().min(1, 'Обязательное поле'),
  description: z.string().optional(),
  cityId: z.string().optional(),
  priceRange: z.coerce.number().min(1).max(4).optional().or(z.literal('')),
  ...moderationContactShape,
});

type FormData = z.infer<typeof schema>;

type PendingAction = 'approve' | 'reject';

export const ShopEditPage: React.FC<{ id: string }> = ({ id }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [schedules, setSchedules] = useState<AdminShopSchedule[]>(getDefaultSchedules());
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [coffeeBeanIds, setCoffeeBeanIds] = useState<string[]>([]);
  const [roasterIds, setRoasterIds] = useState<string[]>([]);
  const [brewMethodIds, setBrewMethodIds] = useState<string[]>([]);
  // Edits outside react-hook-form (schedule, catalogs); schedules are only sent if touched or already stored.
  const [extraDirty, setExtraDirty] = useState(false);
  const [schedulesTouched, setSchedulesTouched] = useState(false);
  const [hadSchedules, setHadSchedules] = useState(false);
  const initializedShopIdRef = useRef<string | null>(null);
  const markDirty =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setExtraDirty(true);
    };

  const { data: shop, isLoading } = useQuery({
    queryKey: ['admin', 'shop', id],
    queryFn: () => getModerationShopById(id!).then((r) => r.data),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.menu?.parseStatus;
      return status === 'Pending' || status === 'Running' ? 2500 : false;
    },
  });

  const { data: catalogs, isLoading: catalogsLoading } = useCatalogs();


  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Initialize once per shop: refetches (menu parse polling, saves) must not wipe unsaved edits.
  useEffect(() => {
    if (!shop || initializedShopIdRef.current === shop.id) return;
    initializedShopIdRef.current = shop.id;

    reset({
      name: shop.name,
      address: shop.address,
      description: shop.description ?? '',
      cityId: shop.cityId ?? '',
      priceRange: shop.priceRange,
      phone: shop.shopContact?.phone ?? '',
      email: shop.shopContact?.email ?? '',
      website: shop.shopContact?.website ?? '',
      instagram: shop.shopContact?.instagram ?? '',
    });

    setHadSchedules(Boolean(shop.schedules?.length));
    setSchedules(shop.schedules?.length ? shop.schedules : getDefaultSchedules());
    setSchedulesTouched(false);
    setEquipmentIds(shop.equipmentIds ?? []);
    setCoffeeBeanIds(shop.coffeeBeanIds ?? []);
    setRoasterIds(shop.roasterIds ?? []);
    setBrewMethodIds(shop.brewMethodIds ?? []);
    setExtraDirty(false);
  }, [shop, reset]);

  const sendSchedules = schedulesTouched || hadSchedules;

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      updateCoffeeShop(id!, {
        name: data.name,
        address: data.address,
        description: data.description,
        // The backend can't clear a city; an empty select keeps the stored one.
        cityId: data.cityId || undefined,
        // PriceRange is a non-nullable enum on the backend, so it cannot be cleared.
        priceRange: data.priceRange ? Number(data.priceRange) : undefined,
        shopContact: {
          phone: data.phone ?? '',
          email: data.email ?? '',
          website: data.website ?? '',
          instagram: data.instagram ?? '',
        },
        // Don't publish template hours for a shop that never had a schedule.
        schedules: sendSchedules ? schedules : undefined,
        equipmentIds,
        coffeeBeanIds,
        roasterIds,
        brewMethodIds,
      }),
    onSuccess: (_response, data) => {
      reset(data);
      setExtraDirty(false);
      if (sendSchedules) setHadSchedules(true);
      showToast('Кофейня обновлена', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'shop', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'moderation', 'shops'] });
    },
    onError: (err: any) => showToast(err?.message ?? 'Ошибка сохранения', 'error'),
  });

  const approveMutation = useMutation({
    mutationFn: (comment?: string) => approveShop(id!, comment ? { comment } : undefined),
    onSuccess: () => {
      showToast('Кофейня одобрена', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'shop', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'moderation', 'shops'] });
      setPendingAction(null);
      qc.invalidateQueries({ queryKey: ['admin', 'published-shops'] });
    },
    onError: (err: any) => showToast(err?.message ?? 'Ошибка', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (comment?: string) => rejectShop(id!, comment ? { comment } : undefined),
    onSuccess: () => {
      showToast('Кофейня отклонена', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'shop', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'moderation', 'shops'] });
      navigate('/shops');
    },
    onError: (err: any) => showToast(err?.message ?? 'Ошибка', 'error'),
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted dark:text-stone-400">Кофейня не найдена</p>
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate('/shops')}>
          ← Назад к списку
        </Button>
      </div>
    );
  }

  // The backend rejects edits of an approved (already published) submission.
  const isApproved = shop.status === 'Approved';

  const requestAction = (action: PendingAction) => {
    if (
      (isDirty || extraDirty) &&
      !window.confirm('Есть несохранённые изменения — продолжить без сохранения?')
    ) {
      return;
    }
    setPendingAction(action);
  };

  const submitForm = handleSubmit((data) => {
    const scheduleError = sendSchedules ? validateSchedules(schedules) : null;
    if (scheduleError) {
      showToast(scheduleError, 'error');
      return;
    }
    updateMutation.mutate(data);
  });
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="mt-1 p-2 -ml-2 text-text-muted dark:text-stone-400 hover:text-text-main dark:hover:text-white transition-colors"
            aria-label="Назад"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white text-xl sm:text-2xl">{shop.name}</h2>
              <Badge variant={statusToBadgeVariant(shop.status)}>{statusLabels[shop.status]}</Badge>
              <Badge variant="info">Заполнено: {shop.dataCompletenessScore}%</Badge>
            </div>
            <p className="text-sm text-text-muted dark:text-stone-400 font-body mt-1 break-words">
              {shop.address}
            </p>
          </div>
        </div>

        {shop.status === 'Pending' && (
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Button
              variant="success"
              size="sm"
              loading={approveMutation.isPending}
              onClick={() => requestAction('approve')}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
            >
              Одобрить
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={rejectMutation.isPending}
              onClick={() => requestAction('reject')}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
            >
              Отклонить
            </Button>
          </div>
        )}
      </div>

      {isApproved && (
        <Card className="p-4 text-sm">Заявка одобрена. Редактирование опубликованной кофейни доступно администратору.</Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] gap-5">
        <div className="space-y-5">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-text-main dark:text-white font-display mb-3">
              Фотографии ({shop.photos?.length ?? 0})
            </h3>
            <PhotoGallery photos={shop.photos ?? []} />
          </Card>

          <ShopSubmissionInfo shop={shop} />
        </div>

        <form
          onSubmit={submitForm}
          className="space-y-5"
        >
          <fieldset disabled={isApproved} className="min-w-0 space-y-5">
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-text-main dark:text-white font-display mb-4">
                Основная информация
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Название *" error={errors.name?.message}>
                    <Input {...register('name')} />
                  </Field>
                  <Field label="Город">
                    {/* Remount once options exist, otherwise the stored city can't be selected and shows «Не указан». */}
                    <NativeSelect key={catalogs ? 'ready' : 'loading'} {...register('cityId')} disabled={catalogsLoading}>
                      <option value="">Не указан</option>
                      {catalogs?.cities.map((city) => (
                        <option key={city.id} value={city.id}>{city.name}</option>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>

                <Field label="Адрес *" error={errors.address?.message}>
                  <Input {...register('address')} />
                </Field>

                <Field label="Описание">
                  <Textarea {...register('description')} rows={5} className="min-h-32 resize-y" />
                </Field>

                <Field label="Ценовой диапазон">
                  <PriceRangePicker
                    value={watch('priceRange')}
                    onChange={(value) =>
                      setValue('priceRange', value ?? '', { shouldValidate: true, shouldDirty: true })
                    }
                    allowEmpty
                    error={errors.priceRange?.message}
                  />
                </Field>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-sm font-semibold text-text-main dark:text-white font-display mb-4">Контакты</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Телефон" error={errors.phone?.message}>
                  <Input {...register('phone')} placeholder="+375 ..." />
                </Field>
                <Field label="Email" error={errors.email?.message}>
                  <Input {...register('email')} placeholder="coffee@example.com" />
                </Field>
                <Field label="Сайт" error={errors.website?.message}>
                  <Input {...register('website')} placeholder="https://..." />
                </Field>
                <Field label="Instagram" error={errors.instagram?.message}>
                  <Input {...register('instagram')} placeholder="@coffeeshop" />
                </Field>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-sm font-semibold text-text-main dark:text-white font-display mb-4">
                Расписание работы
              </h3>
              <ScheduleEditor
                value={schedules}
                onChange={(next) => {
                  setSchedules(next);
                  setSchedulesTouched(true);
                  setExtraDirty(true);
                }}
              />
            </Card>

            <Card className="p-6">
              <h3 className="text-sm font-semibold text-text-main dark:text-white font-display mb-1">
                Оборудование и ассортимент
              </h3>
              <p className="text-xs text-text-muted dark:text-stone-400 font-body mb-4">
                Теги и coffee focus у заявки не хранятся — их задают в карточке опубликованной кофейни после одобрения.
              </p>
              {catalogsLoading ? (
                <p className="text-sm text-text-muted dark:text-stone-400 font-body">Загрузка справочников...</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <CatalogMultiSelect
                    label="Оборудование"
                    items={(catalogs?.equipments ?? []).map((item) => ({
                      id: item.id,
                      name: item.name,
                      subtitle: [item.brand, item.model].filter(Boolean).join(' '),
                    }))}
                    selectedIds={equipmentIds}
                    onChange={markDirty(setEquipmentIds)}
                  />
                  <CatalogMultiSelect
                    label="Кофейные зёрна"
                    items={(catalogs?.beans ?? []).map((item) => ({ id: item.id, name: item.name }))}
                    selectedIds={coffeeBeanIds}
                    onChange={markDirty(setCoffeeBeanIds)}
                  />
                  <CatalogMultiSelect
                    label="Обжарщики"
                    items={(catalogs?.roasters ?? []).map((item) => ({ id: item.id, name: item.name }))}
                    selectedIds={roasterIds}
                    onChange={markDirty(setRoasterIds)}
                  />
                  <CatalogMultiSelect
                    label="Методы заваривания"
                    items={(catalogs?.brewMethods ?? []).map((item) => ({ id: item.id, name: item.name }))}
                    selectedIds={brewMethodIds}
                    onChange={markDirty(setBrewMethodIds)}
                  />
                </div>
              )}
            </Card>

            {id && (
              <Card className="p-6">
                <MenuEditor
                  menu={shop.menu ?? null}
                  onAttach={async (photos) => {
                    await attachModerationShopMenuPhotos(id, { photos });
                    await qc.invalidateQueries({ queryKey: ['admin', 'shop', id] });
                  }}
                  onParse={async () => {
                    await parseModerationShopMenu(id);
                    await qc.invalidateQueries({ queryKey: ['admin', 'shop', id] });
                  }}
                  onSave={async (body) => {
                    await updateModerationShopMenu(id, body);
                    await qc.invalidateQueries({ queryKey: ['admin', 'shop', id] });
                  }}
                />
              </Card>
            )}
          </fieldset>

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end sticky bottom-0 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur py-3 -mx-1 px-1 border-t border-border-light dark:border-border-dark sm:border-0 sm:static sm:bg-transparent sm:backdrop-blur-none sm:py-0">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => navigate('/shops')}
              className="w-full sm:w-auto"
            >
              К списку
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isSubmitting || updateMutation.isPending}
              disabled={isApproved}
              className="w-full sm:w-auto"
            >
              Сохранить изменения
            </Button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={pendingAction === 'approve'}
        title="Одобрить кофейню?"
        message="Кофейня станет видна пользователям. Можно оставить комментарий для аудита."
        confirmLabel="Одобрить"
        variant="success"
        withComment
        commentLabel="Комментарий (необязательно)"
        onConfirm={async (comment) => {
          await approveMutation.mutateAsync(comment);
        }}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        isOpen={pendingAction === 'reject'}
        title="Отклонить кофейню?"
        message="Укажите причину отклонения — пользователь сможет увидеть её в истории."
        confirmLabel="Отклонить"
        variant="danger"
        withComment
        commentLabel="Причина отклонения"
        onConfirm={async (comment) => {
          await rejectMutation.mutateAsync(comment);
        }}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};

const Field: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({
  label,
  error,
  children,
}) => (
  <div>
    <label className="block text-xs font-medium text-text-muted dark:text-stone-400 mb-1 font-body">
      {label}
    </label>
    {children}
    {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
  </div>
);
