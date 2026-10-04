import { DataTable } from '@/src/components/ui/DataTable';
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import type { PublishedShop } from '../../api/admin';
import { getShopTags } from '../../api/catalogs';
import {
  formatMenuPrice,
  getMenuDrinks,
  type CoffeeDrinkDefinitionDto,
  type ShopMenuDto,
  type ShopMenuItemDto,
} from '../../api/menu';
import type {
  MenuItemAvailability,
  ShopChangePayloadDto,
  ShopChangeSection,
  UploadedPhotoDto,
} from '../../api/shopChangeRequests';
import { useCatalogs } from '../../hooks/useCatalogs';

const AVAIL_LABELS: Record<MenuItemAvailability, string> = {
  Present: 'Есть',
  Absent: 'Нет',
  Unknown: 'Неизвестно',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-text-muted dark:text-stone-400">{label}</dt>
      <dd className="mt-1 text-sm text-text-main dark:text-stone-100 break-words">{children}</dd>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border-light dark:border-border-dark px-4 py-6 text-center text-sm text-text-muted dark:text-stone-400">
      {children}
    </p>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-stone-100 px-3 py-1 text-sm text-text-main dark:bg-white/10 dark:text-stone-100"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function DiffValue({
  before,
  after,
}: {
  before?: React.ReactNode;
  after: React.ReactNode;
}) {
  const hasBefore = before !== undefined && before !== null && before !== '';
  if (!hasBefore) return <>{after}</>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-text-muted line-through decoration-stone-400/70">{before}</span>
      <span className="text-text-muted">→</span>
      <span className="font-medium text-text-main dark:text-white">{after}</span>
    </span>
  );
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function PhotoPreview({ url, label }: { url?: string | null; label: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!url || url === failedUrl) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center bg-[#1A1412] px-3 text-center text-xs text-stone-300">
        {url ? 'Не удалось загрузить фото' : 'Предпросмотр недоступен'}
      </div>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <img src={url} alt={label} className="aspect-[3/4] w-full object-cover" onError={() => setFailedUrl(url)} />
    </a>
  );
}

