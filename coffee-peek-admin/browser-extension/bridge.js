(() => {
  if (globalThis.__coffeepeekBridge) return;
  globalThis.__coffeepeekBridge = true;
  const channel = 'coffeepeek-link-import-v1';
  window.addEventListener('message', async (event) => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || message?.channel !== channel ||
      message.direction !== 'request' || typeof message.requestId !== 'string' || message.requestId.length > 80 ||
      !['ping', 'extract', 'cancel'].includes(message.action)) return;
    try {
      const response = await chrome.runtime.sendMessage({ action: message.action, requestId: message.requestId, url: message.url });
      window.postMessage({ channel, direction: 'response', requestId: message.requestId, ...response }, location.origin);
    } catch {
      window.postMessage({ channel, direction: 'response', requestId: message.requestId, error: 'Перезагрузите админку после подключения расширения' }, location.origin);
    }
  });
})();
