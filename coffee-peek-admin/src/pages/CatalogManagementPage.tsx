import { Input } from '@/src/components/ui/Input';
import { NativeSelect } from '@/src/components/ui/NativeSelect';
import { DataTable } from '@/src/components/ui/DataTable';
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Link, useSearchParams } from 'react-router-dom';
import {
  createAdminCatalogItem,
  deleteAdminCatalogItem,
  getAdminCatalog,
  updateAdminCatalogItem,
  type CatalogItem,
  type CatalogKind,
  type CatalogMutationRequest,
  type CatalogEquipment,
  type CatalogBrewMethod,
  type CatalogRoaster,
} from '../api/catalogs';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/Dialog';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errors';

interface CatalogDefinition {
  kind: CatalogKind;
  label: string;
  singular: string;
  description: string;
}

const CATALOGS: CatalogDefinition[] = [
  { kind: 'cities', label: 'Города', singular: 'город', description: 'Города, доступные при создании и поиске кофеен' },
  { kind: 'equipments', label: 'Оборудование', singular: 'оборудование', description: 'Кофемашины, кофемолки и другое оснащение' },
  { kind: 'beans', label: 'Зерно', singular: 'зерно', description: 'Виды зерна, используемые кофейнями' },
  { kind: 'roasters', label: 'Обжарщики', singular: 'обжарщика', description: 'Бренды и компании-обжарщики' },
  { kind: 'brewMethods', label: 'Заваривание', singular: 'способ заваривания', description: 'Доступные способы приготовления кофе' },
];

const EQUIPMENT_CATEGORIES = [
  'Эспрессо-машина', 'Кофемолка', 'Промышленная кофемолка', 'Альтернативное заваривание',
  'Ручное оборудование', 'Batch brewer', 'Вода и бойлеры', 'Весы и точные инструменты',
  'Cold brew', 'Другое',
];

const BREW_CATEGORIES = ['Не указана', 'Под давлением', 'Пролив', 'Иммерсия', 'Традиционный'];
const CATALOG_KINDS = new Set<CatalogKind>(CATALOGS.map((catalog) => catalog.kind));

function parseCatalogKind(value: string | null): CatalogKind {
  return value && CATALOG_KINDS.has(value as CatalogKind) ? value as CatalogKind : 'cities';
}

type FormState = { name: string; brand: string; modelName: string; category: number };
const EMPTY_FORM: FormState = { name: '', brand: '', modelName: '', category: 0 };
const labelClass = 'block text-xs font-medium text-text-muted dark:text-stone-400 mb-1.5 font-body';

function itemTitle(kind: CatalogKind, item: CatalogItem): string {
  if (kind === 'equipments') {
    const equipment = item as CatalogEquipment;
    return [equipment.brand, equipment.model ?? equipment.name].filter(Boolean).join(' ');
  }
  return item.name;
}

function itemCategory(kind: CatalogKind, item: CatalogItem): string | null {
  if (kind === 'equipments') return EQUIPMENT_CATEGORIES[(item as CatalogEquipment).category ?? 9] ?? 'Другое';
  if (kind === 'brewMethods') return BREW_CATEGORIES[(item as CatalogBrewMethod).category ?? 0] ?? 'Не указана';
  return null;
}

function formFromItem(kind: CatalogKind, item: CatalogItem): FormState {
  if (kind === 'equipments') {
    const equipment = item as CatalogEquipment;
    return { name: '', brand: equipment.brand ?? '', modelName: equipment.model ?? equipment.name ?? '', category: equipment.category ?? 9 };
  }
  return { ...EMPTY_FORM, name: item.name, category: kind === 'brewMethods' ? (item as CatalogBrewMethod).category ?? 0 : 0 };
}

function requestFromForm(kind: CatalogKind, form: FormState): CatalogMutationRequest | null {
  if (kind === 'equipments') {
    const brand = form.brand.trim();
    const modelName = form.modelName.trim();
    return brand && modelName ? { brand, modelName, category: form.category } : null;
  }
  const name = form.name.trim();
  if (!name) return null;
  return kind === 'brewMethods' ? { name, category: form.category } : { name };
}

