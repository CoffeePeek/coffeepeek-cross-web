import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { renderHomePage } from '../api/public-page.mjs';

const shell = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const bootstrap = shell.match(/<script>([\s\S]*?)<\/script>/)[1];

function start(storageFails = false) {
  const classes = new Set();
  const context = {
    document: { documentElement: {
      classList: { add: name => classes.add(name), remove: name => classes.delete(name), toggle() {} },
      setAttribute() {},
    } },
    window: { addEventListener(name, listener, capture) {
      assert.equal(name, 'error');
      assert.equal(capture, true);
      this.onError = listener;
    } },
    localStorage: { getItem() { if (storageFails) throw new Error('Storage blocked'); return 'dark'; } },
    HTMLScriptElement: class {},
  };
  runInNewContext(bootstrap, context);
  return { classes, context };
}

test('server HTML keeps readable content and the shared loader; only JavaScript clients hide the server layout', () => {
  const html = renderHomePage(shell);
  assert.match(html, /id="server-rendered-content"/);
  assert.match(html, /id="app-startup"><span class="wobble-ring" role="status" aria-label="Загрузка"/);
  assert.match(shell, /#app-startup\s*\{\s*display: none/);
  assert.match(shell, /\.app-js #server-rendered-content \{ display: none; \}/);
  assert.match(shell, /\.app-js #app-startup \{ display: flex; \}/);
  assert.doesNotMatch(shell.match(/<html[^>]*>/)[0], /app-js/);
  assert(start().classes.has('app-js'));
  assert(start(true).classes.has('app-js'));
});

test('entry module and runtime failures restore readable server content; image failures keep the loader', () => {
  for (const failure of ['module', 'runtime', 'image']) {
    const { classes, context } = start();
    const script = new context.HTMLScriptElement();
    script.type = 'module';
    context.window.onError({ target: failure === 'module' ? script : failure === 'runtime' ? context.window : { tagName: 'IMG' } });
    assert.equal(classes.has('app-js'), failure === 'image', failure);
  }
});
