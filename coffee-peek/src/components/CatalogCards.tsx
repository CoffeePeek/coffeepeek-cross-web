import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CoffeeCard as Coffee, CoffeeOffer, RoasterCard as Roaster, ShopCard as Shop, Photo, FilterGroup, Classification } from '../api/discovery';
import type { PublicAddress } from '../api/publicAddresses';
import { useFavorite } from '../hooks/useFavorites';
import { countryFlagUrl, safePurchaseUrl } from '../utils/catalogSearch';
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
  return `Проверено ${new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
}
export function CatalogPhoto({ photo, name, className = 'aspect-[5/3]', size = 'card', loading = 'lazy' }: { photo: Photo | null | undefined; name: string; className?: string; size?: 'card' | 'detail' | 'thumbnail'; loading?: 'eager' | 'lazy' }) {
  return <div className={`overflow-hidden rounded-xl ${className}`}>{photo
    ? <img src={photo.urls?.[size] || photo.fullUrl} alt={name} loading={loading} className="h-full w-full object-cover" />
    : <ShopPhotoPlaceholder />}</div>;
}
export function FavoriteButton({ kind, address, value, className = catalogButton }: { kind: 'coffee_shop' | 'roaster'; address: PublicAddress | undefined; value?: boolean | null; className?: string }) {
  const { favorite, pending, toggle } = useFavorite(kind, address, value);
  return <button type="button" className={className} style={{ padding: 0, minWidth: 44 }} disabled={!address || pending} aria-pressed={favorite === true}
    aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'} onClick={event => { event.stopPropagation(); toggle(); }}>
    <AppIcon name="heart" filled={favorite === true} size={26} color={favorite ? COLORS.primary : 'currentColor'} style={{ flexShrink: 0 }} /><span className="sr-only">Избранное</span>
  </button>;
}
export function ClassificationBadges({ value, groups, layout = 'chips' }: { value: Classification; groups: FilterGroup[]; layout?: 'chips' | 'details' }) {
  const entries = [
    ['brew', value.defaultBrewPurposes, 'Рекомендуемое приготовление', 'coffee'], ['roast', value.roastLevel, 'Обжарка', 'local_fire_department'],
    ['processing', value.processing, 'Обработка', 'eco'], ['taste', value.tasteGroups, 'Преобладающий профиль', 'sparkle'],
    ['caffeine', value.caffeine, 'Кофеин', 'coffee-bean'], ['acidity', value.acidity, 'Кислотность', 'water_drop'],
    ['fermentation', value.fermentation, 'Ферментация', 'science'], ['composition', value.composition, 'Состав', 'coffee-bean'],
  ] as const;
  const label = (code: string, value: string) => groups.find(group => group.code === code)?.values.find(option => option.code === value)?.name ?? value;
  if (layout === 'details') return <dl className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-4">{entries.flatMap(([code, raw, caption, icon]) => {
    const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return values.length ? [<div key={code} className="flex min-w-0 flex-col">
      <dt className="contents"><span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 dark:bg-[#2D241F]"><AppIcon name={code === 'brew' && values.length === 1 ? `brew:${values[0]}` : icon} size={28} aria-hidden /></span><span className="order-last mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">{caption}</span></dt>
      <dd className="break-words text-sm font-semibold">{values.map(value => label(code, value)).join(', ')}</dd>
    </div>] : [];
  })}</dl>;
  return <div className="flex flex-wrap gap-2">{entries.flatMap(([code, values]) => (Array.isArray(values) ? values : values ? [values] : []).map(value =>
    <span key={`${code}:${value}`} className="rounded-full bg-stone-100 px-3 py-1 text-sm dark:bg-[#1A1412]">{label(code, value)}</span>))}</div>;
}
export function OfferList({ offers, defaults = [], groups = [] }: { offers: CoffeeOffer[]; defaults?: string[]; groups?: FilterGroup[] }) {
  const brewLabel = (value: string) => groups.find(group => group.code === 'brew')?.values.find(option => option.code === value)?.name ?? value;
  return <ul className="grid gap-4 md:grid-cols-2">{offers.map(offer => {
    const href = safePurchaseUrl(offer.sourceUrl);
    return <li key={offer.offerKey} className={`${catalogPanel} flex flex-col gap-4 sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xl font-semibold">{offer.weightGrams === null ? 'Вес не указан' : `${offer.weightGrams} г`}</p>
        <p className="flex items-center gap-2 text-xs font-medium" title="Наличие по последней проверке источника">
          <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${offer.availability === 'InStock' ? 'bg-green-500' : offer.availability === 'OutOfStock' ? 'bg-red-500' : 'bg-stone-400'}`} />
          {({ InStock: 'В наличии', OutOfStock: 'Нет в наличии', Unknown: 'Наличие не подтверждено' })[offer.availability]}
        </p>
      </div>
      <p className="text-2xl font-bold tabular-nums">{offer.price.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {offer.currency}</p>
      {href && <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-stone-900 transition-colors hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" href={href} target="_blank" rel="noopener noreferrer">У продавца<AppIcon name="arrow_forward" size={18} className="-rotate-45" aria-hidden /></a>}
      <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-2 text-xs leading-5">
        <dt className="text-stone-500 dark:text-stone-400">Продавец</dt><dd className="break-words">{offer.sellerName}</dd>
        <dt className="text-stone-500 dark:text-stone-400">Помол</dt><dd className="break-words">{offer.grind ?? 'Не указан'}</dd>
        <dt className="text-stone-500 dark:text-stone-400">Приготовление</dt><dd className="break-words">{offer.brewPurpose ? brewLabel(offer.brewPurpose) : defaults.length ? defaults.map(brewLabel).join(', ') : 'Не подтверждено'}</dd>
        <dt className="text-stone-500 dark:text-stone-400">Источник</dt><dd>{offer.availabilityScope === 'online' ? 'Онлайн' : 'В магазине'}</dd>
        <dt className="text-stone-500 dark:text-stone-400">Проверено</dt><dd>{checkedTime(offer.checkedAtUtc).replace(/^Проверено /, '')}</dd>
      </dl>
      {offer.availability === 'InStock' && <p className="mt-auto text-xs text-stone-500 dark:text-stone-400">Проверка источника не гарантирует остаток.</p>}
    </li>;
  })}</ul>;
}
export function CoffeeCatalogCard({ coffee, groups }: { coffee: Coffee; groups: FilterGroup[] }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const weightControlId = useId();
  const [selectedWeights, setSelectedWeights] = useState<Partial<Record<string, number | null>>>({});
  const label = (group: string, value: string) => groups.find(item => item.code === group)?.values.find(item => item.code === value)?.name ?? value;
  const prices = new Map<string, Map<number | null, { min: number; max: number }>>();
  for (const offer of coffee.matchingOffers) {
    const weights = prices.get(offer.currency) ?? new Map();
    const previous = weights.get(offer.weightGrams);
    weights.set(offer.weightGrams, {
      min: Math.min(previous?.min ?? offer.price, offer.price),
      max: Math.max(previous?.max ?? offer.price, offer.price),
    });
    prices.set(offer.currency, weights);
  }
  const tastes = coffee.classification.tasteGroups.map(value => label('taste', value));
  return <ShopCard coffee={coffee} colors={colors} onSelect={() => navigate(coffee.address.canonicalPath)}>
      <p className="mb-2 flex min-w-0 items-center gap-1.5 text-xs leading-5" style={{ color: colors.textSecondary }} title={coffee.countries.map(country => country.nameRu).join(', ')}>
        {coffee.countries.map(country => countryFlagUrl(country.code) && <img key={country.code} src={countryFlagUrl(country.code)} alt="" width={20} height={15} loading="lazy" className="h-3.5 w-5 shrink-0 rounded-sm object-cover" onError={event => { event.currentTarget.hidden = true; }} />)}
        <span className="truncate">{coffee.countries.map(country => country.nameRu).join(', ') || 'Происхождение не указано'}</span>
      </p>
      {!!tastes.length && <div className="mb-3 flex flex-wrap gap-1.5">{tastes.slice(0, 3).map(taste => <InfoChip key={taste} colors={colors}>{taste}</InfoChip>)}{tastes.length > 3 && <InfoChip colors={colors}>+{tastes.length - 3}<span className="sr-only">: {tastes.slice(3).join(', ')}</span></InfoChip>}</div>}
      <div className="mt-auto space-y-2 border-t pt-3" style={{ borderColor: colors.border }}>
        {[...prices.entries()].map(([currency, offersByWeight]) => {
          const weights = [...offersByWeight.keys()].sort((a, b) => (a ?? Infinity) - (b ?? Infinity));
          const savedWeight = selectedWeights[currency];
          const selectedWeight = savedWeight !== undefined && offersByWeight.has(savedWeight) ? savedWeight : weights[0];
          const price = offersByWeight.get(selectedWeight)!;
          const weightLabel = (weight: number | null) => weight === null ? 'Вес не указан' : `${weight} г`;
          const selectWeight = (weight: number | null) => setSelectedWeights(previous => ({ ...previous, [currency]: weight }));
          const [amount, cents] = price.min.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(',');
          return <div key={currency} className="flex flex-wrap items-center justify-between gap-2">
            <p aria-live="polite" aria-atomic="true" className="flex shrink-0 items-center gap-1.5 font-bold tracking-tight tabular-nums">
              {price.min < price.max && <span className="text-sm font-medium">от </span>}
              <span className="inline-flex items-start gap-0.5"><span className="text-2xl leading-none">{amount}<span className="sr-only">,</span></span><span className="pt-0.5 text-sm leading-none">{cents}</span></span>
              {currency === 'BYN' ? <><BynSign size={22} color="currentColor" /><span className="sr-only">белорусских рублей</span></> : <span className="text-base">{currency}</span>}
            </p>
            {weights.length === 1 ? <span className="ml-auto rounded-full border px-2.5 py-1 text-xs" style={{ borderColor: colors.border, color: colors.textSecondary }}>{weightLabel(selectedWeight)}</span>
              : weights.length > 4 ? <div className="relative ml-auto h-8 rounded-full border focus-within:ring-2 focus-within:ring-primary" style={{ background: colors.background, borderColor: colors.border, color: colors.textPrimary }}>
                <select aria-label={`Вес упаковки ${coffee.name} (${currency})`} value={selectedWeight ?? 'unknown'} onClick={event => event.stopPropagation()} onChange={event => selectWeight(event.target.value === 'unknown' ? null : Number(event.target.value))}
                  className="relative -top-[7px] h-11 rounded-full border-0 bg-transparent px-3 text-xs outline-none">
                  {weights.map(weight => <option key={weight ?? 'unknown'} value={weight ?? 'unknown'}>{weightLabel(weight)}</option>)}
                </select>
              </div>
              : <div role="radiogroup" aria-label={`Вес упаковки ${coffee.name} (${currency})`} onClick={event => event.stopPropagation()} className="ml-auto grid grid-flow-col auto-cols-fr gap-0.5 rounded-full p-0.5" style={{ background: colors.background, border: `1px solid ${colors.border}` }}>
                {weights.map(weight => <label key={weight ?? 'unknown'} className="group relative cursor-pointer after:absolute after:inset-x-0 after:-inset-y-[7px] after:content-['']">
                  <input type="radio" name={`${weightControlId}-${currency}`} value={weight ?? 'unknown'} checked={selectedWeight === weight} onChange={() => selectWeight(weight)} aria-label={weightLabel(weight)} className="peer sr-only" />
                  <span className="flex min-h-[30px] min-w-11 items-center justify-center rounded-full px-2 text-xs font-semibold transition-[background-color,box-shadow] group-hover:bg-primary/10 peer-checked:bg-white peer-checked:text-stone-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-primary dark:peer-checked:bg-stone-600 dark:peer-checked:text-white" style={{ color: selectedWeight === weight ? undefined : colors.textSecondary }}>{weight ?? '—'}</span>
                </label>)}
              </div>}
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
