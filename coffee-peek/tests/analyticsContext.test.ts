import { analyticsApiCategory, analyticsPageType } from '../src/lib/analyticsContext';
import { getAnalyticsError } from '../src/lib/analyticsError';

test('route and API categories never contain IDs, slugs, queries or form input', () => {
  expect(analyticsPageType('/shops/private-shop/check-ins/secret/edit?token=secret')).toBe('check_in_edit');
  expect(analyticsPageType('/users/private-user')).toBe('user_profile');
  expect(analyticsPageType('/unknown/private')).toBe('other');
  expect(analyticsApiCategory('/api/v1/check-ins/private-id?token=secret')).toBe('check_ins');
  expect(analyticsApiCategory('/api/tokens/refresh')).toBe('authentication');
  expect(analyticsApiCategory('/api/unknown/private-id')).toBe('other');
});

test.each([[400, 'validation'], [401, 'authentication'], [403, 'permission'], [404, 'not_found'], [429, 'rate_limited'], [503, 'server']])('HTTP %s emits only safe diagnostics', (status, category) => {
  expect(getAnalyticsError({ status, message: 'private note', body: { password: 'secret' } })).toEqual({ status_code: status, error_category: category });
});

test('network/cancellation and malformed errors are classified without leaking messages', () => {
  expect(getAnalyticsError(new TypeError('Fetch failed https://private?token=secret'))).toEqual({ error_category: 'network' });
  expect(getAnalyticsError(new DOMException('private reason', 'AbortError'))).toEqual({ error_category: 'cancelled' });
  expect(getAnalyticsError({ status: 'private', message: 'secret' })).toEqual({ error_category: 'unknown' });
  expect(getAnalyticsError(null)).toEqual({ error_category: 'unknown' });
});
