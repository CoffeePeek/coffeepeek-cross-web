import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBrewMethods } from '../api/coffeeshop';
import { createHomeCheckIn, getHomeCheckIn, searchHomeCoffee, updateHomeCheckIn } from '../api/homeCheckIns';
import { useCheckInPhotoUpload } from '../hooks/usePhotoUpload';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../constants/colors';
import { useUser } from '../contexts/UserContext';
import { getErrorMessage } from '../utils/errorHandler';
import { newHomeDraft, validateHomeDraft, type HomeDraft } from '../utils/homeCheckInForm';
import { useToast } from '../contexts/ToastContext';
import { captureAnalyticsEvent } from '../lib/analytics';
import { CheckInAnalytics, readCheckInFlow, type CheckInFlow } from '../lib/checkInAnalytics';
import DrinkSelector from './DrinkSelector';
import CheckInPhotoThumb from './CheckInPhotoThumb';
import CheckInPhotos from './CheckInPhotos';
import Mascot from './Mascot';

export default function HomeCheckInSheet({ id, onClose, onSaved, analyticsFlow }: { id?: string; onClose: () => void; onSaved?: () => void; analyticsFlow?: CheckInFlow }) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { user } = useUser();
  const { showToast } = useToast();
  const client = useQueryClient();
  const [draft, setDraft] = useState<HomeDraft>(newHomeDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);
  const [beanQuery, setBeanQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [choosingBean, setChoosingBean] = useState(false);
  const [analytics] = useState(() => new CheckInAnalytics(readCheckInFlow(analyticsFlow, id ? 'my_check_ins' : 'direct'), 'home', id ? 'edit' : 'create'));
  const photos = useCheckInPhotoUpload();
  const detail = useQuery({ queryKey: ['homeCheckIn', user?.id, id], queryFn: () => getHomeCheckIn(id!), enabled: !!id && !!user });
  const methods = useQuery({ queryKey: ['brewMethods'], queryFn: () => getBrewMethods().then(r => r.data) });
  const beans = useQuery({ queryKey: ['homeCoffeeSearch', user?.id, debouncedQuery], queryFn: () => searchHomeCoffee(debouncedQuery), enabled: choosingBean && !!user });
  const field = (name: keyof HomeDraft, value: HomeDraft[keyof HomeDraft]) => { analytics.field(name); setDraft(previous => ({ ...previous, [name]: value })); };
  const cancel = () => { analytics.cancel('editor'); onClose(); };

  useEffect(() => {
    const track = () => {
      analytics.start();
      if (!detail.isLoading && !detail.error) analytics.view('editor');
      if (choosingBean) analytics.view('bean_picker');
    };
    track();
    window.addEventListener('coffeepeek:analytics-ready', track);
    return () => window.removeEventListener('coffeepeek:analytics-ready', track);
  }, [analytics, detail.isLoading, detail.error, choosingBean]);
  useEffect(() => { if (detail.error) analytics.failure(detail.error, 'load'); }, [analytics, detail.error]);
  useEffect(() => { if (beans.error && choosingBean) analytics.failure(beans.error, 'bean_search'); }, [analytics, beans.error, choosingBean]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(beanQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [beanQuery]);
  useEffect(() => {
    const item = detail.data;
    if (!item) return;
    const time = new Date(item.preparedAtUtc || item.preparedAt || item.createdAtUtc || `${item.preparedOn}T12:00:00`);
    setDraft({
      date: item.preparedOn, time: `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`,
      brewMethodCode: item.brewMethodCode || item.home?.brewMethodCode || '', coffeeProductSlug: '',
      coffeeProductId: item.coffeeProductId || '', customBeanName: item.coffeeProductId ? '' : item.beanName || item.home?.beanName || '',
      doseGrams: item.doseGrams == null ? '' : String(item.doseGrams),
      minutes: item.brewDurationSeconds ? String(Math.floor(item.brewDurationSeconds / 60)) : '',
      seconds: item.brewDurationSeconds ? String(item.brewDurationSeconds % 60) : '',
      tasteScore: item.tasteScore || item.home?.tasteScore || 5, text: item.text || '', drinkSlug: item.drinkSlug || '',
      customDrinkName: item.customDrinkName || '', visibility: item.visibility || '',
    });
  }, [detail.data]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const submit = async () => {
    if (busy) return;
    analytics.submit();
    const result = validateHomeDraft(draft, !!id);
    setErrors(result.errors);
    if (!result.request) { analytics.validation(Object.keys(result.errors)); return; }
    if (photos.selectedFiles.length > 5 || new Set(photos.selectedFiles.map(f => `${f.name}:${f.size}:${f.lastModified}`)).size !== photos.selectedFiles.length) {
      setErrors(previous => ({ ...previous, photos: 'Выберите не более пяти разных фотографий' }));
      analytics.validation(['photos']);
      return;
    }
    setBusy(true);
    setSubmitError('');
    let stage: 'photo_upload' | 'save' = id ? 'save' : 'photo_upload';
    try {
      if (id) {
        const { photos: _photos, drinkPhoto: _drinkPhoto, ...request } = result.request;
        await updateHomeCheckIn(id, request);
        analytics.saved(result.request.visibility || detail.data?.visibility || 'Private', !!detail.data?.photos?.length);
      } else {
        const uploadedPhotos = await photos.uploadPhotos();
        stage = 'save';
        const created = await createHomeCheckIn({ ...result.request, coffeeProductId: null, photos: uploadedPhotos });
        captureAnalyticsEvent('check_in_created', {
          kind: 'home', visibility: created.visibility || result.request.visibility || 'Private', has_photos: uploadedPhotos.length > 0,
          flow_id: analytics.flow.flow_id, source: analytics.flow.source, duration_ms: analytics.duration(),
        });
        analytics.saved(created.visibility || result.request.visibility || 'Private', uploadedPhotos.length > 0);
      }
      await Promise.all([client.invalidateQueries({ queryKey: ['homeCheckIns'] }), client.invalidateQueries({ queryKey: ['checkIns'] })]);
      showToast(id ? 'Чекин обновлён' : 'Чекин сохранён', 'success');
      onSaved?.();
      onClose();
    } catch (error) {
      analytics.failure(error, stage);
      const status = (error as { status?: number }).status;
      if (status === 400 || status === 422) {
        const fields = (error as { errors?: Record<string, string[]> }).errors || {};
        const mapped: Record<string, string> = {};
        for (const [name, messages] of Object.entries(fields)) {
          const key = name.replace(/^\$\.?/, '').split('.').at(-1)?.toLowerCase() || '';
          const target = ({ preparedat: 'date', preparedon: 'date', brewmethodcode: 'brewMethodCode', coffeeproductslug: 'bean', coffeeproductid: 'bean', custombeanname: 'bean', dosegrams: 'doseGrams', brewdurationseconds: 'duration', tastescore: 'tasteScore', text: 'text', customdrinkname: 'customDrinkName', visibility: 'visibility', photos: 'photos' } as Record<string, string>)[key];
          if (target) mapped[target] = messages.join(', ');
        }
        setErrors(previous => ({ ...previous, ...mapped }));
        analytics.validation(Object.keys(mapped), 'server');
      }
      setSubmitError(status === 400 || status === 422 ? `Проверьте поля формы. ${getErrorMessage(error)}` :
        status === 409 ? 'Запись изменилась на сервере. Обновите её перед повтором.' :
        status === 429 ? 'Слишком много запросов. Попробуйте позже.' :
        status === 403 || status === 404 ? 'Запись недоступна.' :
        status === 401 ? 'Войдите снова, чтобы сохранить чекин.' :
        error instanceof TypeError ? 'Соединение прервалось. Проверьте «Мои чекины» перед повтором.' : getErrorMessage(error));
    } finally { setBusy(false); }
  };

  const inputClass = 'mt-1 min-h-11 w-full rounded-full border px-4 py-2 outline-none focus:border-[#EAB308]';
  const inputStyle = { background: theme === 'dark' ? '#3D2F28' : '#F5F5F5', color: colors.textPrimary, borderColor: colors.border, colorScheme: theme };
  const labelClass = 'block text-sm font-medium';
  const error = (key: string) => errors[key] && <p role="alert" className="mt-1 text-xs text-red-500">{errors[key]}</p>;
  const photoChange: React.ChangeEventHandler<HTMLInputElement> = event => {
    analytics.field('photos');
    const incoming = Array.from(event.target.files || []);
    photos.setSelectedFiles(previous => [...previous, ...incoming].filter((file, index, all) =>
      all.findIndex(other => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified) === index).slice(0, 5));
    event.target.value = '';
  };

  return <div role="presentation" className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/55 sm:items-center" onMouseDown={event => { if (event.target === event.currentTarget && !busy) cancel(); }}>
    <section role="dialog" aria-modal="true" aria-label={id ? 'Редактировать кофе дома' : 'Кофе дома'} className="flex max-h-[90dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[28px] border shadow-xl sm:rounded-[28px]" style={{ background: colors.surface, color: colors.textPrimary, borderColor: colors.border }}>
      <div aria-hidden="true" className="mx-auto mt-3 h-1 w-10 rounded-full bg-stone-400/70 sm:hidden" />
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: colors.border }}><h2 className="text-xl font-bold">Кофе дома</h2><button type="button" aria-label="Закрыть" disabled={busy} onClick={cancel} className="h-11 w-11 rounded-full text-2xl disabled:opacity-40">×</button></div>
      {detail.isLoading ? <p className="p-6">Загрузка…</p> : detail.error ? <div className="p-6 text-red-500">{getErrorMessage(detail.error)} <button onClick={() => { analytics.retry('load'); void detail.refetch(); }} className="underline">Повторить</button></div> : <>
      <div className="space-y-4 overflow-y-auto px-5 py-4">
        {(submitError || Object.keys(errors).length > 0) && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{submitError || 'Проверьте отмеченные поля'}</p>}
        <div className="flex items-center justify-between gap-3"><div><p className="font-bold">Сделать публичным</p><p className="mt-1 text-xs leading-5" style={{ color: colors.textSecondary }}>Публичный чекин появится в ленте после модерации.<br />Скрытый виден только вам.</p></div><button type="button" role="switch" aria-checked={draft.visibility === 'Public'} disabled={busy} onClick={() => field('visibility', draft.visibility === 'Public' ? 'Private' : 'Public')} className="relative h-8 w-14 shrink-0 rounded-full bg-[#EAB308] disabled:opacity-40"><span className="absolute top-1 h-6 w-6 rounded-full bg-[#1A1412] transition-all" style={{ left: draft.visibility === 'Public' ? 28 : 4 }} /></button></div>{error('visibility')}
        <fieldset disabled={busy} className="flex items-center gap-3 rounded-2xl border p-4" style={{ background: theme === 'dark' ? '#3D2F28' : '#F5F5F5', borderColor: colors.border }}><legend className="sr-only">Как получился кофе?</legend><Mascot pose="cup" size={52} /><div><p className="font-bold">Как получился кофе?</p><div className="mt-2 flex gap-1">{[1, 2, 3, 4, 5].map(score => <button key={score} type="button" aria-label={`${score} из 5`} aria-pressed={draft.tasteScore === score} onClick={() => field('tasteScore', score)} className="h-11 w-11 text-3xl" style={{ color: score <= draft.tasteScore ? '#EAB308' : colors.border }}>★</button>)}</div></div>{error('tasteScore')}</fieldset>
        <div className="space-y-4 border-l-2 border-dashed border-[#EAB308] pl-4">
        <div className="grid grid-cols-2 gap-3"><label className={labelClass}>Дата приготовления<input className={inputClass} style={inputStyle} type="date" max={newHomeDraft().date} value={draft.date} disabled={busy} onChange={e => field('date', e.target.value)} /></label><label className={labelClass}>Время<input className={inputClass} style={inputStyle} type="time" value={draft.time} disabled={busy} onChange={e => field('time', e.target.value)} /></label></div>{error('date')}
        <label className={labelClass}>Способ заваривания <span className="font-normal">(необязательно)</span><select className={inputClass} style={inputStyle} value={draft.brewMethodCode} disabled={busy} onChange={e => field('brewMethodCode', e.target.value)}><option value="">Не выбран</option>{draft.brewMethodCode && !methods.data?.some(method => method.slug === draft.brewMethodCode) && <option value={draft.brewMethodCode}>{draft.brewMethodCode}</option>}{methods.data?.filter(method => !!method.slug).map(method => <option key={method.slug} value={method.slug}>{method.name}</option>)}</select></label>{methods.error && <p className="text-xs text-red-500">Каталог способов недоступен. Сохранённый способ можно оставить.</p>}{error('brewMethodCode')}
        <div><p className={labelClass}>Зерно (необязательно)</p>{draft.coffeeProductSlug || draft.coffeeProductId || draft.customBeanName ? <div className="mt-2 flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: colors.border }}><span>{draft.customBeanName || draft.coffeeProductSlug || detail.data?.beanName || draft.coffeeProductId}</span><button type="button" disabled={busy} onClick={() => { analytics.field('bean'); setDraft(previous => ({ ...previous, coffeeProductSlug: '', coffeeProductId: '', customBeanName: '' })); }} className="min-h-11 px-2">Убрать</button></div> : null}<button type="button" disabled={busy} onClick={() => { analytics.field('bean'); analytics.view('bean_picker'); setChoosingBean(value => !value); }} className="mt-2 min-h-11 rounded-full border px-4" style={{ borderColor: colors.border }}>Выбрать зерно</button>{choosingBean && <div className="mt-2 rounded-2xl border p-3" style={{ borderColor: colors.border }}><input aria-label="Поиск зерна" className={inputClass} style={inputStyle} placeholder="Поиск зерна" value={beanQuery} onChange={e => setBeanQuery(e.target.value)} />{beans.isLoading && <p className="p-2 text-sm">Поиск…</p>}{beans.error && <button type="button" onClick={() => { analytics.retry('bean_search'); void beans.refetch(); }} className="p-2 text-red-500">Ошибка поиска · Повторить</button>}{beans.data?.map(bean => <button type="button" key={bean.slug || bean.address?.slug || bean.id} onClick={() => { analytics.field('bean'); setDraft(previous => ({ ...previous, coffeeProductSlug: bean.slug || bean.address?.slug || '', coffeeProductId: '', customBeanName: '' })); setChoosingBean(false); }} className="block min-h-11 w-full rounded-xl px-2 text-left hover:bg-[#EAB308]/10">{bean.name || bean.title || bean.slug || bean.address?.slug}</button>)}<label className={labelClass}>Использовать своё зерно<input className={inputClass} style={inputStyle} maxLength={250} value={draft.customBeanName} onChange={e => { analytics.field('bean'); setDraft(previous => ({ ...previous, customBeanName: e.target.value, coffeeProductSlug: '', coffeeProductId: '' })); }} /></label><button type="button" className="min-h-11 px-2 font-bold" onClick={() => setChoosingBean(false)}>Готово</button></div>}{error('bean')}</div>
        <label className={labelClass}>Количество кофе, г (необязательно)<input className={inputClass} style={inputStyle} inputMode="decimal" value={draft.doseGrams} onChange={e => field('doseGrams', e.target.value)} disabled={busy} /></label>{error('doseGrams')}
        <div><p className={labelClass}>Время заваривания (необязательно)</p><div className="grid grid-cols-2 gap-3"><label>Минуты<input className={inputClass} style={inputStyle} inputMode="numeric" value={draft.minutes} onChange={e => field('minutes', e.target.value)} disabled={busy} /></label><label>Секунды<input className={inputClass} style={inputStyle} inputMode="numeric" value={draft.seconds} onChange={e => field('seconds', e.target.value)} disabled={busy} /></label></div>{error('duration')}</div>
        <label className={labelClass}>Заметка (необязательно)<textarea className={`${inputClass} min-h-24 rounded-2xl`} style={inputStyle} maxLength={1000} value={draft.text} onChange={e => field('text', e.target.value)} disabled={busy} placeholder="Какой вкус? Что хочется повторить?" /></label>{error('text')}
        <DrinkSelector drinkSlug={draft.drinkSlug} customDrinkName={draft.customDrinkName} savedName={detail.data?.drinkNameRu || detail.data?.drinkNameEn || undefined} disabled={busy} onChange={(slug, name) => { analytics.field('drinkSlug'); setDraft(previous => ({ ...previous, drinkSlug: slug, customDrinkName: name })); }} />{error('customDrinkName')}
        {id ? <><p className="text-sm" style={{ color: colors.textSecondary }}>Фотографии при редактировании не изменяются.</p><CheckInPhotos photos={detail.data?.photos || []} shopName="Кофе дома" /></> : <div><p className={labelClass}>Фотографии</p><p className="text-xs" style={{ color: colors.textSecondary }}>Чашка, зерно или процесс приготовления — до 5 фото.</p><p className="mt-2 text-sm">Добавлено: {photos.selectedFiles.length}/5</p>{photos.selectedFiles.length < 5 && <label className="mt-2 flex h-24 w-24 cursor-pointer items-center justify-center rounded-xl border text-3xl" style={{ borderColor: colors.border }}>+<input type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/avif" multiple className="sr-only" disabled={busy} onChange={photoChange} /></label>}<div className="mt-2 flex gap-2 overflow-x-auto">{photos.selectedFiles.map((file, index) => <CheckInPhotoThumb key={`${file.name}-${file.size}-${file.lastModified}`} file={file} onRemove={() => { analytics.field('photos'); photos.removeFile(index); }} />)}</div>{error('photos')}{photos.error && <p className="text-sm text-red-500">{photos.error}</p>}</div>}
        </div>
      </div>
      <div className="border-t px-5 py-3" style={{ borderColor: colors.border }}><button type="button" disabled={busy} onClick={() => void submit()} className="min-h-11 w-full rounded-full bg-[#EAB308] px-5 font-bold text-[#1A1412] disabled:opacity-50">{busy ? 'Сохраняем чекин…' : 'Сохранить чекин'}</button></div>
      </>}
    </section>
  </div>;
}
