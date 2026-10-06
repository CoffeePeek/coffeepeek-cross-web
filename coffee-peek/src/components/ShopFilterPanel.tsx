import React, { useState } from 'react';
import { getPhotoUrl, type Equipment, type CoffeeBean, type Roaster, type BrewMethod, type CoffeeShopFilters, type ShopTagDto } from '../api/coffeeshop';
import { COLORS } from '../constants/colors';
import type { IconProps } from '@phosphor-icons/react';
import {
  Clock, Sparkle, CheckCircle, Heart,
  CaretDown, Check, PersonSimpleWalk, X,
} from '@/components/Icon';
import { AppIcon } from './icons';
import { RemovableChip } from './RemovableChip';
import { PriceRangeSlider } from './PriceRangeSlider';
import { PRICE_FILTER_OPTIONS, toPriceFilterLevel } from '../utils/priceRange';

const LIST_PREVIEW = 6;

function remainingLabel(count: number): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return `Ещё ${count} вариантов`;
  if (n1 === 1) return `Ещё ${count} вариант`;
  if (n1 >= 2 && n1 <= 4) return `Ещё ${count} варианта`;
  return `Ещё ${count} вариантов`;
}

const FIXED_QUICK_FILTERS: { id: string; label: string; Icon?: React.ComponentType<IconProps> }[] = [
  { id: 'all',      label: 'Все' },
  { id: 'nearby',   label: 'Рядом',      Icon: PersonSimpleWalk },
  { id: 'open',     label: 'Открыто',    Icon: Clock        },
  { id: 'new',      label: 'Новые',      Icon: Sparkle      },
  { id: 'visited',  label: 'Уже был',    Icon: CheckCircle },
  { id: 'favorite', label: 'Избранное',  Icon: Heart        },
];

const PRICE_OPTIONS = PRICE_FILTER_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  labelShort: o.labelShort,
  tiers: o.tiers,
}));

const FOCUS_OPTIONS = [
  { value: 'specialty', label: 'Specialty' },
  { value: 'coffee_bar', label: 'Кофейня' },
  { value: 'cafe', label: 'Кафе' },
];

export interface AppliedFilters {
  priceRange?: string;
  coffeeFocus?: string;
  equipments: string[];
  beans: string[];
  roasters: string[];
  brewMethods: string[];
}

interface ShopFilterPanelProps {
  mode: 'chips' | 'quick' | 'sidebar';
  activeQuick: string[];
  onQuickChange: (id: string) => void;
  shopTags: ShopTagDto[];
  selectedTagIds: string[];
  onTagToggle: (tagId: string) => void;
  filters: CoffeeShopFilters;
  selectedEquipments: string[];
  selectedBeans: string[];
  selectedRoasters: string[];
  selectedBrewMethods: string[];
  equipments: Equipment[];
  coffeeBeans: CoffeeBean[];
  roasters: Roaster[];
  brewMethods: BrewMethod[];
  colors: { surface: string; border: string; textPrimary: string; background: string };
  dark: boolean;
  onApplyFilters: (applied: AppliedFilters) => void;
  resultCount?: number;
  onClose?: () => void;
  canLocate?: boolean;
}

function toggle(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
}

export const FilterAccordion: React.FC<{
  title: string;
  count?: number;
  defaultOpen?: boolean;
  muted: string;
  textPrimary: string;
  borderColor: string;
  children: React.ReactNode;
}> = ({ title, count = 0, defaultOpen = false, muted, textPrimary, borderColor, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderBottom: `1px solid ${borderColor}` }}>
      <button
        type="button"
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          minHeight: 48, padding: '0 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: '"Manrope"', fontSize: 13, fontWeight: 700, color: textPrimary, letterSpacing: '-0.01em' }}>
          {title}
          {count > 0 && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: `${COLORS.primary}1F`, color: COLORS.primary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{count}</span>}
        </span>
        <CaretDown
          size={14}
          color={muted}
          style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
        />
      </button>
      {open && <div style={{ padding: '0 10px 12px' }}>{children}</div>}
    </div>
  );
};

const CheckMark: React.FC<{ checked: boolean; gold: string }> = ({ checked, gold }) => (
  <span style={{
    width: 22, height: 22, flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }}>
    {checked ? <Check size={17} color={gold} weight="bold" /> : null}
  </span>
);

