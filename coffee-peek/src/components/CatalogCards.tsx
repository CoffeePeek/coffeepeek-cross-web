import { Link } from 'react-router-dom';
import { CoffeeBean } from '@phosphor-icons/react';
import type { CoffeeCard as Coffee, CoffeeOffer, RoasterCard as Roaster, ShopCard as Shop, Photo, FilterGroup, Classification } from '../api/discovery';
import type { PublicAddress } from '../api/publicAddresses';
import { useFavorite } from '../hooks/useFavorites';
import { safePurchaseUrl } from '../utils/catalogSearch';
import ShopPhotoPlaceholder from './ShopPhotoPlaceholder';

export const catalogPanel = 'rounded-2xl border border-stone-200 bg-white p-4 dark:border-[#3D2F28] dark:bg-[#2D241F]';
export const catalogButton = 'min-h-11 rounded-xl border border-stone-300 px-4 py-2 font-semibold hover:border-yellow-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 disabled:opacity-50 dark:border-[#4A3D35]';
export function checkedTime(value: string | null | undefined) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Проверка не указана';
  return `Проверено ${new Date(value).toLocaleString()}`;
}
export function CatalogPhoto({ photo, name }: { photo: Photo | null | undefined; name: string }) {
  return <div className="aspect-[5/3] overflow-hidden rounded-xl">{photo
    ? <img src={photo.urls?.card || photo.fullUrl} alt={name} loading="lazy" className="h-full w-full object-cover" />
    : <ShopPhotoPlaceholder />}</div>;
}
export function FavoriteButton({ kind, address, value }: { kind: 'coffee_shop' | 'roaster'; address: PublicAddress; value?: boolean | null }) {
  const { favorite, pending, toggle } = useFavorite(kind, address, value);
  return <button type="button" className={catalogButton} disabled={pending} aria-pressed={favorite === true}
    aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'} onClick={toggle}>
    <span aria-hidden="true">{favorite ? '♥' : '♡'}</span><span className="sr-only">Избранное</span>
  </button>;
}
export function ClassificationBadges({ value, groups }: { value: Classification; groups: FilterGroup[] }) {
  const entries = [
    ['brew', value.defaultBrewPurposes], ['caffeine', value.caffeine], ['roast', value.roastLevel], ['acidity', value.acidity],
    ['processing', value.processing], ['fermentation', value.fermentation], ['taste', value.tasteGroups], ['composition', value.composition],
  ] as const;
  return <div className="flex flex-wrap gap-2">{entries.flatMap(([code, values]) => (Array.isArray(values) ? values : values ? [values] : []).map(value =>
    <span key={`${code}:${value}`} className="rounded-full bg-stone-100 px-3 py-1 text-sm dark:bg-[#1A1412]">{groups.find(group => group.code === code)?.values.find(option => option.code === value)?.name ?? value}</span>))}</div>;
}
export function OfferList({ offers, defaults = [] }: { offers: CoffeeOffer[]; defaults?: string[] }) {
  return <ul className="space-y-3">{offers.map(offer => {
    const href = safePurchaseUrl(offer.sourceUrl);
    return <li key={offer.offerKey} className="rounded-xl border border-stone-200 p-3 text-sm dark:border-[#4A3D35]">
      <p className="text-base font-bold">{offer.weightGrams === null ? 'Вес не указан' : `${offer.weightGrams} г`} · {offer.price.toLocaleString()} {offer.currency}</p>
      <p>{offer.grind ?? 'Помол не указан'} · {offer.brewPurpose ?? (defaults.length ? `Назначение: ${defaults.join(', ')}` : 'Назначение не подтверждено')}</p>
      <p>{offer.sellerName} · {offer.availabilityScope === 'online' ? 'Онлайн' : 'В магазине'}</p>
      <p>{({ InStock: 'В наличии по проверке источника', OutOfStock: 'Нет в наличии', Unknown: 'Наличие не подтверждено' })[offer.availability]}</p>
      <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">{checkedTime(offer.checkedAtUtc)}</p>
      {offer.availability === 'InStock' && <p className="text-xs text-stone-600 dark:text-stone-300">Проверка источника не гарантирует остаток.</p>}
      {href && <a className="mt-2 inline-flex min-h-11 items-center font-semibold text-amber-800 underline dark:text-yellow-400" href={href} target="_blank" rel="noopener noreferrer">У продавца ↗</a>}
    </li>;
  })}</ul>;
}
export function CoffeeCatalogCard({ coffee, groups }: { coffee: Coffee; groups: FilterGroup[] }) {
  const label = (group: string, value: string) => groups.find(item => item.code === group)?.values.find(item => item.code === value)?.name ?? value;
  const prices = new Map<string, { currency: string; weight: number | null; min: number; max: number }>();
  for (const offer of coffee.matchingOffers) {
    const key = `${offer.currency}:${offer.weightGrams}`;
    const previous = prices.get(key);
    prices.set(key, { currency: offer.currency, weight: offer.weightGrams, min: Math.min(previous?.min ?? offer.price, offer.price), max: Math.max(previous?.max ?? offer.price, offer.price) });
  }
  const profile = [...coffee.countries.map(country => country.nameRu), ...coffee.classification.processing.map(value => label('processing', value)), ...coffee.classification.fermentation.map(value => label('fermentation', value))];
  const tastes = coffee.classification.tasteGroups.map(value => label('taste', value));
  return <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-[#3D2F28] dark:bg-[#2D241F]">
    <Link to={coffee.address.canonicalPath} className="block aspect-[6/5] bg-stone-100 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-500 dark:bg-[#241C17]">
      {coffee.coverPhoto ? <img src={coffee.coverPhoto.urls?.card || coffee.coverPhoto.fullUrl} alt={coffee.name} loading="lazy" className="h-full w-full object-contain" /> : <div className="flex h-full flex-col items-center justify-center gap-3 text-stone-400 dark:text-stone-500"><CoffeeBean size={56} weight="light" aria-hidden="true" /><span className="text-xs">Фото пока нет</span></div>}
    </Link>
    <div className="flex flex-1 flex-col gap-3 p-4">
      <Link className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-600 hover:underline dark:text-stone-300" to={coffee.roaster.address.canonicalPath}>{coffee.roaster.name}</Link>
      <Link className="hover:underline" to={coffee.address.canonicalPath}><h3 className="text-lg font-bold leading-snug">{coffee.name}</h3></Link>
      <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-300">{profile.join(' · ') || 'Происхождение и обработка не подтверждены'}</p>
      {!!tastes.length && <div className="flex flex-wrap gap-1.5">{tastes.slice(0, 3).map(taste => <span key={taste} className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold dark:bg-[#1A1412]">{taste}</span>)}{tastes.length > 3 && <span title={tastes.slice(3).join(', ')} className="rounded-full border border-stone-200 px-2 py-1 text-[11px] dark:border-[#4A3D35]">+{tastes.length - 3}<span className="sr-only">: {tastes.slice(3).join(', ')}</span></span>}</div>}
      <div className="mt-auto space-y-2 border-t border-stone-200 pt-3 dark:border-[#3D2F28]">
        {[...prices.entries()].map(([key, price]) => <div key={key} className="flex items-center justify-between gap-2">
          <p className="text-xl font-bold tracking-tight">{price.min < price.max ? 'от ' : ''}{price.min.toLocaleString()} <span className="text-base">{price.currency}</span></p>
          <span className="rounded-full bg-stone-50 px-2.5 py-1 text-xs text-stone-600 dark:bg-[#1A1412] dark:text-stone-300">{price.weight === null ? 'Вес не указан' : `${price.weight} г`}</span>
        </div>)}
        {coffee.sortPrice !== null && <p className="text-xs text-stone-600 dark:text-stone-300">Цена сортировки: {coffee.sortPrice.toLocaleString()} {coffee.matchingOffers[0]?.currency}</p>}
        {!coffee.matchingOffers.length && <p className="text-sm">Подходящих предложений нет.</p>}
        <Link className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-stone-200 text-sm font-semibold shadow-sm hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 dark:border-[#4A3D35] dark:hover:bg-[#1A1412]" to={coffee.address.canonicalPath}>Выбрать вариант <span aria-hidden="true">↗</span></Link>
      </div>
      <details className="text-xs text-stone-600 dark:text-stone-300"><summary className="min-h-11 cursor-pointer py-3">Характеристики и предложения ({coffee.matchingOffers.length})</summary><div className="space-y-3 pb-2"><p>{coffee.productKind === 'green_beans' ? 'Зелёный кофе' : 'Обжаренный кофе'} · {coffee.productForm === 'ground_only' ? 'Молотый' : 'В зёрнах'}</p><ClassificationBadges value={coffee.classification} groups={groups} /><OfferList offers={coffee.matchingOffers} defaults={coffee.classification.defaultBrewPurposes} /></div></details>
      <p className="text-[11px] text-stone-600 dark:text-stone-300">{checkedTime(coffee.catalogCheckedAtUtc)}</p>
    </div>
  </article>;
}
export function RoasterCatalogCard({ roaster, groups }: { roaster: Roaster; groups: FilterGroup[] }) {
  return <article className={`${catalogPanel} space-y-3`}>
    <Link to={roaster.address.canonicalPath}><CatalogPhoto photo={roaster.coverPhoto} name={roaster.name} /><h3 className="mt-3 text-xl font-bold">{roaster.name}</h3></Link>
    <FavoriteButton kind="roaster" address={roaster.address} value={roaster.isFavorite} />
    <div className="flex flex-wrap gap-2">{roaster.tags.map(tag => <span key={tag.slug} title={tag.description ?? undefined} className="rounded-full bg-stone-100 px-3 py-1 text-sm dark:bg-[#1A1412]">{tag.name}</span>)}</div>
    <p>Доступных товаров: {roaster.availableCoffeeProducts}</p>
    {roaster.matchingCoffeeProducts !== null && <p>Подходящих товаров: {roaster.matchingCoffeeProducts}</p>}
    <p className="text-xs text-stone-600 dark:text-stone-300">{checkedTime(roaster.coffeeCatalogUpdatedAtUtc)}</p>
    {roaster.matchingCoffee && <div><p className="mb-2 font-semibold">Подходящий кофе</p><CoffeeCatalogCard coffee={roaster.matchingCoffee} groups={groups} /></div>}
  </article>;
}
export function ShopCatalogCard({ shop }: { shop: Shop }) {
  return <article className={`${catalogPanel} space-y-3`}>
    <Link to={shop.address.canonicalPath}><CatalogPhoto photo={shop.coverPhoto} name={shop.name} /><h3 className="mt-3 text-xl font-bold">{shop.name}</h3></Link>
    <p>{shop.addressLine}</p>
    <p>★ {shop.rating.toFixed(1)} · {shop.reviewCount} отзывов{shop.isOpen !== null ? ` · ${shop.isOpen ? 'Открыто' : 'Закрыто'}` : ''}</p>
    {shop.distanceMeters !== null && <p>{(shop.distanceMeters / 1000).toLocaleString()} км от вас</p>}
    {shop.isVisited === true && <p>Вы здесь были</p>}
    <FavoriteButton kind="coffee_shop" address={shop.address} value={shop.isFavorite} />
    <div className="flex flex-wrap gap-2">{shop.tags.map(tag => <span key={tag.slug} className="rounded-full bg-stone-100 px-3 py-1 text-sm dark:bg-[#1A1412]">{tag.name}</span>)}</div>
    {!!shop.matchingMenuItems.length && <div><p className="font-semibold">Подходящие напитки</p><ul className="space-y-2">{shop.matchingMenuItems.map(item => <li key={`${item.drinkSlug}:${item.volumeMl}:${item.currency}`} className="text-sm">
      {item.name} · {item.brewMethod} · {item.volumeMl === null ? 'Объём не указан' : `${item.volumeMl} мл`} · {item.price === null ? 'Цена не указана' : `${item.price} ${item.currency}`}<p className="text-xs">{checkedTime(item.checkedAtUtc)}</p>
    </li>)}</ul></div>}
  </article>;
}
export function CatalogPagination({ page, totalPages, onChange, label }: { page: number; totalPages: number; onChange: (page: number) => void; label: string }) {
  return <nav aria-label={`Страницы: ${label}`} className="mt-5 flex flex-wrap items-center justify-center gap-3">
    <button type="button" className={catalogButton} disabled={page <= 1} onClick={() => onChange(page - 1)}>Назад</button>
    <span>{page} / {Math.max(1, totalPages)}</span>
    <button type="button" className={catalogButton} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Далее</button>
  </nav>;
}
