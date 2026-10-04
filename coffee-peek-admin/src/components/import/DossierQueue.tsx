import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ImportCandidate } from '../../api/import';
import { Pagination } from '../ui/Pagination';
import { DataTable } from '../ui/DataTable';
import { displayShopName } from '../../constants/catalogIngest';
import { SourceBadge } from './catalogControls';

interface DossierQueueProps {
  items: ImportCandidate[];
  activeId?: string;
  page: number;
  totalPages: number;
  totalCount: number;
  loading?: boolean;
  onSelect: (id: string) => void;
  onPageChange: (page: number) => void;
}

export const DossierQueue: React.FC<DossierQueueProps> = ({
  items,
  activeId,
  page,
  totalPages,
  totalCount,
  loading,
  onSelect,
  onPageChange,
}) => {
  const columns: ColumnDef<ImportCandidate>[] = [
    { id: 'name', header: 'Кофейня', cell: ({ row }) => <div className="max-w-[200px]"><p className="truncate font-semibold text-text-main dark:text-white">{displayShopName(row.original.name, row.original.brand)}</p><SourceBadge source={row.original.source} importedFromFile={row.original.importedFromFile} /></div> },
  ];
  return <aside className="flex flex-col min-h-0 h-full w-full bg-white dark:bg-surface-dark border-r border-border-light dark:border-border-dark">
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted px-3.5 pt-3.5 pb-2">
      Очередь
      {totalCount > 0 && (
        <span className="normal-case tracking-normal font-normal ml-1.5 tabular-nums">{totalCount}</span>
      )}
    </h3>
    <div className="flex-1 overflow-y-auto min-h-0"><DataTable columns={columns} data={items} loading={loading} loadingRows={5} emptyText="Очередь пуста" getRowId={(item) => item.id} onRowClick={(item) => onSelect(item.id)} getRowClassName={(item) => item.id === activeId ? 'bg-primary-light dark:bg-primary/15' : undefined} /></div>
    <div className="shrink-0 px-2 py-1.5 border-t border-border-light dark:border-border-dark">
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  </aside>;
};
