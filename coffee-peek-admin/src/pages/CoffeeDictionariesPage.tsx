import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Search } from 'lucide-react';
import { coffeeGroups, createDictionaryEntry, deactivateDictionaryEntry, editDictionaryEntry, getDictionary, type DictionaryEntry, type GroupCode } from '../api/coffeeCatalog';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { NativeSelect } from '../components/ui/NativeSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/Dialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../contexts/ToastContext';

export const groupNames: Record<GroupCode, string> = { brew: 'Назначение', caffeine: 'Кофеин', roast: 'Обжарка', acidity: 'Кислотность', processing: 'Обработка', fermentation: 'Ферментация', taste: 'Вкус', composition: 'Состав' };
const entrySchema = z.object({
  code: z.string().min(1, 'Введите код').max(100, 'Не больше 100 символов').regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Используйте строчные латинские буквы, цифры и дефисы'),
  name: z.string().trim().min(1, 'Введите название').max(100, 'Не больше 100 символов'),
  description: z.string().trim().max(2000, 'Не больше 2000 символов'),
  sortOrder: z.coerce.number().int('Введите целое число'),
  isActive: z.boolean(),
});
type EntryForm = z.infer<typeof entrySchema>;
function EntryEditor({ kind, group, entry, onClose }: { kind: 'tags' | 'values'; group: GroupCode; entry: DictionaryEntry | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const schema = kind === 'values' ? entrySchema.extend({ code: z.string().min(1, 'Введите код').max(100, 'Не больше 100 символов').regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'Используйте строчные латинские буквы, цифры и дефисы. Начните с буквы') }) : entrySchema;
  const form = useForm<EntryForm>({ resolver: zodResolver(schema), defaultValues: { code: entry?.slug ?? entry?.code ?? '', name: entry?.name ?? '', description: entry?.description ?? '', sortOrder: entry?.sortOrder ?? 0, isActive: entry?.isActive ?? true } });
  const mutation = useMutation({ mutationFn: (value: EntryForm) => entry ? editDictionaryEntry(kind, entry.id, { name: value.name, description: value.description || null, sortOrder: value.sortOrder, isActive: value.isActive })
    : createDictionaryEntry(kind, { ...(kind === 'tags' ? { slug: value.code } : { code: value.code, groupCode: group }), name: value.name, description: value.description || null, sortOrder: value.sortOrder }),
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'coffee-dictionary', kind] }), qc.invalidateQueries({ queryKey: ['admin', 'coffee'] }), qc.invalidateQueries({ queryKey: ['admin', 'roaster-tags'] }), qc.invalidateQueries({ queryKey: ['catalogs'] })]);
      showToast(kind === 'tags' ? 'Тег сохранён' : 'Характеристика сохранена', 'success');
      onClose();
    },
    onError: error => form.setError('root', { message: error.message }),
  });
  const { errors } = form.formState;
  return <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}><DialogContent className="gap-3 p-4 text-text-main dark:text-white sm:p-5">
    <DialogHeader className="pr-6 text-left"><DialogTitle>{entry ? 'Изменить' : 'Создать'} {kind === 'tags' ? 'тег обжарщика' : 'характеристику кофе'}</DialogTitle><DialogDescription>{kind === 'values' ? `Группа: ${groupNames[entry?.groupCode ?? group]}` : 'Название и описание услуги обжарщика.'}</DialogDescription></DialogHeader>
    <form className="space-y-3" onSubmit={form.handleSubmit(value => mutation.mutate(value))}>
      <fieldset disabled={mutation.isPending} className="min-w-0 space-y-3">
        <div className="space-y-1">
          <label htmlFor="entry-name" className="text-sm">Название</label>
          <Input id="entry-name" {...form.register('name')} maxLength={100} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'entry-name-error' : undefined} />
          {errors.name && <p id="entry-name-error" role="alert" className="text-xs text-red-700 dark:text-red-300">{errors.name.message}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor="entry-description" className="text-sm">Описание <span className="text-text-muted dark:text-stone-400">· необязательно</span></label>
          <Textarea id="entry-description" {...form.register('description')} rows={3} maxLength={2000} aria-invalid={!!errors.description} aria-describedby={errors.description ? 'entry-description-error' : undefined} />
          {errors.description && <p id="entry-description-error" role="alert" className="text-xs text-red-700 dark:text-red-300">{errors.description.message}</p>}
        </div>
        {entry && <div className="flex flex-wrap items-center gap-2 text-sm"><label className="flex items-center gap-2"><Input type="checkbox" {...form.register('isActive')} />Активен</label><span className="text-xs text-text-muted dark:text-stone-400">· доступен в каталоге</span></div>}
        <details open={!entry || !!errors.code || !!errors.sortOrder} className="rounded-md border border-border-light p-3 dark:border-border-dark">
          <summary className="w-fit cursor-pointer rounded text-xs text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-stone-400">Код и порядок в списке</summary>
          <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <div className="min-w-0 space-y-1">
              <label htmlFor="entry-code" className="text-sm">{kind === 'tags' ? 'Код тега' : 'Код характеристики'}</label>
              <Input id="entry-code" {...form.register('code')} readOnly={!!entry} maxLength={100} spellCheck={false} autoCapitalize="none" className="font-mono text-xs" aria-invalid={!!errors.code} aria-describedby={`entry-code-hint${errors.code ? ' entry-code-error' : ''}`} />
              <p id="entry-code-hint" className="text-xs text-text-muted dark:text-stone-400">{entry ? 'Код нельзя изменить после создания.' : 'Латиница, цифры и дефисы. После создания код нельзя изменить.'}</p>
              {errors.code && <p id="entry-code-error" role="alert" className="text-xs text-red-700 dark:text-red-300">{errors.code.message}</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="entry-order" className="text-sm">Порядок</label>
              <Input id="entry-order" type="number" step={1} {...form.register('sortOrder')} aria-invalid={!!errors.sortOrder} aria-describedby={`entry-order-hint${errors.sortOrder ? ' entry-order-error' : ''}`} />
              <p id="entry-order-hint" className="text-xs text-text-muted dark:text-stone-400">Меньше — выше в списке.</p>
              {errors.sortOrder && <p id="entry-order-error" role="alert" className="text-xs text-red-700 dark:text-red-300">{errors.sortOrder.message}</p>}
            </div>
          </div>
        </details>
      </fieldset>
      {errors.root && <p role="alert" className="break-words text-sm text-red-700 dark:text-red-300">{errors.root.message}</p>}
      <DialogFooter className="border-t border-border-light pt-3 dark:border-border-dark">
        <Button variant="ghost" size="sm" disabled={mutation.isPending} onClick={onClose}>Отмена</Button>
        <Button type="submit" size="sm" loading={mutation.isPending}>Сохранить</Button>
      </DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
export function CoffeeDictionariesPage({ kind }: { kind: 'tags' | 'values' }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [group, setGroup] = useState<GroupCode>('brew');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState<DictionaryEntry | null | undefined>();
  const [deactivating, setDeactivating] = useState<DictionaryEntry | null>(null);
  const query = useQuery({ queryKey: ['admin', 'coffee-dictionary', kind], queryFn: ({ signal }) => getDictionary(kind, signal), retry: false });
  const deactivate = useMutation({ mutationFn: (entry: DictionaryEntry) => deactivateDictionaryEntry(kind, entry.id), onSuccess: async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'coffee-dictionary', kind] }), qc.invalidateQueries({ queryKey: ['admin', 'coffee'] }), qc.invalidateQueries({ queryKey: ['admin', 'roaster-tags'] }), qc.invalidateQueries({ queryKey: ['catalogs'] })]);
    showToast(kind === 'tags' ? 'Тег деактивирован' : 'Характеристика деактивирована', 'success');
    setDeactivating(null);
  } });
  const groupEntries = query.data?.filter(entry => kind === 'tags' || entry.groupCode === group) ?? [];
  const term = search.trim().toLocaleLowerCase('ru-RU');
  const entries = groupEntries.filter(entry => (status === 'all' || entry.isActive === (status === 'active')) && [entry.name, entry.description, entry.slug, entry.code].some(value => value?.toLocaleLowerCase('ru-RU').includes(term)))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru-RU'));
  return <section aria-label={kind === 'tags' ? 'Список тегов обжарщиков' : 'Список характеристик кофе'} className="min-w-0 w-full space-y-4 text-text-main dark:text-white">
    <div className="flex flex-wrap items-center gap-2">
      {kind === 'values' && <div className="w-full sm:w-48"><NativeSelect aria-label="Группа" value={group} onChange={event => setGroup(event.target.value as GroupCode)}>{coffeeGroups.map(code => <option key={code} value={code}>{groupNames[code]}</option>)}</NativeSelect></div>}
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <Input type="search" aria-label={kind === 'tags' ? 'Поиск тегов' : 'Поиск характеристик'} placeholder="Поиск по названию или коду" className="pl-9" value={search} onChange={event => setSearch(event.target.value)} />
      </div>
      <div className="w-full sm:w-44"><NativeSelect aria-label="Статус" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Все статусы</option><option value="active">Активные</option><option value="inactive">Неактивные</option></NativeSelect></div>
      <Button size="sm" className="sm:ml-auto" onClick={() => setEditing(null)}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Создать {kind === 'tags' ? 'тег' : 'значение'}</Button>
    </div>
    {query.data && <p className="text-xs text-text-muted dark:text-stone-400" role="status">Показано: {entries.length} из {groupEntries.length}</p>}
    {query.isPending && <p role="status" className="py-6 text-sm text-text-muted">Загрузка справочника…</p>}
    {query.isError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-700 dark:text-red-300">Не удалось загрузить список: {query.error.message} <Button size="sm" variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}>Повторить</Button></div>}
    <ul className="divide-y divide-border-light dark:divide-border-dark">{entries.map(entry => <li key={`${kind}:${entry.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 text-sm font-semibold"><button className="inline-flex max-w-full items-center gap-2 rounded text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" onClick={() => setEditing(entry)}><span className="min-w-0 break-words">{entry.name}</span><Pencil className="h-3 w-3 shrink-0 text-text-muted" aria-hidden="true" /></button></h2>
          <Badge variant={entry.isActive ? 'approved' : 'default'}>{entry.isActive ? 'Активен' : 'Неактивен'}</Badge>
        </div>
        {entry.description && <p className="line-clamp-2 break-words text-xs text-text-muted dark:text-stone-400">{entry.description}</p>}
      </div>
      {entry.isActive
        ? <Button variant="ghost" size="sm" onClick={() => { deactivate.reset(); setDeactivating(entry); }}>Деактивировать</Button>
        : <Button variant="secondary" size="sm" onClick={() => setEditing({ ...entry, isActive: true })}>Вернуть в каталог</Button>}
    </li>)}</ul>
    {query.data && !entries.length && <div className="py-8 text-center text-sm text-text-muted dark:text-stone-400">
      <p>{groupEntries.length ? 'Ничего не найдено. Измените поиск или статус.' : kind === 'tags' ? 'Тегов пока нет.' : 'В этой группе пока нет значений.'}</p>
      {(search || status !== 'all') && <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearch(''); setStatus('all'); }}>Сбросить фильтры</Button>}
    </div>}
    {editing !== undefined && <EntryEditor kind={kind} group={group} entry={editing} onClose={() => setEditing(undefined)} />}
    <ConfirmDialog isOpen={!!deactivating} title={`Деактивировать «${deactivating?.name ?? ''}»?`} message="Запись исчезнет из публичного каталога, а назначения сохранятся в истории. Восстановить её можно кнопкой «Вернуть в каталог»." error={deactivate.isError ? deactivate.error.message : undefined} confirmLabel="Деактивировать" onCancel={() => setDeactivating(null)} onConfirm={async () => { if (deactivating) { try { await deactivate.mutateAsync(deactivating); } catch { /* Keep the confirmation open with its error. */ } } }} />
  </section>;
}
