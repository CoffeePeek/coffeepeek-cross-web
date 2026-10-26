import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export const checkInPath = (id: string) => `/check-ins/${encodeURIComponent(id)}`;

// `data-card-control` marks zones that look like controls but are not interactive, e.g. a like counter shown to guests.
const CONTROLS = 'a, button, input, select, textarea, label, summary, [role="button"], [role="menuitem"], [role="dialog"], [data-card-control]';

interface CardClick {
  defaultPrevented: boolean;
  target: EventTarget | null;
  currentTarget: { contains(node: Node | null): boolean };
}

/** A card click opens the post unless it lands on one of the card's own controls or ends a text selection. */
export function isPostOpeningClick(event: CardClick, selection = ''): boolean {
  const target = event.target as Element | null;
  // React bubbles clicks from portals (photo lightbox, card menu) through the card although they are outside it in the DOM.
  return !event.defaultPrevented && !!target && event.currentTarget.contains(target) && !target.closest(CONTROLS) && !selection;
}

/** Click handler that opens the check-in page from a feed card; Cmd/Ctrl-click opens it in a new tab. */
export function useOpenCheckIn(id: string, enabled: boolean, onOpen?: () => void) {
  const navigate = useNavigate();
  if (!enabled) return undefined;
  return (event: MouseEvent<HTMLElement>) => {
    if (!isPostOpeningClick(event, window.getSelection()?.toString())) return;
    onOpen?.();
    if (event.metaKey || event.ctrlKey) window.open(checkInPath(id), '_blank', 'noopener');
    else navigate(checkInPath(id));
  };
}
