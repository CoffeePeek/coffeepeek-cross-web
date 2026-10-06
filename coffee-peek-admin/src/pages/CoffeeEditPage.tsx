import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { coffeeGroups, editAdminCoffee, editClassification, editVariantClassification, getAdminCoffee, getClassification, getDictionary, type AdminCoffee, type AdminClassification, type Classification, type GroupCode } from '../api/coffeeCatalog';
import { httpClient } from '../api/core/httpClient';
import { baseProtectedFields, coffeeContentSchema, coffeeDraft, executeVersionedChanges, isVersionConflict, type CoffeeDraft } from '../utils/coffeeEditor';
import { useUnsavedCoffee } from '../hooks/useUnsavedCoffee';
import { coffeeWarningLabel } from '../utils/coffeePresentation';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { NativeSelect } from '../components/ui/NativeSelect';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { groupNames } from './CoffeeDictionariesPage';

const editorSchema = z.object({ content: coffeeContentSchema, countryCodes: z.array(z.string().regex(/^[A-Z]{2}$/)).max(30), protectedFields: z.array(z.string()),
  classification: z.object({ defaultBrewPurposes: z.array(z.string()), caffeine: z.string().nullable(), roastLevel: z.string().nullable(), acidity: z.string().nullable(), processing: z.array(z.string()), fermentation: z.array(z.string()), tasteGroups: z.array(z.string()), composition: z.string().nullable() }),
  classificationProtected: z.array(z.string()), variants: z.array(z.object({ id: z.string().uuid(), brewPurpose: z.string().nullable(), protectFromImport: z.boolean() })) });
const classificationFields: Record<GroupCode, keyof Classification> = { brew: 'defaultBrewPurposes', caffeine: 'caffeine', roast: 'roastLevel', acidity: 'acidity', processing: 'processing', fermentation: 'fermentation', taste: 'tasteGroups', composition: 'composition' };
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

