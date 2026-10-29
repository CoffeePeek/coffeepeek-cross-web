import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Ellipsis, type LucideIcon } from 'lucide-react';
import { buttonVariants } from '../ui/Button';

interface UserAction {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
}

export function UserActionsMenu({ name, actions }: { name: string; actions: UserAction[] }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current) return;
    const popup = menu.current;
    const anchor = trigger.current.getBoundingClientRect();
    const height = popup.getBoundingClientRect().height;
    popup.style.left = `${Math.max(8, Math.min(anchor.right - popup.offsetWidth, window.innerWidth - popup.offsetWidth - 8))}px`;
    popup.style.top = `${Math.max(8, anchor.bottom + height + 8 <= window.innerHeight ? anchor.bottom + 4 : anchor.top - height - 4)}px`;
    popup.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();

    const dismiss = (event: Event) => {
      if (!(event.target instanceof Node) || !popup.contains(event.target)) popup.hidePopover();
    };
    window.addEventListener('resize', dismiss);
    document.addEventListener('scroll', dismiss, true);
    return () => {
      window.removeEventListener('resize', dismiss);
      document.removeEventListener('scroll', dismiss, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'h-11 w-11 shrink-0' })}
        aria-label={`Действия: ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        popoverTarget={id}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            menu.current?.showPopover();
          }
        }}
      >
        <Ellipsis className="h-5 w-5" aria-hidden="true" />
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        role="menu"
        aria-label={`Действия: ${name}`}
        className="fixed inset-auto z-50 m-0 max-h-[calc(100dvh-16px)] w-60 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-border-light bg-white p-1 shadow-lg dark:border-border-dark dark:bg-surface-dark"
        onToggle={(event) => setOpen(event.newState === 'open')}
        onBlur={(event) => {
          if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
            event.currentTarget.hidePopover();
          }
        }}
        onKeyDown={(event) => {
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
          const index = items.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === 'ArrowDown' ? (index + 1) % items.length
            : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
          if (next !== null) {
            event.preventDefault();
            items[next]?.focus();
          }
        }}
      >
        {actions.map(({ label, icon: Icon, onSelect, danger }) => (
          <button
            key={label}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-stone-100 focus-visible:bg-stone-100 dark:hover:bg-white/10 dark:focus-visible:bg-white/10 ${danger ? 'text-red-600 dark:text-red-400' : 'text-text-main dark:text-white'}`}
            onClick={() => {
              menu.current?.hidePopover();
              trigger.current?.focus();
              onSelect();
            }}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