export const OptionRow: React.FC<{
  label: React.ReactNode;
  checked: boolean;
  onClick: () => void;
  gold: string;
  textPrimary: string;
  icon?: React.ReactNode;
}> = ({ label, checked, onClick, gold, textPrimary, icon }) => (
  <button
    type="button"
    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
    onClick={onClick}
    aria-pressed={checked}
    style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      minHeight: 44, padding: '7px 8px', background: checked ? `${gold}12` : 'transparent', border: 'none', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
    }}
  >
    {icon}
    <span style={{
      fontFamily: '"Manrope"', fontSize: 13, fontWeight: checked ? 700 : 500,
      color: textPrimary, minWidth: 0, flex: 1,
    }}>
      {label}
    </span>
    <CheckMark checked={checked} gold={gold} />
  </button>
);

const ExpandableOptions: React.FC<{
  items: { id: string; name: string; photoUrl?: string | null; iconName?: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  gold: string;
  textPrimary: string;
}> = ({ items, selected, onToggle, gold, textPrimary }) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, LIST_PREVIEW);

  return (
    <div>
      {visible.map((item) => (
        <OptionRow
          key={item.id}
          label={item.name}
          checked={selected.includes(item.id)}
          onClick={() => onToggle(item.id)}
          gold={gold}
          textPrimary={textPrimary}
          icon={item.photoUrl !== undefined ? <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 text-xs font-bold text-stone-700">
            {item.photoUrl ? <img src={item.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : item.name.slice(0, 2).toUpperCase()}
          </span> : item.iconName ? <AppIcon name={item.iconName} size={24} color={textPrimary} /> : undefined}
        />
      ))}
      {items.length > LIST_PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            minHeight: 44, marginTop: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px',
            fontFamily: '"Manrope"', fontSize: 12, fontWeight: 600, color: COLORS.primary,
          }}
        >
          {expanded ? 'Свернуть' : remainingLabel(items.length - LIST_PREVIEW)}
        </button>
      )}
    </div>
  );
};

const AppliedChip = RemovableChip;

