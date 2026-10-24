import { useEffect, useRef, useState } from 'react';
import { getGoogleClientId, loadGoogleIdentity } from '../lib/googleIdentity';
import { Button } from './ui/Button';

interface GoogleSignInButtonProps {
  disabled: boolean;
  loading: boolean;
  onCredential: (credential: string) => Promise<void>;
  onError: (message: string) => void;
}

export function GoogleSignInButton({ disabled, loading, onCredential, onError }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ disabled, onCredential, onError });
  callbacks.current = { disabled, onCredential, onError };
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const container = containerRef.current;
    if (!container) return;
    setStatus('loading');
    void loadGoogleIdentity().then(accountsId => {
      if (cancelled) return;
      accountsId.initialize({
        client_id: getGoogleClientId(),
        ux_mode: 'popup',
        auto_select: false,
        callback: ({ credential }) => {
          if (cancelled || callbacks.current.disabled) return;
          if (!credential) {
            callbacks.current.onError('Google не вернул данные для входа. Попробуйте ещё раз.');
            return;
          }
          void callbacks.current.onCredential(credential);
        },
      });
      let renderedWidth = 0;
      const renderButton = () => {
        const width = Math.min(400, Math.floor(container.clientWidth || 280));
        if (cancelled || width === renderedWidth) return;
        renderedWidth = width;
        container.replaceChildren();
        accountsId.renderButton(container, {
          type: 'standard', theme: 'filled_black', size: 'large', text: 'signin_with',
          shape: 'rectangular', width, locale: 'ru',
        });
      };
      renderButton();
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(renderButton);
        observer.observe(container);
      }
      setStatus('ready');
    }).catch(() => {
      if (!cancelled) setStatus('error');
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      container.replaceChildren();
    };
  }, [attempt]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        inert={disabled || status !== 'ready'}
        aria-busy={loading || status === 'loading'}
        className={disabled ? 'flex min-h-10 justify-center opacity-50' : 'flex min-h-10 justify-center'}
      />
      {(status === 'loading' || loading) && <p role="status" className="text-center text-xs text-stone-400">{loading ? 'Входим через Google…' : 'Загружаем вход через Google…'}</p>}
      {status === 'error' && (
        <div className="space-y-2 text-center">
          <p role="alert" className="text-xs text-red-400">Не удалось загрузить вход через Google.</p>
          <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => setAttempt(value => value + 1)}>Повторить загрузку Google</Button>
        </div>
      )}
    </div>
  );
}
