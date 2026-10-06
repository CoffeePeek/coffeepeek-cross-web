import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { coffeeGroups, createDictionaryEntry, deactivateDictionaryEntry, editDictionaryEntry, getDictionary, type DictionaryEntry, type GroupCode } from '../api/coffeeCatalog';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { NativeSelect } from '../components/ui/NativeSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/Dialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

export const groupNames: Record<GroupCode, string> = { brew: 'Назначение', caffeine: 'Кофеин', roast: 'Обжарка', acidity: 'Кислотность', processing: 'Обработка', fermentation: 'Ферментация', taste: 'Вкус', composition: 'Состав' };
const entrySchema = z.object({ code: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Стабильный код: строчные латинские буквы, цифры и дефисы'), name: z.string().trim().min(1, 'Введите название').max(100), description: z.string().max(2000), sortOrder: z.coerce.number().int(), isActive: z.boolean() });
type EntryForm = z.infer<typeof entrySchema>;
function EntryEditor({ kind, group, entry, onClose }: { kind: 'tags' | 'values'; group: GroupCode; entry: DictionaryEntry | null; onClose: () => void }) {
  const qc = useQueryClient();
  const schema = kind === 'values' ? entrySchema.extend({ code: z.string().max(100).regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'Код начинается с латинской буквы') }) : entrySchema;
  const form = useForm<EntryForm>({ resolver: zodResolver(schema), defaultValues: { code: entry?.slug ?? entry?.code ?? '', name: entry?.name ?? '', description: entry?.description ?? '', sortOrder: entry?.sortOrder ?? 0, isActive: entry?.isActive ?? true } });
  const mutation = useMutation({ mutationFn: (value: EntryForm) => entry ? editDictionaryEntry(kind, entry.id, { name: value.name, description: value.description || null, sortOrder: value.sortOrder, isActive: value.isActive })
    : createDictionaryEntry(kind, { ...(kind === 'tags' ? { slug: value.code } : { code: value.code, groupCode: group }), name: value.name, description: value.description || null, sortOrder: value.sortOrder }),
    onSuccess: async () => { await Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'coffee-dictionary', kind] }), qc.invalidateQueries({ queryKey: ['admin', 'coffee'] }), qc.invalidateQueries({ queryKey: ['catalogs'] })]); onClose(); },
    onError: error => form.setError('root', { message: error.message }),
  });
  return <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}><DialogContent>
    <DialogHeader><DialogTitle>{entry ? 'Изменить' : 'Создать'} {kind === 'tags' ? 'тег обжарщика' : 'характеристику кофе'}</DialogTitle><DialogDescription>{kind === 'values' ? `${groupNames[group]}: создание значения не меняет правила парсера.` : 'Теги услуг назначаются вручную.'}</DialogDescription></DialogHeader>
    <form className="space-y-3" onSubmit={form.handleSubmit(value => mutation.mutate(value))}>
      <label className="block">{kind === 'tags' ? 'Slug' : 'Код'}<Input {...form.register('code')} readOnly={!!entry} aria-invalid={!!form.formState.errors.code} /></label>
      <label className="block">Название<Input {...form.register('name')} aria-invalid={!!form.formState.errors.name} /></label>
      <label className="block">Описание<Textarea {...form.register('description')} /></label>
      <label className="block">Порядок<Input type="number" {...form.register('sortOrder')} /></label>
      {entry && <label className="flex min-h-11 items-center gap-2"><input type="checkbox" {...form.register('isActive')} />Активен</label>}
      {Object.entries(form.formState.errors).map(([field, error]) => <p key={field} role="alert" className="text-sm text-red-600 dark:text-red-300">{error.message}</p>)}
      <Button type="submit" loading={mutation.isPending}>Сохранить</Button>
    </form>
  </DialogContent></Dialog>;
}
export function CoffeeDictionariesPage({ kind }: { kind: 'tags' | 'values' }) {
  const qc = useQueryClient();
  const [group, setGroup] = useState<GroupCode>('brew');
  const [editing, setEditing] = useState<DictionaryEntry | null | undefined>();
  const [deactivating, setDeactivating] = useState<DictionaryEntry | null>(null);
  const query = useQuery({ queryKey: ['admin', 'coffee-dictionary', kind], queryFn: ({ signal }) => getDictionary(kind, signal), retry: false });
  const deactivate = useMutation({ mutationFn: (entry: DictionaryEntry) => deactivateDictionaryEntry(kind, entry.id), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['admin', 'coffee-dictionary'] }); await qc.invalidateQueries({ queryKey: ['catalogs'] }); setDeactivating(null); } });
  const entries = query.data?.filter(entry => kind === 'tags' || entry.groupCode === group) ?? [];
  return <main className="mx-auto max-w-6xl space-y-5"><h1 className="text-2xl font-bold">{kind === 'tags' ? 'Теги обжарщиков' : 'Характеристики кофе'}</h1>
    {kind === 'values' && <label className="block">Группа<NativeSelect value={group} onChange={event => setGroup(event.target.value as GroupCode)}>{coffeeGroups.map(code => <option key={code} value={code}>{groupNames[code]}</option>)}</NativeSelect></label>}
    <Button onClick={() => setEditing(null)}>Создать {kind === 'tags' ? 'тег' : 'значение'}</Button>
    {query.isPending && <div className="h-48 animate-pulse rounded-xl bg-stone-200 dark:bg-stone-800" aria-label="Загрузка справочника" />}
    {query.isError && <p role="alert">{query.error.message} <Button onClick={() => void query.refetch()}>Повторить</Button></p>}
    <div className="space-y-3">{entries.map(entry => <Card key={entry.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><h2 className="font-semibold">{entry.name} · {entry.isActive ? 'Активен' : 'Неактивен'}</h2><p className="text-sm">{entry.slug ?? entry.code} · порядок {entry.sortOrder}</p><p className="text-sm text-stone-500 dark:text-stone-300">{entry.description}</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setEditing(entry)}>{entry.isActive ? 'Изменить' : 'Реактивировать'}</Button>{entry.isActive && <Button variant="ghost" onClick={() => setDeactivating(entry)}>Деактивировать</Button>}</div></Card>)}</div>
    {query.data && !entries.length && <p>Значений пока нет.</p>}
    {editing !== undefined && <EntryEditor kind={kind} group={group} entry={editing} onClose={() => setEditing(undefined)} />}
    <ConfirmDialog isOpen={!!deactivating} title="Деактивировать?" message="Назначения сохранятся в истории. Значение исчезнет из публичного каталога. Вернуть его можно через «Изменить» → «Активен»." confirmLabel="Деактивировать" onCancel={() => setDeactivating(null)} onConfirm={async () => { if (deactivating) { try { await deactivate.mutateAsync(deactivating); } catch { /* Error is displayed below without closing the confirmation. */ } } }} />
    {deactivate.isError && <p role="alert">{deactivate.error.message}</p>}
  </main>;
}