function CoffeeEditor({ initial, initialClassification }: { initial: AdminCoffee; initialClassification: AdminClassification }) {
  const qc = useQueryClient();
  const { isAdmin } = useUser();
  const { showToast } = useToast();
  const [server, setServer] = useState(initial);
  const [serverClassification, setServerClassification] = useState(initialClassification);
  const version = useRef(Math.max(initial.version, initialClassification.version));
  const [conflict, setConflict] = useState(initial.version !== initialClassification.version);
  const [comparison, setComparison] = useState<{ coffee: AdminCoffee; classification: AdminClassification } | null>(null);
  const [archive, setArchive] = useState(false);
  const [slugBusy, setSlugBusy] = useState(false);
  const form = useForm<CoffeeDraft>({ defaultValues: coffeeDraft(initial, initialClassification), resolver: zodResolver(editorSchema) as unknown as Resolver<CoffeeDraft> });
  useUnsavedCoffee(form.formState.isDirty);
  const draft = form.watch();
  const dictionary = useQuery({ queryKey: ['admin', 'coffee-dictionary', 'values'], queryFn: ({ signal }) => getDictionary('values', signal) });
  const countries = useQuery({ queryKey: ['catalogs', 'coffee-origin-countries'], queryFn: async ({ signal }) => (await httpClient.get<AdminCoffee['countries']>('/api/Catalogs/coffee-origin-countries', { requiresAuth: false, signal })).data });
  const refresh = async () => {
    const [coffee, classification] = await Promise.all([getAdminCoffee(server.id), getClassification(server.id)]);
    qc.setQueryData(['admin', 'coffee', 'detail', server.id], { coffee, classification });
    return { coffee, classification };
  };
  const save = useMutation({ mutationFn: async ({ value, status }: { value: CoffeeDraft; status: AdminCoffee['status'] }) => {
    if (conflict) throw new Error('Сначала разрешите конфликт версии');
    const changes: ((version: number) => Promise<AdminCoffee | AdminClassification>)[] = [];
    const body = (version: number, status: AdminCoffee['status']) => ({ content: { ...server.content, ...value.content }, countryCodes: value.countryCodes, protectedFields: value.protectedFields, version, status });
    if (!same(value.content, server.content) || !same(value.countryCodes, server.countries.map(country => country.code)) || !same(value.protectedFields, server.protectedFields))
      changes.push(version => editAdminCoffee(server.id, body(version, server.status)));
    if (!same(value.classification, serverClassification.classification) || !same(value.classificationProtected, serverClassification.protectedFields))
      changes.push(version => editClassification(server.id, { classification: value.classification, protectedFields: value.classificationProtected, version }));
    for (const variant of value.variants) if (!same(variant, serverClassification.variants.find(item => item.id === variant.id)))
      changes.push(version => editVariantClassification(server.id, variant.id, { brewPurpose: variant.brewPurpose, protectFromImport: variant.protectFromImport, version }));
    if (status !== server.status) changes.push(version => editAdminCoffee(server.id, body(version, status)));
    await executeVersionedChanges(version.current, changes, value => {
      version.current = value.version;
      if ('content' in value) setServer(value); else setServerClassification(value);
    });
    return refresh();
  }, onSuccess: async ({ coffee, classification }) => {
    version.current = coffee.version; setServer(coffee); setServerClassification(classification); form.reset(coffeeDraft(coffee, classification)); setArchive(false); setConflict(coffee.version !== classification.version);
    await qc.invalidateQueries({ queryKey: ['admin', 'coffee', 'list'] }); showToast('Карточка сохранена', 'success');
  }, onError: error => { if (isVersionConflict(error)) { setConflict(true); setComparison(null); } else form.setError('root', { message: error.message }); } });
  const busy = save.isPending || slugBusy;
  const protect = (field: string) => <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.protectedFields.includes(field)} onChange={event => form.setValue('protectedFields', event.target.checked ? [...draft.protectedFields, field] : draft.protectedFields.filter(value => value !== field), { shouldDirty: true })} />Сохранять при импорте: {field}</label>;
  const options = (group: GroupCode) => dictionary.data?.filter(value => value.groupCode === group) ?? [];
  const submit = (status: AdminCoffee['status']) => form.handleSubmit(async value => { await save.mutateAsync({ value, status }); })().catch(() => {});
  return <main className="mx-auto max-w-5xl space-y-5 pb-8"><Link className="inline-flex min-h-11 items-center underline" to="/coffees">← Кофе</Link><h1 className="text-2xl font-bold">{server.content.name}</h1>
    <p>{server.status} · версия {version.current} · {server.slug ?? 'Публичный slug не назначен'}</p>
    <Link className="inline-flex min-h-11 items-center underline" to={`/roaster-tags/assignments/${encodeURIComponent(server.roasterId)}`}>Услуги обжарщика</Link>
    {conflict && <Card className="space-y-3 border-amber-500 p-5"><h2 className="font-bold">Карточка изменилась</h2><p>Локальный черновик сохранён. Загрузите актуальные данные и сравните перед повторным сохранением.</p>
      <Button onClick={async () => { try { setComparison(await refresh()); } catch (error) { showToast((error as Error).message, 'error'); } }}>Загрузить текущие данные / сравнить</Button>
      {comparison && <><div className="grid gap-4 sm:grid-cols-2"><details><summary className="min-h-11 cursor-pointer">Мой черновик</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(draft, null, 2)}</pre></details><details><summary className="min-h-11 cursor-pointer">Текущие данные</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(coffeeDraft(comparison.coffee, comparison.classification), null, 2)}</pre></details></div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={comparison.coffee.version !== comparison.classification.version} onClick={() => { version.current = comparison.coffee.version; setServer(comparison.coffee); setServerClassification(comparison.classification); form.reset(coffeeDraft(comparison.coffee, comparison.classification)); setConflict(false); }}>Использовать текущие данные</Button>
        <Button onClick={() => { if (comparison.coffee.version !== comparison.classification.version) return; version.current = comparison.coffee.version; setServer(comparison.coffee); setServerClassification(comparison.classification); setConflict(false); }}>Сохранить мой черновик для повторной попытки</Button></div></>}
    </Card>}
    <Card className="space-y-2 p-5"><h2 className="font-bold">Проверка перед публикацией</h2><ul className="list-disc pl-5">{server.reviewWarnings.map(warning => <li key={warning}>{coffeeWarningLabel(warning)}</li>)}</ul>{!server.reviewWarnings.length && <p>Предупреждений нет.</p>}<p>Проверьте происхождение, фото, классификацию и защиту ручных правок.</p>{!server.variants.length && <p>Предложений покупки нет. После публикации кофе может отсутствовать в каталоге с фильтром «Только в наличии».</p>}</Card>
    <form onSubmit={event => { event.preventDefault(); void submit(server.status); }} className="space-y-5">
      <fieldset disabled={busy} className="space-y-5">
      <Card className="space-y-4 p-5"><h2 className="font-bold">Содержание</h2><label className="block">Название<Input {...form.register('content.name')} /></label>{protect('Name')}
        <label className="block">Описание<Textarea rows={5} value={draft.content.description ?? ''} onChange={event => form.setValue('content.description', event.target.value || null, { shouldDirty: true })} /></label>{protect('Description')}
        <div className="grid gap-4 sm:grid-cols-2"><label>Вид продукта<NativeSelect {...form.register('content.productKind')}><option value="roasted_beans">Обжаренный кофе</option><option value="green_beans">Зелёный кофе</option></NativeSelect>{protect('ProductKind')}</label><label>Форма продукта<NativeSelect {...form.register('content.productForm')}><option value="whole_beans">В зёрнах</option><option value="ground_only">Молотый</option></NativeSelect>{protect('ProductForm')}</label></div>
        <fieldset><legend className="font-semibold">Страны</legend>{countries.data?.map(country => <label key={country.code} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={draft.countryCodes.includes(country.code)} onChange={event => form.setValue('countryCodes', event.target.checked ? [...draft.countryCodes, country.code] : draft.countryCodes.filter(code => code !== country.code), { shouldDirty: true })} />{country.nameRu}</label>)}{countries.isError && <p role="alert">Не удалось загрузить страны. <button type="button" onClick={() => void countries.refetch()} className="underline">Повторить</button></p>}{protect('Countries')}</fieldset>
        <details><summary className="min-h-11 cursor-pointer">Исходные характеристики</summary><div className="space-y-3">{(['compositionKind', 'processing', 'roastLevel', 'acidity', 'body', 'qGraderScoreRaw'] as const).map(field => <label className="block" key={field}>{field}<Input value={draft.content[field] ?? ''} onChange={event => form.setValue(`content.${field}`, event.target.value || (field === 'compositionKind' ? 'unknown' : null), { shouldDirty: true })} /></label>)}{(['tasteDescriptors', 'brewRecommendations', 'grindOptions', 'features'] as const).map(field => <label className="block" key={field}>{field} — по одному на строку<Textarea value={draft.content[field].join('\n')} onChange={event => form.setValue(`content.${field}`, event.target.value.split('\n'), { shouldDirty: true })} /></label>)}
          {baseProtectedFields.filter(field => !['Name', 'Description', 'ProductKind', 'ProductForm', 'Countries', 'Photos'].includes(field)).map(field => <div key={field}>{protect(field)}</div>)}
        </div></details>
      </Card>
      <Card className="space-y-4 p-5"><h2 className="font-bold">Нормализованная классификация</h2><p className="text-sm">Не подтверждённые значения сохраняются как null / []. Защита этого раздела не меняет защиту содержания.</p>
        {dictionary.isError && <p role="alert">Справочник недоступен. <button type="button" onClick={() => void dictionary.refetch()} className="underline">Повторить</button></p>}
        {coffeeGroups.map(group => {
          const field = classificationFields[group]; const value = draft.classification[field]; const values = options(group);
          return <fieldset key={field} className="rounded-xl border border-stone-200 p-3 dark:border-stone-700"><legend>{groupNames[group]}</legend>
            {Array.isArray(value) ? <>{!value.length && <p>Не подтверждено</p>}{values.map(option => <label key={option.id} className="flex min-h-11 items-center gap-2"><input type="checkbox" disabled={!option.isActive && !value.includes(option.code!)} checked={value.includes(option.code!)} onChange={event => form.setValue(`classification.${field}`, event.target.checked ? [...value, option.code!] : value.filter(code => code !== option.code), { shouldDirty: true })} />{option.name}{!option.isActive && ' — неактивно'}</label>)}</> : <NativeSelect aria-label={groupNames[group]} value={value ?? ''} onChange={event => form.setValue(`classification.${field}`, event.target.value || null, { shouldDirty: true })}><option value="">Не подтверждено</option>{values.map(option => <option key={option.id} value={option.code} disabled={!option.isActive && value !== option.code}>{option.name}{!option.isActive && ' — неактивно'}</option>)}</NativeSelect>}
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.classificationProtected.includes(field)} onChange={event => form.setValue('classificationProtected', event.target.checked ? [...draft.classificationProtected, field] : draft.classificationProtected.filter(value => value !== field), { shouldDirty: true })} />Сохранять при импорте</label>
          </fieldset>;
        })}
      </Card>
      <Card className="space-y-3 p-5"><h2 className="font-bold">Фотографии</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{server.photos.map(photo => <img key={photo.fullUrl} src={photo.urls?.detail ?? photo.fullUrl} alt="Фото кофе" className="aspect-square rounded-xl object-cover" />)}</div>{!server.photos.length && <p>Фото нет.</p>}{protect('Photos')}</Card>
      <Card className="space-y-4 p-5"><h2 className="font-bold">Все варианты покупки</h2>{server.variants.map((variant, index) => <div key={index} className="space-y-1 rounded-xl border border-stone-200 p-3 dark:border-stone-700"><p>{variant.weightGrams === null ? 'Вес не указан' : `${variant.weightGrams} г`} · {variant.price} {variant.currency} · {variant.grind ?? 'Помол не указан'}</p><p>{variant.sellerName} · {variant.availabilityScope} · {variant.availability === 'Unknown' ? 'Наличие не подтверждено' : variant.availability}</p><p>Проверено: {new Date(variant.checkedAtUtc).toLocaleString()}</p><p className="break-all text-sm">{variant.sourceUrl}</p></div>)}
        {draft.variants.map((variant, index) => <div key={variant.id} className="space-y-2"><p className="break-all text-xs">Вариант {variant.id}</p><label>Назначение варианта<NativeSelect aria-label="Назначение варианта" value={variant.brewPurpose ?? ''} onChange={event => form.setValue(`variants.${index}.brewPurpose`, event.target.value || null, { shouldDirty: true })}><option value="">Наследовать назначение кофе</option>{options('brew').map(option => <option key={option.id} value={option.code} disabled={!option.isActive && variant.brewPurpose !== option.code}>{option.name}{!option.isActive && ' — неактивно'}</option>)}</NativeSelect></label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={variant.protectFromImport} onChange={event => form.setValue(`variants.${index}.protectFromImport`, event.target.checked, { shouldDirty: true })} />Сохранять назначение при импорте</label></div>)}
      </Card>
      </fieldset>
      {form.formState.errors.root && <p role="alert" className="text-red-600 dark:text-red-300">{form.formState.errors.root.message}</p>}
      {Object.keys(form.formState.errors).some(key => key !== 'root') && <p role="alert" className="text-red-600 dark:text-red-300">Проверьте поля формы: название, страны и характеристики.</p>}
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={conflict} loading={busy}>Сохранить изменения</Button>{server.status !== 'Published' && <Button type="button" disabled={busy || conflict} onClick={() => void submit('Published')}>Опубликовать</Button>}{server.status === 'Archived' && <Button type="button" disabled={busy || conflict} onClick={() => void submit('Draft')}>Вернуть в Draft</Button>}{server.status !== 'Archived' && <Button variant="danger" type="button" disabled={busy || conflict} onClick={() => setArchive(true)}>Архивировать</Button>}</div>
    </form>
    {isAdmin && <CoffeeSlugEditor coffee={server} disabled={busy || conflict || form.formState.isDirty} onBusy={setSlugBusy} onSaved={async () => { const current = await refresh(); version.current = current.coffee.version; setServer(current.coffee); setServerClassification(current.classification); setConflict(current.coffee.version !== current.classification.version); form.reset(coffeeDraft(current.coffee, current.classification)); }} />}
    <ConfirmDialog isOpen={archive} title="Архивировать кофе?" message="Источники и фотографии сохранятся. Карточка исчезнет из публичного каталога." confirmLabel="Архивировать" variant="danger" onCancel={() => setArchive(false)} onConfirm={async () => { await submit('Archived'); }} />
  </main>;
}
function CoffeeSlugEditor({ coffee, disabled, onBusy, onSaved }: { coffee: AdminCoffee; disabled: boolean; onBusy: (value: boolean) => void; onSaved: () => Promise<void> }) {
  const [slug, setSlug] = useState(coffee.slug ?? '');
  const [reason, setReason] = useState('');
  const address = useQuery({ queryKey: ['admin', 'coffee-public-address', coffee.slug], queryFn: async ({ signal }) => (await httpClient.get<{ address: { revision: number } }>(`/api/v1/coffees/${encodeURIComponent(coffee.slug!)}`, { requiresAuth: false, signal })).data.address, enabled: coffee.status === 'Published' && !!coffee.slug, retry: false, staleTime: 0 });
  const mutation = useMutation({ mutationFn: async () => {
    const body = { slug, reason, expectedRevision: address.data?.revision ?? 0 };
    const path = `/api/admin/coffees/public-addresses/${encodeURIComponent(coffee.id)}`;
    if (!coffee.slug) await httpClient.post(`${path}/initialize`, body);
    else await httpClient.patch(path, body);
    await onSaved();
  }, onMutate: () => onBusy(true), onSettled: () => onBusy(false) });
  return <Card className="space-y-3 p-5"><h2 className="font-bold">Публичный slug · Admin</h2><label className="block">Slug<Input value={slug} onChange={event => setSlug(event.target.value)} /></label><label className="block">Причина изменения<Input value={reason} onChange={event => setReason(event.target.value)} /></label>
    {coffee.slug && !address.data && <p>Для изменения требуется актуальная revision публичного адреса. Она доступна после публикации.</p>}
    {disabled && <p>Сначала сохраните или разрешите изменения карточки.</p>}<Button disabled={disabled || mutation.isPending || !slug || !reason || !!coffee.slug && !address.data} onClick={() => mutation.mutate()}>Сохранить slug</Button>{mutation.isError && <p role="alert">{mutation.error.message}</p>}
  </Card>;
}
export function CoffeeEditPage() {
  const { id = '' } = useParams();
  const query = useQuery({ queryKey: ['admin', 'coffee', 'detail', id], queryFn: async ({ signal }) => { const [coffee, classification] = await Promise.all([getAdminCoffee(id, signal), getClassification(id, signal)]); return { coffee, classification }; }, retry: false, staleTime: 0 });
  if (query.isPending) return <div className="h-64 animate-pulse rounded-xl bg-stone-200 dark:bg-stone-800" aria-label="Загрузка карточки" />;
  if (query.isError) return <p role="alert">{query.error.message} <Button onClick={() => void query.refetch()}>Повторить</Button></p>;
  return <CoffeeEditor key={id} initial={query.data.coffee} initialClassification={query.data.classification} />;
}