const CatalogForm: React.FC<{
  definition: CatalogDefinition;
  value: FormState;
  busy: boolean;
  editing: boolean;
  onChange: (value: FormState) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}> = ({ definition, value, busy, editing, onChange, onSubmit, onCancel }) => {
  const equipment = definition.kind === 'equipments';
  const categoryOptions = equipment ? EQUIPMENT_CATEGORIES : BREW_CATEGORIES;
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {equipment ? (
        <>
          <div><label htmlFor={`${editing ? 'edit' : 'create'}-brand`} className={labelClass}>Бренд</label><Input id={`${editing ? 'edit' : 'create'}-brand`} autoFocus={editing} value={value.brand} onChange={(e) => onChange({ ...value, brand: e.target.value })} placeholder="La Marzocco" maxLength={100} /></div>
          <div><label htmlFor={`${editing ? 'edit' : 'create'}-model`} className={labelClass}>Модель</label><Input id={`${editing ? 'edit' : 'create'}-model`} value={value.modelName} onChange={(e) => onChange({ ...value, modelName: e.target.value })} placeholder="Linea Mini" maxLength={100} /></div>
        </>
      ) : (
        <div className={definition.kind === 'brewMethods' ? '' : 'sm:col-span-2'}><label htmlFor={`${editing ? 'edit' : 'create'}-name`} className={labelClass}>Название</label><Input id={`${editing ? 'edit' : 'create'}-name`} autoFocus={editing} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder={`Новый ${definition.singular}`} maxLength={100} /></div>
      )}
      {(equipment || definition.kind === 'brewMethods') && (
        <div className={equipment ? 'sm:col-span-2' : ''}><label htmlFor={`${editing ? 'edit' : 'create'}-category`} className={labelClass}>Категория</label><NativeSelect id={`${editing ? 'edit' : 'create'}-category`} value={value.category} onChange={(e) => onChange({ ...value, category: Number(e.target.value) })}>{categoryOptions.map((label, index) => <option key={label} value={index}>{label}</option>)}</NativeSelect></div>
      )}
      <div className="sm:col-span-2 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel} disabled={busy} className="min-h-[44px]">Отмена</Button>}
        <Button type="submit" loading={busy} className="min-h-[44px]">{editing ? 'Сохранить' : 'Добавить'}</Button>
      </div>
    </form>
  );
};

