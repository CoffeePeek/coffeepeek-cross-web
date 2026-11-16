import type { BrowseCity } from '../lib/localCity';
import { distanceKm } from './distance';
import type { DeviceLocation } from './geolocation';

// City centres from https://www.geonames.org/BY/largest-cities-in-belarus.html (CC BY 4.0).
// Radii approximate the area in which we can suggest these cities.
const cities: { names: string[]; center: [number, number]; radiusKm: number }[] = [
  { names: ['Минск', 'Мінск', 'minsk'], center: [27.5667, 53.9], radiusKm: 13 },
  { names: ['Гомель', 'gomel', 'homyel', 'homel'], center: [30.975, 52.434], radiusKm: 9 },
  { names: ['Гродно', 'Гродна', 'grodno', 'hrodna'], center: [23.829, 53.676], radiusKm: 8 },
  { names: ['Витебск', 'Віцебск', 'vitebsk', 'vitsebsk'], center: [30.205, 55.190], radiusKm: 8 },
  { names: ['Могилёв', 'Магілёў', 'mogilev', 'mahilyow'], center: [30.340, 53.909], radiusKm: 8 },
  { names: ['Брест', 'Брэст', 'brest'], center: [23.717, 52.109], radiusKm: 9 },
  { names: ['Бобруйск', 'Бабруйск', 'bobruysk', 'babruysk'], center: [29.205, 53.147], radiusKm: 7 },
  { names: ['Барановичи', 'Баранавічы', 'baranovichi', 'baranavichy'], center: [26.008, 53.133], radiusKm: 6 },
  { names: ['Борисов', 'Барысаў', 'borisov', 'barysaw'], center: [28.505, 54.228], radiusKm: 6 },
  { names: ['Пинск', 'Пінск', 'pinsk'], center: [26.067, 52.122], radiusKm: 6 },
];

const normalize = (name: string) => name.trim().toLowerCase().replaceAll('ё', 'е');

function findGeography(city: BrowseCity) {
  const keys = [normalize(city.id), normalize(city.name)];
  return cities.find(({ names }) => names.some(name => keys.includes(normalize(name))));
}

export function getCityCenter(city: BrowseCity): [number, number] | undefined {
  return findGeography(city)?.center;
}

export function findCityAtLocation(catalog: BrowseCity[], { coords }: DeviceLocation): BrowseCity | undefined {
  const { latitude, longitude, accuracy } = coords;
  if (accuracy === undefined || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 3000) return undefined;
  const geography = cities.find(({ center, radiusKm }) =>
    distanceKm(latitude, longitude, center[1], center[0]) + accuracy / 1000 <= radiusKm);
  return geography ? catalog.find(city => findGeography(city) === geography) : undefined;
}
