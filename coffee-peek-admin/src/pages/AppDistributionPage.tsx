import { DataTable } from '@/src/components/ui/DataTable';
import { Input } from '@/src/components/ui/Input';
import type { ColumnDef } from '@tanstack/react-table';
import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AndroidAppRelease,
  getAndroidAppReleases,
  getAppDownloadsConfig,
  publishAndroidAppRelease,
  updateAndroidGooglePlay,
  updateIosAppStore,
} from '../api/appDistribution';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../contexts/ToastContext';

const distributionKeys = {
  config: ['admin', 'app-distribution', 'config'] as const,
  releases: ['admin', 'app-distribution', 'android-releases'] as const,
};

interface StoreFormState {
  url: string;
  enabled: boolean;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${unitIndex === 0 ? value.toFixed(0) : value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function validationMessage(error: unknown, fallback: string): string {
  const err = error as {
    message?: string;
    errors?: Record<string, string[] | string>;
    body?: { message?: string; errors?: Record<string, string[] | string> };
  };
  const errors = err?.errors ?? err?.body?.errors;
  if (errors && typeof errors === 'object') {
    const messages = Object.values(errors).flat().map(String).filter(Boolean);
    if (messages.length) return messages.join(', ');
  }
  return err?.message || err?.body?.message || fallback;
}

const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <label className="inline-flex items-center gap-2 text-sm font-body text-text-main dark:text-white">
    <Input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-border-light text-primary focus:ring-primary/30"
    />
    {label}
  </label>
);

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, children, className = '' }) => (
  <label className={`block min-w-0 space-y-1.5 ${className}`}>
    <span className="block text-xs font-medium text-text-muted dark:text-stone-400">{label}</span>
    {children}
  </label>
);

const StoreSettingsCard: React.FC<{
  title: string;
  form: StoreFormState;
  onFormChange: (form: StoreFormState) => void;
  onSave: () => void;
  loading: boolean;
}> = ({ title, form, onFormChange, onSave, loading }) => (
  <Card className="flex min-w-0 flex-col gap-4 p-5 sm:p-6">
    <div>
      <h3 className="font-display text-base font-semibold text-text-main dark:text-white">{title}</h3>
      <p className="mt-1 text-xs text-text-muted dark:text-stone-400">URL и доступность канала</p>
    </div>
    <Field label="Ссылка магазина">
      <Input
        type="url"
        value={form.url}
        onChange={(e) => onFormChange({ ...form, url: e.target.value })}
        placeholder="https://..."
        className="w-full"
      />
    </Field>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <Toggle
        checked={form.enabled}
        onChange={(enabled) => onFormChange({ ...form, enabled })}
        label="Канал включён"
      />
      <Button type="button" onClick={onSave} loading={loading} className="min-h-[44px] w-full sm:w-auto">
        Сохранить
      </Button>
    </div>
  </Card>
);

