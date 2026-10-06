import { Link } from 'react-router-dom';
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
  return <article className={`${catalogPanel} space-y-3`}>
    <Link to={coffee.address.canonicalPath}><CatalogPhoto photo={coffee.coverPhoto} name={coffee.name} /><h3 className="mt-3 text-xl font-bold">{coffee.name}</h3></Link>
    <Link className="inline-flex min-h-11 items-center underline" to={coffee.roaster.address.canonicalPath}>{coffee.roaster.name}</Link>
    <p className="text-sm">{coffee.productKind === 'green_beans' ? 'Зелёный кофе' : 'Обжаренный кофе'} · {coffee.productForm === 'ground_only' ? 'Молотый' : 'В зёрнах'}</p>
    <p className="text-sm">{coffee.countries.map(country => country.nameRu).join(', ') || 'Происхождение не подтверждено'}</p>
    <ClassificationBadges value={coffee.classification} groups={groups} />
    {coffee.sortPrice !== null && <p className="text-sm">Цена сортировки: {coffee.sortPrice.toLocaleString()} {coffee.matchingOffers[0]?.currency}</p>}
    <OfferList offers={coffee.matchingOffers} defaults={coffee.classification.defaultBrewPurposes} />
    {!coffee.matchingOffers.length && <p>Подходящих предложений нет.</p>}
    <p className="text-xs text-stone-600 dark:text-stone-300">{checkedTime(coffee.catalogCheckedAtUtc)}</p>
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
