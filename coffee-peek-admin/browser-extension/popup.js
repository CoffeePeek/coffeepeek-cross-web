let currentTab;
let origin;
const status = document.getElementById('status');
const button = document.getElementById('connect');
button.disabled = true;
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  currentTab = tab;
  const url = new URL(tab.url);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error();
  origin = url.origin;
  document.getElementById('origin').textContent = origin;
  button.disabled = false;
}).catch(() => { status.textContent = 'Откройте админку CoffeePeek'; });
button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    // Permission is scoped to the selected admin host. No access to arbitrary browsing history.
    const adminUrl = new URL(origin);
    const pattern = `${adminUrl.protocol}//${adminUrl.hostname}/*`;
    if (!await chrome.permissions.request({ origins: [pattern] })) throw new Error('Разрешение не выдано');
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: ['coffeepeek-admin'] });
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: ['coffeepeek-admin'] });
    await chrome.scripting.registerContentScripts([{ id: 'coffeepeek-admin', matches: [pattern], js: ['bridge.js'], runAt: 'document_idle' }]);
    await chrome.storage.local.set({ adminOrigin: origin });
    await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, files: ['bridge.js'] });
    status.textContent = 'Подключено. Можно вернуться к импорту';
  } catch (error) { status.textContent = error.message || 'Не удалось подключиться'; }
  button.disabled = false;
});
