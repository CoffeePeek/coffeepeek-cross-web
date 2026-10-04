import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  decideDuplicateSuggestion,
  DuplicateCandidateSide,
  DuplicateSuggestion,
  getDuplicateSuggestions,
} from '../api/import';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Pagination } from '../components/ui/Pagination';
import { DataTable } from '../components/ui/DataTable';
import { ImportTabs, SourceBadge } from '../components/import/catalogControls';
import { useToast } from '../contexts/ToastContext';
import {
  QUEUE_STATUS_LABELS,
  displayShopName,
  fallbackResearchLinks,
} from '../constants/catalogIngest';

function sideMaps(side: DuplicateCandidateSide) {
  return fallbackResearchLinks({
    name: side.name,
    address: side.address,
    latitude: side.latitude,
    longitude: side.longitude,
    phone: side.phone,
    website: side.website,
    instagram: side.instagram,
    externalId: side.externalId,
  });
}

const SideCard: React.FC<{ side: DuplicateCandidateSide; label: string }> = ({ side, label }) => {
  const maps = sideMaps(side);
  const title = displayShopName(side.name);
  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark p-3 sm:p-4 min-w-0">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-wide text-text-muted dark:text-stone-500">
          {label}
        </span>
        <SourceBadge source={String(side.source)} importedFromFile={side.importedFromFile} />
        <Badge variant={side.queueStatus === 'Published' ? 'approved' : 'pending'}>
          {QUEUE_STATUS_LABELS[side.queueStatus]}
        </Badge>
      </div>
      <Link
        to={`/import/${side.id}`}
        className="text-sm font-semibold text-text-main dark:text-white hover:text-primary font-display"
      >
        {title}
      </Link>
      {side.address && (
        <p className="text-xs text-text-muted dark:text-stone-400 mt-1 break-words">{side.address}</p>
      )}
      <p className="text-[11px] text-text-muted dark:text-stone-500 mt-1 font-mono">
        {side.latitude != null && side.longitude != null
          ? `${side.latitude.toFixed(5)}, ${side.longitude.toFixed(5)}`
          : 'нет координат'}
      </p>
      <div className="flex flex-wrap gap-2 mt-2 text-xs">
        {maps.googleMaps && (
          <a
            href={maps.googleMaps}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Google
          </a>
        )}
        {maps.yandexMaps && (
          <a
            href={maps.yandexMaps}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Яндекс
          </a>
        )}
        {side.resultingShopId && (
          <Link to={`/published-shops/${side.resultingShopId}`} className="text-primary hover:underline">
            В каталоге
          </Link>
        )}
      </div>
    </div>
  );
};

export const ImportDuplicatesPage: React.FC = () => {
  const { showToast } = useToast();
  const qc = useQueryClient();
  // Per-card busy state: a card stays busy until its own request AND the follow-up refetch settle.
  const [decidingIds, setDecidingIds] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'import', 'duplicates', { status: 'Pending', page }],
    queryFn: () =>
      getDuplicateSuggestions({ status: 'Pending', page, pageSize: 50 }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      decideDuplicateSuggestion(id, accept),
    onSuccess: async (_, { accept }) => {
      showToast(accept ? 'Объединено как одно место' : 'Отмечено как разные', 'success');
      await qc.invalidateQueries({ queryKey: ['admin', 'import'] });
    },
    onError: (err: { message?: string }) => {
      showToast(err?.message ?? 'Не удалось сохранить решение', 'error');
    },
    onSettled: (_data, _err, { id }) =>
      setDecidingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }),
  });

  const decide = (id: string, accept: boolean) => {
    if (decidingIds.has(id)) return;
    setDecidingIds((prev) => new Set(prev).add(id));
    decideMutation.mutate({ id, accept });
  };

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const columns: ColumnDef<DuplicateSuggestion>[] = [
    { accessorKey: 'score', header: 'Score', cell: ({ row }) => <div className="min-w-[120px]"><strong>{Math.round(row.original.score)}</strong>{row.original.distanceMeters != null && <p className="text-xs text-text-muted">{Math.round(row.original.distanceMeters)} м</p>}<div className="mt-1 flex flex-wrap gap-1">{row.original.reasons.map((reason) => <Badge key={reason}>{reason}</Badge>)}</div></div> },
    { id: 'left', header: 'Место A', cell: ({ row }) => <SideCard side={row.original.left} label="A" /> },
    { id: 'right', header: 'Место B', cell: ({ row }) => <SideCard side={row.original.right} label="B" /> },
    { id: 'actions', cell: ({ row }) => { const busy = decidingIds.has(row.original.id); return <div className="flex min-w-max flex-col gap-2"><Button size="sm" disabled={busy} loading={busy} onClick={() => decide(row.original.id, true)}>Это одно место</Button><Button variant="secondary" size="sm" disabled={busy} onClick={() => decide(row.original.id, false)}>Разные места</Button></div>; } },
  ];

  // Deciding the last pairs of the last page shrinks totalPages — step back instead of showing empty.
  useEffect(() => {
    if (data && page > data.totalPages) setPage(Math.max(1, data.totalPages));
  }, [data, page]);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <ImportTabs />
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">Похожие места</h2>
        <p className="text-sm text-text-muted dark:text-stone-400 mt-0.5">
          Пары для ручного подтверждения. Автомердж по OSM / Instagram / телефону уже прошёл на
          бэке.
        </p>
      </div>

      {isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Не удалось загрузить похожие. Проверьте, что duplicates API уже на Gateway.
        </p>
      )}

      <Card><DataTable columns={columns} data={items} loading={isLoading} emptyText="Похожих пар нет." getRowId={(item) => item.id} /></Card>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
};
