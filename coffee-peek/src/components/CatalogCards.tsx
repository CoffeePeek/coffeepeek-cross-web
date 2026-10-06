import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CoffeeCard as Coffee, CoffeeOffer, RoasterCard as Roaster, ShopCard as Shop, Photo, FilterGroup, Classification } from '../api/discovery';
import type { PublicAddress } from '../api/publicAddresses';
import { useFavorite } from '../hooks/useFavorites';
import { safePurchaseUrl } from '../utils/catalogSearch';
import ShopPhotoPlaceholder from './ShopPhotoPlaceholder';
import ShopCard, { InfoChip } from './ShopCard';
import { useTheme } from '../contexts/ThemeContext';
import { COLORS, getThemeColors } from '../constants/colors';
import { getPhotoUrl } from '../api/coffeeshop';
import { useRoaster } from '../hooks/queries/useCatalogs';
import { AppIcon } from './icons';

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
export function FavoriteButton({ kind, address, value, className = catalogButton }: { kind: 'coffee_shop' | 'roaster'; address: PublicAddress; value?: boolean | null; className?: string }) {
  const { favorite, pending, toggle } = useFavorite(kind, address, value);
  return <button type="button" className={className} style={{ padding: 0, minWidth: 44 }} disabled={pending} aria-pressed={favorite === true}
    aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'} onClick={event => { event.stopPropagation(); toggle(); }}>
    <AppIcon name="heart" filled={favorite === true} size={26} color={favorite ? COLORS.primary : 'currentColor'} style={{ flexShrink: 0 }} /><span className="sr-only">Избранное</span>
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
  const navigate = useNavigate();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const label = (group: string, value: string) => groups.find(item => item.code === group)?.values.find(item => item.code === value)?.name ?? value;
  const prices = new Map<string, { currency: string; weight: number | null; min: number; max: number }>();
  for (const offer of coffee.matchingOffers) {
    const key = `${offer.currency}:${offer.weightGrams}`;
    const previous = prices.get(key);
    prices.set(key, { currency: offer.currency, weight: offer.weightGrams, min: Math.min(previous?.min ?? offer.price, offer.price), max: Math.max(previous?.max ?? offer.price, offer.price) });
  }
  const profile = [...coffee.countries.map(country => country.nameRu), ...coffee.classification.processing.map(value => label('processing', value)), ...coffee.classification.fermentation.map(value => label('fermentation', value))];
  const tastes = coffee.classification.tasteGroups.map(value => label('taste', value));
  return <ShopCard coffee={coffee} colors={colors} onSelect={() => navigate(coffee.address.canonicalPath)}>
      <Link className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-600 hover:underline dark:text-stone-300" to={coffee.roaster.address.canonicalPath}>{coffee.roaster.name}</Link>
      <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-300">{profile.join(' · ') || 'Происхождение и обработка не подтверждены'}</p>
      {!!tastes.length && <div className="flex flex-wrap gap-1.5">{tastes.slice(0, 3).map(taste => <InfoChip key={taste} colors={colors}>{taste}</InfoChip>)}{tastes.length > 3 && <InfoChip colors={colors}>+{tastes.length - 3}<span className="sr-only">: {tastes.slice(3).join(', ')}</span></InfoChip>}</div>}
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
  </ShopCard>;
}
export function RoasterCatalogCard({ roaster }: { roaster: Roaster }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  // ponytail: search has no shop count; reuse cached details until the list DTO includes it.
  const details = useRoaster(roaster.address.slug);
  const shopCount = details.data?.shops?.length;
  const plural = new Intl.PluralRules('ru').select(shopCount ?? 0);
  const shopsLabel = plural === 'one' ? 'кофейня использует' : plural === 'few' ? 'кофейни используют' : 'кофеен используют';
  const open = () => navigate(roaster.address.canonicalPath);
  return (
    <article role="button" tabIndex={0} aria-label={`Открыть обжарщика ${roaster.name}`}
      onClick={open} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); open(); } }}
      className="flex flex-col rounded-[28px] border p-4 shadow-sm outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-yellow-500 sm:p-5"
      style={{ background: colors.surface, borderColor: colors.border, color: colors.textPrimary, cursor: 'pointer' }}>
      <div className="flex items-center gap-4">
        <div className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl sm:h-24 sm:w-24 ${roaster.coverPhoto ? 'bg-white' : ''}`}>
          {roaster.coverPhoto
            ? <img src={getPhotoUrl(roaster.coverPhoto, 'card')} alt={roaster.name} loading="lazy" decoding="async" className="h-full w-full object-contain" />
            : <AppIcon name="factory" size={40} color={colors.textSecondary} />}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 break-words text-lg font-semibold leading-snug sm:text-xl">{roaster.name}</h3>
            <FavoriteButton kind="roaster" address={roaster.address} value={roaster.isFavorite}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500" />
          </div>
          {details.data?.about?.trim() && <p className="line-clamp-2 text-sm leading-relaxed" style={{ color: colors.textSecondary }}>{details.data.about.trim()}</p>}
          {!!roaster.tags.length && <div className="flex flex-wrap gap-2">{roaster.tags.map(tag => <span key={tag.slug} title={tag.description ?? undefined} className="rounded-full bg-stone-100 px-3 py-1 text-sm dark:bg-[#1A1412]" style={{ color: colors.textSecondary }}>{tag.name}</span>)}</div>}
        </div>
      </div>
      <div className="mt-4 space-y-2 border-t pt-3 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
        <div className="flex items-center gap-2">
          <AppIcon name="coffee" size={20} style={{ flexShrink: 0 }} />
          {shopCount !== undefined ? <span>{shopCount} {shopsLabel} это зерно</span>
            : details.isError ? <><span>Число кофеен недоступно</span><button type="button" aria-label="Повторить загрузку числа кофеен" className="min-h-11 underline" onClick={event => { event.stopPropagation(); void details.refetch(); }}>Повторить</button></>
            : <span role="status">Загрузка числа кофеен…</span>}
        </div>
        <p className="flex items-center gap-2"><AppIcon name="coffee-bean" size={20} style={{ flexShrink: 0 }} />Доступные товары: {roaster.availableCoffeeProducts}</p>
      </div>
    </article>
  );
}
export function ShopCatalogCard({ shop }: { shop: Shop }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const tagRow = useRef<HTMLDivElement>(null);
  const [visibleTags, setVisibleTags] = useState(shop.tags.length);
  const hiddenTags = shop.tags.slice(visibleTags);
  useLayoutEffect(() => {
    const row = tagRow.current;
    if (!row || !shop.tags.length) return;
    const fitTags = () => {
      const chips = Array.from(row.children) as HTMLElement[];
      const badge = chips.pop()!;
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const widths = chips.map(chip => chip.getBoundingClientRect().width);
      if (widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1) <= row.clientWidth) {
        setVisibleTags(widths.length); return;
      }
      const badgeText = badge.firstChild!;
      const original = badgeText.nodeValue;
      let width = 0, count = 0;
      for (let index = 0; index < widths.length; index++) {
        badgeText.nodeValue = `+${widths.length - index - 1}`;
        const nextWidth = width + widths[index] + (index ? gap : 0);
        if (nextWidth + gap + badge.getBoundingClientRect().width > row.clientWidth) break;
        width = nextWidth; count = index + 1;
      }
      badgeText.nodeValue = original;
      setVisibleTags(count);
    };
    fitTags();
    const observer = new ResizeObserver(fitTags);
    observer.observe(row);
    document.fonts.addEventListener('loadingdone', fitTags);
    return () => { observer.disconnect(); document.fonts.removeEventListener('loadingdone', fitTags); };
  }, [shop.tags, theme]);
  return <ShopCard colors={getThemeColors(theme)} onSelect={() => navigate(shop.address.canonicalPath)} shop={{
    id: shop.address.slug, name: shop.name, publicAddress: shop.address, canonicalPath: shop.address.canonicalPath,
    address: shop.addressLine, shopPhotos: shop.coverPhoto ? [shop.coverPhoto.urls?.card || shop.coverPhoto.fullUrl] : [],
    rating: shop.rating, reviewCount: shop.reviewCount, isOpen: shop.isOpen ?? undefined,
    isVisited: shop.isVisited ?? undefined, isFavorite: shop.isFavorite,
  }}>
    {shop.distanceMeters !== null && <p className="flex items-center gap-1.5"><AppIcon name="person-simple-walk" size={18} />{(shop.distanceMeters / 1000).toLocaleString()} км от вас</p>}
    {!!shop.tags.length && <div ref={tagRow} aria-label="Теги кофейни" className="relative flex gap-2 overflow-hidden whitespace-nowrap">
      {shop.tags.map((tag, index) => <span key={tag.slug} aria-hidden={index >= visibleTags} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-sm dark:bg-[#1A1412] ${index >= visibleTags ? 'pointer-events-none invisible absolute' : ''}`}><AppIcon name={`tag:${tag.slug}`} size={16} />{tag.name}</span>)}
      <span aria-hidden={!hiddenTags.length} title={hiddenTags.map(tag => tag.name).join(', ')} className={`shrink-0 rounded-full bg-stone-100 px-3 py-1 text-sm dark:bg-[#1A1412] ${hiddenTags.length ? '' : 'pointer-events-none invisible absolute'}`}>
        {`+${hiddenTags.length}`}<span className="sr-only">: {hiddenTags.map(tag => tag.name).join(', ')}</span>
      </span>
    </div>}
    {!!shop.matchingMenuItems.length && <div><p className="font-semibold">Подходящие напитки</p><ul className="space-y-2">{shop.matchingMenuItems.map(item => <li key={`${item.drinkSlug}:${item.volumeMl}:${item.currency}`} className="text-sm">
      {item.name} · {item.brewMethod} · {item.volumeMl === null ? 'Объём не указан' : `${item.volumeMl} мл`} · {item.price === null ? 'Цена не указана' : `${item.price} ${item.currency}`}<p className="text-xs">{checkedTime(item.checkedAtUtc)}</p>
    </li>)}</ul></div>}
  </ShopCard>;
}
export function CatalogPagination({ page, totalPages, onChange, label }: { page: number; totalPages: number; onChange: (page: number) => void; label: string }) {
  return <nav aria-label={`Страницы: ${label}`} className="mt-5 flex flex-wrap items-center justify-center gap-3">
    <button type="button" className={catalogButton} disabled={page <= 1} onClick={() => onChange(page - 1)}>Назад</button>
    <span>{page} / {Math.max(1, totalPages)}</span>
    <button type="button" className={catalogButton} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Далее</button>
  </nav>;
}
