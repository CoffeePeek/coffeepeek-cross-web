import { useId, useState, type ReactNode } from 'react';
import { Check } from '../Icon';

interface CatalogOption {
  id: string;
  name: string;
  image?: string | null;
  detail?: string;
}

interface CatalogSelectionProps {
  title: string;
  items: CatalogOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  icon: ReactNode;
  loading?: boolean;
  failed?: boolean;
  onRetry: () => void;
}

export function CatalogSelection({ title, items, selectedIds, onChange, icon, loading, failed, onRetry }: CatalogSelectionProps) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const shown = expanded ? items : items.slice(0, 5);

  return (
    <section className="shop-wizard-catalog" aria-labelledby={`${id}-title`}>
      <h2 className="shop-wizard-section-label" id={`${id}-title`}>{title}</h2>
      <div className="shop-wizard-panel" id={`${id}-list`}>
        {loading ? <p className="shop-wizard-panel-message" role="status">Загрузка…</p> : failed ? (
          <div className="shop-wizard-panel-message">
            <p>Не удалось загрузить список</p>
            <button type="button" className="shop-wizard-text-button" onClick={onRetry}>Повторить</button>
          </div>
        ) : items.length === 0 ? <p className="shop-wizard-panel-message">Список пока пуст</p> : shown.map((item) => {
          const selected = selectedIds.includes(item.id);
          return (
            <button type="button" role="checkbox" aria-checked={selected} key={item.id} className="shop-wizard-option" onClick={() => onChange(selected ? selectedIds.filter((id) => id !== item.id) : [...selectedIds, item.id])}>
              <span className="shop-wizard-option-icon" aria-hidden="true">{item.image ? <img src={item.image} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : icon}</span>
              <span className="shop-wizard-option-name">{item.name}{item.detail && <small>{item.detail}</small>}</span>
              {selected && <Check size={23} className="shop-wizard-check" />}
            </button>
          );
        })}
        {!failed && !loading && items.length > 5 && (
          <button type="button" className="shop-wizard-expand" aria-expanded={expanded} aria-controls={`${id}-list`} onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Свернуть' : `Показать все (${items.length})`}
          </button>
        )}
      </div>
    </section>
  );
}
