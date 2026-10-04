import { LINK_IMPORT_CHANNEL, LINK_IMPORT_VERSION, LinkImportDraft, normalizeLinkImportUrl, validateLinkImportDraft } from './linkImport';
import { safeMenuImageUrl } from './linkImportEnrichment';

function extensionRequest(action: 'ping' | 'extract' | 'image', url?: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = window.setTimeout(() => finish(new Error(action === 'ping' ? 'Подключите расширение' : 'Источник не ответил. Повторите импорт')), action === 'ping' ? 1500 : action === 'image' ? 25_000 : 130_000);
    const cancel = () => window.postMessage({ channel: LINK_IMPORT_CHANNEL, direction: 'request', requestId, action: 'cancel' }, location.origin);
    const finish = (error?: Error, response?: Record<string, unknown>) => {
      clearTimeout(timeout);
      window.removeEventListener('message', receive);
      signal?.removeEventListener('abort', abort);
      if (error) { if (action !== 'ping') cancel(); reject(error); } else resolve(response ?? {});
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

export async function readLinkImportImage(url: string, signal?: AbortSignal): Promise<File> {
  if (!safeMenuImageUrl(url)) throw new Error('Источник фотографии не поддерживается');
  const response = await extensionRequest('image', url, signal);
  if (typeof response.base64 !== 'string' || response.base64.length > 12_000_000 ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(String(response.contentType))) throw new Error('Некорректная фотография');
  const binary = atob(response.base64);
  if (!binary.length || binary.length > 8 * 1024 * 1024) throw new Error('Фотография слишком большая');
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const extension = response.contentType === 'image/png' ? 'png' : response.contentType === 'image/webp' ? 'webp' : 'jpg';
  return new File([bytes], `menu-${crypto.randomUUID()}.${extension}`, { type: String(response.contentType) });
}
