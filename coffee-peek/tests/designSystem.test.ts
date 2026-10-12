jest.mock('../src/hooks/useFavorites', () => ({ useFavorite: () => ({ favorite: null, pending: false, toggle: jest.fn() }) }));
jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../src/api/core/httpClient', () => ({ httpClient: {} }));
jest.mock('../src/api/core/apiConfig', () => ({ API_ENDPOINTS: {} }));
jest.mock('../src/utils/logger', () => ({ logger: { warn: jest.fn() } }));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { tokens } from '../src/design-system/tokens';
import { components, card, header } from '../src/design-system/components';
import ShopCard from '../src/components/ShopCard';
import LogoMark, { HEADER_LOGO_SIZE } from '../src/components/LogoMark';
import type { CoffeeCard } from '../src/api/discovery';

test('JSON exports all TypeScript tokens and component specifications', () => {
  const json = JSON.parse(readFileSync(path.join(process.cwd(), 'src/design-system/tokens.json'), 'utf8'));
  const { light, dark, ...otherTokens } = tokens;
  const { meta, components: exportedComponents, themes, ...exportedTokens } = json;
  expect(meta.version).toBe('1.1.0');
  expect(themes).toEqual({ light, dark });
  expect(exportedTokens).toEqual(otherTokens);
  expect(exportedComponents).toEqual(components);
});

test('documented card and header logo dimensions match the rendered UI', () => {
  const coffee = { name: 'Coffee', address: { slug: 'coffee' }, roaster: { name: 'Roaster' }, coverPhoto: null } as CoffeeCard;
  const render = () => renderToStaticMarkup(React.createElement(ShopCard, { coffee, colors: tokens.light, onSelect: jest.fn() }));
  const html = render();
  expect(html).toContain(`rounded-[${card.borderRadius}px]`);
  expect(html).toContain(`aspect-[${card.photoAspectRatio.replace(':', '/')}]`);
  expect(html).toContain(`px-${card.padding / 4} pb-${card.padding / 4} pt-${card.paddingTop / 4}`);
  expect(html).toContain(`box-shadow:${tokens.shadow.card}`);
  const state = jest.spyOn(React, 'useState').mockImplementationOnce(() => [true, jest.fn()] as any);
  try {
    const hovered = render();
    expect(hovered).toContain(`translateY(${card.hoverTranslateY}px)`);
    expect(hovered).toContain(`box-shadow:${tokens.shadow.cardHover}`);
    expect(hovered).toContain(`${tokens.brand.primary}${Math.round(card.states.hoverBorderOpacity * 255).toString(16)}`);
  } finally {
    state.mockRestore();
  }
  expect(HEADER_LOGO_SIZE).toBe(header.logoSize);
  const logo = renderToStaticMarkup(React.createElement(LogoMark, { size: HEADER_LOGO_SIZE }));
  expect(logo).toContain(`width:${header.logoSize}px`);
  expect(logo).toContain(`border-radius:${header.logoBorderRadius}px`);
});