const ShopFilterPanel: React.FC<ShopFilterPanelProps> = ({
  mode,
  activeQuick, onQuickChange,
  shopTags, selectedTagIds, onTagToggle,
  filters, selectedEquipments, selectedBeans, selectedRoasters, selectedBrewMethods,
  equipments, coffeeBeans, roasters, brewMethods,
  colors, dark,
  onApplyFilters,
  resultCount,
  onClose,
  canLocate = false,
}) => {
  const gold = COLORS.primary;
  const goldWarm = '#D4A84B';
  const borderColor = dark ? '#3D2F28' : colors.border;
  const muted = dark ? '#A39E93' : '#78716C';
  const textPrimary = dark ? '#fff' : '#1C1917';

  const applied: AppliedFilters = {
    priceRange: filters.priceRange,
    coffeeFocus: filters.coffeeFocus,
    equipments: selectedEquipments,
    beans: selectedBeans,
    roasters: selectedRoasters,
    brewMethods: selectedBrewMethods,
  };

  const patch = (next: Partial<AppliedFilters>) => onApplyFilters({ ...applied, ...next });

  const hasApplied = selectedEquipments.length > 0 || selectedBeans.length > 0 ||
    selectedRoasters.length > 0 || selectedBrewMethods.length > 0 || !!filters.priceRange;

  const chipBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    minHeight: 44, padding: 3, borderRadius: 999, whiteSpace: 'nowrap',
    fontFamily: '"Manrope"', fontWeight: 600, fontSize: 14,
    cursor: 'pointer', transition: 'all .15s', border: 'none', background: 'transparent',
    flexShrink: 0,
  };

  const quickChipContentStyle = (active: boolean): React.CSSProperties => ({
    minHeight: 38, padding: '0 14px', borderRadius: 999,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: active ? `${gold}18` : (dark ? '#2B211C' : '#fff'),
    color: textPrimary,
    border: `1px solid ${active ? `${gold}80` : borderColor}`,
    boxShadow: active ? `0 2px 8px ${gold}18` : (dark ? '0 2px 8px rgba(0,0,0,.14)' : '0 2px 8px rgba(28,25,23,.06)'),
    transition: 'all .2s',
  });

  const current = {
    priceRange: filters.priceRange,
    coffeeFocus: filters.coffeeFocus,
    equipments: selectedEquipments,
    beans: selectedBeans,
    roasters: selectedRoasters,
    brewMethods: selectedBrewMethods,
  };

  const statusAndFocusChips = (
    <>
      {FIXED_QUICK_FILTERS.map(({ id, label, Icon }) => {
        if (id === 'nearby' && !canLocate) return null;
        const active = id === 'all'
          ? activeQuick.includes('all') && !filters.coffeeFocus
          : activeQuick.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => {
              onQuickChange(id);
              if (id === 'all' && filters.coffeeFocus) patch({ coffeeFocus: undefined });
            }}
            aria-pressed={active}
            style={chipBase}
          >
            <span style={quickChipContentStyle(active)}>
              {Icon && <Icon size={14} weight={active ? id === 'favorite' ? 'fill' : 'bold' : 'regular'} color={goldWarm} style={{ display: 'block', flexShrink: 0, overflow: 'visible', background: 'transparent' }} />}
              {label}
            </span>
          </button>
        );
      })}

      {FOCUS_OPTIONS.map(({ value, label }) => {
        const active = filters.coffeeFocus === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => patch({ coffeeFocus: active ? undefined : value })}
            aria-pressed={active}
            style={chipBase}
          >
            <span style={quickChipContentStyle(active)}>{label}</span>
          </button>
        );
      })}
    </>
  );

  if (mode === 'quick') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'center', paddingBottom: 16 }}>
        {statusAndFocusChips}
      </div>
    );
  }

  if (mode === 'chips') {
    const appliedTags = shopTags.filter((tag) => selectedTagIds.includes(tag.id));
    const showApplied = hasApplied || appliedTags.length > 0;
    return (
      <div style={{ paddingBottom: 10 }}>
        <div className="overflow-x-auto no-scrollbar" style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {statusAndFocusChips}
          </div>
        </div>

        {showApplied && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center', paddingTop: 8 }}>
            {appliedTags.map((tag) => (
              <AppliedChip key={tag.id} label={tag.name} gold={gold} onRemove={() => onTagToggle(tag.id)} />
            ))}
            {current.priceRange && (
              <AppliedChip
                label={
                  PRICE_OPTIONS.find((p) => p.value === toPriceFilterLevel(current.priceRange))?.label ??
                  current.priceRange
                }
                gold={gold}
                onRemove={() => patch({ priceRange: undefined })}
              />
            )}
            {current.equipments.map(id => {
              const eq = equipments.find(e => e.id === id);
              return eq ? <AppliedChip key={id} label={eq.name} gold={gold} onRemove={() => patch({ equipments: current.equipments.filter(x => x !== id) })} /> : null;
            })}
            {current.beans.map(id => {
              const b = coffeeBeans.find(item => item.id === id);
              return b ? <AppliedChip key={id} label={b.name} gold={gold} onRemove={() => patch({ beans: current.beans.filter(x => x !== id) })} /> : null;
            })}
            {current.roasters.map(id => {
              const r = roasters.find(item => item.id === id);
              return r ? <AppliedChip key={id} label={r.name} gold={gold} onRemove={() => patch({ roasters: current.roasters.filter(x => x !== id) })} /> : null;
            })}
            {current.brewMethods.map(id => {
              const m = brewMethods.find(item => item.id === id);
              return m ? <AppliedChip key={id} label={m.name} gold={gold} onRemove={() => patch({ brewMethods: current.brewMethods.filter(x => x !== id) })} /> : null;
            })}
            <button
              type="button"
              onClick={() => {
                appliedTags.forEach((tag) => onTagToggle(tag.id));
                onApplyFilters({ priceRange: undefined, coffeeFocus: undefined, equipments: [], beans: [], roasters: [], brewMethods: [] });
              }}
              style={{ minHeight: 44, padding: '0 10px', background: 'transparent', color: muted, border: 'none', borderRadius: 999, fontFamily: '"Manrope"', fontSize: 11, cursor: 'pointer' }}
            >
              Сбросить всё
            </button>
          </div>
        )}
      </div>
    );
  }

  const accordionProps = { muted, textPrimary, borderColor };

  return (
    <div>
      {onClose && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, marginBottom: 8 }}>
          <span style={{ fontFamily: '"Manrope"', fontWeight: 750, fontSize: 20, color: textPrimary }}>Фильтры</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть фильтры"
            style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: dark ? 'rgba(255,255,255,.08)' : 'rgba(120,113,108,.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textPrimary, padding: 0, flexShrink: 0 }}
          >
            <X color={textPrimary} size={16} aria-hidden />
          </button>
        </div>
      )}

      <div style={{ overflow: 'hidden', borderRadius: 18, border: `1px solid ${borderColor}`, background: dark ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.78)', boxShadow: dark ? '0 8px 24px rgba(0,0,0,.12)' : '0 8px 24px rgba(28,25,23,.05)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
      {shopTags.length > 0 && (
        <FilterAccordion title="Особенности" count={selectedTagIds.length} defaultOpen={selectedTagIds.length > 0} {...accordionProps}>
          {shopTags.map((tag) => (
            <OptionRow
              key={tag.id}
              label={tag.name}
              checked={selectedTagIds.includes(tag.id)}
              onClick={() => onTagToggle(tag.id)}
              gold={gold}
              textPrimary={textPrimary}
              icon={<AppIcon name={`tag:${tag.slug ?? ''}`} size={22} color={textPrimary} />}
            />
          ))}
        </FilterAccordion>
      )}

      <FilterAccordion title="Цена" count={filters.priceRange ? 1 : 0} defaultOpen {...accordionProps}>
        <PriceRangeSlider
          value={filters.priceRange}
          onChange={(priceRange) => patch({ priceRange })}
          gold={gold}
          muted={muted}
          track={dark ? '#3D2F28' : '#E7E5E4'}
        />
      </FilterAccordion>

      {equipments.length > 0 && (
        <FilterAccordion title="Оборудование" count={selectedEquipments.length} defaultOpen={selectedEquipments.length > 0} {...accordionProps}>
          <ExpandableOptions
            items={equipments}
            selected={selectedEquipments}
            onToggle={(id) => patch({ equipments: toggle(selectedEquipments, id) })}
            gold={gold}
            textPrimary={textPrimary}
          />
        </FilterAccordion>
      )}

      {coffeeBeans.length > 0 && (
        <FilterAccordion title="Зёрна" count={selectedBeans.length} defaultOpen={selectedBeans.length > 0} {...accordionProps}>
          <ExpandableOptions
            items={coffeeBeans}
            selected={selectedBeans}
            onToggle={(id) => patch({ beans: toggle(selectedBeans, id) })}
            gold={gold}
            textPrimary={textPrimary}
          />
        </FilterAccordion>
      )}

      {roasters.length > 0 && (
        <FilterAccordion title="Обжарщики" count={selectedRoasters.length} defaultOpen={selectedRoasters.length > 0} {...accordionProps}>
          <ExpandableOptions
            items={roasters.map(roaster => ({ ...roaster, photoUrl: roaster.photoUrl ?? (roaster.coverPhoto ? getPhotoUrl(roaster.coverPhoto, 'thumbnail') : null) }))}
            selected={selectedRoasters}
            onToggle={(id) => patch({ roasters: toggle(selectedRoasters, id) })}
            gold={gold}
            textPrimary={textPrimary}
          />
        </FilterAccordion>
      )}

      {brewMethods.length > 0 && (
        <FilterAccordion title="Заваривание" count={selectedBrewMethods.length} defaultOpen={selectedBrewMethods.length > 0} {...accordionProps}>
          <ExpandableOptions
            items={brewMethods.map(method => ({ ...method, iconName: `brew:${method.name}` }))}
            selected={selectedBrewMethods}
            onToggle={(id) => patch({ brewMethods: toggle(selectedBrewMethods, id) })}
            gold={gold}
            textPrimary={textPrimary}
          />
        </FilterAccordion>
      )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0 4px' }}>
        {hasApplied && (
          <button
            type="button"
            onClick={() => onApplyFilters({ priceRange: undefined, coffeeFocus: undefined, equipments: [], beans: [], roasters: [], brewMethods: [] })}
            style={{
              width: '100%', height: 44, borderRadius: 12, border: `1px solid ${borderColor}`,
              background: 'transparent', color: muted, cursor: 'pointer',
              fontFamily: '"Manrope"', fontWeight: 600, fontSize: 13,
            }}
          >
            Сбросить фильтры
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%', height: 48, borderRadius: 14, border: 'none',
              background: gold, color: '#1A1412', cursor: 'pointer',
              fontFamily: '"Manrope"', fontWeight: 700, fontSize: 14,
            }}
          >
            {typeof resultCount === 'number' ? `Найдено ${resultCount}` : 'Готово'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ShopFilterPanel;
