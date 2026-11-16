import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { CaretDown, Check, Crosshair, MapPin } from './Icon';
import { useBrowseCity } from '../hooks/useBrowseCity';
import type { BrowseCity } from '../lib/localCity';
import { findCityAtLocation } from '../utils/cityGeography';
import { getDeviceLocation } from '../utils/geolocation';

let offeredCityId: string | undefined;

export default function HeaderCityPicker({ textColor, borderColor, surfaceBg, mutedColor, hoverBg }: {
  textColor: string; borderColor: string; surfaceBg: string; mutedColor: string; hoverBg: string;
}) {
  const { city, cities, catalog, hasSavedCity, override, query, chooseCity } = useBrowseCity();
  const { key } = useLocation();
  const panelId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const [suggestion, setSuggestion] = useState<BrowseCity>();

  useEffect(() => {
    panel.current?.hidePopover();
    setLocating(false);
    setMessage('');
    setSuggestion(undefined);
    return () => { request.current += 1; };
  }, [key]);

  useEffect(() => {
    if (hasSavedCity || override || !catalog.length || offeredCityId) return;
    const currentRequest = request.current;
    let active = true;
    void getDeviceLocation().then(position => {
      if (!active || currentRequest !== request.current || !position) return;
      const detected = findCityAtLocation(catalog, position);
      if (!detected || detected.id === city.id || offeredCityId) return;
      offeredCityId = detected.id;
      setSuggestion(detected);
      if (!document.querySelector(':popover-open')) panel.current?.showPopover();
    });
    return () => { active = false; };
  }, [catalog, city.id, hasSavedCity, override, key]);

  const select = (nextCity: BrowseCity) => {
    request.current += 1;
    setLocating(false);
    setMessage('');
    setSuggestion(undefined);
    chooseCity(nextCity);
    panel.current?.hidePopover();
  };

  const locate = async () => {
    const currentRequest = ++request.current;
    setLocating(true);
    setMessage('');
    setSuggestion(undefined);
    const position = await getDeviceLocation({ requestPermission: true, enableHighAccuracy: true, maximumAge: 0 });
    if (request.current !== currentRequest) return;
    setLocating(false);
    const detected = position && findCityAtLocation(catalog, position);
    if (detected) select(detected);
    else setMessage(position ? 'Не удалось найти город в каталоге. Выберите его из списка.' : 'Геолокация недоступна. Выберите город из списка.');
  };

  const choices = cities.some(item => item.id === city.id) ? cities : [city, ...cities];
  const row = 'flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold hover:bg-[var(--city-hover)] focus-visible:outline-2 focus-visible:outline-primary';
  return <>
    <button type="button" popoverTarget={panelId} aria-controls={panelId} aria-expanded={open}
      aria-label={`Выбрать город, сейчас ${city.name}`}
      className="inline-flex h-11 min-w-0 shrink-0 items-center gap-1 rounded-full border px-2 font-semibold focus-visible:outline-2 focus-visible:outline-primary sm:gap-2 sm:px-3"
      style={{ color: textColor, borderColor }}>
      <MapPin size={17} aria-hidden className="hidden shrink-0 min-[380px]:block" />
      <span className="max-w-[68px] truncate text-sm sm:max-w-[110px]">{city.name}</span>
      <CaretDown size={13} aria-hidden className="shrink-0" />
    </button>
    <div ref={panel} id={panelId} popover="auto" role="group" aria-label="Город"
      onToggle={event => setOpen(event.newState === 'open')}
      className="m-0 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border p-2 shadow-xl"
      style={{
        inset: 'calc(65px + env(safe-area-inset-top)) max(1rem, calc((100vw - 76rem) / 2)) auto auto',
        maxHeight: 'calc(100dvh - 82px - env(safe-area-inset-top))',
        color: textColor, borderColor, background: surfaceBg, '--city-hover': hoverBg,
      } as CSSProperties}>
      {suggestion && <button type="button" className={row} onClick={() => select(suggestion)}>
        <MapPin size={18} className="shrink-0 text-primary" /> Вы в городе {suggestion.name}? Показать кофейни
      </button>}
      <button type="button" disabled={locating || !catalog.length} onClick={() => void locate()} className={`${row} disabled:opacity-55`}>
        <Crosshair size={18} className="shrink-0 text-primary" /> {locating ? 'Определяем город…' : 'Определить мой город'}
      </button>
      {query.isPending && <p role="status" className="px-3 py-2 text-sm" style={{ color: mutedColor }}>Загружаем города…</p>}
      {query.isError && <button type="button" className={row} onClick={() => void query.refetch()}>Повторить загрузку городов</button>}
      <p role="status" className={message ? 'px-3 py-2 text-sm' : 'sr-only'} style={{ color: mutedColor }}>{message}</p>
      <div className="mt-1 border-t pt-1" style={{ borderColor }}>
        {choices.map(item => <button key={item.id} type="button" className={row} aria-pressed={city.id === item.id} onClick={() => select(item)}>
          <span className="min-w-0 flex-1 break-words">{item.name}</span>
          {city.id === item.id && <Check size={18} aria-hidden className="shrink-0 text-primary" />}
        </button>)}
      </div>
    </div>
  </>;
}
