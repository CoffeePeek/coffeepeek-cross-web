import { normalizeLinkImportUrl, validateLinkImportDraft, LINK_IMPORT_VERSION, mergeEnrichment, safeMenuImageUrl } from './link-import.js';

const jobs = new Map();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readPage(url, requested, job, timeout = 22_000) {
  const tab = await chrome.tabs.create({ url, active: false });
  job.tabs.add(tab.id);
  let previous = '', stable = 0, best, lastError = 'Карточка не загрузилась';
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (job.cancelled) throw new Error('Импорт отменён');
    const current = await chrome.tabs.get(tab.id);
    if (current.status !== 'complete') { await pause(500); continue; }
    try {
      const actual = normalizeLinkImportUrl(current.url);
      if (actual.source !== requested.source || (requested.externalId && actual.externalId !== requested.externalId)) throw new Error('Источник открыл вход или другую карточку');
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['extract.js'] });
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
        try { return { draft: globalThis.__coffeepeekExtract(), collecting: globalThis.__coffeepeekGalleryCollecting }; }
        catch (error) { return { error: error.message }; }
      } });
      if (result?.result?.error) { lastError = result.result.error; stable = 0; }
      else {
        best = validateLinkImportDraft(result?.result?.draft, requested);
        const signature = JSON.stringify([best.fields, best.enrichment]);
        stable = signature === previous ? stable + 1 : 0;
        previous = signature;
        if (stable >= 2 && !result.result.collecting) return best;
      }
    } catch (error) { lastError = error.message; }
    await pause(1000);
  }
  if (best) return best;
  job.keepTabs.add(tab.id);
  throw new Error(lastError);
}

async function imageFile(url, job) {
  if (!safeMenuImageUrl(url)) throw new Error('Источник фотографии не поддерживается');
  job.controller = new AbortController();
  const timeout = setTimeout(() => job.controller.abort(), 20_000);
  try {
    const response = await fetch(url, { signal: job.controller.signal, credentials: 'omit', redirect: 'error' });
    const contentType = response.headers.get('content-type')?.split(';')[0];
    if (!response.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) throw new Error('Не удалось загрузить фотографию');
    const max = 8 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > max) throw new Error('Фотография больше 8 МБ');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) { await reader.cancel(); throw new Error('Фотография больше 8 МБ'); }
      chunks.push(value);
    }
    if (!size) throw new Error('Пустая фотография');
    let binary = '';
    for (const chunk of chunks) for (let offset = 0; offset < chunk.length; offset += 8192) {
      binary += String.fromCharCode(...chunk.subarray(offset, offset + 8192));
    }
    return { contentType, base64: btoa(binary) };
  } finally { clearTimeout(timeout); }
}

async function run(message, sender) {
  const { adminOrigin } = await chrome.storage.local.get('adminOrigin');
  if (!sender.tab || sender.frameId !== 0 || !adminOrigin || new URL(sender.url).origin !== adminOrigin) throw new Error('Подключите админку через значок расширения');
  if (message.action === 'ping') return { version: LINK_IMPORT_VERSION };
  const key = `${sender.tab.id}:${message.requestId}`;
  if (message.action === 'cancel') {
    const job = jobs.get(key);
    if (job) {
      job.cancelled = true;
      job.controller?.abort();
      for (const id of job.tabs) await chrome.tabs.remove(id).catch(() => {});
    }
    return { cancelled: true };
  }
  if (!['extract', 'image'].includes(message.action)) throw new Error('Неизвестный запрос');
  if ([...jobs.keys()].some((id) => id.startsWith(`${sender.tab.id}:`))) throw new Error('Дождитесь текущего импорта');
  const job = { cancelled: false, tabs: new Set(), keepTabs: new Set(), controller: null };
  jobs.set(key, job);
  let completed = false;
  try {
    if (message.action === 'image') return await imageFile(message.url, job);
    const requested = normalizeLinkImportUrl(message.url);
    const primary = await readPage(requested.url, requested, job, 35_000);
    const parts = [primary.enrichment], warnings = [];
    // Follow only links belonging to the same organisation, never nearby cards.
    const related = (primary.enrichment?.menuSources ?? []).filter((source) => {
      try {
        const target = normalizeLinkImportUrl(source.url);
        return requested.source === 'yandex' && target.source === 'yandex' && target.externalId === primary.externalId &&
          ['menu', 'gallery'].includes(source.kind) && new URL(source.url).pathname !== new URL(requested.url).pathname;
      } catch { return false; }
    }).slice(0, 2);
    for (const source of related) {
      try { parts.push((await readPage(source.url, primary, job, source.kind === 'gallery' ? 40_000 : 22_000)).enrichment); }
      catch (error) { if (job.cancelled) throw error; warnings.push(`${source.label}: ${error.message}`); }
    }
    if (requested.source === 'yandex' && primary.fields.instagram) {
      try {
        const profile = normalizeLinkImportUrl(primary.fields.instagram);
        const instagram = await readPage(profile.url, profile, job);
        parts.push(instagram.enrichment);
        for (const field of ['phone', 'website', 'description']) {
          if (!primary.fields[field] && instagram.fields[field]) {
            primary.fields[field] = instagram.fields[field];
            primary.evidence[field] = `${profile.url}: ${instagram.evidence[field] || instagram.fields[field]}`;
          }
        }
        if (instagram.fields.openingHours && primary.fields.openingHours && instagram.fields.openingHours !== primary.fields.openingHours) {
          warnings.push(`Instagram: другое расписание — ${instagram.fields.openingHours}`);
        } else if (!primary.fields.openingHours && instagram.fields.openingHours) {
          primary.fields.openingHours = instagram.fields.openingHours;
          primary.evidence.openingHours = profile.url;
        }
      } catch (error) { if (job.cancelled) throw error; warnings.push(`Instagram: ${error.message}`); }
    }
    primary.enrichment = mergeEnrichment(...parts, { tags: [], menuItems: [], menuSources: [], photos: [], warnings });
    completed = true;
    return { draft: primary };
  } finally {
    jobs.delete(key);
    // Leave a blocked source open so the user can sign in or resolve a captcha.
    if (completed || job.cancelled) for (const id of job.tabs) {
      if (job.cancelled || !job.keepTabs.has(id)) await chrome.tabs.remove(id).catch(() => {});
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!message || typeof message.requestId !== 'string' || message.requestId.length > 80) return;
  run(message, sender).then(respond, (error) => respond({ error: error.message || 'Не удалось прочитать страницу' }));
  return true;
});
