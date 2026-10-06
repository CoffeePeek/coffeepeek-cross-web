import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync } from 'node:fs';
import path from 'node:path';
import AppIcon from '../src/components/icons/AppIcon';
import { getBrewMethodImage } from '../src/components/icons/iconMap';

const render = (name: string, props = {}) => renderToStaticMarkup(createElement(AppIcon, { name, ...props }));

test('deployed brew names resolve to all seven supplied SVGs, including aliases', () => {
  const names = ['Aeropress', 'Batch Brew', 'Cezve (Turkish Coffee)', 'Chemex', 'Cold Brew', 'Espresso', 'Hario V60'];
  const images = names.map(name => getBrewMethodImage(name));
  expect(new Set(images).size).toBe(7);
  for (const [index, image] of images.entries()) {
    expect(image).toBeDefined();
    expect(existsSync(path.join(process.cwd(), 'public', image!))).toBe(true);
    expect(render(`brew:${names[index]}`)).toContain('mask-image:');
  }
  expect(getBrewMethodImage('  COLd_brew ')).toBe(getBrewMethodImage('Колд-брю'));
  expect(getBrewMethodImage('Moka Pot')).toBeUndefined();
  expect(render('brew:Moka Pot')).toContain('<svg');
});

test('tag aliases and unknown or prototype-like slugs use safe icon fallbacks', () => {
  expect(render('tag:plan-based-milk')).toBe(render('tag:plant-based-milk'));
  expect(render('tag: ROASTERY ')).toBe(render('factory'));
  for (const name of ['tag:unknown', 'tag:', 'tag:constructor', 'tag:__proto__']) expect(render(name)).toBe(render('list-star'));
  expect(render('constructor')).toBe('');
  expect(getBrewMethodImage('constructor')).toBeUndefined();
});

test('favorite weights differ and labeled brew icons preserve accessible semantics', () => {
  expect(render('heart', { filled: true })).not.toBe(render('heart'));
  expect(render('brew:V60')).toContain('aria-hidden="true"');
  const labeled = render('brew:V60', { size: 28, 'aria-label': 'V60' });
  expect(labeled).toContain('role="img"');
  expect(labeled).toContain('width:28px');
  expect(labeled).not.toContain('aria-hidden');
});
