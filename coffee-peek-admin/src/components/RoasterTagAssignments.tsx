import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAssignedTags, getDictionary, setAssignedTags } from '../api/coffeeCatalog';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Link, useParams } from 'react-router-dom';

const tagsSchema = z.object({ tagIds: z.array(z.string().uuid()).max(100).refine(values => new Set(values).size === values.length, 'Теги должны быть уникальными') });
export function RoasterTagsPage() {
  const { id = '' } = useParams();
  return <main className="mx-auto max-w-3xl space-y-4"><Link className="inline-flex min-h-11 items-center underline" to="/roaster-tags">← Теги обжарщиков</Link><h1 className="text-2xl font-bold">Назначения обжарщика</h1><p className="break-all">{id}</p><RoasterTagAssignments key={id} id={id} /></main>;
}
export function RoasterTagAssignments({ id }: { id: string }) {
  const qc = useQueryClient();
  const [removeInactive, setRemoveInactive] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const form = useForm<{ tagIds: string[] }>({ defaultValues: { tagIds: [] }, resolver: zodResolver(tagsSchema) });
  const tags = useQuery({ queryKey: ['admin', 'coffee-dictionary', 'tags'], queryFn: ({ signal }) => getDictionary('tags', signal) });
  const assigned = useQuery({ queryKey: ['admin', 'roaster-tags', id], queryFn: ({ signal }) => getAssignedTags(id, signal), retry: false });
  useEffect(() => { if (assigned.data && !initialized) { form.reset({ tagIds: assigned.data.filter(tag => tag.isActive).map(tag => tag.id) }); setInitialized(true); } }, [assigned.data, initialized]);
  const inactive = assigned.data?.filter(tag => !tag.isActive) ?? [];
  const mutation = useMutation({ mutationFn: ({ tagIds }: { tagIds: string[] }) => setAssignedTags(id, tagIds), onSuccess: async () => { await Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'roaster-tags', id] }), qc.invalidateQueries({ queryKey: ['catalogs'] })]); form.reset(form.getValues()); setRemoveInactive(false); } });
  const selected = form.watch('tagIds');
  return <Card className="space-y-3 p-5"><h2 className="font-semibold">Услуги обжарщика</h2>
    {(tags.isError || assigned.isError) && <p role="alert">Не удалось загрузить назначения. <Button onClick={() => { void tags.refetch(); void assigned.refetch(); }}>Повторить</Button></p>}
    <form className="space-y-3" onSubmit={form.handleSubmit(values => mutation.mutate(values))}>
      {tags.data?.filter(tag => tag.isActive).map(tag => <label key={tag.id} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={selected.includes(tag.id)} onChange={event => form.setValue('tagIds', event.target.checked ? [...selected, tag.id] : selected.filter(id => id !== tag.id), { shouldDirty: true })} />{tag.name}</label>)}
      {!!inactive.length && <div><p>Неактивные назначения: {inactive.map(tag => tag.name).join(', ')}</p><p className="text-sm">Полная замена списка удалит эти назначения. Они не могут быть назначены повторно до реактивации.</p><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={removeInactive} onChange={event => setRemoveInactive(event.target.checked)} />Удалить неактивные назначения при сохранении</label></div>}
      <Button type="submit" disabled={!initialized || tags.isError || mutation.isPending || !!inactive.length && !removeInactive} loading={mutation.isPending}>Сохранить назначения</Button>
      {mutation.isError && <p role="alert">{mutation.error.message}</p>}{form.formState.errors.tagIds && <p role="alert">{form.formState.errors.tagIds.message}</p>}
    </form>
  </Card>;
}
