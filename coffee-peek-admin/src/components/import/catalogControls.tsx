import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  CATALOG_TAG_OPTIONS,
  COFFEE_FOCUS_LABELS,
  COFFEE_FOCUS_OPTIONS,
  GOOGLE_STATUS_LABELS,
  IMPORT_SOURCE_LABELS,
  CoffeeFocus,
  GoogleBusinessStatus,
  parseImportSource,
} from '../../constants/catalogIngest';
import { Badge, BadgeVariant } from '../ui/Badge';

export const ImportTabs: React.FC = () => {
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  const isDuplicates = pathname.startsWith('/import/duplicates');
  const isStats = !isDuplicates && params.get('panel') === 'stats';
  const listActive = !isDuplicates && !isStats;

  const tabClass = (active: boolean) =>
    `px-3 py-2 rounded-lg text-sm font-body min-h-[40px] ${
      active
        ? 'bg-primary/20 text-primary'
        : 'text-text-muted dark:text-stone-400 hover:text-text-main dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
    }`;

  return (
    <div className="flex gap-1 overflow-x-auto">
      <NavLink to="/import?panel=list" className={tabClass(listActive)}>
        К импорту
      </NavLink>
      <NavLink to="/import/duplicates" className={tabClass(isDuplicates)}>
        Похожие
      </NavLink>
      <NavLink to="/import?panel=stats" className={tabClass(isStats)}>
        Статистика
      </NavLink>
    </div>
  );
};

export const CoffeeFocusPicker: React.FC<{
  value?: CoffeeFocus;
  onChange: (value: CoffeeFocus) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
    {COFFEE_FOCUS_OPTIONS.map((option) => {
      const active = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          aria-pressed={active}
          className={[
            'flex flex-col items-start gap-1 rounded-xl border px-3 py-3 text-left min-h-[72px] transition-colors',
            active
              ? 'border-primary bg-primary/10'
              : 'border-border-light dark:border-border-dark hover:border-primary/60',
          ].join(' ')}
        >
          <span className="text-sm font-semibold text-text-main dark:text-white font-display">
            {option.key}. {option.label}
          </span>
          <span className="text-xs text-text-muted dark:text-stone-400 font-body">{option.hint}</span>
        </button>
      );
    })}
  </div>
);

export type CatalogTagOption = { slug: string; label: string };

export const CatalogTagChips: React.FC<{
  value: string[];
  onChange: (next: string[]) => void;
  options?: CatalogTagOption[];
  disabled?: boolean;
}> = ({ value, onChange, options = CATALOG_TAG_OPTIONS, disabled }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((tag) => {
      const active = value.includes(tag.slug);
      return (
        <button
          key={tag.slug}
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange(active ? value.filter((slug) => slug !== tag.slug) : [...value, tag.slug])
          }
          className={
            active
              ? 'inline-flex items-center rounded-full px-2.5 py-[5px] text-[13px] font-medium font-body border border-text-main bg-text-main text-white dark:border-white dark:bg-white dark:text-black'
              : 'inline-flex items-center rounded-full px-2.5 py-[5px] text-[13px] font-medium font-body border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark text-text-main dark:text-white hover:border-text-muted dark:hover:border-stone-500 transition-colors'
          }
        >
          {tag.label}
        </button>
      );
    })}
  </div>
);

export function googleStatusBadgeVariant(status?: GoogleBusinessStatus): BadgeVariant {
  switch (status) {
    case 'Operational':
      return 'approved';
    case 'ClosedPermanently':
      return 'rejected';
    case 'ClosedTemporarily':
    case 'Far':
      return 'pending';
    case 'NotFound':
      return 'info';
    case 'Unknown':
    default:
      return 'default';
  }
}

export const GoogleStatusBadge: React.FC<{ status?: GoogleBusinessStatus }> = ({ status }) => (
  <Badge variant={googleStatusBadgeVariant(status)}>
    {status ? GOOGLE_STATUS_LABELS[status] : 'Google не проверен'}
  </Badge>
);

export const FocusBadge: React.FC<{ focus?: CoffeeFocus }> = ({ focus }) =>
  focus ? <Badge variant="info">{COFFEE_FOCUS_LABELS[focus]}</Badge> : <span className="text-stone-500">—</span>;

export const SourceBadge: React.FC<{
  source?: string;
  importedFromFile?: boolean;
}> = ({ source, importedFromFile }) => {
  const parsed = importedFromFile ? 'File' : parseImportSource(source);
  if (!parsed) return null;
  return <Badge variant={parsed === 'File' ? 'info' : 'default'}>{IMPORT_SOURCE_LABELS[parsed]}</Badge>;
};
