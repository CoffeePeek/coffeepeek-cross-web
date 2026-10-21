jest.mock('../src/api/admin', () => ({ getModerationShopById: jest.fn(), getPublishedShopById: jest.fn() }));
jest.mock('../src/api/coffeeShops', () => ({ getBrowseCoffeeShopBySlug: jest.fn() }));
jest.mock('../src/api/shopPublicAddresses', () => ({ getShopPublicAddressById: jest.fn(), getShopPublicAddressBySlug: jest.fn() }));
let mockIsAdmin = true;
jest.mock('../src/contexts/UserContext', () => ({ useUser: () => ({ isAdmin: mockIsAdmin }) }));
jest.mock('../src/pages/PublishedShopEditPage', () => ({ PublishedShopEditPage: ({ id, submissionId }: { id: string; submissionId?: string }) => `published:${id};submission:${submissionId ?? ''}` }));
jest.mock('../src/pages/ShopEditPage', () => ({ ShopEditPage: ({ id }: { id: string }) => `moderation:${id}` }));
jest.mock('../src/pages/BrowseShopPage', () => ({ BrowseShopPage: () => 'public-details' }));

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PublishedShopLink } from '../src/components/PublishedShopLink';
import { ShopDetailPage } from '../src/pages/ShopDetailPage';

const shopId = 'shop-uuid';
const submissionId = 'submission-uuid';
const slug = 'coffee-slug';
let client: QueryClient;
beforeEach(() => {
  mockIsAdmin = true;
  client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } } });
  client.setQueryData(['admin', 'published-shop', shopId], { id: shopId, name: 'Кофейня у парка', location: { address: 'Парковая, 10' }, isHidden: true });
  client.setQueryData(['admin', 'shop', submissionId], { id: submissionId, status: 'Approved', publishedShopId: shopId });
  const address = { entityId: shopId, slug, canonicalPath: `/coffee-shops/${slug}` };
  client.setQueryData(['admin', 'shop-public-address', 'slug', slug], address);
  client.setQueryData(['admin', 'shop-public-address', 'id', shopId], address);
  client.setQueryData(['browse', 'coffee-shop', slug], { name: 'Кофейня у парка', address: 'Парковая, 10' });
});
afterEach(() => client.clear());

function render(element: React.ReactElement, path = '/') {
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [path] }, element)));
}

test('shop links show name and street, and let administrators open hidden shops directly', () => {
  const markup = render(createElement(PublishedShopLink, { shopId }));
  expect(markup).toContain('Кофейня у парка');
  expect(markup).toContain('Парковая, 10');
  expect(markup).toContain(`href="/published-shops/${shopId}"`);
  expect(markup).not.toContain(`>${shopId}<`);
});

test('moderators use resolved public slugs and names without requiring an admin detail', () => {
  mockIsAdmin = false;
  client.removeQueries({ queryKey: ['admin', 'published-shop'] });
  const markup = render(createElement(PublishedShopLink, { shopId }));
  expect(markup).toContain(`href="/coffee-shops/${slug}"`);
  expect(markup).toContain('Кофейня у парка');
  expect(markup).toContain('Парковая, 10');
});

test.each(['published', 'moderation', 'public'] as const)('%s entry opens the same complete published editor for an administrator', source => {
  const id = source === 'published' ? shopId : source === 'moderation' ? submissionId : slug;
  const markup = render(createElement(Routes, null, createElement(Route, { path: '/detail/:id', element: createElement(ShopDetailPage, { source }) })), `/detail/${id}`);
  expect(markup).toContain(`published:${shopId}`);
  if (source === 'moderation') expect(markup).toContain(`submission:${submissionId}`);
});

test('pending submissions keep moderation actions; moderator access never selects the administrative editor', () => {
  client.setQueryData(['admin', 'shop', submissionId], { id: submissionId, status: 'Pending' });
  const element = createElement(Routes, null, createElement(Route, { path: '/detail/:id', element: createElement(ShopDetailPage, { source: 'moderation' }) }));
  expect(render(element, `/detail/${submissionId}`)).toContain(`moderation:${submissionId}`);
  mockIsAdmin = false;
  client.setQueryData(['admin', 'shop', submissionId], { id: submissionId, status: 'Approved', publishedShopId: shopId });
  expect(render(element, `/detail/${submissionId}`)).toContain(`moderation:${submissionId}`);
});
