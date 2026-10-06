import React from 'react';
import { X } from './Icon';

/** Removable gold pill used in filters and create-shop multi-selects. */
export const RemovableChip: React.FC<{
  label: React.ReactNode;
  gold?: string;
  onRemove: () => void;
}> = ({ label, gold = '#EAB308', onRemove }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '5px 8px 5px 12px',
      borderRadius: 99,
      whiteSpace: 'nowrap',
      background: `${gold}15`,
      color: gold,
      border: `1px solid ${gold}40`,
      fontFamily: '"Manrope"',
      fontWeight: 600,
      fontSize: 12,
    }}
  >
    {label}
    <button
      type="button"
      onClick={onRemove}
      aria-label="Удалить"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        padding: 2,
      }}
    >
      <X color={gold} size={13} aria-hidden />
    </button>
  </span>
);

export default RemovableChip;
