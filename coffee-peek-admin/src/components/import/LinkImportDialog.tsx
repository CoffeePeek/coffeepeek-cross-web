import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ImportCandidate, patchImportCandidate, saveNewLinkImport } from '../../api/import';
import { useToast } from '../../contexts/ToastContext';
import { LINK_IMPORT_LABELS, CONTACT_FIELDS, LinkImportDraft, LinkImportField, selectedContactPatch, newCandidateFromLink, normalizeLinkImportUrl } from '../../utils/linkImport';
import { checkLinkImportExtension, readLinkImport } from '../../utils/linkImportBridge';
import { formatImportOpeningHours } from '../../utils/importOpeningHours';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/Dialog';

const REQUIRED_FIELDS: LinkImportField[] = ['name', 'address', 'latitude', 'longitude'];
const CAN_EDIT = new Set<LinkImportField>(CONTACT_FIELDS);
const linkSchema = z.object({ url: z.string().trim().superRefine((value, context) => {
  try { normalizeLinkImportUrl(value); }
  catch (error) { context.addIssue({ code: z.ZodIssueCode.custom, message: (error as Error).message }); }
}) });

export function LinkImportDialog({ candidate, onClose, onUpdated }: {
  candidate?: ImportCandidate;
  onClose: () => void;
  onUpdated: (candidate: ImportCandidate) => void;
}) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<{ url: string }>({ resolver: zodResolver(linkSchema), defaultValues: { url: '' } });
  const url = watch('url');
  const [mode, setMode] = useState<'existing' | 'new'>(candidate ? 'existing' : 'new');
  const [extension, setExtension] = useState<'checking' | 'ready' | 'missing'>('checking');
  const [draft, setDraft] = useState<LinkImportDraft>();
  const [coordinates, setCoordinates] = useState({ latitude: '', longitude: '' });
  const [selected, setSelected] = useState<Set<LinkImportField>>(new Set());
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const qc = useQueryClient();
  const { showToast } = useToast();
  useEffect(() => {
    const controller = new AbortController();
    checkLinkImportExtension(controller.signal).then(() => setExtension('ready'), () => { if (!controller.signal.aborted) setExtension('missing'); });
    return () => { controller.abort(); abortRef.current?.abort(); };
  }, []);

  const selectDefaults = (next: LinkImportDraft, nextMode: typeof mode) => {
    const keys = Object.keys(next.fields) as LinkImportField[];
    setSelected(new Set(nextMode === 'new' ? [...keys.filter((key) => key !== 'description'), ...REQUIRED_FIELDS] :
      keys.filter((key) => CAN_EDIT.has(key) && !candidate?.[key as typeof CONTACT_FIELDS[number]])));
  };
  const read = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setReading(true); setError(''); setDraft(undefined);
    try {
      const next = await readLinkImport(url, controller.signal);
      if (controller.signal.aborted) return;
      setExtension('ready'); setDraft(next); selectDefaults(next, mode);
      setCoordinates({ latitude: next.fields.latitude === undefined ? '' : String(next.fields.latitude), longitude: next.fields.longitude === undefined ? '' : String(next.fields.longitude) });
    } catch (err) {
      if (!controller.signal.aborted) setError((err as Error).message);
    } finally { if (!controller.signal.aborted) setReading(false); }
  };
  const save = async () => {
    if (!draft || saving) return;
    setSaving(true); setError('');
    try {
      if (mode === 'existing' && candidate) {
        const patch = selectedContactPatch(draft.fields, selected);
        if (!Object.keys(patch).length) throw new Error('Выберите поля для сохранения');
        const response = await patchImportCandidate(candidate.id, patch);
        if (response.patchMissing) throw new Error('Сохранение контактов недоступно');
        if (response.isSuccess === false || response.data?.id !== candidate.id) throw new Error('API не подтвердил сохранение');
        const notSaved = Object.entries(patch).filter(([key, value]) => {
          const actual = response.data[key as typeof CONTACT_FIELDS[number]];
          const normalize = (text: string) => key === 'phone' ? text.replace(/\D/g, '') : text.trim().replace(/\/$/, '');
          return !actual || normalize(actual) !== normalize(value);
        });
        if (notSaved.length) throw new Error(`Не сохранено: ${notSaved.map(([key]) => LINK_IMPORT_LABELS[key as LinkImportField]).join(', ')}`);
        onUpdated(response.data);
        showToast('Данные сохранены', 'success');
      } else {
        const result = await saveNewLinkImport(draft, selected);
        showToast(result.inserted ? 'Кофейня добавлена в очередь' : result.enriched ? 'Данные существующей кофейни дополнены' : 'Кофейня уже есть в импорте', 'success');
      }
      await qc.invalidateQueries({ queryKey: ['admin', 'import'] });
      onClose();
    } catch (err) { setError((err as Error).message || 'Не удалось сохранить'); }
    finally { setSaving(false); }
  };
  let canSave = Boolean(draft && selected.size);
  if (draft && mode === 'new') {
    try { newCandidateFromLink(draft, selected); } catch { canSave = false; }
  }
  const keys = draft ? [...new Set([...(Object.keys(draft.fields) as LinkImportField[]), ...(mode === 'new' ? REQUIRED_FIELDS : [])])] : [];
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Импорт по ссылке</DialogTitle>
        <DialogDescription className="sr-only">Чтение карточки и выбор полей для сохранения</DialogDescription>
        <form onSubmit={handleSubmit(() => read())} className="flex flex-col gap-2 sm:flex-row">
          <Input aria-label="Ссылка для импорта" placeholder="Яндекс или Instagram" {...register('url', { onChange: () => setDraft(undefined) })} disabled={reading || saving} autoFocus />
          <Button type="submit" loading={reading} disabled={!url.trim() || saving}>Получить данные</Button>
        </form>
        {extension !== 'ready' && (
          <details className="rounded-lg border border-border-light dark:border-border-dark p-3 text-sm" open={extension === 'missing' ? true : undefined}>
            <summary className="cursor-pointer">{extension === 'checking' ? 'Проверка расширения…' : 'Подключить расширение'}</summary>
            <ol className="mt-2 list-decimal pl-5 space-y-1 text-text-muted">
              <li><a className="underline" href="/link-import-extension.zip" download>Скачать</a> и распаковать архив.</li>
              <li>В chrome://extensions включить режим разработчика и загрузить распакованную папку.</li>
              <li>На этой странице нажать значок расширения → «Подключить эту админку».</li>
            </ol>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => { void checkLinkImportExtension().then(() => setExtension('ready'), () => setExtension('missing')); }}>Проверить подключение</Button>
          </details>
        )}
        {reading && <div className="flex items-center justify-between gap-2 text-sm" role="status"><span>Чтение страницы…</span><Button variant="ghost" size="sm" onClick={() => { abortRef.current?.abort(); setReading(false); }}>Отменить</Button></div>}
        {draft && <>
          {candidate && <fieldset className="flex flex-wrap gap-4 text-sm" disabled={saving}>
            <legend className="sr-only">Куда сохранить</legend>
            {(['existing', 'new'] as const).map((value) => <label key={value} className="flex items-center gap-2"><input type="radio" name="link-import-mode" checked={mode === value} onChange={() => { setMode(value); selectDefaults(draft, value); }} />{value === 'existing' ? 'Текущая карточка' : 'Новая кофейня'}</label>)}
          </fieldset>}
          <a href={draft.url} target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted underline truncate">{draft.url}</a>
          <div className="space-y-3">
            {keys.map((key) => {
              const editable = key !== 'description' && (mode === 'new' || CAN_EDIT.has(key));
              const current = mode === 'existing' && candidate && CAN_EDIT.has(key) ? candidate[key as typeof CONTACT_FIELDS[number]] : undefined;
              const value = draft.fields[key] ?? '';
              return <div key={key} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <input type="checkbox" className="mt-2" aria-label={`Сохранить: ${LINK_IMPORT_LABELS[key]}`} disabled={!editable || saving} checked={editable && selected.has(key)} onChange={(event) => setSelected((previous) => { const next = new Set(previous); if (event.target.checked) next.add(key); else next.delete(key); return next; })} />
                <div className="min-w-0">
                  <label htmlFor={`link-field-${key}`} className="text-xs text-text-muted">{LINK_IMPORT_LABELS[key]}{!editable && <span> · только просмотр</span>}</label>
                  {editable && key === 'openingHours' ? <Textarea id={`link-field-${key}`} rows={2} value={String(value)} disabled={saving} title={draft.evidence[key]} onChange={(event) => setDraft({ ...draft, fields: { ...draft.fields, openingHours: event.target.value } })} /> : editable ? <Input id={`link-field-${key}`} value={key === 'latitude' || key === 'longitude' ? coordinates[key] : value} inputMode={key === 'latitude' || key === 'longitude' ? 'decimal' : undefined} disabled={saving} title={draft.evidence[key]} onChange={(event) => {
                    const raw = event.target.value;
                    if (key === 'latitude' || key === 'longitude') setCoordinates((previous) => ({ ...previous, [key]: raw }));
                    setDraft({ ...draft, fields: { ...draft.fields, [key]: key === 'latitude' || key === 'longitude' ? raw.trim() ? Number(raw.replace(',', '.')) : undefined : raw } });
                  }} /> : <div id={`link-field-${key}`} className="text-sm whitespace-pre-line break-words" title={draft.evidence[key]}>{key === 'openingHours' ? formatImportOpeningHours(String(value)) : value}</div>}
                  {current && current !== value && <p className="text-xs text-text-muted mt-1 break-words">Сейчас: {key === 'openingHours' ? formatImportOpeningHours(current) : current}</p>}
                </div>
              </div>;
            })}
          </div>
          {mode === 'new' && !canSave && <p className="text-xs text-text-muted">Заполните название, адрес и координаты.</p>}
          <Button onClick={() => void save()} loading={saving} disabled={!canSave || reading}>{mode === 'new' ? 'Добавить в очередь' : 'Сохранить выбранное'}</Button>
        </>}
        {(error || errors.url) && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error || errors.url?.message}</p>}
      </DialogContent>
    </Dialog>
  );
}
