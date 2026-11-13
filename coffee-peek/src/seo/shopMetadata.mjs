import minsk from '../constants/minskCatalog.json' with { type: 'json' };

const cities = {
  minsk: { name: 'Минск', country: 'BY' },
  lida: { name: 'Лида', country: 'BY' },
  vitebsk: { name: 'Витебск', country: 'BY' },
  grodno: { name: 'Гродно', country: 'BY' },
  mogilyov: { name: 'Могилёв', country: 'BY' },
  brest: { name: 'Брест', country: 'BY' },
  gomel: { name: 'Гомель', country: 'BY' },
  moskva: { name: 'Москва', country: 'RU' },
  slutsk: { name: 'Слуцк', country: 'BY' },
};
const days = [
  ['Monday', 'Понедельник'],
  ['Tuesday', 'Вторник'],
  ['Wednesday', 'Среда'],
  ['Thursday', 'Четверг'],
  ['Friday', 'Пятница'],
  ['Saturday', 'Суббота'],
  ['Sunday', 'Воскресенье'],
];
const ratingFormatter = new Intl.NumberFormat('ru-BY', { maximumFractionDigits: 2 });
const listFormatter = new Intl.ListFormat('ru-BY');
const minutesPerDay = 24 * 60;

function text(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function citySlug(shop) {
  return shop.city?.slug ?? shop.cityId;
}

function cityInfo(shop) {
  const slug = citySlug(shop);
  return Object.hasOwn(cities, slug) ? cities[slug] : undefined;
}

function shopAddress(shop) {
  const city = cityInfo(shop);
  const street = text(shop.location?.address) || text(shop.address);
  const streetParts = street.toLowerCase().split(',').map(part => part.trim().replace(/^г\.?\s*/i, ''));
  const cityName = city?.name.toLowerCase();
  const containsCity = cityName && streetParts.some(part => part === cityName || part.startsWith(`${cityName} `));
  return [containsCity ? '' : city?.name, street].filter(Boolean).join(', ');
}

export function getShopTitle(shop) {
  const name = text(shop.name) || 'Кофейня';
  const location = shopAddress(shop);
  return location ? `${name} — ${location}` : name;
}

export function getShopCollectionLinks(shop) {
  if (citySlug(shop) !== minsk.slug) return [];
  const links = [];
  if (text(shop.type).toLowerCase() === minsk.collections.specialty.filters.type) links.push(minsk.collections.specialty);
  if (Array.isArray(shop.tags) && shop.tags.some(tag => tag?.slug === minsk.collections['laptop-friendly'].filters.tags[0])) {
    links.push(minsk.collections['laptop-friendly']);
  }
  return links;
}

export function getShopUtcOffsetMinutes(shop) {
  // The current catalog cities in Belarus and Moscow both observe UTC+03:00.
  return cityInfo(shop) ? 180 : undefined;
}

function dayIndex(schedule) {
  const value = String(schedule.dayOfWeek ?? '').trim().toLowerCase();
  if (/^[0-6]$/.test(value)) {
    // The API uses System.DayOfWeek numbers with Sunday at 0. Older flat
    // schedules use the same Monday-first index as the web UI.
    return Array.isArray(schedule.intervals) ? (Number(value) + 6) % 7 : Number(value);
  }
  return days.findIndex(([name]) => name.toLowerCase() === value || name.slice(0, 3).toLowerCase() === value);
}

function parseTime(value) {
  const match = text(value).match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
}

function formatTime(minutes) {
  const local = minutes % minutesPerDay;
  return `${String(Math.floor(local / 60)).padStart(2, '0')}:${String(local % 60).padStart(2, '0')}`;
}

export function getShopOpeningHours(shop) {
  const offset = getShopUtcOffsetMinutes(shop);
  if (offset === undefined || !Array.isArray(shop.schedules)) return [];
  return shop.schedules.flatMap(schedule => {
    if (!schedule || schedule.isClosed) return [];
    const day = dayIndex(schedule);
    if (day < 0) return [];
    const intervals = Array.isArray(schedule.intervals) ? schedule.intervals : [schedule];
    return intervals.flatMap(interval => {
      const open = parseTime(interval?.openTime);
      const close = parseTime(interval?.closeTime);
      if (open === undefined || close === undefined || open === close) return [];
      const localOpen = open + offset;
      return [{
        day: (day + Math.floor(localOpen / minutesPerDay)) % days.length,
        opens: formatTime(localOpen),
        closes: formatTime(close + offset),
      }];
    });
  }).sort((a, b) => a.day - b.day || a.opens.localeCompare(b.opens));
}

export function getShopLocalWeekday(shop) {
  const offset = getShopUtcOffsetMinutes(shop) ?? -new Date().getTimezoneOffset();
  const local = new Date(Date.now() + offset * 60_000);
  return (local.getUTCDay() + 6) % days.length;
}

export function renderShopOpeningHours(shop, escapeHtml) {
  const hours = getShopOpeningHours(shop);
  if (!hours.length) return '';
  const rows = days.map(([, label], day) => {
    const intervals = hours.filter(interval => interval.day === day);
    if (!intervals.length) return '';
    const ranges = intervals.map(({ opens, closes }) =>
      `<time datetime="${opens}">${opens}</time>–<time datetime="${closes}">${closes}</time>`).join(', ');
    return `<div><dt>${escapeHtml(label)}</dt><dd>${ranges}</dd></div>`;
  }).join('');
  return `<section><h2>Часы работы</h2><dl>${rows}</dl></section>`;
}

export function buildShopMetadata(shop, canonical) {
  const name = text(shop.name) || 'Кофейня';
  const title = getShopTitle(shop);
  const city = cityInfo(shop);
  const address = shopAddress(shop);
  const streetAddress = text(shop.location?.address) || text(shop.address);
  const images = (shop.photos ?? []).map(photo => text(photo?.urls?.detail) || text(photo?.fullUrl)).filter(Boolean);
  const hours = getShopOpeningHours(shop);
  const menuAvailable = shop.menu?.items?.some(item => item?.availability === 'Present')
    || shop.menu?.photos?.some(photo => photo?.fullUrl);
  const rating = shop.rating;
  const hasRating = Number.isFinite(rating) && rating >= 1 && rating <= 5 && shop.checkInCount > 0;
  const details = [
    images.length ? 'фото' : '',
    menuAvailable ? 'меню' : '',
    hours.length ? 'часы работы' : '',
  ].filter(Boolean);
  const fallback = [
    `Кофейня «${name}».`,
    address ? `Адрес: ${address}.` : '',
    hasRating ? `Оценка посетителей: ${ratingFormatter.format(rating)} из 5.` : '',
    details.length ? `${listFormatter.format(details).replace(/^./u, first => first.toUpperCase())} на CoffeePeek.` : '',
  ].filter(Boolean).join(' ');
  const description = text(shop.description) || fallback;
  const { latitude, longitude } = shop.location ?? {};
  const hasGeo = Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    name,
    description,
    url: canonical,
    image: images.length ? images : undefined,
    address: streetAddress || city ? {
      '@type': 'PostalAddress',
      streetAddress: streetAddress || undefined,
      addressLocality: city?.name,
      addressCountry: city?.country,
    } : undefined,
    geo: hasGeo ? { '@type': 'GeoCoordinates', latitude, longitude } : undefined,
    openingHoursSpecification: hours.length ? hours.map(({ day, opens, closes }) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: days[day][0],
      opens,
      closes,
    })) : undefined,
    // checkInCount includes unrated and repeat visits; the API has no rating count.
  };
  return { title, description, structuredData };
}
