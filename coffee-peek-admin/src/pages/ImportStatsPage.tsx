import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getImportStats,
  refreshDuplicateSuggestions,
  refreshOsmImport,
} from '../api/import';
import { useToast } from '../contexts/ToastContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { MetricCard } from '../components/dashboard/MetricCard';
import { ImportTabs } from '../components/import/catalogControls';
import { BUCKET_LABELS, COFFEE_FOCUS_LABELS } from '../constants/catalogIngest';

export const ImportStatsPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'import', 'stats'],
    queryFn: () => getImportStats().then((r) => r.data),
  });

  const refreshMutation = useMutation({
    mutationFn: refreshOsmImport,
    onSuccess: () => {
      showToast('OSM снимок обновлён', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'import'] });
    },
    onError: (err: { message?: string }) => showToast(err?.message ?? 'Не удалось обновить OSM', 'error'),
  });

  const duplicatesMutation = useMutation({
    mutationFn: refreshDuplicateSuggestions,
    onSuccess: (response) => {
      const { suggested, scanned, alreadyTracked } = response.data;
      showToast(
        `Похожие: предложено ${suggested} (скан ${scanned}, уже было ${alreadyTracked})`,
        'success'
      );
      qc.invalidateQueries({ queryKey: ['admin', 'import'] });
      if (suggested > 0) navigate('/import/duplicates');
    },
    onError: (err: { message?: string }) =>
      showToast(err?.message ?? 'Не удалось найти похожие', 'error'),
  });

  return (
    <div
      className={
        embedded
          ? 'h-full overflow-y-auto p-4 sm:p-6 space-y-4'
          : 'mx-auto w-full max-w-[1600px] space-y-6'
      }
    >
      {!embedded && <ImportTabs />}
      {!embedded && (
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">Статистика каталога</h2>
        </div>
      )}
      {isError && (
        <p className="text-sm text-red-400">Не удалось загрузить статистику</p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard label="Ожидает" value={data.pending} color="text-yellow-400" />
            <MetricCard label="Позже" value={data.skipped} />
            <MetricCard
              label="В ленте"
              value={data.published}
              color="text-green-400"
              subtitle={Object.entries(data.publishedByFocus)
                .map(([key, count]) => `${COFFEE_FOCUS_LABELS[key as keyof typeof COFFEE_FOCUS_LABELS]} ${count}`)
                .join(' · ')}
            />
            <MetricCard label="Не в ленту" value={data.rejected} color="text-red-400" />
            <MetricCard
              label="Похожие"
              value={data.pendingDuplicates}
              color="text-primary"
              subtitle="на подтверждение"
              onClick={() => navigate('/import/duplicates')}
            />
          </div>
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-text-main dark:text-white mb-3">Корзины коллектора</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {(Object.keys(BUCKET_LABELS) as Array<keyof typeof BUCKET_LABELS>).map((key) => (
                <div key={key} className="rounded-lg border border-border-light dark:border-border-dark p-3">
                  <p className="text-xs text-text-muted dark:text-stone-500">{BUCKET_LABELS[key]}</p>
                  <p className="text-lg font-display text-text-main dark:text-white mt-1">{data.byBucket[key]}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-text-main dark:text-white mb-3">Действия</h3>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={refreshMutation.isPending}
            onClick={() => refreshMutation.mutate()}
          >
            Обновить OSM (Минск)
          </Button>
          <Button
            variant="primary"
            loading={duplicatesMutation.isPending}
            onClick={() => duplicatesMutation.mutate()}
          >
            Найти похожие
          </Button>
        </div>
      </Card>
    </div>
  );
};
