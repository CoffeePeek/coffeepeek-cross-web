import { applyCriteria, filterRoasters, readSearchState, writeSearchState, validateSearch, transferDiscovery, normalizeFilters, safePurchaseUrl } from '../src/utils/catalogSearch';
import type { RoasterCard } from '../src/api/discovery';

test('URL restores criteria and independent discovery pages; changes reset both', () => {
  const state = { q: '  кофе   Ёж ', filters: { brew: ['filter'], budget: { currency: 'BYN', maxDrinkPrice: 10, maxCoffeePrice: 50, coffeeWeightGrams: 250 } }, sort: 'relevance', page: 1, coffeeShopsPage: 3, roastersPage: 2 };
  const restored = readSearchState(writeSearchState(state, 'discovery'), 'discovery');
  expect(restored).toEqual({ ...state, q: 'кофе Ёж' });
  expect(applyCriteria(restored, { filters: {} })).toMatchObject({ page: 1, coffeeShopsPage: 1, roastersPage: 1 });
  expect(writeSearchState({ ...restored, coffeeShopsPage: 4 }, 'discovery').get('roastersPage')).toBe('2');
  expect(transferDiscovery(restored, 'shops').filters).toEqual({ menu: { brew: ['filter'], currency: 'BYN', maxPrice: 10 } });
  expect(transferDiscovery(restored, 'roasters').filters).toEqual({});
  expect(transferDiscovery({ ...restored, filters: { budget: { currency: 'BYN', maxDrinkPrice: 10 } } }, 'roasters').filters).toEqual({});
  expect(transferDiscovery({ ...restored, filters: { budget: { currency: 'BYN', maxCoffeePrice: 50, coffeeWeightGrams: 250 } } }, 'shops').filters).toEqual({});
});

test('roasters search the complete list locally, normalize names and apply tags, favorites and sorting', () => {
  const roaster = (slug: string, name: string | null, availableCoffeeProducts: number | string | null, tags: string[] = []): RoasterCard => ({
    address: { slug, canonicalPath: `/roasters/${slug}`, revision: '1', isAlias: false }, name, photoUrl: null, coverPhoto: null,
    coffeeShopsCount: '2', coffeeProductsCount: '12', availableCoffeeProducts,
    tags: tags.map(slug => ({ slug, name: null, description: null, sortOrder: '1' })),
  });
  const items = [roaster('a', 'Кофе Ёж', '12', ['online', 'wholesale']), roaster('b', 'ЁЖ Ростер', 2, ['online']), roaster('c', null, null), roaster('d', 'Другой', 'string')];
  const state = { q: '  еЖ  ', filters: {}, sort: 'relevance' };
  expect(filterRoasters(items, state).map(item => item.address.slug)).toEqual(['b', 'a']);
  expect(filterRoasters(items, { ...state, filters: { tags: ['online', 'wholesale'] } }).map(item => item.address.slug)).toEqual(['a']);
  expect(filterRoasters(items, { ...state, filters: { excludeTags: ['wholesale'] } }).map(item => item.address.slug)).toEqual(['b']);
  expect(filterRoasters(items, { ...state, filters: { favoritesOnly: true } }, slug => slug === 'a').map(item => item.address.slug)).toEqual(['a']);
  expect(filterRoasters(items, { ...state, filters: { favoritesOnly: true } })).toEqual([]);
  expect(filterRoasters(items, { q: '', filters: {}, sort: 'available_coffees_desc' }).slice(0, 2).map(item => item.address.slug)).toEqual(['a', 'b']);
  expect(filterRoasters(items, { ...state, q: 'нет совпадений' })).toEqual([]);
  const all = Array.from({ length: 25 }, (_, index) => roaster(String(index), `Обжарщик ${index}`, 0));
  expect(filterRoasters(all, { q: '', filters: {}, sort: 'name_asc' })).toHaveLength(25);
  expect(items.map(item => item.address.slug)).toEqual(['a', 'b', 'c', 'd']);
});
test('price sort requires currency and exact weight; filter scopes are strict', () => {
  const state = readSearchState(new URLSearchParams('sort=price_asc'), 'coffees');
  expect(validateSearch(state, 'coffees').sort).toBeDefined();
  expect(validateSearch({ ...state, filters: { currency: 'BYN' } }, 'coffees').sort).toBeDefined();
  expect(validateSearch({ ...state, filters: { currency: 'RUB', weightGrams: 250 } }, 'coffees')).toEqual({});
  expect(validateSearch({ ...state, sort: 'name_asc', filters: { minPrice: 50, maxPrice: 10 } }, 'coffees')).toHaveProperty('currency');
  expect(validateSearch({ ...state, sort: 'name_asc', filters: { tags: ['wholesale'], excludeTags: ['wholesale'] } }, 'roasters')).toHaveProperty('excludeTags');
  expect(validateSearch({ ...state, sort: 'name_asc', filters: { coffee: { roasters: ['a'] } } }, 'roasters')).not.toEqual({});
  expect(validateSearch({ ...state, sort: 'name_asc', filters: { city: 'minsk' } }, 'discovery')).not.toEqual({});
  expect(validateSearch({ ...state, sort: 'name_asc', filters: { budget: { currency: 'BYN', maxCoffeePrice: 50 } } }, 'discovery')['budget.coffeeWeightGrams']).toBeDefined();
});
test('empty selections disappear; saved unknown codes remain explicit; malformed URLs fail', () => {
  expect(normalizeFilters({ brew: [], coffee: {}, availableOnly: false, taste: ['new-code', 'new-code'] })).toEqual({ availableOnly: false, taste: ['new-code'] });
  expect(readSearchState(new URLSearchParams('filters=%7B%22caffeine%22%3A%5B%22new-code%22%5D%7D'), 'coffees').filters).toEqual({ caffeine: ['new-code'] });
  for (const url of ['filters=null', 'filters=[]', 'filters={', 'page=0', 'sort=unknown']) expect(() => readSearchState(new URLSearchParams(url), 'coffees')).toThrow();
  expect(safePurchaseUrl('javascript:alert(1)')).toBeUndefined();
  expect(safePurchaseUrl('https://example.test/coffee')).toBe('https://example.test/coffee');
});
