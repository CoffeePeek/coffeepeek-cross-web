import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from '../Icon';
import WobbleRing from '../WobbleRing';

export function ProfileAvatar({ name, url, className = '' }: { name: string; url?: string | null; className?: string }) {
  return <span className={`profile-avatar ${className}`} aria-hidden="true">
    {name.replace(/^@+/, '').trim().charAt(0).toUpperCase() || '?'}
    {url && <img key={url} src={url} alt="" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = 'none'; }} />}
  </span>;
}

export function ProfileSectionHeading({ title, onAll }: { title: string; onAll?: () => void }) {
  return <div className="flex min-h-11 items-center justify-between gap-3">
    <h2 className="text-xl font-bold tracking-tight">{title}</h2>
    {onAll && <button type="button" className="profile-text-button" onClick={onAll} aria-label={`${title}: показать все`}>Все</button>}
  </div>;
}

export function ProfileLoading({ label = 'Загрузка…' }: { label?: string }) {
  return <div role="status" className="flex min-h-24 items-center justify-center gap-3 py-6 profile-muted"><WobbleRing size={24} /><span className="text-sm">{label}</span></div>;
}

export function ProfileError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-x-3 rounded-2xl border p-3 text-sm profile-panel">
    <p>{message}</p><button type="button" onClick={onRetry} className="profile-text-button">Повторить</button>
  </div>;
}

export function ProfileDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  return <dialog ref={ref} className="profile-dialog" aria-labelledby={titleId} onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="flex max-h-[85dvh] flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b p-4 profile-divider">
        <h2 id={titleId} className="text-xl font-bold">{title}</h2>
        <button autoFocus type="button" aria-label="Закрыть" onClick={onClose} className="profile-icon-button"><X size={22} /></button>
      </div>
      <div className="overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</div>
    </div>
  </dialog>;
}
