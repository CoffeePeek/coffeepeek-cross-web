import WobbleRing from '../WobbleRing';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { DetailedCoffeeShop } from '../../api/coffeeshop';
import { formatDayOfWeekShort, getCurrentDayOfWeek, toLocalSchedules } from '../../utils/shopUtils';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/theme';
import { AppIcon } from '../icons';
import { CaretDown } from '@/components/Icon';
import { coffeeDetailIcon, createOsmMap, ensureMapPinMascots } from '../../map/osmMap';

interface ShopSidebarProps {
  shop: Pick<DetailedCoffeeShop, 'name' | 'location' | 'type' | 'schedules'>;
  textMain: string;
  textMuted: string;
  cardBg: string;
  borderColor: string;
  layout?: 'stacked' | 'horizontal';
}

export const ShopSidebar: React.FC<ShopSidebarProps> = ({
  shop,
  textMain,
  textMuted,
  cardBg,
  borderColor,
  layout = 'stacked',
}) => {
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const currentDay = getCurrentDayOfWeek();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);

  const latitude = shop.location?.latitude;
  const longitude = shop.location?.longitude;
  const hasCoordinates = latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!hasCoordinates || !mapRef.current) return;
    const container = mapRef.current;
    let cancelled = false;

    const map = createOsmMap(container, {
      center: [longitude, latitude],
      zoom: 15,
      dark: isDark,
      interactive: false,
      zoomControl: false,
    });
    mapInstanceRef.current = map;

    void ensureMapPinMascots().catch(() => {}).then(() => {
      if (cancelled || mapInstanceRef.current !== map) return;
      const element = coffeeDetailIcon(shop.type);
      element.title = shop.name;
      element.style.pointerEvents = 'none';
      new maplibregl.Marker({ element, anchor: 'center' })
        .setLngLat([longitude, latitude])
        .addTo(map);
      setIsMapLoaded(true);
    });

    return () => {
      cancelled = true;
      map.remove();
      mapInstanceRef.current = null;
      setIsMapLoaded(false);
    };
  }, [latitude, longitude, shop.name, shop.type, isDark]);

  return (
    <div className={`${cardBg} rounded-3xl border ${borderColor} overflow-hidden shadow-sm min-w-0 ${layout === 'horizontal' && hasCoordinates ? 'sm:grid sm:grid-cols-2 sm:items-stretch' : ''}`}>
      {hasCoordinates && (
        <div className={`h-52 w-full max-w-full relative z-0 isolate overflow-hidden ${layout === 'horizontal' ? 'sm:order-2 sm:h-full sm:min-h-44' : 'sm:h-64'}`}>
          <div className="absolute inset-0 w-full h-full">
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          </div>
          {!isMapLoaded && (
            <div className={`absolute inset-0 flex items-center justify-center ${isDark ? 'bg-[#2D241F]' : 'bg-[#F5F5F4]'}`}>
              <WobbleRing size={32} />
            </div>
          )}
        </div>
      )}

      <div className="p-5">
        <div className={`flex items-center gap-3 min-w-0 ${shop.schedules && shop.schedules.length > 0 ? 'mb-6' : ''}`}>
          <div className={`w-12 h-12 rounded-2xl ${themeClasses.primary.bgLight} flex items-center justify-center shrink-0`}>
            <AppIcon name="pin_drop" size={20} className={themeClasses.primary.text} />
          </div>
          <h3 className={`font-bold ${textMain} break-words min-w-0 flex-1`}>
            {shop.location?.address || 'Адрес не указан'}
          </h3>
        </div>

        {shop.schedules && shop.schedules.length > 0 && (
          <div className={`flex items-start gap-3 pt-6 border-t ${borderColor}`}>
            <div className={`w-12 h-12 rounded-2xl ${themeClasses.primary.bgLight} flex items-center justify-center shrink-0`}>
              <AppIcon name="schedule" size={20} className={themeClasses.primary.text} />
            </div>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className={`flex w-full items-center justify-between gap-2 min-h-12 ${textMain} font-bold text-left lg:pointer-events-none`}
                style={{ padding: 0, margin: 0, border: 'none', background: 'transparent', borderRadius: 0 }}
                onClick={() => setHoursOpen((open) => !open)}
                aria-expanded={hoursOpen}
              >
                <span>Часы работы</span>
                <CaretDown
                  size={16}
                  className={`lg:hidden shrink-0 transition-transform ${hoursOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div className={`${hoursOpen ? 'grid' : 'hidden'} lg:grid grid-cols-[2.5rem_1fr] gap-x-3 gap-y-2 text-sm`}>
                {toLocalSchedules(shop.schedules)
                  .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                  .map((schedule) => {
                  const dayLabel = formatDayOfWeekShort(schedule.dayOfWeek);
                  const isToday = schedule.dayOfWeek === currentDay;
                  const rowClass = isToday ? `font-bold ${themeClasses.primary.text}` : textMuted;
                  return (
                    <Fragment key={String(schedule.dayOfWeek)}>
                      <span className={rowClass}>{dayLabel || '—'}</span>
                      <span className={`${rowClass} tabular-nums`}>
                        {schedule.openTime && schedule.closeTime
                          ? `${schedule.openTime} - ${schedule.closeTime}`
                          : 'Закрыто'}
                      </span>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
