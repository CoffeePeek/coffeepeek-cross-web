import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DotsThree, WarningCircle, X } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { reportReview } from '../api/reviewReports';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/theme';
import { getErrorMessage } from '../utils/errorHandler';

export default function ReportReviewButton({ reviewId }: { reviewId: string }) {
  const { user } = useUser();
  const { theme } = useTheme();
  const classes = getThemeClasses(theme);
  const { showToast } = useToast();
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const mutation = useMutation({
    mutationFn: () => reportReview(reviewId, text),
    onSuccess: () => { setSent(true); setOpen(false); setText(''); showToast('Жалоба отправлена', 'success'); },
  });

  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!open || !dialog.current) return;
    dialog.current.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.current?.close();
      document.body.style.overflow = overflow;
      trigger.current?.focus();
    };
  }, [open]);

  if (!user) return null;
  const close = () => { if (!mutation.isPending) setOpen(false); };
  return (
    <div ref={menu} className={`relative shrink-0 text-sm ${classes.text.primary}`}>
      <button ref={trigger} type="button" aria-label="Действия с отзывом" aria-expanded={menuOpen} aria-controls={`${id}-menu`} className={`flex h-11 w-11 items-center justify-center rounded-full ${classes.text.secondary} hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#EAB308]`} onClick={() => setMenuOpen(!menuOpen)}>
        <DotsThree size={26} weight="bold" />
      </button>
      {menuOpen && <div id={`${id}-menu`} className={`absolute right-0 top-12 z-20 w-52 rounded-2xl border p-1.5 shadow-lg ${classes.bg.card} ${classes.border.default}`}>
        <button type="button" autoFocus disabled={sent} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50" onClick={() => { setMenuOpen(false); mutation.reset(); setOpen(true); }}><WarningCircle size={18} />{sent ? 'Жалоба отправлена' : 'Пожаловаться'}</button>
      </div>}
      {open && createPortal(
        <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }} className={`fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-[28px] border p-0 backdrop:bg-black/55 sm:inset-0 sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-[460px] sm:rounded-[28px] ${classes.bg.card} ${classes.text.primary} ${classes.border.default}`}>
          <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 sm:p-6">
            <div aria-hidden="true" className={`mx-auto mb-3 h-1 w-10 rounded-full sm:hidden ${classes.bg.tertiary}`} />
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id={`${id}-title`} className="text-xl font-bold">Пожаловаться на отзыв</h2>
              <button type="button" disabled={mutation.isPending} aria-label="Закрыть" onClick={close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"><X size={22} /></button>
            </div>
            <p id={`${id}-description`} className={`mb-5 text-sm ${classes.text.secondary}`}>Расскажите, что не так с отзывом. Администратор проверит вашу жалобу.</p>
            <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (!mutation.isPending) mutation.mutate(); }}>
              <label htmlFor={`${id}-text`} className="block font-semibold">Причина жалобы</label>
              <textarea id={`${id}-text`} autoFocus required maxLength={2000} rows={5} value={text} onChange={event => setText(event.target.value)} disabled={mutation.isPending} placeholder="Например, оскорбления или недостоверная информация" className={`w-full resize-none rounded-2xl border p-3 focus:outline-none focus:ring-2 focus:ring-[#EAB308]/50 ${classes.bg.input} ${classes.border.default}`} />
              <p className={`text-right text-xs ${classes.text.secondary}`}>{text.trim().length} / 2000</p>
              {mutation.error && <p role="alert" className="text-red-500">{(mutation.error as { status?: number }).status === 429 ? 'Слишком много запросов. Попробуйте позже.' : (mutation.error as { status?: number }).status === 404 ? 'Отзыв больше недоступен.' : getErrorMessage(mutation.error)}</p>}
              <button type="submit" disabled={mutation.isPending || !text.trim()} className={`min-h-12 w-full rounded-2xl px-4 py-3 font-bold disabled:opacity-50 ${classes.primary.bg} ${classes.text.inverse}`}>{mutation.isPending ? 'Отправка…' : 'Отправить жалобу'}</button>
            </form>
          </div>
        </dialog>, document.body,
      )}
    </div>
  );
}
