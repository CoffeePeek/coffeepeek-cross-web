import { Input } from '@/src/components/ui/Input';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useSearchParams, Link } from 'react-router-dom';
import { getBrowseCoffeeShops } from '../api/coffeeShops';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { DataTable } from '../components/ui/DataTable';

const PAGE_SIZE = 20;
type BrowseShop = Awaited<ReturnType<typeof getBrowseCoffeeShops>>['data']['items'][number];

export const BrowseShopsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const [localSearch, setLocalSearch] = useState(search);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['browse', 'coffee-shops', { page, search }],
    queryFn: () =>
      getBrowseCoffeeShops(page, PAGE_SIZE, search || undefined).then((r) => r.data),
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };
  const columns: ColumnDef<BrowseShop>[] = [
    { id: 'photo', header: '', cell: ({ row }) => row.original.imageUrl ? <img src={row.original.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="text-2xl">☕</span> },
    { accessorKey: 'name', header: 'Название', cell: ({ row }) => <Button asChild variant="ghost" className="px-0"><Link to={row.original.canonicalPath}>{row.original.name}</Link></Button> },
    { accessorKey: 'cityName', header: 'Город', cell: ({ row }) => row.original.cityName || '—' },
    { accessorKey: 'address', header: 'Адрес', cell: ({ row }) => row.original.address || '—' },
    { accessorKey: 'rating', header: 'Рейтинг', cell: ({ row }) => row.original.rating != null ? `★ ${row.original.rating.toFixed(1)}` : '—' },
    { accessorKey: 'checkInCount', header: 'Чекины', cell: ({ row }) => row.original.checkInCount ?? 0 },
    { id: 'actions', cell: ({ row }) => <Button asChild variant="secondary" size="sm"><Link to={row.original.canonicalPath}>Открыть</Link></Button> },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">Кофейни</h2>
        <p className="text-sm text-text-muted dark:text-stone-400 font-body mt-0.5">
          Каталог опубликованных кофеен — только просмотр
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParam('search', localSearch);
        }}
        className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row"
      >
        <Input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Поиск по названию..."
          className="w-full sm:w-72"
        />
        <Button type="submit" variant="secondary" size="sm" className="w-full sm:w-auto min-h-[44px] sm:min-h-0">
          Найти
        </Button>
      </form>

      {isError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          Не удалось загрузить кофейни. Попробуйте позже.
        </div>
      )}

      <Card><DataTable columns={columns} data={data?.items ?? []} loading={isLoading} emptyText="Кофейни не найдены" getRowId={(shop) => shop.id} /></Card>
      {data && <Pagination page={page} totalPages={data.totalPages} onPageChange={(nextPage) => setParam('page', String(nextPage))} />}
    </div>
  );
};
