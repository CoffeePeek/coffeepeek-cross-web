import { extractLinkImport } from '../src/utils/extractLinkImport';
// Runs in the extension's isolated world, without reading application cookies or tokens.
const world = globalThis as typeof globalThis & { __coffeepeekExtract?: () => unknown; __coffeepeekExpanded?: boolean };
if (!world.__coffeepeekExpanded && location.hostname.includes('yandex.')) {
  const hours = document.querySelector<HTMLElement>('.business-working-status-view');
  if (hours && !document.querySelector('.business-working-hours-view')) hours.click();
  world.__coffeepeekExpanded = true;
}
world.__coffeepeekExtract = () => extractLinkImport(document, location.href);
