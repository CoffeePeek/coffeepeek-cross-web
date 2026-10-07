jest.mock('../src/api/coffeeshop', () => ({}));
jest.mock('../src/components/CatalogCards', () => ({ catalogButton: '' }));
jest.mock('../src/components/icons', () => ({ AppIcon: () => null }));
jest.mock('@/components/Icon', () => ({ CaretDown: () => null, Check: () => null }), { virtual: true });
jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
let mockLocation = { pathname: '/coffees', search: '' };
jest.mock('react-router-dom', () => ({ useLocation: () => mockLocation }));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CatalogFilters } from '../src/components/CatalogFilters';
import { ScrollToTop } from '../src/components/ScrollToTop';
import type { FacetGroup } from '../src/api/discovery';

test('empty coffee groups are hidden, populated groups and unavailable selections remain usable', () => {
  const render = (groups: FacetGroup[], filters: Record<string, unknown> = {}) => renderToStaticMarkup(React.createElement(CatalogFilters, {
    kind: 'coffees', groups, filters, onApply: jest.fn(),
  }));
  const group: FacetGroup = { code: 'taste', name: 'Вкусовые ноты', selection: 'or', options: [] };
  const empty = render([group]);
  expect(empty.match(/<div hidden="">/g)).toHaveLength(12);
  expect(empty).not.toContain('<fieldset');
  const populated = render([{ ...group, options: [{ code: 'chocolate', name: 'Шоколад', count: 16, selected: false }] }], { taste: ['chocolate'] });
  expect(populated).toContain('Шоколад');
  expect(populated).toContain('aria-pressed="true"');
  expect(populated.match(/<div hidden="">/g)).toHaveLength(11);
  for (const groups of [[group], []]) {
    const missing = render(groups, { taste: ['retired'] });
    expect(missing.match(/<div hidden="">/g)).toHaveLength(11);
    expect(missing).toContain('Значение «retired» недоступно.');
    expect(missing).toContain('Удалить фильтр');
  }
});

test('coffee filter changes preserve scroll; entering a route still scrolls to the top', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const scrollTo = jest.fn();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { scrollTo } });
  const ref = jest.spyOn(React, 'useRef').mockReturnValue({ current: null });
  const effect = jest.spyOn(React, 'useEffect').mockImplementation(callback => { callback(); });
  try {
    ScrollToTop();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    mockLocation = { pathname: '/coffees', search: '?filters=changed' };
    ScrollToTop();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    mockLocation = { pathname: '/shops', search: '' };
    ScrollToTop();
    mockLocation = { pathname: '/coffees', search: '' };
    ScrollToTop();
    expect(scrollTo).toHaveBeenCalledTimes(3);
  } finally {
    ref.mockRestore();
    effect.mockRestore();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
