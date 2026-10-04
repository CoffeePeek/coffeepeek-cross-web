import { getLandingRedirect } from '../src/utils/landingRedirect';

test.each([true, false])('email links retain their token regardless of authentication (%s)', authenticated => {
  const search = `?${new URLSearchParams({ token: 'a+b/c=d' })}`;
  expect(getLandingRedirect('/', search, authenticated)).toBe(`/confirm-email${search}`);
});

test('ordinary landing requests preserve the existing authenticated redirect', () => {
  expect(getLandingRedirect('/', '', true)).toBe('/shops');
  expect(getLandingRedirect('/', '', false)).toBeNull();
  expect(getLandingRedirect('/confirm-email', '?token=a', true)).toBeNull();
});
