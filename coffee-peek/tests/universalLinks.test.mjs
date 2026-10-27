import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const endpoint = '/.well-known/apple-app-site-association';
const association = JSON.parse(await readFile(new URL(`../public${endpoint}`, import.meta.url), 'utf8'));
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

test('all public content links belong to the signed CoffeePeek iOS app', () => {
  const [details] = association.applinks.details;
  assert.deepEqual(details.appIDs, ['JJ7867S6PS.com.coffeepeek']);
  const paths = details.components.map(component => component['/']);
  for (const path of ['/', '/coffee-shops/*', '/shops/*', '/roasters/*', '/users/*', '/coffees/*', '/check-ins/*']) {
    assert.ok(paths.includes(path), path);
  }
  assert.ok(!paths.includes('/*'), 'account confirmation and password recovery must keep their website handlers');
  assert.ok(details.components.every(component => component.exclude !== true));
});

test('both Apple association URLs serve JSON before the website fallback without a redirect', () => {
  const fallbackIndex = config.rewrites.findIndex(rule => rule.source === '/:path*');
  assert.ok(fallbackIndex >= 0);
  for (const source of [endpoint, '/apple-app-site-association']) {
    const index = config.rewrites.findIndex(rule => rule.source === source);
    assert.ok(index >= 0 && index < fallbackIndex, source);
    assert.equal(config.rewrites[index].destination, endpoint);
    const headers = config.headers.find(rule => rule.source === source)?.headers;
    assert.ok(headers?.some(header => header.key === 'Content-Type' && header.value === 'application/json'), source);
    assert.ok(!config.redirects.some(rule => rule.source === source), source);
  }
});