export const CatalogManagementPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [kind, setKind] = useState<CatalogKind>(() => parseCatalogKind(searchParams.get('kind')));
  const [search, setSearch] = useState('');
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [deleting, setDeleting] = useState<CatalogItem | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const definition = CATALOGS.find((catalog) => catalog.kind === kind)!;
  const queryKey = ['admin', 'catalogs', kind] as const;

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => (await getAdminCatalog(kind)).data ?? [],
  });

  const createMutation = useMutation({
    mutationFn: ({ catalog, body }: { catalog: CatalogKind; body: CatalogMutationRequest }) => createAdminCatalogItem(catalog, body),
    onSuccess: async (_, { catalog }) => { setCreateForm(EMPTY_FORM); showToast('Запись добавлена', 'success'); await queryClient.invalidateQueries({ queryKey: ['admin', 'catalogs', catalog] }); },
    onError: (error) => showToast(getErrorMessage(error, 'Не удалось добавить запись'), 'error'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ catalog, id, body }: { catalog: CatalogKind; id: string; body: CatalogMutationRequest }) => updateAdminCatalogItem(catalog, id, body),
    onSuccess: async (_, { catalog }) => { setEditing(null); showToast('Изменения сохранены', 'success'); await queryClient.invalidateQueries({ queryKey: ['admin', 'catalogs', catalog] }); },
    onError: (error) => showToast(getErrorMessage(error, 'Не удалось сохранить изменения'), 'error'),
  });
  const deleteMutation = useMutation({
    mutationFn: ({ catalog, id }: { catalog: CatalogKind; id: string }) => deleteAdminCatalogItem(catalog, id),
    onSuccess: async (_, { catalog }) => { setDeleting(null); showToast('Запись удалена', 'success'); await queryClient.invalidateQueries({ queryKey: ['admin', 'catalogs', catalog] }); },
    onError: (error) => showToast(getErrorMessage(error, 'Не удалось удалить запись. Возможно, она используется кофейней.'), 'error'),
  });

  const visibleItems = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('ru');
    return [...data]
      .sort((a, b) => itemTitle(kind, a).localeCompare(itemTitle(kind, b), 'ru'))
      .filter((item) => !normalized || `${itemTitle(kind, item)} ${itemCategory(kind, item) ?? ''}`.toLocaleLowerCase('ru').includes(normalized));
  }, [data, kind, search]);

  const changeKind = (next: CatalogKind) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('kind', next);
    setSearchParams(nextParams, { replace: true });
    setKind(next); setSearch(''); setCreateForm(EMPTY_FORM); setEditing(null); setDeleting(null);
  };
  const submitCreate = () => {
    const body = requestFromForm(kind, createForm);
    if (!body) return showToast(kind === 'equipments' ? 'Укажите бренд и модель' : 'Укажите название', 'error');
    createMutation.mutate({ catalog: kind, body });
  };
  const submitEdit = () => {
    const body = requestFromForm(kind, editForm);
    if (!body || !editing) return showToast(kind === 'equipments' ? 'Укажите бренд и модель' : 'Укажите название', 'error');
    updateMutation.mutate({ catalog: kind, id: editing.id, body });
  };
  const columns: ColumnDef<CatalogItem>[] = [
    ...(kind === 'roasters' ? [{ id: 'photo', header: '', cell: ({ row }: { row: { original: CatalogItem } }) => { const roaster = row.original as CatalogRoaster; return roaster.photoUrl ? <img src={roaster.photoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="h-12 w-12 rounded-lg bg-stone-100 dark:bg-white/5" />; } } as ColumnDef<CatalogItem>] : []),
    { id: 'name', header: 'Название', cell: ({ row }) => itemTitle(kind, row.original) },
    ...(kind === 'equipments' || kind === 'brewMethods' ? [{ id: 'category', header: 'Категория', cell: ({ row }) => itemCategory(kind, row.original) || '—' } as ColumnDef<CatalogItem>] : []),
    { id: 'actions', meta: { className: 'text-right' }, cell: ({ row }) => { const roaster = kind === 'roasters' ? row.original as CatalogRoaster : null; return <div className="flex justify-end gap-2">{roaster ? <Button asChild variant="secondary" size="sm"><Link to={`/catalogs/roasters/${roaster.id}`}>Редактировать</Link></Button> : <Button variant="secondary" size="sm" onClick={() => { setEditing(row.original); setEditForm(formFromItem(kind, row.original)); }}>Изменить</Button>}<Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleting(row.original)}>Удалить</Button></div>; } },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-text-main dark:text-white">Справочники</h1>
        <p className="text-sm text-text-muted dark:text-stone-400 font-body mt-0.5">Управление справочниками, которые используются в карточках и фильтрах кофеен</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0" role="tablist" aria-label="Разделы каталога">
        {CATALOGS.map((catalog) => <Button key={catalog.kind} type="button" size="sm" role="tab" aria-selected={kind === catalog.kind} onClick={() => changeKind(catalog.kind)} variant={kind === catalog.kind ? 'primary' : 'secondary'}>{catalog.label}</Button>)}
      </div>

      <Card className="p-6">
        <div className="mb-4"><h2 className="text-sm font-semibold text-text-main dark:text-white font-display">Добавить: {definition.singular}</h2><p className="text-xs text-text-muted dark:text-stone-400 font-body mt-1">{definition.description}</p></div>
        <CatalogForm definition={definition} value={createForm} busy={createMutation.isPending} editing={false} onChange={setCreateForm} onSubmit={submitCreate} />
      </Card>

      <Card className="p-6">
        <div className="p-4 sm:p-5 border-b border-border-light dark:border-border-dark flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="min-w-0"><h2 className="text-sm font-semibold text-text-main dark:text-white font-display">{definition.label}</h2><p className="text-xs text-text-muted dark:text-stone-400 font-body mt-0.5">{data.length} записей</p></div>
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по каталогу" aria-label="Поиск по каталогу" className="sm:ml-auto sm:max-w-xs" />
        </div>
        {isError ? <div className="p-10 text-center"><p className="mb-3 font-body text-sm text-red-500">Не удалось загрузить каталог</p><Button variant="secondary" onClick={() => refetch()}>Повторить</Button></div> : <DataTable columns={columns} data={visibleItems} loading={isLoading} emptyText={search ? 'Ничего не найдено' : 'В этом справочнике пока нет записей'} getRowId={(item) => item.id} />}
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && <DialogContent><DialogTitle>Изменить: {itemTitle(kind, editing)}</DialogTitle><CatalogForm definition={definition} value={editForm} busy={updateMutation.isPending} editing onChange={setEditForm} onSubmit={submitEdit} onCancel={() => setEditing(null)} /></DialogContent>}
      </Dialog>

      <ConfirmDialog isOpen={Boolean(deleting)} title={`Удалить ${definition.singular}?`} message={`«${deleting ? itemTitle(kind, deleting) : ''}» будет удалено из справочника. Если запись используется кофейней, сервер может отклонить удаление.`} confirmLabel="Удалить" variant="danger" onConfirm={async () => { if (deleting) await deleteMutation.mutateAsync({ catalog: kind, id: deleting.id }); }} onCancel={() => setDeleting(null)} />
    </div>
  );
};
