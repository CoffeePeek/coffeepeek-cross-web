/** Stable route groups: never use a private user/check-in ID as a breakdown. */
export function analyticsPageType(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0];
  if (/\/check-ins\/[^/]+\/edit$/.test(path)) return 'check_in_edit';
  if (/\/check-ins\/new$/.test(path)) return 'check_in_create';
  if (/^\/(shops|coffee-shops)\/[^/]+\/edit$/.test(path)) return 'shop_edit';
  if (/^\/(shops|coffee-shops)\/[^/]+$/.test(path)) return 'shop_detail';
  if (/^\/roasters\/[^/]+$/.test(path)) return 'roaster_detail';
  if (/^\/coffees\/[^/]+$/.test(path)) return 'coffee_detail';
  if (/^\/users\//.test(path)) return 'user_profile';
  if (/^\/my\//.test(path)) return 'contributions';
  const pages: Record<string, string> = {
    '/': 'landing', '/search': 'discovery', '/shops': 'shops', '/map': 'map',
    '/coffees': 'coffees', '/roasters': 'roasters', '/feed': 'feed', '/check-ins': 'my_check_ins',
    '/profile': 'profile', '/login': 'login', '/register': 'register', '/settings': 'settings',
    '/privacy': 'privacy', '/terms': 'terms', '/error': 'error',
  };
  return pages[path] ?? 'other';
}

/** Only a closed vocabulary leaves the client; unknown/private endpoints become 'other'. */
export function analyticsApiCategory(endpoint: string): string {
  const path = endpoint.split(/[?#]/, 1)[0].toLowerCase();
  if (/\/(?:auth|account|identity|tokens)(?:\/|$)/.test(path)) return 'authentication';
  if (/\/(?:favorites)(?:\/|$)/.test(path)) return 'favorites';
  if (/\/(?:check-ins|checkins|home-check-ins|homecheckins)(?:\/|$)/.test(path)) return 'check_ins';
  if (/\/(?:photos|uploads|media)(?:\/|$)/.test(path)) return 'photos';
  if (/\/(?:coffees|coffeeproducts|coffee-products)(?:\/|$)/.test(path)) return 'coffees';
  if (/\/(?:roasters)(?:\/|$)/.test(path)) return 'roasters';
  if (/\/(?:shops|coffeeshop|coffeeshops|coffee-shops)(?:\/|$)/.test(path)) return 'shops';
  if (/\/(?:feed)(?:\/|$)/.test(path)) return 'feed';
  if (/\/(?:discovery|search|catalog|catalogs)(?:\/|$)/.test(path)) return 'catalog';
  if (/\/(?:users|profile)(?:\/|$)/.test(path)) return 'profile';
  return 'other';
}
