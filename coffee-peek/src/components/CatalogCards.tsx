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
import { brand } from '../design-system';
import { getPhotoUrl } from '../api/coffeeshop';
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
  const name = roaster.name ?? 'Обжарщик';
  const address = roaster.address.slug && roaster.address.canonicalPath ? { ...roaster.address, slug: roaster.address.slug, canonicalPath: roaster.address.canonicalPath } : undefined;
  const photo = (roaster.coverPhoto && getPhotoUrl(roaster.coverPhoto, 'card')) || roaster.photoUrl;
  const accent = theme === 'dark' ? brand.goldWarm : colors.textPrimary;
  const count = (value: number | string | null | undefined) => {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number.toLocaleString('ru-RU') : '—';
  };
  const stats = [
    { label: 'Кофейни используют', icon: 'coffee', value: roaster.coffeeShopsCount },
    { label: 'Товары в каталоге', icon: 'coffee-bean', value: roaster.coffeeProductsCount },
  ];
  const catalogPath = `/coffees?filters=${encodeURIComponent(JSON.stringify({ roasters: [roaster.address.slug], availableOnly: false }))}`;
  const open = () => { if (roaster.address.canonicalPath) navigate(roaster.address.canonicalPath); };
  return (
    <article role={roaster.address.canonicalPath ? 'button' : undefined} tabIndex={roaster.address.canonicalPath ? 0 : undefined} aria-label={`Открыть обжарщика ${name}`}
      onClick={open} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); open(); } }}
      className="flex flex-col rounded-2xl border p-3 outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{ background: colors.surface, borderColor: theme === 'light' ? colors.borderHover : colors.border, color: colors.textPrimary, cursor: roaster.address.canonicalPath ? 'pointer' : undefined }}>
      <div className="grid grid-cols-[64px_minmax(0,1fr)_44px] items-start gap-x-3 gap-y-1.5">
        <div className="row-span-2 flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl" style={{ background: photo ? COLORS.light.surface : theme === 'dark' ? colors.background : colors.badge }}>
          {photo
            ? <img src={photo} alt={name} loading="lazy" decoding="async" className="h-full w-full object-contain" />
            : <AppIcon name="factory" size={28} color={colors.textSecondary} />}
        </div>
        <div className="min-w-0 self-center">
          <h3 className="break-words text-xl font-bold leading-tight tracking-tight">{name}</h3>
        </div>
        <FavoriteButton kind="roaster" address={address} value={roaster.isFavorite}
          className="row-span-2 flex h-11 w-11 items-center justify-center rounded-full border border-border-light bg-transparent outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary dark:border-[#4A3D35]" />
      </div>
      <dl aria-label="Статистика обжарщика" className="mb-2.5 mt-3 grid grid-cols-2 gap-2">
        {stats.map(stat => <div key={stat.label} className="flex items-center gap-2 rounded-xl border p-2" style={{ background: theme === 'dark' ? colors.background : colors.surfaceAlt, borderColor: theme === 'dark' ? colors.borderHover : colors.border }}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: theme === 'dark' ? colors.surface : undefined, color: theme === 'dark' ? accent : colors.textSecondary }}><AppIcon name={stat.icon} size={22} /></span>
          <div className="min-w-0"><dt className="text-xs leading-tight" style={{ color: colors.textSecondary }}>{stat.label}</dt><dd className="mt-0.5 text-[22px] font-semibold leading-none tracking-tight">{count(stat.value)}</dd></div>
        </div>)}
      </dl>
      {roaster.address.slug && <Link to={catalogPath} onClick={event => event.stopPropagation()} className="mt-auto flex min-h-11 items-center justify-between gap-3 border-t pt-2 outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-primary" style={{ borderColor: theme === 'dark' ? colors.borderHover : colors.border }}>
        <div><span className="text-sm font-semibold" style={{ color: accent }}>Смотреть каталог</span><span className="mt-0.5 block text-xs" style={{ color: colors.textSecondary }}>Кофе этого обжарщика</span></div>
        <AppIcon name="caret-right" size={20} color={theme === 'dark' ? accent : brand.goldWarmHover} className="shrink-0" />
      </Link>}
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