function PhotoThumbGrid({
  title,
  photos,
}: {
  title: string;
  photos: Array<{ id?: string; url?: string | null; label: string; meta?: string }>;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-text-main dark:text-white">
        {title}{' '}
        <span className="font-normal text-text-muted">({photos.length})</span>
      </p>
      {photos.length === 0 ? (
        <EmptyNote>Нет фото в этой группе</EmptyNote>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo, index) => (
            <div
              key={photo.id ?? `${photo.label}-${index}`}
              className="overflow-hidden rounded-xl border border-border-light dark:border-border-dark bg-stone-50 dark:bg-black/20"
            >
              <PhotoPreview url={photo.url} label={photo.label} />
              <div className="space-y-0.5 p-2">
                <p className="truncate text-xs font-medium text-text-main dark:text-stone-100">{photo.label}</p>
                {photo.meta && <p className="truncate text-[11px] text-text-muted">{photo.meta}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewPhotosList({ photos }: { photos: UploadedPhotoDto[] }) {
  return (
    <PhotoThumbGrid
      title="Новые фото"
      photos={photos.map((photo) => ({
        id: photo.storageKey,
        url: photo.fullUrl,
        label: photo.fileName || photo.storageKey,
        meta: `${photo.contentType || 'image'} · ${formatBytes(photo.size)}`,
      }))}
    />
  );
}

function CatalogIdsView({
  label,
  ids,
  resolve,
}: {
  label: string;
  ids: string[] | null | undefined;
  resolve: (id: string) => string;
}) {
  if (!ids) return <EmptyNote>{label}: не указано в заявке</EmptyNote>;
  if (ids.length === 0) return <EmptyNote>{label}: очистить (пустой список)</EmptyNote>;
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-text-main dark:text-white">{label}</p>
      <ChipList items={ids.map((id) => resolve(id))} />
    </div>
  );
}

function MenuItemsView({
  items,
  currentMenu,
  drinks,
}: {
  items: NonNullable<ShopChangePayloadDto['menu']>['items'];
  currentMenu: ShopMenuDto | null | undefined;
  drinks: CoffeeDrinkDefinitionDto[];
}) {
  const currentBySlug = useMemo(() => {
    const map = new Map<string, ShopMenuItemDto>();
    currentMenu?.items.forEach((item) => map.set(item.slug, item));
    return map;
  }, [currentMenu]);

  const drinksBySlug = useMemo(() => {
    const map = new Map<string, CoffeeDrinkDefinitionDto>();
    drinks.forEach((drink) => map.set(drink.slug, drink));
    return map;
  }, [drinks]);

  const nameFor = (slug: string) =>
    drinksBySlug.get(slug)?.nameRu ||
    currentBySlug.get(slug)?.nameRu ||
    slug;

  const formatItem = (item: {
    availability: MenuItemAvailability;
    price?: number | null;
    volumeMl?: number | null;
  }) => {
    const parts = [AVAIL_LABELS[item.availability] ?? item.availability];
    if (item.price != null) parts.push(formatMenuPrice(item.price, currentMenu?.currency ?? 'BYN'));
    else parts.push('цена не указана');
    if (item.volumeMl != null) parts.push(`${item.volumeMl} мл`);
    return parts.join(' · ');
  };

  if (items.length === 0) return <EmptyNote>В заявке нет позиций меню</EmptyNote>;

  const changed = items.filter((item) => {
    const current = currentBySlug.get(item.slug);
    if (!current) return true;
    return (
      current.availability !== item.availability ||
      (current.price ?? null) !== (item.price ?? null) ||
      (current.volumeMl ?? null) !== (item.volumeMl ?? null)
    );
  });
  type MenuItem = (typeof items)[number];
  const isChanged = (item: MenuItem) => {
    const current = currentBySlug.get(item.slug);
    return !current || current.availability !== item.availability || (current.price ?? null) !== (item.price ?? null) || (current.volumeMl ?? null) !== (item.volumeMl ?? null);
  };
  const columns: ColumnDef<MenuItem>[] = [
    { header: 'Напиток', cell: ({ row }) => <><p className="font-medium text-text-main dark:text-white">{nameFor(row.original.slug)}</p><p className="text-xs text-text-muted">{row.original.slug}</p></> },
    { header: 'Сейчас', cell: ({ row }) => { const current = currentBySlug.get(row.original.slug); return current ? formatItem(current) : 'нет в текущем меню'; }, meta: { className: 'align-top text-text-muted dark:text-stone-400' } },
    { header: 'В заявке', cell: ({ row }) => formatItem(row.original), meta: { className: 'align-top font-medium text-text-main dark:text-stone-100' } },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted dark:text-stone-400">
        Позиций в заявке: {items.length}
        {currentMenu ? ` · изменится: ${changed.length}` : ''}
      </p>
      <DataTable columns={columns} data={items} getRowId={(item) => item.slug} getRowClassName={(item) => isChanged(item) ? 'bg-amber-50/70 dark:bg-amber-500/10' : undefined} />
    </div>
  );
}

interface ChangeRequestPayloadViewProps {
  section: ShopChangeSection;
  payload: ShopChangePayloadDto;
  shop?: PublishedShop | null;
  currentMenu?: ShopMenuDto | null;
}

export const ChangeRequestPayloadView: React.FC<ChangeRequestPayloadViewProps> = ({
  section,
  payload,
  shop,
  currentMenu,
}) => {
  const { data: catalogs } = useCatalogs();
  const { data: tags = [] } = useQuery({
    queryKey: ['catalogs', 'shop-tags'],
    queryFn: () => getShopTags().then((r) => r.data ?? []),
    staleTime: 5 * 60 * 1000,
  });
  const { data: drinks = [] } = useQuery({
    queryKey: ['menu-drinks'],
    queryFn: () => getMenuDrinks().then((r) => r.data ?? []),
    staleTime: 10 * 60 * 1000,
  });

  const resolveCatalog = (kind: 'roasters' | 'equipments' | 'brewMethods' | 'beans') => (id: string) => {
    const list = catalogs?.[kind] ?? [];
    const found = list.find((item) => item.id === id);
    if (!found) return id;
    if (kind === 'equipments') {
      const equipment = found as { brand?: string; model?: string; name?: string };
      const label = [equipment.brand, equipment.model].filter(Boolean).join(' ').trim();
      return label || equipment.name || id;
    }
    return ('name' in found && found.name) || id;
  };

  const resolveTag = (id: string) => tags.find((tag) => tag.id === id)?.name ?? id;

  if (section === 'Description') {
    if (payload.description == null) return <EmptyNote>Описание в заявке не передано</EmptyNote>;
    return (
      <div className="space-y-3">
        {shop?.description != null && shop.description !== payload.description && (
          <div>
            <p className="mb-1 text-xs font-medium text-text-muted">Сейчас</p>
            <p className="whitespace-pre-wrap rounded-xl bg-stone-50 p-3 text-sm text-text-muted dark:bg-white/5 dark:text-stone-400">
              {shop.description || '—'}
            </p>
          </div>
        )}
        <div>
          <p className="mb-1 text-xs font-medium text-text-muted">В заявке</p>
          <p className="whitespace-pre-wrap rounded-xl border border-border-light bg-white p-4 text-sm text-text-main dark:border-border-dark dark:bg-surface-dark dark:text-stone-100">
            {payload.description || '— (пустое описание)'}
          </p>
        </div>
      </div>
    );
  }

  if (section === 'Contacts') {
    const next = payload.contacts;
    if (!next) return <EmptyNote>Контакты в заявке не переданы</EmptyNote>;
    const current = shop?.contacts;
    const rows: Array<{ label: string; before?: string | null; after: string | null }> = [
      { label: 'Телефон', before: current?.phoneNumber, after: next.phoneNumber },
      { label: 'Email', before: current?.email, after: next.email },
      { label: 'Сайт', before: current?.siteLink, after: next.siteLink },
      { label: 'Instagram', before: current?.instagramLink, after: next.instagramLink },
    ];
    return (
      <dl className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <Field key={row.label} label={row.label}>
            <DiffValue before={row.before || undefined} after={row.after || '—'} />
          </Field>
        ))}
      </dl>
    );
  }

  if (section === 'Photos') {
    const photos = payload.photos;
    if (!photos) return <EmptyNote>Фото в заявке не переданы</EmptyNote>;
    const retained = (photos.retainedPhotoIds ?? [])
      .map((id) => shop?.photos?.find((photo) => photo.id === id))
      .filter(Boolean)
      .map((photo) => ({
        id: photo!.id,
        url: photo!.fullUrl,
        label: photo!.fileName || photo!.id,
        meta: 'оставляем',
      }));
    const missingRetained = (photos.retainedPhotoIds ?? []).filter(
      (id) => !shop?.photos?.some((photo) => photo.id === id)
    );
    return (
      <div className="space-y-5">
        <p className="text-sm text-text-muted dark:text-stone-400">
          Останется существующих: {photos.retainedPhotoIds?.length ?? 0} · новых: {photos.newPhotos?.length ?? 0}
        </p>
        <PhotoThumbGrid title="Оставляемые фото кофейни" photos={retained} />
        {missingRetained.length > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Не найдены в текущей галерее: {missingRetained.join(', ')}
          </p>
        )}
        <NewPhotosList photos={photos.newPhotos ?? []} />
      </div>
    );
  }

  if (section === 'Tags') {
    return <CatalogIdsView label="Теги" ids={payload.tagIds} resolve={resolveTag} />;
  }
  if (section === 'Roasters') {
    return <CatalogIdsView label="Обжарщики" ids={payload.roasterIds} resolve={resolveCatalog('roasters')} />;
  }
  if (section === 'Equipment') {
    return (
      <CatalogIdsView label="Оборудование" ids={payload.equipmentIds} resolve={resolveCatalog('equipments')} />
    );
  }
  if (section === 'BrewMethods') {
    return (
      <CatalogIdsView
        label="Методы заваривания"
        ids={payload.brewMethodIds}
        resolve={resolveCatalog('brewMethods')}
      />
    );
  }

  if (section === 'Menu') {
    const menu = payload.menu;
    if (!menu) return <EmptyNote>Меню в заявке не передано</EmptyNote>;
    const retained = (menu.retainedPhotoIds ?? [])
      .map((id) => currentMenu?.photos?.find((photo) => photo.id === id))
      .filter(Boolean)
      .map((photo) => ({
        id: photo!.id,
        url: photo!.fullUrl,
        label: photo!.fileName || photo!.id || 'фото меню',
        meta: 'оставляем',
      }));
    return (
      <div className="space-y-6">
        <MenuItemsView items={menu.items ?? []} currentMenu={currentMenu} drinks={drinks} />
        <PhotoThumbGrid title="Оставляемые фото меню" photos={retained} />
        <NewPhotosList photos={menu.newPhotos ?? []} />
      </div>
    );
  }

  return <EmptyNote>Неизвестный тип секции</EmptyNote>;
};
