import { Input } from '@/src/components/ui/Input';
import { NativeSelect } from '@/src/components/ui/NativeSelect';
import { DataTable } from '@/src/components/ui/DataTable';
import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { getPublishedShopById } from '../api/admin';
import {
  getShopChangeRequests,
  type ShopChangeRequestDto,
  type ShopChangeSection,
  type ShopChangeStatus,
} from '../api/shopChangeRequests';
import { getUserPublicProfile } from '../api/users';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { LoadError } from '../components/ui/LoadError';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';

export const sectionLabels: Record<ShopChangeSection, string> = {
  Photos: 'Фото',
  Contacts: 'Контакты',
  Description: 'Описание',
  Tags: 'Теги',
  Roasters: 'Обжарщики',
  Equipment: 'Оборудование',
  Menu: 'Меню',
  BrewMethods: 'Методы заваривания',
};

const statusLabels: Record<ShopChangeStatus, string> = {
  Pending: 'На модерации',
  Approved: 'Одобрено',
  Rejected: 'Отклонено',
};

function useEntityLabels(items: ShopChangeRequestDto[]) {
  const shopIds = useMemo(
    () => [...new Set(items.map((item) => item.shopId).filter(Boolean))],
    [items]
  );
  const userIds = useMemo(
    () => [...new Set(items.map((item) => item.submittedByUserId).filter(Boolean))],
    [items]
  );

  const shopQueries = useQueries({
    queries: shopIds.map((shopId) => ({
      queryKey: ['admin', 'published-shop', shopId],
      queryFn: () => getPublishedShopById(shopId).then((r) => r.data),
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });

  const userQueries = useQueries({
    queries: userIds.map((userId) => ({
      queryKey: ['public-user-profile', userId],
      queryFn: () => getUserPublicProfile(userId).then((r) => r.data),
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });

  const shopNames = useMemo(() => {
    const map = new Map<string, string>();
    shopIds.forEach((id, index) => {
      const shop = shopQueries[index]?.data;
      if (shop?.name) map.set(id, shop.name);
    });
    return map;
  }, [shopIds, shopQueries]);

  const userNames = useMemo(() => {
    const map = new Map<string, string>();
    userIds.forEach((id, index) => {
      const user = userQueries[index]?.data;
      if (user) map.set(id, user.nickname || user.userName);
    });
    return map;
  }, [userIds, userQueries]);

  return { shopNames, userNames };
}

export const ShopChangeRequestsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = (params.get('status') ?? '') as ShopChangeStatus | '';
  const section = (params.get('section') ?? '') as ShopChangeSection | '';
  const shopId = params.get('shopId') ?? '';
  const submittedByUserId = params.get('submittedByUserId') ?? '';
  const [shopIdDraft, setShopIdDraft] = useState(shopId);
  const [userIdDraft, setUserIdDraft] = useState(submittedByUserId);
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'shop-change-requests', { page, status, section, shopId, submittedByUserId }],
    queryFn: () => getShopChangeRequests({
      page,
      pageSize: 20,
      status: status || undefined,
      section: section || undefined,
      shopId: shopId.trim() || undefined,
      submittedByUserId: submittedByUserId.trim() || undefined,
    }).then((response) => response.data),
  });

  const { shopNames, userNames } = useEntityLabels(data?.items ?? []);
  const columns: ColumnDef<ShopChangeRequestDto>[] = [
    { accessorKey: 'section', header: 'Секция', cell: ({ row }) => sectionLabels[row.original.section] },
    { accessorKey: 'shopId', header: 'Кофейня', cell: ({ row }) => shopNames.get(row.original.shopId) || 'Загружается…' },
    { accessorKey: 'submittedByUserId', header: 'Отправил', cell: ({ row }) => userNames.get(row.original.submittedByUserId) || 'Пользователь…' },
    { accessorKey: 'status', header: 'Статус', cell: ({ row }) => <Badge variant={row.original.status.toLowerCase() as 'pending' | 'approved' | 'rejected'}>{statusLabels[row.original.status]}</Badge> },
    { accessorKey: 'createdAtUtc', header: 'Дата', cell: ({ row }) => new Date(row.original.createdAtUtc).toLocaleString('ru-RU') },
    { id: 'actions', meta: { className: 'text-right' }, cell: ({ row }) => <Button asChild variant="secondary" size="sm"><Link to={`/shop-change-requests/${row.original.id}`}>Открыть</Link></Button> },
  ];

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key)
    );
    setParams(next);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-display text-text-main dark:text-white">
          Правки кофеен
        </h1>
        <p className="mt-1 text-sm text-text-muted dark:text-stone-400">
          Заявки пользователей на изменение опубликованных данных.
        </p>
      </div>

      <Card className="p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            update({
              shopId: shopIdDraft.trim(),
              submittedByUserId: userIdDraft.trim(),
              page: '1',
            });
          }}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
        >
          <NativeSelect
            aria-label="Статус заявки"
            value={status}
            onChange={(e) => update({ status: e.target.value, page: '1' })}
            className="rounded-lg border border-border-light bg-white px-3 py-2 dark:border-border-dark dark:bg-surface-dark"
          >
            <option value="">Все статусы</option>
            <option value="Pending">На модерации</option>
            <option value="Approved">Одобрено</option>
            <option value="Rejected">Отклонено</option>
          </NativeSelect>
          <NativeSelect
            aria-label="Раздел заявки"
            value={section}
            onChange={(e) => update({ section: e.target.value, page: '1' })}
            className="rounded-lg border border-border-light bg-white px-3 py-2 dark:border-border-dark dark:bg-surface-dark"
          >
            <option value="">Все секции</option>
            {Object.entries(sectionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          <Input
            aria-label="ID кофейни"
            value={shopIdDraft}
            onChange={(e) => setShopIdDraft(e.target.value)}
            placeholder="ID кофейни"
            className="rounded-lg border border-border-light bg-white px-3 py-2 dark:border-border-dark dark:bg-surface-dark"
          />
          <Input
            aria-label="ID пользователя"
            value={userIdDraft}
            onChange={(e) => setUserIdDraft(e.target.value)}
            placeholder="ID пользователя"
            className="rounded-lg border border-border-light bg-white px-3 py-2 dark:border-border-dark dark:bg-surface-dark"
          />
          <Button type="submit">Применить</Button>
        </form>
      </Card>

      {isError && <LoadError message={data ? 'Не удалось обновить правки кофеен. Показаны последние загруженные данные.' : 'Не удалось загрузить правки кофеен.'} onRetry={() => void refetch()} retrying={isFetching} />}
      {(!isError || data) && <Card>
        <DataTable columns={columns} data={data?.items ?? []} loading={isLoading} emptyText="Заявок не найдено" getRowId={(request) => request.id} />
      </Card>}

      {data && <Pagination
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={(next) => update({ page: String(next) })}
      />}
    </div>
  );
};
