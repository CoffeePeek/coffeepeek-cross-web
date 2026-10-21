jest.mock('../src/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('../src/components/Header', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/layouts/LegalPageLayout.css', () => ({}));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import PrivacyPolicyPage from '../src/pages/PrivacyPolicyPage';
import TermsOfServicePage from '../src/pages/TermsOfServicePage';
import { LEGAL } from '../src/constants/legal';

test.each([
  { Page: PrivacyPolicyPage, route: '/privacy', title: 'Политика конфиденциальности' },
  { Page: TermsOfServicePage, route: '/terms', title: 'Условия использования' },
])('$title: every contents link resolves to a unique section and existing data controls remain available', ({ Page, route, title }) => {
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(Page)));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const links = [...html.matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
  const sections = [...html.matchAll(/<section id="([^"]+)"/g)].map(match => match[1]);
  expect(new Set(ids).size).toBe(ids.length);
  expect(sections).toHaveLength(14);
  for (const id of links) expect(ids).toContain(id);
  for (const id of sections) expect(links).toContain(id);
  expect(links).toContain('analytics-settings');
  expect(html).toContain('id="analytics-settings"');
  expect(html).toContain('aria-current="location"');
  expect(html).toContain('class="legal-document"');
  expect(html).toContain(title);
  expect(html).toContain(LEGAL.updatedAt);
  expect(html).toContain('Вернуться назад');
  expect(html).not.toContain('max-w-4xl');
  if (route === '/privacy') {
    expect(ids).toContain('posthog');
    expect(ids).toContain('data-deletion');
  }
});
