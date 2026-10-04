/** Email links must be handled before the authenticated landing redirect. */
export function getLandingRedirect(pathname: string, search: string, authenticated: boolean): string | null {
  if (pathname !== '/') return null;
  const token = new URLSearchParams(search).get('token');
  if (token) return `/confirm-email?${new URLSearchParams({ token })}`;
  return authenticated ? '/shops' : null;
}
