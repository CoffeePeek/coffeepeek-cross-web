import React from 'react';
import { COLORS } from '../constants/colors';
import { AppIcon } from './icons';

interface ShopSearchBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  showFilters: boolean;
  onFilterToggle: () => void;
  activeFilterCount: number;
  colors: { surface: string; border: string; textPrimary: string; textSecondary: string; background: string };
  dark: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  desktopFilters?: boolean;
}

const ShopSearchBar: React.FC<ShopSearchBarProps> = ({
  searchQuery, onSearchChange, showFilters, onFilterToggle, activeFilterCount,
  colors, dark,
  placeholder = 'Поиск кофейни…', ariaLabel = 'Поиск кофейни', className = 'mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8',
  desktopFilters = false,
}) => {
  const gold = COLORS.primary;
  const goldWarm = '#D4A84B';
  const borderColor = dark ? '#3D2F28' : colors.border;
  const inputBg = dark ? 'rgba(255,255,255,0.04)' : '#fff';
  const inputBorder = dark ? '#3D2F28' : 'rgba(158,123,54,.4)';

  const filterBtn = (height: number): React.CSSProperties => ({
    height,
    width: height,
    padding: 0,
    borderRadius: 999,
    background: showFilters ? gold : inputBg,
    color: showFilters ? '#1A1412' : (dark ? '#fff' : '#1C1917'),
    border: `1px solid ${showFilters ? gold : borderColor}`,
    cursor: 'pointer',
    fontFamily: '"Manrope"',
    fontWeight: 600,
    fontSize: 12,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    minWidth: height,
    justifyContent: 'center',
    boxSizing: 'border-box',
    transition: 'all .15s',
    position: 'relative',
  });

  return (
    <div className={className}>

      {/* ── Desktop ───────────────────────────────────────────── */}
      <div className="hidden pb-1 pt-4 lg:block">
        <div className="flex items-center gap-2">
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
            <AppIcon name="search" size={18} color={goldWarm} />
          </span>
          <input
            type="search"
            aria-label={ariaLabel}
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            maxLength={100}
            placeholder={placeholder}
            className="focus-visible:ring-2 focus-visible:ring-primary"
            style={{ width: '100%', height: desktopFilters ? 52 : 44, borderRadius: 999, border: `1px solid ${inputBorder}`, background: inputBg, padding: '0 18px 0 48px', fontSize: 15, fontFamily: '"Manrope"', color: dark ? '#fff' : '#1C1917', outline: 'none', boxSizing: 'border-box' as const }}
          />
        </div>
        {desktopFilters && <button type="button" aria-label="Фильтры" aria-expanded={showFilters} onClick={onFilterToggle} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={filterBtn(52)}>
          <AppIcon name="tune" size={24} />
          {activeFilterCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs text-stone-900">{activeFilterCount}</span>}
        </button>}
        </div>
      </div>

      {/* ── Mobile search — Search left, Фильтры right ─────── */}
      <div className="lg:hidden pb-4 pt-7">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {/* Search — fills remaining */}
          <div style={{ flex: '1 1 0', minWidth: 0, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <AppIcon name="search" size={18} color={goldWarm} />
            </span>
            <input
              type="search"
              aria-label={ariaLabel}
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              maxLength={100}
              placeholder={placeholder}
              className="focus-visible:ring-2 focus-visible:ring-primary"
              style={{ width: '100%', height: 56, borderRadius: 999, border: `1px solid ${inputBorder}`, background: colors.surface, padding: '0 18px 0 48px', fontSize: 16, fontFamily: '"Manrope"', color: dark ? '#fff' : '#1C1917', outline: 'none', boxSizing: 'border-box' as const, minWidth: 0 }}
            />
          </div>

          {/* Фильтры — right */}
          <button type="button" aria-label="Фильтры" aria-expanded={showFilters} onClick={onFilterToggle} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ ...filterBtn(56), background: showFilters ? gold : colors.surface }}>
            <AppIcon name="tune" size={24} color={showFilters ? '#1A1412' : (dark ? '#A39E93' : '#78716C')} />
            {activeFilterCount > 0 && (
              <span style={{ position: 'absolute', right: -2, top: -2, minWidth: 18, height: 18, borderRadius: 99, background: showFilters ? '#1A1412' : gold, color: showFilters ? gold : '#1A1412', fontFamily: '"Manrope"', fontWeight: 700, fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShopSearchBar;
