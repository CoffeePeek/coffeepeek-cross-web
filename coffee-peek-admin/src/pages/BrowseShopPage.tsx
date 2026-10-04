import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Link, useParams } from 'react-router-dom';
import { getBrowseCoffeeShopBySlug } from '../api/coffeeShops';
import { getShopPublicAddressBySlug } from '../api/shopPublicAddresses';
import { setPublishedShopVisibility } from '../api/admin';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../contexts/ToastContext';
import { useUser } from '../contexts/UserContext';
import { DataTable } from '../components/ui/DataTable';

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const BrowseShopPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const { isAdmin } = useUser();
  const qc = useQueryClient();
  const [confirmHide, setConfirmHide] = useState(false);

  const { data: shop, isLoading, isError } = useQuery({
    queryKey: ['browse', 'coffee-shop', id],
    queryFn: () => getBrowseCoffeeShopBySlug(id!).then((r) => r.data),
    enabled: Boolean(id),
  });
  const { data: adminAddress } = useQuery({
    queryKey: ['admin', 'shop-public-address', 'slug', id],
    queryFn: () => getShopPublicAddressBySlug(id!).then(response => response.data),
    enabled: isAdmin && Boolean(id),
    staleTime: 60_000,
  });
  type ShopSchedule = NonNullable<NonNullable<typeof shop>['schedules']>[number];
  const scheduleColumns: ColumnDef<ShopSchedule>[] = [
    { accessorKey: 'dayOfWeek', header: 'День', cell: ({ row }) => DAY_NAMES[row.original.dayOfWeek] ?? row.original.dayOfWeek },
    { id: 'hours', header: 'Часы', cell: ({ row }) => row.original.openTime && row.original.closeTime ? `${row.original.openTime} – ${row.original.closeTime}` : '—' },
  ];

  const hideMutation = useMutation({
    mutationFn: () => {
      if (!adminAddress?.entityId) throw new Error('Не удалось определить кофейню для скрытия');
      return setPublishedShopVisibility(adminAddress.entityId, true);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['browse'] });
      qc.invalidateQueries({ queryKey: ['admin', 'published-shops'] });
      showToast('Кофейня скрыта из приложения', 'success');
    },
    onError: (err: any) => showToast(err?.message ?? 'Не удалось скрыть кофейню', 'error'),
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <div className="h-8 w-48 rounded bg-gray-100 dark:bg-white/5 animate-pulse mb-4" />
        <div className="h-64 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (isError || !shop) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <p className="text-red-400 text-sm mb-4">Кофейня не найдена</p>
        <Link to="/coffee-shops">
          <Button variant="secondary" size="sm">Назад к списку</Button>
        </Link>
      </div>
    );
  }

  const fromPhotos = shop.photos?.map((p) => p.fullUrl).filter((u): u is string => Boolean(u));
  const imageUrls =
    fromPhotos && fromPhotos.length > 0
      ? fromPhotos
      : shop.imageUrls ?? (shop.imageUrl ? [shop.imageUrl] : []);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to="/coffee-shops">
          <Button variant="ghost" size="sm">← К списку</Button>
        </Link>
        <Link to="/map">
          <Button variant="secondary" size="sm">На карте</Button>
        </Link>
        {isAdmin && adminAddress?.entityId && (
          <>
            <Link to={`/published-shops/${adminAddress.entityId}`}>
              <Button variant="secondary" size="sm">Редактировать</Button>
            </Link>
            <Button
              variant="danger"
              size="sm"
              loading={hideMutation.isPending}
              onClick={() => setConfirmHide(true)}
            >
              Скрыть из приложения
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={isAdmin && confirmHide}
        title="Скрыть кофейню из приложения?"
        message={`«${shop.name}» перестанет отображаться пользователям приложения.`}
        confirmLabel="Скрыть"
        variant="danger"
        onConfirm={async () => {
          try {
            await hideMutation.mutateAsync();
          } catch {
            // Ошибку показывает onError мутации.
          } finally {
            setConfirmHide(false);
          }
        }}
        onCancel={() => setConfirmHide(false)}
      />

      <Card className="overflow-hidden">
        {imageUrls.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4 border-b border-border-light dark:border-border-dark">
            {imageUrls.slice(0, 6).map((url, i) => (
              <img
                key={i}
                src={url}
                alt={shop.name}
                className="w-full h-24 object-cover rounded-lg"
              />
            ))}
          </div>
        )}

        <div className="p-5 space-y-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">{shop.name}</h2>
            {shop.cityName && (
              <p className="text-sm text-text-muted dark:text-stone-400 mt-1">{shop.cityName}</p>
            )}
          </div>

          {(shop.rating != null || shop.reviewCount != null) && (
            <p className="text-sm text-text-muted dark:text-stone-400">
              {shop.rating != null && `⭐ ${shop.rating.toFixed(1)}`}
              {shop.reviewCount != null && ` · ${shop.reviewCount} отзывов`}
            </p>
          )}

          {(shop.address || shop.location?.address) && (
            <div>
              <h3 className="text-xs font-medium text-text-muted dark:text-stone-500 uppercase tracking-wide mb-1">
                Адрес
              </h3>
              <p className="text-sm text-text-main dark:text-white">{shop.address ?? shop.location?.address}</p>
            </div>
          )}

          {shop.description && (
            <div>
              <h3 className="text-xs font-medium text-text-muted dark:text-stone-500 uppercase tracking-wide mb-1">
                Описание
              </h3>
              <p className="text-sm text-text-main dark:text-stone-300 leading-relaxed">{shop.description}</p>
            </div>
          )}

          {shop.schedules && shop.schedules.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-text-muted dark:text-stone-500 uppercase tracking-wide mb-2">
                Расписание
              </h3>
              <DataTable columns={scheduleColumns} data={shop.schedules} getRowId={(schedule) => String(schedule.dayOfWeek)} />
            </div>
          )}

          {shop.shopContact && (
            <div>
              <h3 className="text-xs font-medium text-text-muted dark:text-stone-500 uppercase tracking-wide mb-2">
                Контакты
              </h3>
              <ul className="space-y-1 text-sm text-text-main dark:text-stone-300">
                {shop.shopContact.phone && <li>Тел.: {shop.shopContact.phone}</li>}
                {shop.shopContact.email && <li>Email: {shop.shopContact.email}</li>}
                {shop.shopContact.website && (
                  <li>
                    <a href={shop.shopContact.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Сайт
                    </a>
                  </li>
                )}
                {shop.shopContact.instagram && <li>Instagram: {shop.shopContact.instagram}</li>}
              </ul>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
