import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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
import { AppIcon, BynSign } from './icons';
import { useRoaster } from '../hooks/queries/useCatalogs';

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
export function FavoriteButton({ kind, address, value, className = catalogButton }: { kind: 'coffee_shop' | 'roaster'; address: PublicAddress | undefined; value?: boolean | null; className?: string }) {
  const { favorite, pending, toggle } = useFavorite(kind, address, value);
  return <button type="button" className={className} style={{ padding: 0, minWidth: 44 }} disabled={!address || pending} aria-pressed={favorite === true}
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
  const prices = new Map<string, { weight: number | null; weights: Set<number | null>; min: number; max: number }>();
  for (const offer of coffee.matchingOffers) {
    const previous = prices.get(offer.currency);
    prices.set(offer.currency, {
      weight: previous && previous.min <= offer.price ? previous.weight : offer.weightGrams,
      weights: new Set([...(previous?.weights ?? []), offer.weightGrams]),
      min: Math.min(previous?.min ?? offer.price, offer.price),
      max: Math.max(previous?.max ?? offer.price, offer.price),
    });
  }
  const tastes = coffee.classification.tasteGroups.map(value => label('taste', value));
  return <ShopCard coffee={coffee} colors={colors} onSelect={() => navigate(coffee.address.canonicalPath)}>
      <p className="mb-2 truncate text-xs leading-5" style={{ color: colors.textSecondary }} title={coffee.countries.map(country => country.nameRu).join(', ')}>{coffee.countries.map(country => country.nameRu).join(', ') || 'Происхождение не указано'}</p>
      {!!tastes.length && <div className="mb-3 flex flex-wrap gap-1.5">{tastes.slice(0, 3).map(taste => <InfoChip key={taste} colors={colors}>{taste}</InfoChip>)}{tastes.length > 3 && <InfoChip colors={colors}>+{tastes.length - 3}<span className="sr-only">: {tastes.slice(3).join(', ')}</span></InfoChip>}</div>}
      <div className="mt-auto space-y-2 border-t pt-3" style={{ borderColor: colors.border }}>
        {[...prices.entries()].map(([currency, price]) => {
          const weights = [...price.weights].sort((a, b) => (a ?? Infinity) - (b ?? Infinity)).map(weight => weight === null ? 'Вес не указан' : `${weight} г`).join(', ');
          return <div key={currency} className="flex items-center justify-between gap-2">
            <p className="flex shrink-0 items-center gap-1.5 text-xl font-bold tracking-tight">{price.weights.size > 1 || price.min < price.max ? 'от ' : ''}{price.min.toLocaleString('ru-RU')}{currency === 'BYN' ? <><BynSign size={22} color="currentColor" /><span className="sr-only">белорусских рублей</span></> : <span className="text-base">{currency}</span>}</p>
            <span className="min-w-0 truncate rounded-full border px-2.5 py-1 text-xs" style={{ borderColor: colors.border, color: colors.textSecondary }} title={weights} aria-label={`Доступный вес: ${weights}`}>{price.weight === null ? 'Вес не указан' : `${price.weight} г`}{price.weights.size > 1 && ` +${price.weights.size - 1}`}</span>
          </div>;
        })}
        {!coffee.matchingOffers.length && <p className="text-sm">Подходящих предложений нет.</p>}
      </div>
  </ShopCard>;
}
export function RoasterCatalogCard({ roaster }: { roaster: Roaster }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const name = roaster.name ?? 'Обжарщик';
  const title = useRef<HTMLHeadingElement>(null);
  const [titleOverflow, setTitleOverflow] = useState(0);
  useLayoutEffect(() => {
    const heading = title.current;
    if (!heading) return;
    const measure = () => setTitleOverflow(Math.max(0, (heading.firstElementChild?.scrollWidth ?? 0) - heading.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(heading);
    document.fonts.addEventListener('loadingdone', measure);
    return () => { observer.disconnect(); document.fonts.removeEventListener('loadingdone', measure); };
  }, [name]);
  const { data: details } = useRoaster(roaster.address.slug);
  const address = roaster.address.slug && roaster.address.canonicalPath ? { ...roaster.address, slug: roaster.address.slug, canonicalPath: roaster.address.canonicalPath } : undefined;
  const photo = (roaster.coverPhoto && getPhotoUrl(roaster.coverPhoto, 'card')) || roaster.photoUrl;
  const plural = new Intl.PluralRules('ru');
  const count = (value: number | string | null | undefined) => value == null || value === '' || !Number.isSafeInteger(Number(value)) || Number(value) < 0 ? null : Number(value);
  const shopCount = count(roaster.coffeeShopsCount ?? details?.coffeeShopsCount);
  const productCount = count(roaster.coffeeProductsCount ?? details?.coffeeProductsCount);
  const stats = [
    { label: 'Кофейни используют', icon: 'coffee', count: shopCount, empty: 'Нет кофеен', unknown: 'Кофейни: —', forms: { one: 'кофейня', few: 'кофейни', other: 'кофеен' } },
    { label: 'Товары в каталоге', icon: 'coffee-bean', count: productCount, empty: 'Нет товаров', unknown: 'Товары: —', forms: { one: 'товар', few: 'товара', other: 'товаров' } },
  ];
  const catalogPath = `/coffees?filters=${encodeURIComponent(JSON.stringify({ roasters: [roaster.address.slug], availableOnly: false }))}`;
  const open = () => { if (roaster.address.canonicalPath) navigate(roaster.address.canonicalPath); };
  return (
    <article role={roaster.address.canonicalPath ? 'button' : undefined} tabIndex={roaster.address.canonicalPath ? 0 : undefined} aria-label={`Открыть обжарщика ${name}`}
      onClick={open} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); open(); } }}
      className="roaster-catalog-card flex h-full flex-col rounded-2xl border p-4 outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary"
      style={{ background: colors.surface, borderColor: theme === 'light' ? colors.borderHover : colors.border, color: colors.textPrimary, cursor: roaster.address.canonicalPath ? 'pointer' : undefined }}>
      <div className="mb-3 flex h-32 shrink-0 items-start gap-3">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl" style={{ background: photo ? COLORS.light.surface : theme === 'dark' ? colors.background : colors.badge }}>
          {photo
            ? <img src={photo} alt={name} loading="lazy" decoding="async" className="h-full w-full object-contain" />
            : <AppIcon name="factory" size={48} color={colors.textSecondary} />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 ref={title} className="roaster-card-title text-2xl font-bold leading-7 tracking-tight" title={name} data-overflow={titleOverflow > 0} style={{ '--roaster-title-offset': `${-titleOverflow}px` } as CSSProperties}><span>{name}</span></h3>
          <p className="mt-3 line-clamp-3 text-sm leading-6" style={{ color: colors.textSecondary }}>{details?.about?.trim() || 'Описание пока не добавлено.'}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t pt-2" style={{ borderColor: colors.border }}>
        <dl aria-label="Статистика обжарщика" className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-2 text-xs" style={{ color: colors.textSecondary }}>
          {stats.map((stat, index) => {
            const value = stat.count === null ? stat.unknown : stat.count === 0 ? stat.empty : `${stat.count.toLocaleString('ru-RU')} ${stat.forms[plural.select(stat.count) as 'one' | 'few'] ?? stat.forms.other}`;
            return <div key={stat.label} className="flex items-center gap-1.5 whitespace-nowrap">
              {index > 0 && <span aria-hidden="true" className="mr-1">·</span>}
              <AppIcon name={stat.icon} size={20} className="shrink-0" />
              <dt className="sr-only">{stat.label}</dt><dd>{index === 1 && roaster.address.slug && productCount !== 0
                ? <Link to={catalogPath} aria-label={`Смотреть каталог ${name}`} onClick={event => event.stopPropagation()} className="inline-flex min-h-11 items-center rounded-lg outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary">{value}</Link>
                : <span aria-disabled={index === 1 && productCount === 0 || undefined} title={index === 1 && productCount === 0 ? 'Каталог пока пуст' : undefined}>{value}</span>}</dd>
            </div>;
          })}
        </dl>
        <FavoriteButton kind="roaster" address={address} value={roaster.isFavorite}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-transparent outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary" />
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
