import { LINK_IMPORT_CHANNEL, LINK_IMPORT_VERSION, LinkImportDraft, normalizeLinkImportUrl, validateLinkImportDraft } from './linkImport';

function extensionRequest(action: 'ping' | 'extract', url?: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = window.setTimeout(() => finish(new Error(action === 'ping' ? 'Подключите расширение' : 'Источник не ответил. Повторите импорт')), action === 'ping' ? 1500 : 65_000);
    const cancel = () => window.postMessage({ channel: LINK_IMPORT_CHANNEL, direction: 'request', requestId, action: 'cancel' }, location.origin);
    const finish = (error?: Error, response?: Record<string, unknown>) => {
      clearTimeout(timeout);
      window.removeEventListener('message', receive);
      signal?.removeEventListener('abort', abort);
      if (error) { if (action === 'extract') cancel(); reject(error); } else resolve(response ?? {});
    };
    const abort = () => finish(new DOMException('Импорт отменён', 'AbortError'));
    const receive = (event: MessageEvent) => {
      const message = event.data;
      if (event.source !== window || event.origin !== location.origin || message?.channel !== LINK_IMPORT_CHANNEL ||
        message.direction !== 'response' || message.requestId !== requestId) return;
      if (typeof message.error === 'string') finish(new Error(message.error)); else finish(undefined, message);
    };
    window.addEventListener('message', receive);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    window.postMessage({ channel: LINK_IMPORT_CHANNEL, direction: 'request', requestId, action, url }, location.origin);
  });
}

export async function checkLinkImportExtension(signal?: AbortSignal): Promise<void> {
  const response = await extensionRequest('ping', undefined, signal);
  if (response.version !== LINK_IMPORT_VERSION) throw new Error('Обновите расширение');
}

export async function readLinkImport(url: string, signal?: AbortSignal): Promise<LinkImportDraft> {
  const requested = normalizeLinkImportUrl(url);
  await checkLinkImportExtension(signal);
  const response = await extensionRequest('extract', requested.url, signal);
  return validateLinkImportDraft(response.draft, requested);
}
