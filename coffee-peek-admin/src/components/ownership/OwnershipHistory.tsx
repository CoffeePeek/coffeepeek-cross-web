import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getOwnershipChanges, ownershipKeys, businessLabels, businessEditPath, type OwnershipFilters, type OwnershipChange } from '../../api/businessOwnership';
import { useUser } from '../../contexts/UserContext';
import { DataTable } from '../ui/DataTable';
import { LoadError } from '../ui/LoadError';
import { Pagination } from '../ui/Pagination';
import type { ColumnDef } from '@tanstack/react-table';

export function OwnershipHistory({ filters, onPageChange, enabled = true }: {
  filters: OwnershipFilters; onPageChange: (page: number) => void; enabled?: boolean;
}) {
  const { isAdmin } = useUser();
  const query = useQuery({
    queryKey: [...ownershipKeys.all, 'changes', filters],
    queryFn: ({ signal }) => getOwnershipChanges(filters, signal),
    enabled: isAdmin && enabled, retry: false,
  });
  const columns: ColumnDef<OwnershipChange>[] = [
    { accessorKey: 'createdAtUtc', header: 'Дата', cell: ({ row }) => new Date(row.original.createdAtUtc).toLocaleString('ru-RU') },
    { id: 'business', header: 'Бизнес', cell: ({ row }) => <Link className="text-primary underline" to={businessEditPath(row.original.businessType, row.original.businessId)}>{businessLabels[row.original.businessType]}<span className="block text-xs break-all">{row.original.businessId}</span></Link> },
    { accessorKey: 'previousOwnerUserId', header: 'Предыдущий владелец', cell: ({ row }) => <span className="break-all">{row.original.previousOwnerUserId ?? 'Не назначен'}</span> },
    { accessorKey: 'newOwnerUserId', header: 'Новый владелец', cell: ({ row }) => <span className="break-all">{row.original.newOwnerUserId ?? 'Доступ отозван'}</span> },
    { accessorKey: 'actorUserId', header: 'Администратор', cell: ({ row }) => <span className="break-all">{row.original.actorUserId}</span> },
    { accessorKey: 'reason', header: 'Причина', cell: ({ row }) => <span className="whitespace-pre-wrap break-words">{row.original.reason ?? 'Не указана'}</span> },
    { id: 'claim', header: 'Заявка', cell: ({ row }) => row.original.claimId ? <Link className="text-primary underline" to={`/ownership-claims/${encodeURIComponent(row.original.claimId)}`}>Открыть заявку</Link> : 'Ручное изменение' },
  ];
  if (!isAdmin || !enabled) return null;
  return <div className="space-y-3">
    {query.isError && <LoadError message="Не удалось загрузить историю доступа." onRetry={() => void query.refetch()} retrying={query.isFetching} />}
    {!query.isError && <>
      <DataTable tableClassName="min-w-[60rem]" columns={columns} data={query.data?.items ?? []} loading={query.isPending} emptyText="Изменений доступа пока нет" getRowId={item => item.id} />
      {query.data && <Pagination page={query.data.page} totalPages={Math.max(1, Math.ceil(query.data.totalCount / query.data.pageSize))} onPageChange={onPageChange} />}
    </>}
  </div>;
}
