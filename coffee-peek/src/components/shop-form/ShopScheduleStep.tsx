import { useId, useState } from 'react';
import type { FrontendSchedule } from '../../api/moderation';
import { adjustShopTime } from '../../utils/createShopWizard';
import { Check, Minus, Plus } from '../Icon';

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const PRESETS = [['08:00', '20:00'], ['09:00', '21:00'], ['10:00', '22:00']];

function TimeControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  return (
    <div className="shop-wizard-time-row">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" inputMode="numeric" autoComplete="off" maxLength={5} placeholder="ЧЧ:ММ" required value={value} aria-invalid={!validTime} onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, '').slice(0, 4);
        onChange(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
      }} />
      <div className="shop-wizard-time-buttons">
        <button type="button" disabled={!validTime} aria-label={`${label}: на 30 минут раньше`} onClick={() => onChange(adjustShopTime(value, -30))}><Minus size={17} /></button>
        <button type="button" disabled={!validTime} aria-label={`${label}: на 30 минут позже`} onClick={() => onChange(adjustShopTime(value, 30))}><Plus size={17} /></button>
      </div>
    </div>
  );
}

export function ShopScheduleStep({ schedules, onChange, error }: { schedules: FrontendSchedule[]; onChange: (value: FrontendSchedule[]) => void; error?: string }) {
  const [perDay, setPerDay] = useState(false);
  const [common, setCommon] = useState({ openTime: schedules[0]?.openTime ?? '09:00', closeTime: schedules[0]?.closeTime ?? '21:00' });
  const updateCommon = (field: 'openTime' | 'closeTime', value: string) => {
    setCommon((previous) => ({ ...previous, [field]: value }));
    onChange(schedules.map((schedule) => ({ ...schedule, [field]: value })));
  };
  const toggleMode = () => {
    if (perDay) {
      const times = schedules[0] ?? common;
      setCommon({ openTime: times.openTime, closeTime: times.closeTime });
      onChange(schedules.map((schedule) => ({ ...schedule, openTime: times.openTime, closeTime: times.closeTime })));
    }
    setPerDay(!perDay);
  };
  const toggleDay = (dayOfWeek: number) => {
    onChange(schedules.some((schedule) => schedule.dayOfWeek === dayOfWeek)
      ? schedules.filter((schedule) => schedule.dayOfWeek !== dayOfWeek)
      : [...schedules, { dayOfWeek, ...common }].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
  };

  return (
    <div className="shop-wizard-schedule">
      <section>
        <h2 className="shop-wizard-section-label">Режим</h2>
        <button type="button" role="switch" aria-checked={perDay} className="shop-wizard-mode shop-wizard-panel" onClick={toggleMode}>
          <span>Разное время по дням</span>
          <span className={`shop-wizard-switch ${perDay ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
        </button>
        <p className="shop-wizard-mode-hint shop-wizard-muted">Включите, если в будни и выходные разные часы.</p>
      </section>
      {!perDay && (
        <section>
          <h2 className="shop-wizard-section-label">Часы работы</h2>
          <div className="shop-wizard-panel">
            <TimeControl label="Открытие" value={common.openTime} onChange={(value) => updateCommon('openTime', value)} />
            <TimeControl label="Закрытие" value={common.closeTime} onChange={(value) => updateCommon('closeTime', value)} />
          </div>
        </section>
      )}
      <section>
        <h2 className="shop-wizard-section-label">Типовые часы</h2>
        <div className="shop-wizard-panel">
          {PRESETS.map(([openTime, closeTime]) => (
            <button type="button" className="shop-wizard-option" key={openTime} aria-pressed={schedules.length > 0 && schedules.every((schedule) => schedule.openTime === openTime && schedule.closeTime === closeTime)} onClick={() => {
              setCommon({ openTime, closeTime });
              onChange(schedules.map((schedule) => ({ ...schedule, openTime, closeTime })));
            }}>
              <span>{openTime} – {closeTime}</span>
              {schedules.length > 0 && schedules.every((schedule) => schedule.openTime === openTime && schedule.closeTime === closeTime) && <Check size={23} className="shop-wizard-check" />}
            </button>
          ))}
        </div>
      </section>
      <section>
        <div className="shop-wizard-days-heading"><h2 className="shop-wizard-section-label">Дни работы</h2><span>{schedules.length} из 7</span></div>
        <div className="shop-wizard-panel">
          {DAYS.map((day, dayOfWeek) => {
            const schedule = schedules.find((item) => item.dayOfWeek === dayOfWeek);
            return (
              <div className="shop-wizard-day" key={day}>
                <button type="button" className="shop-wizard-option" role="checkbox" aria-checked={!!schedule} onClick={() => toggleDay(dayOfWeek)}>
                  <span>{day}</span>{schedule ? <Check size={23} className="shop-wizard-check" /> : <span className="shop-wizard-muted shop-wizard-day-off">Выходной</span>}
                </button>
                {perDay && schedule && (
                  <div className="shop-wizard-day-times">
                    {(['openTime', 'closeTime'] as const).map((field) => (
                      <TimeControl key={field} label={`${field === 'openTime' ? 'Открытие' : 'Закрытие'}, ${day.toLowerCase()}`} value={schedule[field]} onChange={(value) => onChange(schedules.map((item) => item.dayOfWeek === dayOfWeek ? { ...item, [field]: value } : item))} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {error && <p className="shop-wizard-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
