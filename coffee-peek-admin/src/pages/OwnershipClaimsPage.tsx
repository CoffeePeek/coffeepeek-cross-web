import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { getOwnershipClaims, ownershipKeys, businessLabels, claimStatusLabels, type OwnershipClaim } from '../api/businessOwnership';
import { OwnershipFilters, useOwnershipFilters } from '../components/ownership/OwnershipFilters';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Badge, statusToBadgeVariant } from '../components/ui/Badge';
import { LoadError } from '../components/ui/LoadError';
import { Pagination } from '../components/ui/Pagination';
import { useUser } from '../contexts/UserContext';

export function OwnershipClaimsPage() {
  const { isAdmin } = useUser();
  const { search } = useLocation();
  const { filters, validId, update } = useOwnershipFilters(true);
  const query = useQuery({
    queryKey: [...ownershipKeys.all, 'claims', filters],
    queryFn: ({ signal }) => getOwnershipClaims(filters, signal),
    enabled: isAdmin && validId, retry: false,
  });
  const columns: ColumnDef<OwnershipClaim>[] = [
    { id: 'business', header: 'Бизнес', cell: ({ row }) => <div><p className="font-semibold">{row.original.businessNameSnapshot}</p><p className="text-xs text-text-muted">{businessLabels[row.original.businessType]} · {row.original.businessSlugSnapshot}</p></div> },
    { accessorKey: 'contact', header: 'Контакт заявителя', cell: ({ row }) => <span className="break-all">{row.original.contact}</span> },
    { accessorKey: 'status', header: 'Статус', cell: ({ row }) => <Badge variant={statusToBadgeVariant(row.original.status)}>{claimStatusLabels[row.original.status]}</Badge> },
    { id: 'access', header: 'Текущий доступ', cell: ({ row }) => row.original.hasCurrentAccess ? 'Есть доступ' : 'Нет доступа' },
    { accessorKey: 'createdAtUtc', header: 'Подана', cell: ({ row }) => new Date(row.original.createdAtUtc).toLocaleString('ru-RU') },
    { id: 'actions', header: 'Действия', cell: ({ row }) => <Button asChild variant="secondary" size="sm"><Link to={`/ownership-claims/${encodeURIComponent(row.original.id)}${search}`}>Рассмотреть</Link></Button> },
  ];
  if (!isAdmin) return null;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="font-display text-2xl font-bold">Заявки на владение</h1><p className="mt-1 text-sm text-text-muted dark:text-stone-400">Проверьте полномочия представителя перед выдачей доступа к бизнесу.</p></div>
      <Button asChild variant="secondary"><Link to="/ownership-changes">История доступа</Link></Button>
    </div>
    <Card className="p-4"><OwnershipFilters withStatus /></Card>
    {query.isError && <LoadError message="Не удалось загрузить заявки на владение." onRetry={() => void query.refetch()} retrying={query.isFetching} />}
    {validId && !query.isError && <Card>
      <DataTable tableClassName="min-w-[48rem]" columns={columns} data={query.data?.items ?? []} loading={query.isPending} emptyText="Заявок с такими фильтрами нет" getRowId={item => item.id} />
    </Card>}
    {validId && !query.isError && query.data && <Pagination page={query.data.page} totalPages={Math.max(1, Math.ceil(query.data.totalCount / query.data.pageSize))} onPageChange={page => update({ page: String(page) })} />}
  </div>;
}