export const AppDistributionPage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [googlePlayForm, setGooglePlayForm] = useState<StoreFormState>({ url: '', enabled: false });
  const [appStoreForm, setAppStoreForm] = useState<StoreFormState>({ url: '', enabled: false });
  const [releaseToPublish, setReleaseToPublish] = useState<AndroidAppRelease | null>(null);

  const configQuery = useQuery({
    queryKey: distributionKeys.config,
    queryFn: () => getAppDownloadsConfig().then((r) => r.data),
  });

  const releasesQuery = useQuery({
    queryKey: distributionKeys.releases,
    queryFn: () => getAndroidAppReleases().then((r) => r.data),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!configQuery.data) return;
    setGooglePlayForm({
      url: configQuery.data.android.googlePlay.url ?? '',
      enabled: configQuery.data.android.googlePlay.enabled,
    });
    setAppStoreForm({
      url: configQuery.data.ios.appStore.url ?? '',
      enabled: configQuery.data.ios.appStore.enabled,
    });
  }, [configQuery.data]);

  const invalidateDistribution = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: distributionKeys.config }),
      queryClient.invalidateQueries({ queryKey: distributionKeys.releases }),
    ]);
  };

  const googlePlayMutation = useMutation({
    mutationFn: () => updateAndroidGooglePlay({
      url: googlePlayForm.url.trim() || null,
      enabled: googlePlayForm.enabled,
    }),
    onSuccess: async () => {
      showToast('Google Play настройки сохранены', 'success');
      await queryClient.invalidateQueries({ queryKey: distributionKeys.config });
    },
    onError: (err) => showToast(validationMessage(err, 'Не удалось сохранить Google Play'), 'error'),
  });

  const appStoreMutation = useMutation({
    mutationFn: () => updateIosAppStore({
      url: appStoreForm.url.trim() || null,
      enabled: appStoreForm.enabled,
    }),
    onSuccess: async () => {
      showToast('App Store настройки сохранены', 'success');
      await queryClient.invalidateQueries({ queryKey: distributionKeys.config });
    },
    onError: (err) => showToast(validationMessage(err, 'Не удалось сохранить App Store'), 'error'),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishAndroidAppRelease(id),
    onSuccess: async () => {
      showToast('Production APK обновлён', 'success');
      setReleaseToPublish(null);
      await invalidateDistribution();
    },
    onError: (err) => showToast(validationMessage(err, 'Не удалось опубликовать release'), 'error'),
  });

  const releases = useMemo(
    () => [...(releasesQuery.data ?? [])].sort((a, b) => b.versionCode - a.versionCode),
    [releasesQuery.data]
  );
  const releaseColumns: ColumnDef<AndroidAppRelease>[] = [
    { accessorKey: 'version', header: 'Версия', meta: { className: 'font-semibold text-text-main dark:text-white' } },
    { accessorKey: 'versionCode', header: 'Код' },
    {
      header: 'Файл',
      cell: ({ row }) => row.original.fileUrl
        ? <a href={row.original.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{row.original.fileName || 'APK'}</a>
        : row.original.fileName || '—',
    },
    { header: 'Размер', cell: ({ row }) => formatBytes(row.original.fileSize) },
    {
      header: 'SHA-256',
      cell: ({ row }) => row.original.sha256
        ? <span title={row.original.sha256} className="font-mono text-xs">{row.original.sha256.slice(0, 12)}…</span>
        : '—',
    },
    { header: 'Дата релиза', cell: ({ row }) => formatDate(row.original.releasedAt) },
    { header: 'Загружен', cell: ({ row }) => formatDate(row.original.createdAt) },
    { header: 'Обновлён', cell: ({ row }) => formatDate(row.original.updatedAt) },
    {
      header: 'Статус',
      cell: ({ row }) => <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.original.isActive ? 'bg-primary text-black' : 'bg-gray-100 text-text-muted dark:bg-white/10 dark:text-stone-300'}`}>{row.original.isActive ? 'Production' : 'Не активен'}</span>,
    },
    {
      id: 'actions',
      header: 'Действие',
      meta: { className: 'text-right', headerClassName: 'text-right' },
      cell: ({ row }) => <Button type="button" variant={row.original.isActive ? 'ghost' : 'secondary'} size="sm" disabled={row.original.isActive} onClick={() => setReleaseToPublish(row.original)}>Сделать production</Button>,
    },
  ];
  const production = configQuery.data?.android.apk;
  const activeRelease = releases.find((release) => release.isActive);
  const productionVersion = production?.version ?? activeRelease?.version;
  const isApkAvailable = Boolean(production?.available || production?.url || activeRelease);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">Приложения</h2>
        <p className="mt-0.5 text-sm text-text-muted dark:text-stone-400 font-body">
          Каналы скачивания и production APK для CoffeePeek
        </p>
      </div>

      {configQuery.isError ? (
        <Card className="text-center">
          <p className="mb-4 text-sm text-red-500 font-body">
            {validationMessage(configQuery.error, 'Не удалось загрузить настройки')}
          </p>
          <Button type="button" variant="secondary" onClick={() => configQuery.refetch()} loading={configQuery.isFetching}>
            Повторить
          </Button>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-6">
          <p className="text-xs uppercase tracking-wide text-text-muted dark:text-stone-400">Production APK</p>
          <p className="mt-2 text-2xl font-bold text-text-main dark:text-white font-display">
            {productionVersion ?? '—'}
          </p>
          <p className="mt-1 text-sm text-text-muted dark:text-stone-400">
            APK {isApkAvailable ? 'включён' : 'выключен'}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs uppercase tracking-wide text-text-muted dark:text-stone-400">Google Play</p>
          <p className="mt-2 text-lg font-bold text-text-main dark:text-white font-display">
            {configQuery.data?.android.googlePlay.enabled ? 'Включён' : 'Выключен'}
          </p>
          <p className="mt-1 truncate text-sm text-text-muted dark:text-stone-400">
            {configQuery.data?.android.googlePlay.url ?? 'URL не задан'}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs uppercase tracking-wide text-text-muted dark:text-stone-400">App Store</p>
          <p className="mt-2 text-lg font-bold text-text-main dark:text-white font-display">
            {configQuery.data?.ios.appStore.enabled ? 'Включён' : 'Выключен'}
          </p>
          <p className="mt-1 truncate text-sm text-text-muted dark:text-stone-400">
            {configQuery.data?.ios.appStore.url ?? 'URL не задан'}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StoreSettingsCard
          title="Android · Google Play"
          form={googlePlayForm}
          onFormChange={setGooglePlayForm}
          onSave={() => googlePlayMutation.mutate()}
          loading={googlePlayMutation.isPending || configQuery.isLoading}
        />
        <StoreSettingsCard
          title="iOS · App Store"
          form={appStoreForm}
          onFormChange={setAppStoreForm}
          onSave={() => appStoreMutation.mutate()}
          loading={appStoreMutation.isPending || configQuery.isLoading}
        />
      </div>

      <Card className="p-6">
        <div className="border-b border-border-light p-4 dark:border-border-dark">
          <h3 className="font-display text-base font-semibold text-text-main dark:text-white">Android-релизы</h3>
        </div>
        <DataTable
          columns={releaseColumns}
          data={releases}
          loading={releasesQuery.isLoading}
          emptyText="Релизов пока нет"
          tableClassName="min-w-[1100px]"
          getRowClassName={(release) => release.isActive ? 'bg-primary/10' : undefined}
        />
      </Card>

      <ConfirmDialog
        isOpen={!!releaseToPublish}
        title="Сделать релиз production?"
        message={releaseToPublish ? `Будет опубликована версия ${releaseToPublish.version}. Для старых версий это выполнит откат.` : ''}
        confirmLabel="Сделать production"
        onConfirm={async () => {
          if (releaseToPublish) {
            await publishMutation.mutateAsync(releaseToPublish.id);
          }
        }}
        onCancel={() => setReleaseToPublish(null)}
      />
    </div>
  );
};
