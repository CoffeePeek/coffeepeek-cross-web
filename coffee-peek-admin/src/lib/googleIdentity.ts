const GSI_SRC = 'https://accounts.google.com/gsi/client?hl=ru';

export interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    ux_mode: 'popup';
    auto_select: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: {
    type: 'standard';
    theme: 'filled_black';
    size: 'large';
    text: 'signin_with';
    shape: 'rectangular';
    width: number;
    locale: 'ru';
  }) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

export const getGoogleClientId = () => (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();

let loadPromise: Promise<GoogleAccountsId> | null = null;

export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`) ?? document.createElement('script');
    const cleanup = () => {
      clearTimeout(timeout);
      script.removeEventListener('load', loaded);
      script.removeEventListener('error', failed);
    };
    const failed = () => {
      cleanup();
      script.remove();
      loadPromise = null;
      reject(new Error('Не удалось загрузить вход через Google. Попробуйте ещё раз.'));
    };
    const loaded = () => {
      if (!window.google?.accounts?.id) return failed();
      cleanup();
      resolve(window.google.accounts.id);
    };
    const timeout = setTimeout(failed, 15_000);
    script.addEventListener('load', loaded, { once: true });
    script.addEventListener('error', failed, { once: true });
    if (!script.isConnected) {
      script.src = GSI_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return loadPromise;
}
