import { Input } from '@/src/components/ui/Input';
import { DataTable } from '@/src/components/ui/DataTable';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { BynSign } from '../ui/CoffeeBeanSign';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { uploadMenuPhotoFiles } from '../../api/photos';
import {
  MenuAvailability,
  ShopMenuDto,
  ShopMenuItemDto,
  UnmatchedMenuItem,
  UpdateShopMenuRequest,
  UploadedPhotoDto,
  formatMenuCapturedAt,
  formatMenuPrice,
  isMenuParsing,
  suggestedRangeHint,
} from '../../api/menu';

const AVAIL_OPTIONS: { value: MenuAvailability; label: string; title: string }[] = [
  { value: 'Present', label: 'Есть', title: 'Есть в меню' },
  { value: 'Unknown', label: '?', title: 'Неизвестно' },
  { value: 'Absent', label: 'Нет', title: 'Нет в меню' },
];

function draftsFromItems(rows: ShopMenuItemDto[]): Record<string, string> {
  return Object.fromEntries(rows.map((item) => [item.slug, item.price != null ? String(item.price) : '']));
}

function parsePriceDraft(raw: string): number | null {
  const normalized = raw.replace(',', '.').trim();
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function filesFromClipboardData(data: DataTransfer | null): File[] {
  if (!data) return [];
  const out: File[] = [];
  const items = data.items ? Array.from(data.items) : [];
  for (const item of items) {
    if (!item.type.startsWith('image/')) continue;
    const blob = item.getAsFile();
    if (!blob) continue;
    const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const name =
      blob.name && blob.name !== 'image.png'
        ? blob.name
        : `menu-paste-${Date.now()}-${out.length + 1}.${ext}`;
    out.push(new File([blob], name, { type: blob.type || 'image/png' }));
  }
  if (out.length > 0) return out;

  // Some browsers put images in files instead of items.
  return Array.from(data.files ?? []).filter((file) => file.type.startsWith('image/'));
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function AvailabilityToggle({
  value,
  onChange,
}: {
  value: MenuAvailability;
  onChange: (next: MenuAvailability) => void;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-full border border-border-light dark:border-border-dark p-0.5" role="radiogroup">
      {AVAIL_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={`min-w-[2.25rem] px-2.5 py-1 rounded-full text-[12px] font-medium font-body leading-none transition-colors ${
              active
                ? 'bg-text-main text-white dark:bg-white dark:text-black'
                : 'text-text-muted dark:text-stone-400 hover:text-text-main dark:hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface MenuEditorProps {
  menu: ShopMenuDto | null;
  unmatched?: UnmatchedMenuItem[];
  onAttach: (photos: UploadedPhotoDto[]) => Promise<void>;
  onParse: () => Promise<void>;
  onSave: (body: UpdateShopMenuRequest) => Promise<void>;
  onDeletePhoto?: (photoId: string) => Promise<void>;
  compact?: boolean;
}

function cloneItems(items: ShopMenuItemDto[]): ShopMenuItemDto[] {
  return items.map((item) => ({ ...item }));
}

export const MenuEditor: React.FC<MenuEditorProps> = ({
  menu,
  unmatched,
  onAttach,
  onParse,
  onSave,
  onDeletePhoto,
  compact,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ShopMenuItemDto[]>(() => cloneItems(menu?.items ?? []));
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>(() =>
    draftsFromItems(menu?.items ?? [])
  );
  const [applyRange, setApplyRange] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteHint, setPasteHint] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);

  useEffect(() => {
    const next = cloneItems(menu?.items ?? []);
    setItems(next);
    setPriceDrafts(draftsFromItems(next));
    setApplyRange(false);
  }, [menu?.items]);

  const parsingNow = isMenuParsing(menu?.parseStatus);
  const hint = suggestedRangeHint(menu?.suggestedPriceRange);
  const photos = menu?.photos ?? [];

  const grouped = useMemo(() => {
    const espresso = items.filter((item) => item.category === 'Espresso');
    const filter = items.filter((item) => item.category === 'Filter');
    return [
      { title: 'Эспрессо', rows: espresso },
      { title: 'Фильтр', rows: filter },
    ];
  }, [items]);
  const unmatchedColumns: ColumnDef<UnmatchedMenuItem>[] = [
    { accessorKey: 'rawName', header: 'Позиция' },
    { accessorKey: 'price', header: 'Цена', cell: ({ row }) => row.original.price != null ? formatMenuPrice(row.original.price) : '—' },
    { accessorKey: 'confidence', header: 'Уверенность', cell: ({ row }) => row.original.confidence != null ? `${Math.round(row.original.confidence * 100)}%` : '—' },
  ];

  const patchItem = (slug: string, patch: Partial<ShopMenuItemDto>) => {
    setItems((current) => current.map((item) => (item.slug === slug ? { ...item, ...patch } : item)));
  };

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      const list = files ? Array.from(files as ArrayLike<File>) : [];
      if (!list.length) return;
      setError(null);
      setUploading(true);
      try {
        const uploaded = await uploadMenuPhotoFiles(list);
        await onAttach(uploaded);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить фото меню');
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [onAttach]
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (uploading || parsingNow || photoToDelete) return;
      if (isTypingTarget(event.target)) return;
      const pasted = filesFromClipboardData(event.clipboardData);
      if (!pasted.length) return;
      event.preventDefault();
      setPasteHint(true);
      window.setTimeout(() => setPasteHint(false), 1200);
      void handleFiles(pasted);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFiles, uploading, parsingNow, photoToDelete]);

  const handleParse = async () => {
    setError(null);
    setParsing(true);
    try {
      await onParse();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось распознать меню');
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await onSave({
        items: items.map((item) => ({
          slug: item.slug,
          availability: item.availability,
          price: item.availability === 'Present' ? item.price ?? null : null,
          volumeMl: item.volumeMl ?? null,
        })),
        applySuggestedPriceRange: applyRange || undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить меню');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div>
        <h2 className="text-sm font-semibold mb-1">Меню</h2>
        {menu?.capturedAtUtc && (
          <p className="text-[11px] text-text-muted">
            Актуально на {formatMenuCapturedAt(menu.capturedAtUtc)}
            {menu.updatedAtUtc && menu.updatedAtUtc !== menu.capturedAtUtc
              ? ` · обновлено ${formatMenuCapturedAt(menu.updatedAtUtc)}`
              : ''}
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {parsingNow && (
        <p className="text-sm text-text-muted flex items-center gap-2">
          <span className="inline-block w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Распознаём меню…
        </p>
      )}

      {menu?.parseStatus === 'Failed' && (
        <div className="rounded-[10px] border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 space-y-2">
          <p className="text-sm text-red-800 dark:text-red-300">Не удалось распознать</p>
          {menu.parseError && <p className="text-xs text-text-muted">{menu.parseError}</p>}
          <Button variant="secondary" size="sm" loading={parsing} onClick={() => void handleParse()}>
            Распознать снова
          </Button>
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {photos.map((photo, index) =>
            photo.fullUrl ? (
              <div key={photo.id ?? photo.storageKey} className="relative">
                <a
                  href={photo.fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden aspect-[3/4] bg-black/5"
                >
                  <img src={photo.fullUrl} alt={`Фото меню ${index + 1}`} className="w-full h-full object-cover" />
                </a>
                {onDeletePhoto && photo.id && (
                  <Button
                    variant="danger"
                    size="icon"
                    className="absolute right-1 top-1"
                    title={`Удалить фото меню ${index + 1}`}
                    aria-label={`Удалить фото меню ${index + 1}`}
                    disabled={uploading || saving || parsing || parsingNow}
                    onClick={() => {
                      setError(null);
                      setPhotoToDelete(photo.id!);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : null
          )}
        </div>
      )}

      <div
        className={`rounded-[10px] border border-dashed px-3 py-3 transition-colors ${
          pasteHint
            ? 'border-primary bg-primary/5'
            : 'border-border-light dark:border-border-dark'
        }`}
        onPaste={(e) => {
          if (uploading || parsingNow) return;
          const pasted = filesFromClipboardData(e.clipboardData);
          if (!pasted.length) return;
          e.preventDefault();
          e.stopPropagation();
          void handleFiles(pasted);
        }}
      >
        <Input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
            Загрузить фото меню
          </Button>
          <span className="text-[11px] text-text-muted">или Ctrl+V / ⌘V из буфера</span>
        </div>
        <p className="text-[11px] text-text-muted mt-1.5">
          До 4 фото на распознавание. Не галерея кофейни. Можно вставить скриншот из буфера обмена.
        </p>
      </div>

      {!menu && !parsingNow && (
        <p className="text-sm text-text-muted">Меню пока не собрали</p>
      )}

      {hint && (
        <div className="rounded-[10px] border border-border-light dark:border-border-dark px-3 py-2 space-y-2">
          <p className="text-sm">{hint}</p>
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <Input
              type="checkbox"
              checked={applyRange}
              onChange={(e) => setApplyRange(e.target.checked)}
            />
            Применить диапазон цен
          </label>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-4 max-w-2xl">
          {grouped.map((group) =>
            group.rows.length === 0 ? null : (
              <div key={group.title}>
                <p className="text-[11px] uppercase tracking-[0.08em] text-text-muted font-semibold mb-1.5">
                  {group.title}
                </p>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Напиток</TableHead>
                      <TableHead>Наличие</TableHead>
                      <TableHead>Цена</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((item) => (
                      <TableRow key={item.slug}>
                        <TableCell>
                          <p className="font-medium">{item.nameRu}</p>
                          {item.source === 'Manual' && <p className="text-xs text-text-muted">вручную</p>}
                        </TableCell>
                        <TableCell>
                          <AvailabilityToggle value={item.availability} onChange={(availability) => patchItem(item.slug, { availability })} />
                        </TableCell>
                        <TableCell>
                          {item.availability === 'Present' ? (
                            <label className="inline-flex h-8 w-[5.75rem] items-center gap-1 rounded-md border border-border-light px-2 dark:border-border-dark">
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                aria-label={`Цена ${item.nameRu}`}
                                value={priceDrafts[item.slug] ?? ''}
                                onChange={(event) => {
                                  const raw = event.target.value;
                                  setPriceDrafts((current) => ({ ...current, [item.slug]: raw }));
                                  patchItem(item.slug, { price: parsePriceDraft(raw) });
                                }}
                                className="min-w-0 text-right tabular-nums"
                              />
                              <BynSign size={11} />
                            </label>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}
          <Button variant="primary" size="sm" loading={saving} onClick={() => void handleSave()}>
            Сохранить меню
          </Button>
        </div>
      )}

      {menu?.parseStatus === 'None' && photos.length > 0 && !parsingNow && (
        <Button variant="secondary" size="sm" loading={parsing} onClick={() => void handleParse()}>
          Распознать меню
        </Button>
      )}

      {unmatched && unmatched.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-text-muted font-semibold mb-1.5">
            Не совпало с каталогом
          </p>
          <DataTable columns={unmatchedColumns} data={unmatched} getRowId={(row) => `${row.rawName}-${row.price ?? ''}`} />
        </div>
      )}
      {onDeletePhoto && (
        <ConfirmDialog
          isOpen={photoToDelete !== null}
          title="Удалить фото меню?"
          message="Фотография будет удалена из меню кофейни. Напитки и цены сохранятся."
          confirmLabel="Удалить фото"
          variant="danger"
          error={error ?? undefined}
          onCancel={() => {
            setPhotoToDelete(null);
            setError(null);
          }}
          onConfirm={async () => {
            if (!photoToDelete) return;
            setError(null);
            try {
              await onDeletePhoto(photoToDelete);
              setPhotoToDelete(null);
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Не удалось удалить фото меню');
            }
          }}
        />
      )}
    </div>
  );
};
