import { Input } from '@/src/components/ui/Input';
import { NativeSelect } from '@/src/components/ui/NativeSelect';
import { Textarea } from '@/src/components/ui/Textarea';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AdminShopSchedule,
  attachPublishedShopPhotos,
  deletePublishedShopPhotos,
  getPublishedShopById,
  updatePublishedShop,
  assignPublishedShopOwner,
  reorderPublishedShopPhotos,
  patchPublishedShopFocus,
  assignShopTags,
  setPublishedShopVisibility,
} from '../api/admin';
import { uploadShopPhotoFiles } from '../api/photos';
import { getShopTags } from '../api/catalogs';
import { useCatalogs } from '../hooks/useCatalogs';
import { useToast } from '../contexts/ToastContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PhotoOrderEditor } from '../components/PhotoOrderEditor';
import { PriceRangePicker } from '../components/PriceRangePicker';
import { ScheduleEditor, getDefaultSchedules } from '../components/moderation/ScheduleEditor';
import { CatalogMultiSelect } from '../components/moderation/CatalogMultiSelect';
import {
  COFFEE_SHOP_STATUS_HINTS,
  COFFEE_SHOP_STATUS_LABELS,
  COFFEE_SHOP_STATUS_OPTIONS,
  coffeeShopStatusBadgeVariant,
} from '../constants/coffeeShopStatus';
import { parsePriceRange } from '../constants/priceRange';
import { CATALOG_TAG_OPTIONS, catalogTagLabel, CoffeeFocus } from '../constants/catalogIngest';
import { CatalogTagChips, CoffeeFocusPicker } from '../components/import/catalogControls';
import { MenuEditor } from '../components/menu/MenuEditor';
import {
  attachPublishedShopMenuPhotos,
  getPublishedShopMenu,
  parsePublishedShopMenu,
  updatePublishedShopMenu,
} from '../api/menu';
import {
  latitudeField,
  longitudeField,
  parseOptionalNumber,
  publishedContactShape,
  validateSchedules,
} from '../utils/shopForm';

const MAX_SHOP_TAGS = 20;

const schema = z.object({
  name: z.string().min(1, 'Обязательное поле'),
  description: z.string().optional(),
  priceRange: z.coerce.number().min(1).max(4),
  status: z.enum(['Active', 'TemporarilyClosed', 'PermanentlyClosed']),
  ownerUserId: z.string().optional(),
  cityId: z.string().optional(),
  address: z.string().optional(),
  latitude: latitudeField,
  longitude: longitudeField,
  ...publishedContactShape,
});

type FormData = z.infer<typeof schema>;

