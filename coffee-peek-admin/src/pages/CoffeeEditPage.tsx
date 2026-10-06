import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2, ExternalLink, ImageOff, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { coffeeGroups, editAdminCoffee, editClassification, editVariantClassification, getAdminCoffee, getClassification, getDictionary, type AdminCoffee, type AdminClassification, type Classification, type GroupCode } from '../api/coffeeCatalog';
import { getCatalogRoasters } from '../api/catalogs';
import { httpClient } from '../api/core/httpClient';
import { baseProtectedFields, coffeeContentSchema, coffeeDraft, executeVersionedChanges, isVersionConflict, type CoffeeDraft } from '../utils/coffeeEditor';
import { useUnsavedCoffee } from '../hooks/useUnsavedCoffee';
import { coffeeWarningLabel } from '../utils/coffeePresentation';
import { safeHttpUrl } from '../utils/importDossier';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
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
const fieldLabels: Record<typeof baseProtectedFields[number], string> = {
  Name: 'Название', Description: 'Описание', ProductKind: 'Вид продукта', ProductForm: 'Форма продукта',
  CompositionKind: 'Тип состава', Processing: 'Обработка', RoastLevel: 'Обжарка', Acidity: 'Кислотность',
  Body: 'Плотность', QGraderScoreRaw: 'Оценка Q-грейдера', TasteDescriptors: 'Вкусовые ноты',
  BrewRecommendations: 'Рекомендации по приготовлению', GrindOptions: 'Варианты помола', Features: 'Особенности',
  Countries: 'Страны происхождения', Photos: 'Фотографии',
};

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
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
  const form = useForm<CoffeeDraft>({ defaultValues: coffeeDraft(initial, initialClassification), resolver: zodResolver(editorSchema) as unknown as Resolver<CoffeeDraft> });
  useUnsavedCoffee(form.formState.isDirty);
  const draft = form.watch();
  const dictionary = useQuery({ queryKey: ['admin', 'coffee-dictionary', 'values'], queryFn: ({ signal }) => getDictionary('values', signal) });
  const countries = useQuery({ queryKey: ['catalogs', 'coffee-origin-countries'], queryFn: async ({ signal }) => (await httpClient.get<AdminCoffee['countries']>('/api/Catalogs/coffee-origin-countries', { requiresAuth: false, signal })).data });
  const roasters = useQuery({ queryKey: ['admin', 'catalogs', 'roasters'], queryFn: async () => (await getCatalogRoasters()).data, retry: false });
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
  const protect = (field: typeof baseProtectedFields[number]) => <label className="flex min-h-8 items-center gap-2 text-sm"><Input type="checkbox" aria-label={`Защита от импорта: ${fieldLabels[field]}`} checked={draft.protectedFields.includes(field)} onChange={event => form.setValue('protectedFields', event.target.checked ? [...draft.protectedFields, field] : draft.protectedFields.filter(value => value !== field), { shouldDirty: true })} />{fieldLabels[field]}</label>;
  const options = (group: GroupCode) => dictionary.data?.filter(value => value.groupCode === group) ?? [];
  const submit = (status: AdminCoffee['status']) => form.handleSubmit(async value => { await save.mutateAsync({ value, status }); })().catch(() => {});
  const countryNames = new Map([...server.countries, ...(countries.data ?? [])].map(country => [country.code, country.nameRu || country.nameEn || country.code]));
  const countryChip = (code: string) => <span key={code} className="inline-flex items-center gap-1.5 rounded-md bg-stone-100 pl-2 text-sm dark:bg-white/10">
    {/^[A-Z]{2}$/.test(code) && <img src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} className="h-3.5 w-5 rounded-sm object-cover" />}
    {countryNames.get(code) ?? code}<button type="button" aria-label={`Убрать страну: ${countryNames.get(code) ?? code}`} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-stone-200 focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-white/10" onClick={() => form.setValue('countryCodes', draft.countryCodes.filter(value => value !== code), { shouldDirty: true })}><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
  </span>;
  const photoThumb = (photo: AdminCoffee['photos'][number], index: number) => <a key={`${photo.fullUrl}-${index}`} href={safeHttpUrl(photo.fullUrl)} target="_blank" rel="noopener noreferrer" className="flex h-28 items-center justify-center rounded-lg bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary dark:bg-white/5">
    {failedPhotos.includes(photo.fullUrl) ? <span className="text-xs text-text-muted">Фото недоступно</span> : <img src={photo.urls?.card || photo.urls?.detail || photo.fullUrl} alt={`Фото кофе ${index + 1}`} loading="lazy" onError={() => setFailedPhotos(previous => [...previous, photo.fullUrl])} className="h-full w-full object-contain p-1" />}
  </a>;
  return <main className="mx-auto max-w-6xl space-y-4 pb-4 text-sm text-text-main dark:text-white [&_input]:text-text-main [&_select]:text-text-main [&_textarea]:text-text-main dark:[&_input]:text-white dark:[&_select]:text-white dark:[&_textarea]:text-white">
    <header className="space-y-1">
      <Link className="inline-flex min-h-8 items-center gap-1 text-xs text-text-muted hover:underline dark:text-stone-400" to="/coffees"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Список кофе</Link>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h1 className="min-w-0 break-words text-xl font-semibold">{server.content.name}</h1><Badge variant={server.status === 'Published' ? 'approved' : server.status === 'Draft' ? 'info' : 'default'}>{({ Draft: 'Черновик', Published: 'Опубликован', Archived: 'В архиве' })[server.status]}</Badge></div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted dark:text-stone-400"><span>Обжарщик: <strong className="font-medium text-text-main dark:text-stone-200">{roasters.data?.find(roaster => roaster.id === server.roasterId)?.name || (roasters.isPending ? 'Загрузка…' : roasters.isError ? 'Имя недоступно' : 'Не указан в справочнике')}</strong></span><Link className="inline-flex min-h-8 items-center underline" to={`/roaster-tags/assignments/${encodeURIComponent(server.roasterId)}`}>Услуги обжарщика</Link>{roasters.isError && <button type="button" className="underline" onClick={() => void roasters.refetch()}>Повторить загрузку имени</button>}</div>
    </header>
    {conflict && <Card className="space-y-3 border-amber-500 p-4"><h2 className="font-semibold">Карточка изменилась</h2><p>Ваш черновик сохранён. Загрузите актуальные данные и сравните перед повторным сохранением.</p>
      <Button size="sm" onClick={async () => { try { setComparison(await refresh()); } catch (error) { showToast((error as Error).message, 'error'); } }}>Загрузить текущие данные / сравнить</Button>
      {comparison && <><div className="grid gap-3 sm:grid-cols-2"><details><summary className="min-h-8 cursor-pointer">Мой черновик</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(draft, null, 2)}</pre></details><details><summary className="min-h-8 cursor-pointer">Текущие данные</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(coffeeDraft(comparison.coffee, comparison.classification), null, 2)}</pre></details></div>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={comparison.coffee.version !== comparison.classification.version} onClick={() => { version.current = comparison.coffee.version; setServer(comparison.coffee); setServerClassification(comparison.classification); form.reset(coffeeDraft(comparison.coffee, comparison.classification)); setConflict(false); }}>Использовать текущие данные</Button>
        <Button size="sm" disabled={comparison.coffee.version !== comparison.classification.version} onClick={() => { if (comparison.coffee.version !== comparison.classification.version) return; version.current = comparison.coffee.version; setServer(comparison.coffee); setServerClassification(comparison.classification); setConflict(false); }}>Сохранить мой черновик для повторной попытки</Button></div></>}
    </Card>}
    <form onSubmit={event => { event.preventDefault(); void submit(server.status); }} className="space-y-4">
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="contents">
            <Card className="space-y-3 p-4 xl:col-start-1 xl:row-start-1"><h2 className="font-semibold">Основные данные</h2>
              <label className="block space-y-1 text-xs text-text-muted dark:text-stone-400">Название<Input {...form.register('content.name')} aria-invalid={!!form.formState.errors.content?.name} /></label>
              {form.formState.errors.content?.name && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{form.formState.errors.content.name.message}</p>}
              <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs text-text-muted dark:text-stone-400">Вид продукта<NativeSelect {...form.register('content.productKind')}><option value="roasted_beans">Обжаренный кофе</option><option value="green_beans">Зелёный кофе</option></NativeSelect></label><label className="space-y-1 text-xs text-text-muted dark:text-stone-400">Форма продукта<NativeSelect {...form.register('content.productForm')}><option value="whole_beans">В зёрнах</option><option value="ground_only">Молотый</option></NativeSelect></label></div>
              <fieldset className="min-w-0 space-y-2"><legend className="mb-1 text-xs text-text-muted dark:text-stone-400">Страны происхождения</legend>
                <div className="flex flex-wrap items-center gap-2" aria-label="Выбранные страны">{draft.countryCodes.slice(0, 2).map(countryChip)}{!draft.countryCodes.length && <span className="text-xs text-amber-800 dark:text-amber-300">Происхождение не подтверждено</span>}</div>
                {draft.countryCodes.length > 2 && <details><summary className="min-h-8 cursor-pointer text-xs text-text-muted dark:text-stone-400">Другие страны ({draft.countryCodes.length - 2})</summary><div className="flex flex-wrap gap-2 pb-2">{draft.countryCodes.slice(2).map(countryChip)}</div></details>}
                <div className="max-w-xs"><NativeSelect aria-label="Добавить страну" value="" disabled={!countries.data || draft.countryCodes.length >= 30} onChange={event => { if (event.target.value && !draft.countryCodes.includes(event.target.value)) form.setValue('countryCodes', [...draft.countryCodes, event.target.value], { shouldDirty: true }); }}><option value="">{countries.isPending ? 'Загрузка стран…' : 'Добавить страну…'}</option>{countries.data?.filter(country => !draft.countryCodes.includes(country.code)).map(country => <option key={country.code} value={country.code}>{country.nameRu || country.nameEn || country.code}</option>)}</NativeSelect></div>
                {countries.isError && <p role="alert" className="text-xs text-red-600 dark:text-red-300">Не удалось загрузить страны. <button type="button" onClick={() => void countries.refetch()} className="underline">Повторить</button></p>}
              </fieldset>
              <label className="block space-y-1 text-xs text-text-muted dark:text-stone-400">Описание<Textarea rows={3} className="min-h-20" value={draft.content.description ?? ''} onChange={event => form.setValue('content.description', event.target.value || null, { shouldDirty: true })} /></label>
            </Card>
            <Card className="row-start-3 space-y-3 p-4 xl:col-start-1 xl:row-start-2"><h2 className="font-semibold">Характеристики для каталога</h2>
              {dictionary.isError && <p role="alert" className="text-xs text-red-600 dark:text-red-300">Справочник недоступен. <button type="button" onClick={() => void dictionary.refetch()} className="underline">Повторить</button></p>}
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">{coffeeGroups.map(group => {
                const field = classificationFields[group]; const value = draft.classification[field]; const values = options(group);
                return <fieldset key={field} className="min-w-0 space-y-1.5"><legend className="mb-1 text-xs text-text-muted dark:text-stone-400">{groupNames[group]}</legend>
                  {Array.isArray(value) ? <>
                    {!!value.length && <div className="flex flex-wrap gap-1">{value.map(code => {
                      const option = values.find(option => option.code === code); const name = option?.name ?? code;
                      return <span key={code} className="inline-flex max-w-full items-center gap-1 rounded-md bg-stone-100 pl-2 text-xs dark:bg-white/10"><span className="min-w-0 break-words">{name}{option && !option.isActive && ' (неактивно)'}</span><button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-stone-200 focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-white/10" aria-label={`Убрать: ${groupNames[group]} — ${name}`} onClick={() => form.setValue(`classification.${field}`, value.filter(item => item !== code), { shouldDirty: true })}><X className="h-3 w-3" aria-hidden="true" /></button></span>;
                    })}</div>}
                    <NativeSelect aria-label={`Добавить: ${groupNames[group]}`} value="" disabled={!dictionary.data} onChange={event => { if (event.target.value && !value.includes(event.target.value)) form.setValue(`classification.${field}`, [...value, event.target.value], { shouldDirty: true }); }}><option value="">{dictionary.isPending ? 'Загрузка…' : value.length ? 'Добавить…' : 'Не подтверждено · выбрать…'}</option>{values.filter(option => option.code && option.isActive && !value.includes(option.code)).map(option => <option key={option.id} value={option.code}>{option.name}</option>)}</NativeSelect>
                  </> : <NativeSelect aria-label={groupNames[group]} value={value ?? ''} disabled={!dictionary.data} onChange={event => form.setValue(`classification.${field}`, event.target.value || null, { shouldDirty: true })}><option value="">Не подтверждено</option>{value && !values.some(option => option.code === value) && <option value={value}>{value} (нет в справочнике)</option>}{values.filter(option => option.code && (option.isActive || value === option.code)).map(option => <option key={option.id} value={option.code}>{option.name}{!option.isActive && ' (неактивно)'}</option>)}</NativeSelect>}
                </fieldset>;
              })}</div>
            </Card>
          </div>
          <aside className="row-start-2 min-w-0 space-y-4 xl:col-start-2 xl:row-span-2 xl:row-start-1">
            <Card className="space-y-3 p-4"><h2 className="font-semibold">Фотографии <span className="font-normal text-text-muted dark:text-stone-400">{server.photos.length || ''}</span></h2>
              {!!server.photos.length ? <><div className="grid grid-cols-2 gap-2">{server.photos.slice(0, 4).map(photoThumb)}</div>{server.photos.length > 4 && <details><summary className="min-h-8 cursor-pointer text-xs">Ещё {server.photos.length - 4} фото</summary><div className="grid grid-cols-2 gap-2">{server.photos.slice(4).map((photo, index) => photoThumb(photo, index + 4))}</div></details>}</> : <div className="flex h-24 items-center justify-center gap-2 rounded-lg bg-stone-100 text-text-muted dark:bg-white/5 dark:text-stone-400"><ImageOff className="h-5 w-5" aria-hidden="true" />Нет фото</div>}
            </Card>
            <Card className={`space-y-2 p-4 ${server.reviewWarnings.length ? 'border-amber-300/60 dark:border-amber-500/30' : ''}`}>
              <h2 className={`flex items-center gap-1.5 text-sm font-semibold ${server.reviewWarnings.length ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{server.reviewWarnings.length ? <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}{server.reviewWarnings.length ? `Нужно проверить (${server.reviewWarnings.length})` : 'Замечаний нет'}</h2>
              {!!server.reviewWarnings.length && <ul className="list-disc space-y-1.5 pl-4 text-xs leading-5 text-amber-900 [overflow-wrap:anywhere] dark:text-amber-200">{server.reviewWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{coffeeWarningLabel(warning)}</li>)}</ul>}
            </Card>
          </aside>
        </div>
        <Card className="space-y-3 p-4"><h2 className="font-semibold">Предложения покупки <span className="font-normal text-text-muted dark:text-stone-400">{server.variants.length || ''}</span></h2>
          {server.variants.length ? <ul className="divide-y divide-border-light dark:divide-border-dark">{server.variants.map((variant, index) => {
            const url = safeHttpUrl(variant.sourceUrl);
            const checked = new Date(variant.checkedAtUtc);
            return <li key={index} className="grid gap-1 py-2 first:pt-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-3">
              <div className="min-w-0"><p className="font-medium">{variant.weightGrams === null ? 'Вес не указан' : `${variant.weightGrams} г`} · {variant.price.toLocaleString('ru-RU')} {variant.currency}</p><p className="text-xs text-text-muted dark:text-stone-400">{variant.grind ?? 'Помол не указан'}{variant.roastPurpose && ` · ${variant.roastPurpose}`}</p></div>
              <div className="min-w-0"><p className="break-words">{variant.sellerName}</p><p className="text-xs text-text-muted dark:text-stone-400">{({ online: 'Онлайн', in_store: 'В магазине' } as Record<string, string>)[variant.availabilityScope] ?? variant.availabilityScope}{url && <a href={url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">Источник<ExternalLink className="h-3 w-3" aria-hidden="true" /></a>}</p></div>
              <div className="space-y-1 sm:text-right"><Badge variant={variant.availability === 'InStock' ? 'approved' : 'default'}>{({ InStock: 'В наличии', OutOfStock: 'Нет в наличии', Unknown: 'Наличие не подтверждено' } as Record<string, string>)[variant.availability] ?? variant.availability}</Badge><p className="text-[11px] text-text-muted dark:text-stone-400" title="Наличие по последней проверке источника">{Number.isNaN(checked.getTime()) ? 'Дата проверки не указана' : `Проверено ${checked.toLocaleDateString('ru-RU')}`}</p></div>
            </li>;
          })}</ul> : <p className="text-xs text-text-muted dark:text-stone-400">Предложений нет. Кофе может не появиться в каталоге с фильтром «Только в наличии».</p>}
          {!!draft.variants.length && <details className="border-t border-border-light pt-2 dark:border-border-dark"><summary className="min-h-8 cursor-pointer text-xs">Назначение отдельных упаковок ({draft.variants.length})</summary><p className="mb-2 text-xs text-text-muted dark:text-stone-400">Предложения покупки не содержат ID упаковок, поэтому настройки показаны отдельно.</p><div className="divide-y divide-border-light dark:divide-border-dark">{draft.variants.map((variant, index) => <div key={variant.id} className="grid items-center gap-2 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]"><span className="truncate font-mono text-xs text-text-muted dark:text-stone-400" title={variant.id}>ID: {variant.id}</span><NativeSelect aria-label="Назначение варианта" value={variant.brewPurpose ?? ''} disabled={!dictionary.data} onChange={event => form.setValue(`variants.${index}.brewPurpose`, event.target.value || null, { shouldDirty: true })}><option value="">Наследовать назначение кофе</option>{variant.brewPurpose && !options('brew').some(option => option.code === variant.brewPurpose) && <option value={variant.brewPurpose}>{variant.brewPurpose} (нет в справочнике)</option>}{options('brew').filter(option => option.code && (option.isActive || variant.brewPurpose === option.code)).map(option => <option key={option.id} value={option.code}>{option.name}{!option.isActive && ' (неактивно)'}</option>)}</NativeSelect><label className="flex min-h-8 items-center gap-2 text-xs"><Input type="checkbox" checked={variant.protectFromImport} onChange={event => form.setValue(`variants.${index}.protectFromImport`, event.target.checked, { shouldDirty: true })} />Защитить от импорта</label></div>)}</div></details>}
        </Card>
        <div className="divide-y divide-border-light border-y border-border-light dark:divide-border-dark dark:border-border-dark">
          <details className="py-1"><summary className="min-h-9 cursor-pointer py-2 text-sm font-medium">Данные из источника</summary><p className="mb-3 text-xs text-text-muted dark:text-stone-400">Формулировки обжарщика. Фильтры каталога используют характеристики выше.</p><div className="grid gap-3 pb-3 sm:grid-cols-2 lg:grid-cols-3">{(['compositionKind', 'processing', 'roastLevel', 'acidity', 'body', 'qGraderScoreRaw'] as const).map(field => <label className="space-y-1 text-xs text-text-muted dark:text-stone-400" key={field}>{fieldLabels[(field[0].toUpperCase() + field.slice(1)) as keyof typeof fieldLabels]}<Input value={draft.content[field] ?? ''} onChange={event => form.setValue(`content.${field}`, event.target.value || (field === 'compositionKind' ? 'unknown' : null), { shouldDirty: true })} /></label>)}{(['tasteDescriptors', 'brewRecommendations', 'grindOptions', 'features'] as const).map(field => <label className="space-y-1 text-xs text-text-muted dark:text-stone-400" key={field}>{fieldLabels[(field[0].toUpperCase() + field.slice(1)) as keyof typeof fieldLabels]}<Textarea rows={3} placeholder="По одному значению на строку" value={draft.content[field].join('\n')} onChange={event => form.setValue(`content.${field}`, event.target.value.split('\n'), { shouldDirty: true })} /></label>)}</div></details>
          <details className="py-1"><summary className="min-h-9 cursor-pointer py-2 text-sm font-medium"><ShieldCheck className="mr-1 inline h-4 w-4 text-text-muted" aria-hidden="true" />Защита от импорта <span className="text-xs font-normal text-text-muted dark:text-stone-400">· защищено: {draft.protectedFields.length + draft.classificationProtected.length}</span></summary><p className="mb-3 text-xs text-text-muted dark:text-stone-400">Отмеченные поля сохраняют ручные правки при обновлении из источника.</p><div className="grid gap-4 pb-3 sm:grid-cols-2"><fieldset><legend className="mb-1 text-xs font-semibold">Основные данные и источник</legend><div className="grid gap-x-3 lg:grid-cols-2">{baseProtectedFields.map(field => <div key={field}>{protect(field)}</div>)}</div></fieldset><fieldset><legend className="mb-1 text-xs font-semibold">Характеристики каталога</legend><div className="grid gap-x-3 lg:grid-cols-2">{coffeeGroups.map(group => {
            const field = classificationFields[group];
            return <label key={field} className="flex min-h-8 items-center gap-2"><Input type="checkbox" aria-label={`Защита характеристики: ${groupNames[group]}`} checked={draft.classificationProtected.includes(field)} onChange={event => form.setValue('classificationProtected', event.target.checked ? [...draft.classificationProtected, field] : draft.classificationProtected.filter(value => value !== field), { shouldDirty: true })} />{groupNames[group]}</label>;
          })}</div></fieldset></div></details>
          <details className="py-1"><summary className="min-h-9 cursor-pointer py-2 text-sm font-medium">Служебные данные</summary><dl className="space-y-1 pb-3 text-xs text-text-muted dark:text-stone-400"><div><dt className="inline font-medium">Ревизия: </dt><dd className="inline">{version.current}. Номер обновления защищает от перезаписи чужих изменений.</dd></div><div className="break-all"><dt className="inline font-medium">Адрес в каталоге: </dt><dd className="inline">{server.slug ? `/coffees/${server.slug}` : 'Ещё не назначен'}</dd></div></dl></details>
        </div>
      </fieldset>
      <div className="sticky bottom-0 z-10 space-y-2 border-t border-border-light bg-white/95 py-3 backdrop-blur dark:border-border-dark dark:bg-stone-950/95">
        {form.formState.errors.root && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{form.formState.errors.root.message}</p>}
        {Object.keys(form.formState.errors).some(key => key !== 'root') && <p role="alert" className="text-xs text-red-600 dark:text-red-300">Проверьте поля формы: название, страны и характеристики.</p>}
        <div className="flex flex-wrap items-center gap-2"><Button type="submit" size="sm" disabled={conflict} loading={busy}>Сохранить изменения</Button>{server.status !== 'Published' && <Button type="button" size="sm" variant="success" disabled={busy || conflict} onClick={() => void submit('Published')}>Опубликовать</Button>}<span className="text-xs text-text-muted dark:text-stone-400" aria-live="polite">{conflict ? 'Нужно разрешить конфликт' : form.formState.isDirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены'}</span><div className="flex gap-2 sm:ml-auto">{server.status === 'Archived' && <Button type="button" size="sm" variant="secondary" disabled={busy || conflict} onClick={() => void submit('Draft')}>Вернуть в черновик</Button>}{server.status !== 'Archived' && <Button variant="ghost" type="button" size="sm" disabled={busy || conflict} onClick={() => setArchive(true)}>Архивировать</Button>}</div></div>
      </div>
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
  return <details className="border-t border-border-light py-1 dark:border-border-dark"><summary className="min-h-9 cursor-pointer py-2 text-sm font-medium">Настройки публичного адреса</summary><div className="space-y-3 pb-3"><div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-1 text-xs text-text-muted dark:text-stone-400">Адрес кофе в каталоге<Input value={slug} disabled={disabled || mutation.isPending} onChange={event => setSlug(event.target.value)} /></label><label className="block space-y-1 text-xs text-text-muted dark:text-stone-400">Причина изменения<Input value={reason} disabled={disabled || mutation.isPending} onChange={event => setReason(event.target.value)} /></label></div>
    {coffee.slug && !address.data && <p className="text-xs text-text-muted dark:text-stone-400">Смена адреса доступна после публикации и загрузки актуальных данных.</p>}
    {address.isError && <p role="alert" className="text-xs text-red-600 dark:text-red-300">Не удалось загрузить публичный адрес. <button type="button" className="underline" onClick={() => void address.refetch()}>Повторить</button></p>}
    {disabled && <p className="text-xs text-text-muted dark:text-stone-400">Сначала сохраните или разрешите изменения карточки.</p>}<Button size="sm" disabled={disabled || mutation.isPending || !slug || !reason || !!coffee.slug && !address.data} onClick={() => mutation.mutate()}>Сохранить адрес</Button>{mutation.isError && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{mutation.error.message}</p>}
  </div></details>;
}
export function CoffeeEditPage() {
  const { id = '' } = useParams();
  const query = useQuery({ queryKey: ['admin', 'coffee', 'detail', id], queryFn: async ({ signal }) => { const [coffee, classification] = await Promise.all([getAdminCoffee(id, signal), getClassification(id, signal)]); return { coffee, classification }; }, retry: false, staleTime: 0 });
  if (query.isPending) return <div className="h-64 animate-pulse rounded-xl bg-stone-200 dark:bg-stone-800" aria-label="Загрузка карточки" />;
  if (query.isError) return <p role="alert">{query.error.message} <Button onClick={() => void query.refetch()}>Повторить</Button></p>;
  return <CoffeeEditor key={id} initial={query.data.coffee} initialClassification={query.data.classification} />;
}
