import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AdminCoffeeShop } from '../api/admin';
import { getUserPublicProfile } from '../api/users';
import { useCatalogs } from '../hooks/useCatalogs';
import { Badge, statusLabels, statusToBadgeVariant } from './ui/Badge';
import { Card } from './ui/Card';
import { getPriceRangeLabel } from '../constants/priceRange';

export function ShopSubmissionInfo({ shop }: { shop: AdminCoffeeShop }) {
  const [profileExpanded, setProfileExpanded] = useState(false);
  const { data: catalogs } = useCatalogs();
  const cityName = catalogs?.cities.find(city => city.id === shop.cityId)?.name ?? shop.cityName;
  const {
    data: authorProfile,
    isLoading: authorProfileLoading,
    isError: authorProfileError,
  } = useQuery({
    queryKey: ['public-user-profile', shop?.userId],
    queryFn: () => getUserPublicProfile(shop!.userId!).then((response) => response.data),
    enabled: profileExpanded && !!shop?.userId,
  });

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-text-main dark:text-white font-display mb-3">
        Заявка на кофейню
      </h3>
      <Badge variant={statusToBadgeVariant(shop.status)}>{statusLabels[shop.status]}</Badge>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-body">
        <MetaItem label="Адрес" value={shop.address || '—'} />
        <MetaItem label="ID заявки" value={shop.id} mono />
        <div>
          <MetaItem label="ID автора" value={shop.userId ?? '—'} mono />
          {shop.userId && (
            <button
              type="button"
              aria-expanded={profileExpanded}
              onClick={() => setProfileExpanded((expanded) => !expanded)}
              className="mt-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {profileExpanded ? 'Скрыть профиль' : 'Показать профиль'}
            </button>
          )}
        </div>
        <MetaItem label="Город" value={cityName ?? (shop.cityId ? 'Загрузка...' : '—')} />
        <MetaItem
          label="Адрес проверен"
          value={shop.addressIsValidated ? 'Да' : 'Нет'}
        />
        <MetaItem
          label="Ценовой диапазон"
          value={getPriceRangeLabel(shop.priceRange)}
        />
        <MetaItem label="Фото" value={String(shop.photos?.length ?? 0)} />
      </dl>
      {profileExpanded && shop.userId && (
        <div className="mt-4 rounded-lg border border-border-light dark:border-border-dark bg-gray-50 dark:bg-white/5 p-3">
          {authorProfileLoading ? (
            <p className="text-sm text-text-muted dark:text-stone-400 font-body">
              Загрузка профиля...
            </p>
          ) : authorProfileError ? (
            <p className="text-sm text-red-500 dark:text-red-400 font-body">
              Не удалось загрузить профиль пользователя
            </p>
          ) : authorProfile ? (
            <div className="flex items-start gap-3">
              {authorProfile.avatarUrl ? (
                <img
                  src={authorProfile.avatarUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover border border-border-light dark:border-border-dark"
                />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-full bg-gray-200 dark:bg-white/10" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-text-main dark:text-white font-body break-words">
                  {authorProfile.nickname || authorProfile.userName}
                </p>
                {authorProfile.nickname && (
                  <p className="text-xs text-text-muted dark:text-stone-400 font-body">
                    @{authorProfile.userName}
                  </p>
                )}
                {authorProfile.about && (
                  <p className="mt-2 text-sm text-text-muted dark:text-stone-300 font-body whitespace-pre-wrap">
                    {authorProfile.about}
                  </p>
                )}
                <p className="mt-2 text-xs text-text-muted dark:text-stone-400 font-body">
                  Чекинов: {authorProfile.checkInCount ?? 0}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}
      {shop.description && (
        <div className="mt-4 pt-4 border-t border-border-light dark:border-border-dark">
          <p className="text-xs font-medium text-text-muted dark:text-stone-400 mb-1">Описание от автора</p>
          <p className="text-sm text-text-main dark:text-stone-200 font-body whitespace-pre-wrap">
            {shop.description}
          </p>
        </div>
      )}
    </Card>
  );
}

const MetaItem: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div>
    <dt className="text-xs text-text-muted dark:text-stone-500">{label}</dt>
    <dd className={`text-text-main dark:text-white mt-0.5 break-all ${mono ? 'font-mono text-xs' : ''}`}>
      {value}
    </dd>
  </div>
);
