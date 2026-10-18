import { detailAnalyticsContext } from '../src/lib/engagementAnalytics';

describe('detail funnel context', () => {
  test.each(['list', 'map', 'favorites', 'related'] as const)('preserves %s entry and the opaque search ID', source => {
    expect(detailAnalyticsContext({ analytics: { source, search_id: 'search-m2a7jd-1' } }))
      .toEqual({ entry_point: source, search_id: 'search-m2a7jd-1' });
  });

  test.each([undefined, null, {}, { analytics: null }, { analytics: { source: '/private/search?q=email@example.com' } }])('defaults unknown navigation state to direct', state => {
    expect(detailAnalyticsContext(state)).toEqual({ entry_point: 'direct' });
  });

  test('never forwards route state, query text, coordinates or an arbitrary search identifier', () => {
    expect(detailAnalyticsContext({
      email: 'private@example.com', latitude: 53.9,
      analytics: { source: 'map', search_id: 'private@example.com', query: 'secret search', longitude: 27.5 },
    })).toEqual({ entry_point: 'map' });
    expect(detailAnalyticsContext({ analytics: { source: 'list', search_id: 'private-user-name' } }))
      .toEqual({ entry_point: 'list' });
  });
});
