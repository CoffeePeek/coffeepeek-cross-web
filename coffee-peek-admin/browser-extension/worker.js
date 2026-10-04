import { normalizeLinkImportUrl, validateLinkImportDraft } from './link-import.js';

const jobs = new Map();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function run(message, sender) {
  const { adminOrigin } = await chrome.storage.local.get('adminOrigin');
  if (!sender.tab || sender.frameId !== 0 || !adminOrigin || new URL(sender.url).origin !== adminOrigin) throw new Error('Подключите админку через значок расширения');
  if (message.action === 'ping') return { version: 1 };
  const key = `${sender.tab.id}:${message.requestId}`;
  if (message.action === 'cancel') {
    const job = jobs.get(key);
    if (job) { job.cancelled = true; if (job.tabId) await chrome.tabs.remove(job.tabId).catch(() => {}); }
    return { cancelled: true };
  }
  if (message.action !== 'extract') throw new Error('Неизвестный запрос');
  if ([...jobs.keys()].some((id) => id.startsWith(`${sender.tab.id}:`))) throw new Error('Дождитесь текущего импорта');
  const requested = normalizeLinkImportUrl(message.url);
  const job = { cancelled: false, tabId: null };
  jobs.set(key, job);
  let completed = false;
  try {
    const tab = await chrome.tabs.create({ url: requested.url, active: true });
    job.tabId = tab.id;
    let previous = '', stable = 0, best, lastError = 'Карточка не загрузилась';
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (job.cancelled) throw new Error('Импорт отменён');
      const current = await chrome.tabs.get(tab.id);
      if (current.status !== 'complete') { await pause(500); continue; }
      try {
        // Validating again prevents injection into a login redirect or an unrelated page.
        const actual = normalizeLinkImportUrl(current.url);
        if (actual.source !== requested.source || (requested.externalId && actual.externalId !== requested.externalId)) throw new Error('Источник открыл вход или другую карточку');
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['extract.js'] });
        const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
          try { return { draft: globalThis.__coffeepeekExtract() }; }
          catch (error) { return { error: error.message }; }
        } });
        if (result?.result?.error) { lastError = result.result.error; stable = 0; }
        else {
          best = validateLinkImportDraft(result?.result?.draft, requested);
          const signature = JSON.stringify(best.fields);
          stable = signature === previous ? stable + 1 : 0;
          previous = signature;
          if (stable >= 3) { completed = true; return { draft: best }; }
        }
      } catch (error) { lastError = error.message; }
      await pause(1000);
    }
    throw new Error(lastError);
  } finally {
    jobs.delete(key);
    // On access/login/captcha errors, leave the source tab for the user to open it normally.
    if ((completed || job.cancelled) && job.tabId) await chrome.tabs.remove(job.tabId).catch(() => {});
    await chrome.tabs.update(sender.tab.id, { active: true }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!message || typeof message.requestId !== 'string' || message.requestId.length > 80) return;
  run(message, sender).then(respond, (error) => respond({ error: error.message || 'Не удалось прочитать страницу' }));
  return true;
});
