import type { SavedDrink } from '../api/consumedDrinks';

export function drinkSelection(drinkSlug?: string | null, customDrinkName?: string | null) {
  if (!drinkSlug) return {};
  if (drinkSlug !== 'other') return { drinkSlug };
  const name = customDrinkName?.trim() || '';
  if (!name || name.length > 100) throw new Error('Укажите название напитка от 1 до 100 символов');
  return { drinkSlug, customDrinkName: name };
}

export function savedDrinkName(drink: SavedDrink, language = typeof document === 'undefined' ? 'ru' : document.documentElement.lang) {
  if (drink.drinkSlug === 'other' && drink.customDrinkName) return drink.customDrinkName;
  return language.toLowerCase().startsWith('en')
    ? drink.drinkNameEn || drink.drinkNameRu || drink.customDrinkName || ''
    : drink.drinkNameRu || drink.drinkNameEn || drink.customDrinkName || '';
}

export function displayDrinkName(drink: SavedDrink, language = typeof document === 'undefined' ? 'ru' : document.documentElement.lang) {
  return savedDrinkName(drink, language) || (language.toLowerCase().startsWith('en') ? 'Not specified' : 'Не указан');
}
