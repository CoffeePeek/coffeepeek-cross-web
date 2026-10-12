import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const app = new URL('../', import.meta.url);
const source = new URL('src/design-system/', app);
const check = process.argv.includes('--check');

function load(file, dependencies = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, source), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  new Function('exports', 'require', outputText)(exports, name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unknown dependency: ${name}`);
    return dependencies[name];
  });
  return exports;
}

function rows(value, prefix) {
  return Object.entries(value).flatMap(([key, item]) => {
    const name = `${prefix}.${key}`;
    return item !== null && typeof item === 'object'
      ? rows(item, name)
      : [`| \`${name}\` | \`${String(item)}\` |`];
  });
}

function update(url, content) {
  if (check) assert.equal(readFileSync(url, 'utf8').replaceAll('\r\n', '\n'), content, `${fileURLToPath(url)} is stale. Run npm run design:sync.`);
  else writeFileSync(url, content);
}

const tokenModule = load('tokens.ts');
const { components } = load('components.ts', { './tokens': tokenModule });
const { light, dark, ...tokens } = tokenModule.tokens;
const jsonFile = new URL('tokens.json', source);
const { meta } = JSON.parse(readFileSync(jsonFile, 'utf8'));
update(jsonFile, `${JSON.stringify({
  meta: { ...meta, version: '1.1.0', note: 'Generated from tokens.ts and components.ts. Colors use CSS notation; Android resources are not bundled.' },
  ...tokens,
  themes: { light, dark },
  components,
}, null, 2)}\n`);

const documentFile = new URL('DESIGN-SYSTEM.md', app);
const document = readFileSync(documentFile, 'utf8').replaceAll('\r\n', '\n');
const start = '<!-- design-system:start -->';
const end = '<!-- design-system:end -->';
assert.equal(document.split(start).length, 2, 'Expected one design-system start marker.');
assert.equal(document.split(end).length, 2, 'Expected one design-system end marker.');
const tables = Object.entries({ ...tokenModule.tokens, ...components }).map(([name, value]) =>
  `### ${name}\n\n| Токен / поле | Значение |\n|---|---|\n${rows(value, name).join('\n')}`,
).join('\n\n');
update(documentFile, document.replace(/<!-- design-system:start -->[\s\S]*?<!-- design-system:end -->/, `${start}\n\n${tables}\n\n${end}`));
console.log(check ? 'Design-system documentation and JSON are synchronized.' : 'Updated DESIGN-SYSTEM.md and tokens.json.');
