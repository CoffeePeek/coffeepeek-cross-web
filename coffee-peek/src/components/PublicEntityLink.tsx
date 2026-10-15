import React from 'react';
import type { AddressKind, PublicAddress } from '../api/publicAddresses';
import { usePublicNavigate } from '../hooks/usePublicNavigate';
export default function PublicEntityLink({ kind, entityId, address, children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind: AddressKind; entityId: string; address?: PublicAddress }) {
  const open = usePublicNavigate();
  return <button type="button" {...props} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented) void open(kind, address ?? entityId, '', { state: { analytics: { source: 'related' } } });
  }}>{children}</button>;
}
