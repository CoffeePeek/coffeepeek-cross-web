import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCoffeeShopBySlug, searchCoffeeShops, type CoffeeShop } from '../api/coffeeshop';
import { getThemeColors } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { getErrorMessage } from '../utils/errorHandler';
import HomeCheckInSheet from './HomeCheckInSheet';
import { AppIcon } from './icons';

type Step = 'choose' | 'shops' | 'home';

export default function CheckInCreateFlow() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { requireAuth } = useRequireAuth();
  const [step, setStep] = useState<Step | null>(null);
  const [kind, setKind] = useState<'shop' | 'home'>('shop');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CoffeeShop | null>(null);
  const [nearby, setNearby] = useState(false);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoError, setGeoError] = useState('');
  const [debounced, setDebounced] = useState('');
  const visible = ['/search', '/coffees', '/feed', '/check-ins'].some(path => pathname === path);
  const shops = useQuery({ queryKey: ['checkInPicker', debounced], queryFn: () => searchCoffeeShops(debounced, undefined, 1, 20).then(r => r.data), enabled: step === 'shops' && !nearby });
  const close = () => { setStep(null); setSelected(null); };
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(query.trim()), 300); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => { if (step === null) return; const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = overflow; }; }, [step]);
  useEffect(() => { if (!visible) close(); }, [visible]);

  const beginNearby = () => {
    setGeoError('');
    if (!navigator.geolocation) return setGeoError('Геолокация недоступна');
    navigator.geolocation.getCurrentPosition(value => { setPosition({ latitude: value.coords.latitude, longitude: value.coords.longitude }); setNearby(true); },
      () => setGeoError('Не удалось определить местоположение'), { enableHighAccuracy: false, timeout: 10000 });
  };
  const nearbyShops = useQuery({ queryKey: ['checkInNearby', position], enabled: step === 'shops' && nearby && !!position,
    queryFn: async () => {
      const { searchShops } = await import('../api/discovery');
      return searchShops({ q: '', filters: { origin: position! }, sort: 'distance_asc', page: 1, pageSize: 20 });
    } });
  const list = nearby ? nearbyShops.data?.items.map(item => ({ id: item.address.slug, publicAddress: item.address, name: item.name, location: { address: item.addressLine }, photos: item.coverPhoto ? [{ fullUrl: item.coverPhoto.fullUrl, fileName: '', storageKey: '' }] : [] })) : shops.data?.coffeeShops || shops.data?.items || [];
  const choose = async (shop: CoffeeShop) => {
    const slug = shop.publicAddress?.slug;
    if (!slug) return setGeoError('У кофейни нет публичного адреса');
    try { const detail = (await getCoffeeShopBySlug(slug)).data; setSelected({ ...shop, name: detail.name, location: detail.location, publicAddress: detail.publicAddress || shop.publicAddress }); }
    catch { setSelected(shop); }
  };
  const proceed = () => {
    const slug = selected?.publicAddress?.slug;
    if (!slug) return;
    close();
    navigate(`/shops/${encodeURIComponent(slug)}/check-ins/new`, { state: { shop: { name: selected?.name || '', address: selected?.location?.address || '', photo: selected?.photos?.[0]?.fullUrl || '' } } });
  };
  if (!visible) return null;
  return <>
    <button type="button" aria-label="Новый чекин" onClick={() => { if (requireAuth()) { setKind('shop'); setStep('choose'); } }} className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] right-5 z-[1201] flex h-14 w-14 items-center justify-center rounded-full bg-[#EAB308] text-3xl font-light text-[#1A1412] shadow-lg lg:bottom-6 lg:right-8">+</button>
    {step === 'home' && <HomeCheckInSheet onClose={close} />}
    {(step === 'choose' || step === 'shops') && <div role="presentation" className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/55 sm:items-center" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section role="dialog" aria-modal="true" aria-label={step === 'choose' ? 'Новый чекин' : 'Выберите кофейню'} className="max-h-[86dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] border p-4 shadow-xl sm:rounded-[28px] sm:p-6" style={{ background: colors.surface, color: colors.textPrimary, borderColor: colors.border }}>
        <div aria-hidden="true" className="mx-auto mb-5 h-1 w-10 rounded-full bg-stone-400/70 sm:hidden" />
        <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-bold">{step === 'choose' ? 'Новый чекин' : 'Выберите кофейню'}</h2><button type="button" onClick={close} aria-label="Закрыть" className="h-11 w-11 rounded-full text-2xl">×</button></div>
        {step === 'choose' ? <><p className="mb-4 text-sm" style={{ color: colors.textSecondary }}>Где вы пили кофе?</p><div role="radiogroup" aria-label="Где вы пили кофе?" className="space-y-3">{([['shop', 'В кофейне'], ['home', 'Дома']] as const).map(([value, label]) => <label key={value} className="flex min-h-[72px] cursor-pointer items-center gap-3 rounded-2xl border px-3" style={{ borderColor: kind === value ? '#EAB308' : colors.border, background: kind === value ? '#EAB30814' : colors.background }}><input type="radio" name="check-in-kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="sr-only" /><span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EAB308]/15 text-[#B88600]"><AppIcon name={value === 'shop' ? 'location_on' : 'coffee'} size={25} /></span><span className="min-w-0 flex-1"><span className="block font-bold">{label}</span><span className="block text-xs" style={{ color: colors.textSecondary }}>{value === 'shop' ? 'Выбрать место и напиток' : 'Записать приготовление'}</span></span>{kind === value && <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#EAB308] text-sm text-[#EAB308]">✓</span>}</label>)}</div><button type="button" onClick={() => setStep(kind === 'home' ? 'home' : 'shops')} className="mt-5 min-h-11 w-full rounded-full bg-[#EAB308] font-bold text-[#1A1412]">Продолжить</button></> : <>
          <div className="mb-3 flex gap-2"><button type="button" onClick={() => { setNearby(false); setPosition(null); }} className="min-h-11 rounded-full border px-3" style={{ borderColor: colors.border }}>Все</button><button type="button" onClick={beginNearby} className="min-h-11 rounded-full border px-3" style={{ borderColor: colors.border }}>Рядом со мной</button><button type="button" onClick={() => { close(); navigate('/map'); }} className="min-h-11 rounded-full border px-3" style={{ borderColor: colors.border }}>На карте</button></div>
          {!nearby && <input aria-label="Поиск кофеен" value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск кофеен" className="mb-3 min-h-11 w-full rounded-xl border px-3" style={{ background: colors.background, borderColor: colors.border, color: colors.textPrimary }} />}
          {geoError && <p role="alert" className="mb-2 text-sm text-red-500">{geoError}</p>}
          {(shops.isLoading || nearbyShops.isLoading) && <p className="p-4">Загрузка…</p>}
          {(nearby ? nearbyShops.error : shops.error) && <button type="button" onClick={() => void (nearby ? nearbyShops.refetch() : shops.refetch())} className="min-h-11 text-red-500">Попробовать снова</button>}
          {!shops.isLoading && !nearbyShops.isLoading && !list?.length && <p className="p-4 text-center">Кофейни не найдены</p>}
          <div className="max-h-[42dvh] space-y-2 overflow-y-auto">{list?.map(shop => <button type="button" key={shop.publicAddress?.slug || shop.id} onClick={() => void choose(shop)} className="flex min-h-[72px] w-full flex-col justify-center rounded-2xl border px-4 text-left" style={{ borderColor: selected?.publicAddress?.slug === shop.publicAddress?.slug ? '#EAB308' : colors.border }}><span className="font-bold">{shop.name}</span><span className="text-sm" style={{ color: colors.textSecondary }}>{shop.location?.address}</span></button>)}</div>
          {selected && <div className="mt-3 rounded-2xl border p-4" style={{ borderColor: '#EAB308' }}><h3 className="font-bold">{selected.name}</h3><p className="text-sm" style={{ color: colors.textSecondary }}>{selected.location?.address}</p><button type="button" onClick={proceed} className="mt-3 min-h-11 w-full rounded-full bg-[#EAB308] font-bold text-[#1A1412]">Продолжить</button></div>}
          {shops.error && <p className="sr-only">{getErrorMessage(shops.error)}</p>}
        </>}
      </section>
    </div>}
  </>;
}