export const PublishedShopEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [ownerInput, setOwnerInput] = useState('');
  const [focus, setFocus] = useState<CoffeeFocus | undefined>();
  const [tagSelection, setTagSelection] = useState<{ shopId: string; slugs: string[] } | null>(null);
  const [schedules, setSchedules] = useState<AdminShopSchedule[]>(getDefaultSchedules());
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [beanIds, setBeanIds] = useState<string[]>([]);
  const [roasterIds, setRoasterIds] = useState<string[]>([]);
  const [brewMethodIds, setBrewMethodIds] = useState<string[]>([]);
  const [schedulesTouched, setSchedulesTouched] = useState(false);
  const [hadSchedules, setHadSchedules] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'hide' | 'removeOwner' | null>(null);
  const initializedShopId = useRef<string | null>(null);

  const { data: shop, isLoading } = useQuery({
    queryKey: ['admin', 'published-shop', id],
    queryFn: () => getPublishedShopById(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: shopMenu } = useQuery({
    queryKey: ['admin', 'published-shop-menu', id],
    queryFn: () => getPublishedShopMenu(id!).then((r) => r.data),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.menu?.parseStatus;
      return status === 'Pending' || status === 'Running' ? 2500 : false;
    },
  });

  const { data: catalogTags = [], isPending: catalogTagsLoading, isError: catalogTagsError } = useQuery({
    queryKey: ['catalogs', 'shop-tags'],
    queryFn: () => getShopTags().then((r) => r.data ?? []),
    staleTime: 5 * 60 * 1000,
  });

  const shopTagsAvailable = shop?.tags !== undefined || shop?.tagSlugs !== undefined || shop?.tagIds !== undefined;
  const selectedTagSlugs = tagSelection && tagSelection.shopId === id ? tagSelection.slugs : [];
  const tagsReady = Boolean(tagSelection && tagSelection.shopId === id) && !catalogTagsLoading && !catalogTagsError;

  // The tag catalog can arrive after the shop. Initialize separately from the form,
  // and preserve unsaved selections when photos, owners or other shop data refetch.
  useEffect(() => {
    if (!shop || !shopTagsAvailable || catalogTagsLoading || catalogTagsError || tagSelection?.shopId === shop.id) return;
    const idToSlug = new Map(catalogTags.map((tag) => [tag.id, tag.slug]));
    const slugs = [
      ...(shop.tags ?? []).map((tag) => tag.slug).filter(Boolean),
      ...(shop.tagSlugs ?? []),
      // Keep unresolved IDs so full-set replacement cannot silently drop a tag.
      ...(shop.tagIds ?? []).map((tagId) => idToSlug.get(tagId) ?? tagId),
    ];
    setTagSelection({ shopId: shop.id, slugs: [...new Set(slugs)] });
  }, [shop, shopTagsAvailable, catalogTags, catalogTagsLoading, catalogTagsError, tagSelection?.shopId]);

  const { data: catalogs, isLoading: catalogsLoading } = useCatalogs();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priceRange: 2, status: 'Active' },
  });

  // Initialize once per shop: photo/owner/menu refetches must not wipe unsaved form edits.
  useEffect(() => {
    if (!shop || initializedShopId.current === shop.id) return;
    initializedShopId.current = shop.id;
    reset({
      name: shop.name,
      description: shop.description ?? '',
      priceRange: parsePriceRange(shop.priceRange) ?? 2,
      status: shop.status,
      ownerUserId: shop.ownerUserId ?? '',
      cityId: shop.location?.cityId ?? shop.cityId ?? '',
      address: shop.location?.address ?? '',
      latitude:
        shop.location?.latitude != null && shop.location.latitude !== null
          ? String(shop.location.latitude)
          : '',
      longitude:
        shop.location?.longitude != null && shop.location.longitude !== null
          ? String(shop.location.longitude)
          : '',
      phoneNumber: shop.contacts?.phoneNumber ?? '',
      email: shop.contacts?.email ?? '',
      siteLink: shop.contacts?.siteLink ?? '',
      instagramLink: shop.contacts?.instagramLink ?? '',
    });
    setOwnerInput(shop.ownerUserId ?? '');
    setHadSchedules(Boolean(shop.schedules?.length));
    setSchedules(shop.schedules?.length ? shop.schedules : getDefaultSchedules());
    setSchedulesTouched(false);
    setEquipmentIds(shop.equipmentIds ?? []);
    setBeanIds(shop.beanIds ?? []);
    setRoasterIds(shop.roasterIds ?? []);
    setBrewMethodIds(shop.brewMethodIds ?? []);
    setFocus(shop.coffeeFocus);
  }, [shop, reset]);

  const sendSchedules = schedulesTouched || hadSchedules;

  const saveMutation = useMutation({
    mutationFn: (data: FormData) =>
      updatePublishedShop(id!, {
        name: data.name,
        description: data.description ?? null,
        priceRange: data.priceRange,
        status: data.status,
        location: {
          cityId: data.cityId || undefined,
          address: data.address || undefined,
          latitude: parseOptionalNumber(data.latitude),
          longitude: parseOptionalNumber(data.longitude),
        },
        contacts: {
          phoneNumber: data.phoneNumber || null,
          email: data.email || null,
          siteLink: data.siteLink || null,
          instagramLink: data.instagramLink || null,
        },
        // Don't publish template hours for a shop that never had a schedule.
        schedules: sendSchedules ? schedules : undefined,
        catalogs: {
          equipmentIds,
          beanIds,
          roasterIds,
          brewMethodIds,
        },
      }),
    onSuccess: (response) => {
      if (sendSchedules) setHadSchedules(true);
      showToast('Кофейня обновлена', 'success');
      qc.setQueryData(['admin', 'published-shop', id], response.data);
      qc.invalidateQueries({ queryKey: ['admin', 'published-shop', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'published-shops'] });
    },
    onError: (err: any) => showToast(err?.message ?? 'Ошибка', 'error'),
  });

  const ownerMutation = useMutation({
    mutationFn: (ownerUserId: string | null) => assignPublishedShopOwner(id!, ownerUserId),
    onSuccess: (_data, ownerUserId) => {
      showToast(ownerUserId ? 'Владелец назначен' : 'Владелец снят', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'published-shop', id] });
    },
    onError: (err: any) => showToast(err?.message ?? 'Ошибка', 'error'),
  });

  const focusMutation = useMutation({
    mutationFn: (coffeeFocus: CoffeeFocus) => patchPublishedShopFocus(id!, coffeeFocus),
    onSuccess: (response) => {
      qc.setQueryData(['admin', 'published-shop', id], response.data);
      showToast('Фокус кофейни сохранён', 'success');
    },
    onError: (err: any) => showToast(err?.message ?? 'Не удалось сохранить фокус', 'error'),
  });

  const photoOrderMutation = useMutation({
    mutationFn: (photoIds: string[]) => reorderPublishedShopPhotos(id!, photoIds),
    onSuccess: (response) => {
      qc.setQueryData(['admin', 'published-shop', id], response.data);
      qc.invalidateQueries({ queryKey: ['admin', 'published-shops'] });
      showToast('Порядок фотографий сохранён', 'success');
    },
    onError: (err: any) => showToast(err?.message ?? 'Не удалось сохранить порядок фотографий', 'error'),
  });

  const photoAddMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const uploaded = await uploadShopPhotoFiles(files);
      return attachPublishedShopPhotos(id!, { photos: uploaded });
    },
    onSuccess: (response) => {
      qc.setQueryData(['admin', 'published-shop', id], response.data);
      qc.invalidateQueries({ queryKey: ['admin', 'published-shops'] });
      showToast('Фото добавлены', 'success');
    },
    onError: (err: any) => showToast(err?.message ?? 'Не удалось добавить фото', 'error'),
  });

  const photoDeleteMutation = useMutation({
    mutationFn: (photoIds: string[]) => deletePublishedShopPhotos(id!, { photoIds }),
    onSuccess: (response) => {
      qc.setQueryData(['admin', 'published-shop', id], response.data);
      qc.invalidateQueries({ queryKey: ['admin', 'published-shops'] });
      showToast('Фото удалены', 'success');
    },
    onError: (err: any) => showToast(err?.message ?? 'Не удалось удалить фото', 'error'),
  });

  const tagsMutation = useMutation({
    mutationFn: async (slugs: string[]) => {
      // PUT replaces the full set: never send a partial list (that would silently drop tags).
      if (!tagsReady || catalogTags.length === 0) {
        throw new Error('Каталог тегов не загружен — теги не сохранены');
      }
      const slugToId = new Map(catalogTags.map((tag) => [tag.slug, tag.id]));
      const missing = slugs.filter((slug) => !slugToId.has(slug));
      if (missing.length) {
        throw new Error(`Теги не найдены в каталоге: ${missing.join(', ')} — сохранение отменено`);
      }
      return assignShopTags(id!, slugs.map((slug) => slugToId.get(slug)!));
    },
    onSuccess: () => {
      showToast('Теги сохранены', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'published-shop', id] });
    },
    onError: (err: any) => showToast(err?.message ?? 'Не удалось сохранить теги', 'error'),
  });

  const visibilityMutation = useMutation({
    mutationFn: (hidden: boolean) => setPublishedShopVisibility(id!, hidden),
    onMutate: async (hidden) => {
      await qc.cancelQueries({ queryKey: ['admin', 'published-shop', id] });
      const previous = qc.getQueryData(['admin', 'published-shop', id]);
      qc.setQueryData(['admin', 'published-shop', id], (current: typeof shop) =>
        current ? { ...current, isHidden: hidden } : current
      );
      return { previous };
    },
    onSuccess: (response, hidden) => {
      qc.setQueryData(['admin', 'published-shop', id], (current: typeof shop) => {
        const base = response.data ?? current;
        return base ? { ...base, isHidden: hidden } : current;
      });
      qc.invalidateQueries({ queryKey: ['admin', 'published-shops'] });
      qc.invalidateQueries({ queryKey: ['browse'] });
      showToast(hidden ? 'Кофейня скрыта из приложения' : 'Кофейня снова видна в приложении', 'success');
    },
    onError: (err: any, _hidden, context) => {
      if (context?.previous) {
        qc.setQueryData(['admin', 'published-shop', id], context.previous);
      }
      showToast(err?.message ?? 'Не удалось изменить видимость', 'error');
    },
  });

  const handleFocusChange = (next: CoffeeFocus) => {
    setFocus(next);
  };

  const handleTagChange = (slugs: string[]) => {
    if (slugs.length > MAX_SHOP_TAGS) {
      showToast(`Максимум ${MAX_SHOP_TAGS} тегов`, 'error');
      return;
    }
    if (id) setTagSelection({ shopId: id, slugs });
  };

  const tagOptions = useMemo(() => {
    const fromApi = catalogTags
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru'))
      .map((tag) => ({ slug: tag.slug, label: catalogTagLabel(tag.slug, tag.name) }));
    return fromApi.length > 0 ? fromApi : CATALOG_TAG_OPTIONS;
  }, [catalogTags]);
  if (isLoading || !shop) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <div className="h-8 w-48 bg-gray-100 dark:bg-white/5 rounded animate-pulse" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="h-64 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
          <div className="h-64 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-8">
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/published-shops')}
          className="shrink-0 self-start min-h-[44px] sm:min-h-0"
        >
          ← Назад
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white text-xl sm:text-2xl">{shop.name}</h2>
            <Badge variant={coffeeShopStatusBadgeVariant(shop.status)}>
              {COFFEE_SHOP_STATUS_LABELS[shop.status]}
            </Badge>
            <Badge variant="info">Заполнено: {shop.dataCompletenessScore}%</Badge>
            {shop.isHidden && <Badge variant="rejected">Скрыта</Badge>}
          </div>
          <p className="text-xs text-text-muted dark:text-stone-400 font-body mt-1">
            {shop.isHidden
              ? 'Не показывается в поиске и на карте. Статус работы при этом не меняется.'
              : COFFEE_SHOP_STATUS_HINTS[shop.status]}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          <Card className="p-6">
            <form
              onSubmit={handleSubmit(async (data) => {
                const scheduleError = sendSchedules ? validateSchedules(schedules) : null;
                if (scheduleError) {
                  showToast(scheduleError, 'error');
                  return;
                }
                await saveMutation.mutateAsync(data);
              })}
              className="space-y-5"
            >
              <h3 className="text-sm font-semibold text-text-main dark:text-white font-display">Карточка</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted dark:text-stone-400 mb-1.5 font-body">
                    Название
                  </label>
                  <Input {...register('name')} />
                  {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted dark:text-stone-400 mb-1.5 font-body">
                    Статус
                  </label>
                  <NativeSelect {...register('status')}>
                    {COFFEE_SHOP_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted dark:text-stone-400 mb-1.5 font-body">
                  Описание
                </label>
                <Textarea {...register('description')} rows={4} className="min-h-24 resize-y" />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted dark:text-stone-400 mb-2 font-body">
                  Ценовой диапазон
                </label>
                <PriceRangePicker
                  value={watch('priceRange')}
                  onChange={(value) => setValue('priceRange', value ?? 2, { shouldValidate: true })}
                  error={errors.priceRange?.message}
                />
              </div>

              <div className="border-t border-border-light dark:border-border-dark pt-4 space-y-4">
                <h4 className="text-sm font-semibold text-text-main dark:text-white font-display">Адрес и карта</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-text-muted dark:text-stone-400 mb-1.5 font-body">
                      Город
                    </label>
                    {/* Remount once options exist, otherwise the stored city can't be selected. */}
                    <NativeSelect key={catalogs ? 'ready' : 'loading'} {...register('cityId')}>
                      <option value="">Выберите город</option>
                      {(catalogs?.cities ?? []).map((city) => (
                        <option key={city.id} value={city.id}>
                          {city.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-text-muted dark:text-stone-400 mb-1.5 font-body">
                      Адрес
                    </label>
                    <Input {...register('address')} placeholder="Улица и дом" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted dark:text-stone-400 mb-1.5 font-body">
                      Широта
                    </label>
                    <Input {...register('latitude')} placeholder="53.9" />
                    {errors.latitude && <p className="text-red-400 text-xs mt-1">{errors.latitude.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted dark:text-stone-400 mb-1.5 font-body">
                      Долгота
                    </label>
                    <Input {...register('longitude')} placeholder="27.56" />
                    {errors.longitude && <p className="text-red-400 text-xs mt-1">{errors.longitude.message}</p>}
                  </div>
                </div>
              </div>

              <div className="border-t border-border-light dark:border-border-dark pt-4 space-y-4">
                <h4 className="text-sm font-semibold text-text-main dark:text-white font-display">Контакты</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-muted dark:text-stone-400 mb-1.5 font-body">
                      Телефон
                    </label>
                    <Input {...register('phoneNumber')} placeholder="+375..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted dark:text-stone-400 mb-1.5 font-body">
                      Email
                    </label>
                    <Input {...register('email')} />
                    {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted dark:text-stone-400 mb-1.5 font-body">
                      Сайт
                    </label>
                    <Input {...register('siteLink')} />
                    {errors.siteLink && <p className="text-red-400 text-xs mt-1">{errors.siteLink.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted dark:text-stone-400 mb-1.5 font-body">
                      Instagram
                    </label>
                    <Input {...register('instagramLink')} />
                    {errors.instagramLink && <p className="text-red-400 text-xs mt-1">{errors.instagramLink.message}</p>}
                  </div>
                </div>
              </div>

              <div className="border-t border-border-light dark:border-border-dark pt-4 space-y-3">
                <h4 className="text-sm font-semibold text-text-main dark:text-white font-display">Расписание</h4>
                <ScheduleEditor
                  value={schedules}
                  onChange={(next) => {
                    setSchedules(next);
                    setSchedulesTouched(true);
                  }}
                />
              </div>

              <div className="border-t border-border-light dark:border-border-dark pt-4 space-y-3">
                <h4 className="text-sm font-semibold text-text-main dark:text-white font-display">
                  Оборудование и ассортимент
                </h4>
                {catalogsLoading ? (
                  <p className="text-sm text-text-muted dark:text-stone-400 font-body">Загрузка справочников…</p>
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
                      onChange={setEquipmentIds}
                    />
                    <CatalogMultiSelect
                      label="Кофейные зёрна"
                      items={(catalogs?.beans ?? []).map((item) => ({ id: item.id, name: item.name }))}
                      selectedIds={beanIds}
                      onChange={setBeanIds}
                    />
                    <CatalogMultiSelect
                      label="Обжарщики"
                      items={(catalogs?.roasters ?? []).map((item) => ({ id: item.id, name: item.name }))}
                      selectedIds={roasterIds}
                      onChange={setRoasterIds}
                    />
                    <CatalogMultiSelect
                      label="Методы заваривания"
                      items={(catalogs?.brewMethods ?? []).map((item) => ({ id: item.id, name: item.name }))}
                      selectedIds={brewMethodIds}
                      onChange={setBrewMethodIds}
                    />
                  </div>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting || saveMutation.isPending}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
              >
                Сохранить
              </Button>
            </form>
          </Card>

        </div>

        <div className="space-y-5 min-w-0">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-text-main dark:text-white font-display mb-1">Видимость</h3>
            <p className="text-xs text-text-muted dark:text-stone-400 font-body mb-3">
              Скрытая кофейня остаётся в админке, но не попадает в поиск и на карту. Это отдельно от статуса
              «временно закрыта».
            </p>
            <Button
              variant={shop.isHidden ? 'success' : 'danger'}
              size="sm"
              loading={visibilityMutation.isPending}
              onClick={() =>
                shop.isHidden ? visibilityMutation.mutate(false) : setConfirmAction('hide')
              }
              className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
            >
              {shop.isHidden ? 'Показать в приложении' : 'Скрыть из приложения'}
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-text-main dark:text-white font-display mb-1">Coffee focus</h3>
            <p className="text-xs text-text-muted dark:text-stone-400 font-body mb-3">
              Категория для ленты. Теги выбираются отдельно.
            </p>
            <CoffeeFocusPicker value={focus} onChange={handleFocusChange} />
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 w-full sm:w-auto"
              disabled={!focus}
              loading={focusMutation.isPending}
              onClick={() => focus && focusMutation.mutate(focus)}
            >
              Сохранить focus
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-text-main dark:text-white font-display mb-1">Теги</h3>
            <p className="text-xs text-text-muted dark:text-stone-400 font-body mb-3">
              Полная замена набора. Не более {MAX_SHOP_TAGS} штук.
            </p>
            {catalogTagsLoading ? (
              <p className="text-xs text-text-muted dark:text-stone-400 font-body mb-3">Загрузка тегов…</p>
            ) : catalogTagsError || !shopTagsAvailable ? (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-body mb-3">
                Не удалось загрузить назначенные теги. Сохранение недоступно.
              </p>
            ) : null}
            <CatalogTagChips
              value={selectedTagSlugs}
              onChange={handleTagChange}
              options={tagOptions}
              disabled={!tagsReady || tagsMutation.isPending}
            />
            <Button
              variant="secondary"
              size="sm"
              loading={tagsMutation.isPending}
              disabled={!tagsReady || catalogTags.length === 0}
              onClick={() => tagsMutation.mutate(selectedTagSlugs)}
              className="mt-4 w-full sm:w-auto min-h-[44px] sm:min-h-0"
            >
              Сохранить теги
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-text-main dark:text-white font-display mb-1">Владелец</h3>
            <p className="text-xs text-text-muted dark:text-stone-400 font-body mb-3">
              UUID пользователя с ролью Owner. Роль выдаётся в разделе «Пользователи».
            </p>
            <div className="flex flex-col gap-2">
              <Input
                value={ownerInput}
                onChange={(e) => setOwnerInput(e.target.value)}
                placeholder="owner-user-id (UUID)"
                className="font-mono"
              />
              <Button
                variant="secondary"
                size="sm"
                loading={ownerMutation.isPending}
                onClick={() =>
                  !ownerInput.trim() && shop.ownerUserId
                    ? setConfirmAction('removeOwner')
                    : ownerMutation.mutate(ownerInput.trim() || null)
                }
                className="w-full sm:w-auto min-h-[44px] sm:min-h-0 self-start"
              >
                Назначить
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <PhotoOrderEditor
        photos={shop.photos}
        isSaving={photoOrderMutation.isPending}
        isUploading={photoAddMutation.isPending}
        isDeleting={photoDeleteMutation.isPending}
        onSave={(photoIds) => photoOrderMutation.mutateAsync(photoIds)}
        onAddFiles={(files) => photoAddMutation.mutateAsync(files)}
        onDelete={(photoIds) => photoDeleteMutation.mutateAsync(photoIds)}
      />

      {id && (
        <Card className="p-6">
          <MenuEditor
            menu={shopMenu?.menu ?? null}
            unmatched={shopMenu?.unmatched}
            onAttach={async (photos) => {
              await attachPublishedShopMenuPhotos(id, { photos });
              await qc.invalidateQueries({ queryKey: ['admin', 'published-shop-menu', id] });
            }}
            onParse={async () => {
              await parsePublishedShopMenu(id);
              await qc.invalidateQueries({ queryKey: ['admin', 'published-shop-menu', id] });
            }}
            onSave={async (body) => {
              await updatePublishedShopMenu(id, body);
              await Promise.all([
                qc.invalidateQueries({ queryKey: ['admin', 'published-shop-menu', id] }),
                body.applySuggestedPriceRange
                  ? qc.invalidateQueries({ queryKey: ['admin', 'published-shop', id] })
                  : Promise.resolve(),
              ]);
            }}
          />
        </Card>
      )}

      <ConfirmDialog
        isOpen={confirmAction === 'hide'}
        title="Скрыть кофейню?"
        message="Кофейня пропадёт из поиска и с карты приложения, пока её снова не покажут."
        confirmLabel="Скрыть"
        variant="danger"
        onConfirm={async () => {
          await visibilityMutation.mutateAsync(true).catch(() => undefined);
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        isOpen={confirmAction === 'removeOwner'}
        title="Снять владельца?"
        message="Текущий владелец потеряет доступ к управлению этой кофейней."
        confirmLabel="Снять"
        variant="danger"
        onConfirm={async () => {
          await ownerMutation.mutateAsync(null).catch(() => undefined);
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};
