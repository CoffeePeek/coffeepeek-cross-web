import { useId, useState } from 'react';
import type { AdminDailyCount } from '../../api/admin';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const formatDate = (date: string) => dateFormatter.format(new Date(`${date}T00:00:00Z`));
const WIDTH = 400;
const HEIGHT = 96;
const INSET = 5;
const BASELINE = HEIGHT - INSET;

export function TrendChart({ label, points }: { label: string; points: AdminDailyCount[] }) {
  const gradientId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const max = Math.max(1, ...points.map(point => point.count));
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? WIDTH / 2 : INSET + index / (points.length - 1) * (WIDTH - INSET * 2),
    y: BASELINE - point.count / max * (HEIGHT - INSET * 2),
  }));
  const line = coordinates.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  const selectedIndex = Math.min(activeIndex ?? points.length - 1, points.length - 1);
  const selected = points[selectedIndex];
  const marker = coordinates[selectedIndex];

  if (!points.length) {
    return <p className="flex h-28 items-center text-xs text-text-muted dark:text-stone-400">Нет данных за период</p>;
  }

  return (
    <div>
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label}: по дням`}
        aria-valuemin={0}
        aria-valuemax={points.length - 1}
        aria-valuenow={selectedIndex}
        aria-valuetext={`${formatDate(selected.date)}: ${selected.count}`}
        className="relative h-24 cursor-crosshair rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onPointerMove={event => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = (event.clientX - bounds.left) / bounds.width * WIDTH;
          setActiveIndex(Math.max(0, Math.min(points.length - 1, Math.round((x - INSET) / (WIDTH - INSET * 2) * (points.length - 1)))));
        }}
        onPointerLeave={() => setActiveIndex(null)}
        onFocus={() => setActiveIndex(points.length - 1)}
        onBlur={() => setActiveIndex(null)}
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          setActiveIndex(event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1
            : Math.max(0, Math.min(points.length - 1, selectedIndex + (event.key === 'ArrowLeft' ? -1 : 1))));
        }}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-full w-full text-primary-dark dark:text-primary" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[INSET, HEIGHT / 2, BASELINE].map(y => (
            <line key={y} x1={INSET} x2={WIDTH - INSET} y1={y} y2={y} className="stroke-border-light dark:stroke-border-dark" strokeDasharray={y === BASELINE ? undefined : '3 5'} vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`${line} L${coordinates[coordinates.length - 1].x},${BASELINE} L${coordinates[0].x},${BASELINE} Z`} fill={`url(#${gradientId})`} />
          <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {activeIndex !== null && <line x1={marker.x} x2={marker.x} y1={INSET} y2={BASELINE} stroke="currentColor" strokeOpacity="0.4" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        </svg>
        {(activeIndex !== null || points.length === 1) && (
          <span aria-hidden="true" className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary-dark dark:border-surface-dark dark:bg-primary" style={{ left: `${marker.x / WIDTH * 100}%`, top: `${marker.y / HEIGHT * 100}%` }} />
        )}
        {activeIndex !== null && (
          <span aria-hidden="true" className="pointer-events-none absolute -top-7 z-10 whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-[11px] text-white shadow-sm dark:bg-stone-100 dark:text-stone-900" style={{ left: `${marker.x / WIDTH * 100}%`, transform: `translateX(${selectedIndex < points.length / 3 ? '0' : selectedIndex > points.length * 2 / 3 ? '-100%' : '-50%'})` }}>
            {formatDate(selected.date)} <strong className="ml-1 tabular-nums">{selected.count}</strong>
          </span>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-text-muted dark:text-stone-400">
        <span>{formatDate(points[0].date)}</span>
        {points.length > 1 && <span>{formatDate(points[points.length - 1].date)}</span>}
      </div>
    </div>
  );
}
