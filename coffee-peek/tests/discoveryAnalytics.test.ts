import { analyticsFilterKeys, changedAnalyticsFilterKeys, discoveryCriteriaKey, discoverySearchProperties, DiscoverySearchSession } from '../src/utils/discoveryAnalytics';

describe('discovery analytics privacy and funnel boundaries', () => {
  const state = { q: '  private email@example.com  ', filters: {
    city: 'private-city', origin: { latitude: 53.912345, longitude: 27.512345 },
    tags: ['private-filter-value'], menu: { brew: ['espresso'], minPrice: 0 },
    arbitraryPrivateField: 'secret', budget: { currency: 'BYN', privateNote: 'secret' },
  }, sort: 'distance_asc' };

  test('outbound search properties contain only bounded text length and allowlisted filter names', () => {
    const properties = discoverySearchProperties('shops', state, 'list', 'search-1');
    expect(properties).toEqual({ catalog: 'shops', search_id: 'search-1', source: 'list', has_query: true,
      query_length: 25, filter_keys: ['budget.currency', 'city', 'menu.brew', 'menu.minPrice', 'nearby', 'tags'],
      nearby: true, sort: 'distance_asc' });
    const serialized = JSON.stringify(properties);
    for (const privateValue of ['email@example.com', '53.912345', '27.512345', 'private-city', 'espresso', 'secret', 'private-filter-value', 'arbitraryPrivateField', 'privateNote']) {
      expect(serialized).not.toContain(privateValue);
    }
    expect(discoverySearchProperties('coffees', { ...state, q: 'x'.repeat(200), sort: 'private-sort' }, 'list', 'search-2'))
      .toMatchObject({ query_length: 100, sort: 'unknown' });
    expect(discoverySearchProperties('shops', state, 'list', 'city', 'minsk').city_slug).toBe('minsk');
    expect(discoverySearchProperties('shops', { q: '', filters: {}, sort: 'recommended' }, 'list', 'recommendations')).toMatchObject({ has_query: false, sort: 'recommended' });
    expect(discoverySearchProperties('shops', state, 'list', 'city', 'private@email.example').city_slug).toBeUndefined();
  });

  test('filter reports include removal and changed values without serializing values or coordinates', () => {
    const before = { origin: { latitude: 1, longitude: 2 }, tags: ['a'], availableOnly: true };
    const after = { origin: { latitude: 4, longitude: 5 }, availableOnly: false, menu: { minPrice: 0 }, token: 'private' };
    expect(changedAnalyticsFilterKeys(before, after)).toEqual(['availableOnly', 'menu.minPrice', 'nearby', 'tags']);
    expect(analyticsFilterKeys(after)).toEqual(['availableOnly', 'menu.minPrice', 'nearby']);
    expect(analyticsFilterKeys({ tags: [], city: '', origin: undefined })).toEqual([]);
  });

  test('pagination, refetch data, object order, and array order do not create a fresh search identity', () => {
    const first = { q: 'flat white', sort: 'name_asc', filters: { tags: ['b', 'a'], menu: { brew: ['filter', 'espresso'] } }, page: 1, dataUpdatedAt: 123 };
    const second = { ...first, page: 3, dataUpdatedAt: 456, filters: { menu: { brew: ['espresso', 'filter'] }, tags: ['a', 'b'] } };
    expect(discoveryCriteriaKey('shops', first, 'list')).toBe(discoveryCriteriaKey('shops', second, 'list'));
    expect(discoveryCriteriaKey('shops', first, 'list')).not.toBe(discoveryCriteriaKey('shops', { ...first, q: 'coffee' }, 'list'));
    expect(discoveryCriteriaKey('shops', first, 'list')).not.toBe(discoveryCriteriaKey('shops', first, 'favorites'));
  });

  test('StrictMode effect replay and infinite scroll produce one start and one completed result', () => {
    const properties = discoverySearchProperties('shops', state, 'list', 'search-1');
    const session = new DiscoverySearchSession(properties, 100);
    expect(session.results(10, 110)).toBeNull();
    expect(session.start()).toEqual(properties);
    expect(session.start()).toBeNull();
    expect(session.results(10, 250)).toEqual({ ...properties, result_count: 10, is_empty: false, duration_ms: 150 });
    expect(session.results(20, 350)).toBeNull();
    expect(session.failure(new Error('background refetch failed'), 500)).toBeNull();
  });

  test('zero results are a successful empty result and do not masquerade as a failure', () => {
    const session = new DiscoverySearchSession(discoverySearchProperties('coffees', { q: '', filters: {}, sort: 'name_asc' }, 'list', 'empty'), 10);
    session.start();
    expect(session.results(0, 45)).toMatchObject({ result_count: 0, is_empty: true, duration_ms: 35, has_query: false });
  });

  test.each([
    [{ status: 401, message: 'token secret' }, 'authorization', 401],
    [{ status: 400, errors: { q: ['private text'] } }, 'validation', 400],
    [{ status: 503, body: 'private body' }, 'server', 503],
    [new TypeError('Failed to fetch https://secret.example/?token=secret'), 'network', undefined],
  ])('errors report categories without messages or payloads', (error, category, status) => {
    const session = new DiscoverySearchSession(discoverySearchProperties('shops', { q: '', filters: {}, sort: 'name_asc' }, 'list', 'failure'), 10);
    session.start();
    const outcome = session.failure(error, 100);
    expect(outcome).toMatchObject({ failure_category: category, duration_ms: 90 });
    expect(outcome?.http_status).toBe(status);
    expect(JSON.stringify(outcome)).not.toMatch(/secret|private|Failed to fetch/);
    expect(session.results(0, 200)).toBeNull();
    expect(session.failure(error, 200)).toBeNull();
  });
});
