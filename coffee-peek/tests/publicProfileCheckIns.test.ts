import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CheckInDto } from '../src/api/coffeeshop';

const mockQuery = {
  data: { pages: [{ items: [{ id: 'one', text: 'Первый чекин' }, { id: 'two', text: 'Второй чекин' }, { id: 'three', text: 'Третий чекин' }] }] },
  isPending: false, isSuccess: true, isFetching: false, isFetchingNextPage: false,
  isError: false, isFetchNextPageError: false, hasNextPage: true,
  fetchNextPage: jest.fn(), refetch: jest.fn(),
};
jest.mock('../src/hooks/queries/useCheckIns', () => ({ usePublicCheckIns: jest.fn(() => mockQuery) }));
jest.mock('../src/hooks/useLoadMoreOnScroll', () => ({ useLoadMoreOnScroll: jest.fn(() => undefined) }));
jest.mock('../src/components/CheckInCard', () => ({ __esModule: true, default: ({ item }: { item: CheckInDto }) => item.text }));
jest.mock('../src/components/profile/ProfileUI', () => {
  const actual = jest.requireActual('../src/components/profile/ProfileUI');
  return { ...actual, ProfileError: jest.fn(actual.ProfileError) };
});
import PublicProfileCheckIns from '../src/components/profile/PublicProfileCheckIns';
import { ProfileError } from '../src/components/profile/ProfileUI';
import { useLoadMoreOnScroll } from '../src/hooks/useLoadMoreOnScroll';
import { usePublicCheckIns } from '../src/hooks/queries/useCheckIns';

const initial = { ...mockQuery };
const render = () => renderToStaticMarkup(createElement(PublicProfileCheckIns, { slug: 'maria' }));
beforeEach(() => { Object.assign(mockQuery, initial); jest.clearAllMocks(); });

test('all loaded check-ins stay in the column; overlapping pages do not duplicate cards', () => {
  mockQuery.data = { pages: [...initial.data.pages, { items: [{ id: 'three', text: 'Третий чекин' }, { id: 'four', text: 'Четвёртый чекин' }] }] };
  const html = render();
  expect(html).toContain('Первый чекин');
  expect(html).toContain('Четвёртый чекин');
  expect(html.match(/Третий чекин/g)).toHaveLength(1);
  expect(html).not.toContain('показать все');
  expect(usePublicCheckIns).toHaveBeenCalledWith({ authorSlug: 'maria', pageSize: 10 });
  const [enabled, load] = jest.mocked(useLoadMoreOnScroll).mock.calls.at(-1)!;
  expect(enabled).toBe(true);
  load();
  expect(mockQuery.fetchNextPage).toHaveBeenCalledWith({ cancelRefetch: false });
});

test.each([{ isFetching: true }, { isError: true }, { hasNextPage: false }])('automatic pagination pauses for %j', state => {
  Object.assign(mockQuery, state);
  render();
  expect(jest.mocked(useLoadMoreOnScroll).mock.calls.at(-1)?.[0]).toBe(false);
});

test('loading the next page keeps cards visible and announces progress below them', () => {
  Object.assign(mockQuery, { isFetching: true, isFetchingNextPage: true });
  const html = render();
  expect(html).toContain('Первый чекин');
  expect(html).toContain('Загрузка следующих чекинов');
  expect(html).not.toContain('Все публичные чекины загружены');
});

test.each([true, false])('failed request retries the correct page (next page: %s)', nextPage => {
  Object.assign(mockQuery, { isError: true, isSuccess: false, isFetchNextPageError: nextPage });
  expect(render()).toContain('Первый чекин');
  const props = jest.mocked(ProfileError).mock.calls.at(-1)![0];
  props.onRetry();
  expect(nextPage ? mockQuery.fetchNextPage : mockQuery.refetch).toHaveBeenCalledTimes(1);
  expect(nextPage ? mockQuery.refetch : mockQuery.fetchNextPage).not.toHaveBeenCalled();
});

test('empty and completed lists stop pagination and show the matching state', () => {
  mockQuery.hasNextPage = false;
  expect(render()).toContain('Все публичные чекины загружены');
  mockQuery.data = { pages: [{ items: [] }] };
  expect(render()).toContain('Пока нет публичных чекинов');
  expect(render()).not.toContain('Все публичные чекины загружены');
});
