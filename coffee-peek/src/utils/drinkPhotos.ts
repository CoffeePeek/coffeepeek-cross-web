import type { SavedDrink } from '../api/consumedDrinks';
import { savedDrinkName } from './consumedDrinks';

// Temporary local photos until the drink catalog supplies its own images.
export function getMockDrinkPhoto(drink: SavedDrink): string {
  const name = `${drink.drinkSlug ?? ''} ${savedDrinkName(drink, 'ru')} ${savedDrinkName(drink, 'en')}`.toLowerCase();
  if (/matcha|матча|маття/.test(name)) return '/images/drinks/matcha.jpg';
  if (/espresso|эспрессо|filter|фильтр|американо|americano|v60|batch|chemex|кемекс/.test(name)) return '/images/drinks/espresso.jpg';
  return '/images/drinks/cappuccino.jpg';
}
