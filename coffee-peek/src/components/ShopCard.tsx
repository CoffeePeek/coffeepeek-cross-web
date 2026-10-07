import React, { memo, useState } from 'react';
import { type CoffeeShop, getPhotoUrl } from '../api/coffeeshop';
import { COLORS } from '../constants/colors';
import { useFavorite } from '../hooks/useFavorites';
import { distanceKm, formatDistance } from '../utils/distance';
import { getPriceRangeTier } from '../utils/priceRange';
import { isShopOpenNow } from '../utils/shopUtils';
import { AppIcon, BeanPriceMarks, StarIcon } from './icons';
import ShopPhotoPlaceholder from './ShopPhotoPlaceholder';
import type { CoffeeCard, RoasterCard } from '../api/discovery';

interface ShopCardColors {
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  background: string;
}

type ShopCardProps = {
  colors: ShopCardColors;
  userLocation?: { latitude: number; longitude: number } | null;
  onSelect: (shopId: string) => void;
  children?: React.ReactNode;
} & ({ shop: CoffeeShop; coffee?: never; roaster?: never } | { shop?: never; coffee: CoffeeCard; roaster?: never } | { shop?: never; coffee?: never; roaster: RoasterCard });

function extractPhotos(shop: CoffeeShop): string[] {
  if (shop.shopPhotos?.length) return shop.shopPhotos.filter(Boolean);
  const raw = shop as unknown as Record<string, unknown>;
  if (Array.isArray(raw.photos)) {
    return raw.photos.map(photo => {
      if (typeof photo === 'string') return photo;
      if (photo && typeof photo === 'object') return getPhotoUrl(photo as Parameters<typeof getPhotoUrl>[0], 'card');
      return '';
    }).filter(Boolean);
  }
  return [];
}

const SHOP_TYPE_LABELS: Record<string, string> = {
  Specialty: 'Specialty', specialty: 'Specialty',
  CoffeeBar: 'Кофейня', coffee_bar: 'Кофейня',
  Cafe: 'Кафе', cafe: 'Кафе',
};

const ShopCard: React.FC<ShopCardProps> = memo(({ shop, coffee, roaster, colors, userLocation, onSelect, children }) => {
  const [hovered, setHovered] = useState(false);
  const publicAddress = roaster?.address.slug && roaster.address.canonicalPath ? { ...roaster.address, slug: roaster.address.slug, canonicalPath: roaster.address.canonicalPath } : shop?.publicAddress;
  const { favorite, pending, toggle } = useFavorite(roaster ? 'roaster' : 'coffee_shop', publicAddress, roaster ? roaster.isFavorite : shop?.isFavorite);
  const name = coffee?.name ?? roaster?.name ?? shop?.name ?? 'Обжарщик';
  const product = coffee ?? roaster;
  const photos = product ? [(product.coverPhoto && getPhotoUrl(product.coverPhoto, 'card')) || roaster?.photoUrl].filter((url): url is string => !!url) : extractPhotos(shop!);
  const raw = shop as unknown as Record<string, unknown>;
  const brewMethods = Array.isArray(raw?.brewMethods) ? raw.brewMethods as Array<{ id?: string; name: string }> : [];
  const roasters = coffee ? [{ name: coffee.roaster.name, photoUrl: coffee.roaster.coverPhoto ? getPhotoUrl(coffee.roaster.coverPhoto, 'thumbnail') : null }]
    : Array.isArray(raw?.roasters) ? raw.roasters as Array<{ id?: string; name: string; photoUrl?: string | null }> : [];
  const openNow = shop ? isShopOpenNow(shop) : undefined;
  const priceTier = getPriceRangeTier(shop?.priceRange);
  const address = shop?.location?.address || shop?.address || shop?.cityName || '';
  const latitude = shop?.location?.latitude ?? shop?.latitude;
  const longitude = shop?.location?.longitude ?? shop?.longitude;
  const distance = userLocation && latitude !== undefined && longitude !== undefined
    ? distanceKm(userLocation.latitude, userLocation.longitude, latitude, longitude)
    : null;
  const type = shop?.type ? (SHOP_TYPE_LABELS[shop.type] ?? shop.type) : '';
  const showRating = (shop?.rating ?? 0) > 0;

  const open = () => { const slug = product?.address.slug ?? shop?.id; if (slug) onSelect(slug); };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Открыть ${coffee ? 'кофе' : roaster ? 'обжарщика' : 'кофейню'} ${name}`}
      onClick={event => { if ((event.target as HTMLElement).closest('article') === event.currentTarget) open(); }}
      onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); open(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`overflow-hidden rounded-[28px] border outline-none transition-transform focus-visible:ring-2 focus-visible:ring-yellow-500 ${coffee ? 'flex h-full flex-col' : ''}`}
      style={{
        background: colors.surface,
        borderColor: hovered ? `${COLORS.primary}70` : colors.border,
        cursor: 'pointer',
        boxShadow: hovered ? '0 12px 32px rgba(0,0,0,.22)' : '0 3px 14px rgba(0,0,0,.08)',
        transform: hovered ? 'translateY(-2px)' : undefined,
      }}
    >
      <div className="relative aspect-[16/9] shrink-0 overflow-hidden" style={{ background: coffee ? `linear-gradient(180deg, ${colors.border}, ${colors.surface} 65%, ${colors.border})` : undefined }}>
        {photos[0] ? (
          <img src={photos[0]} alt={name} loading="lazy" decoding="async" className={`h-full w-full ${coffee || roaster ? 'object-contain' : 'object-cover'} transition-transform duration-500`} style={{ transform: hovered && !roaster ? 'scale(1.035)' : undefined }} />
        ) : roaster ? <div className="flex h-full w-full items-center justify-center" style={{ background: colors.background }}><AppIcon name="factory" size={64} color={colors.textSecondary} /></div> : <ShopPhotoPlaceholder />}
        {!coffee && <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/15" />}

        {shop?.isNew && (
          <span className="absolute left-3 top-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-black/70 px-3 text-xs font-bold text-white backdrop-blur-md">
            <AppIcon name="auto_awesome" size={15} color={COLORS.primary} />
            Новое
          </span>
        )}

        {(shop || roaster) && <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {showRating && shop && (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-black/70 px-3 text-xs font-bold text-white backdrop-blur-md" aria-label={`Рейтинг ${shop.rating?.toFixed(1)}`}>
              <StarIcon filled size={16} color={COLORS.primary} />
              {shop.rating?.toFixed(1)}
              {shop.reviewCount ? <span className="font-medium text-white/75">({shop.reviewCount})</span> : null}
            </span>
          )}
          <button
            type="button"
            aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
            disabled={pending}
            onKeyDown={event => event.stopPropagation()}
            onClick={event => { event.stopPropagation(); toggle(); }}
            className="flex h-11 w-11 items-center justify-center rounded-full border-0 bg-black/80 p-0 backdrop-blur-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
          >
            <AppIcon name="favorite" filled={favorite === true} size={26} color={favorite ? '#EAB308' : '#FFFFFF'} />
          </button>
        </div>}

        {roasters.length > 0 && (
          <div className="absolute bottom-3 right-4 flex -space-x-3" aria-label={`Обжарщики: ${roasters.map(roaster => roaster.name).join(', ')}`}>
            {roasters.slice(0, 3).map((roaster, index) => (
              <span
                key={roaster.id ?? `${roaster.name}-${index}`}
                title={roaster.name}
                className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-[3px] bg-white text-sm font-extrabold text-stone-800 shadow-lg"
                style={{ borderColor: colors.surface, zIndex: index + 1 }}
              >
                {roaster.photoUrl
                  ? <img src={roaster.photoUrl} alt={roaster.name} className="h-full w-full object-cover" loading="lazy" />
                  : roaster.name.slice(0, 2).toUpperCase()}
              </span>
            ))}
            {roasters.length > 3 && (
              <span className="relative flex h-12 w-12 items-center justify-center rounded-full border-[3px] bg-stone-900 text-xs font-bold text-white shadow-lg" style={{ borderColor: colors.surface, zIndex: 4 }}>+{roasters.length - 3}</span>
            )}
          </div>
        )}
      </div>

      <div className={`px-4 pb-4 pt-3 ${coffee ? 'flex flex-1 flex-col' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-xl font-extrabold tracking-[-0.02em]" style={{ color: colors.textPrimary }}>{name}</h3>
          {openNow !== undefined && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold uppercase" style={{ background: openNow ? 'rgba(34,197,94,.16)' : 'rgba(239,68,68,.14)', color: openNow ? '#22C55E' : '#EF4444' }}>
              <span className="h-2 w-2 rounded-full" style={{ background: 'currentColor' }} />
              {openNow ? 'Открыто' : 'Закрыто'}
            </span>
          )}
        </div>

        {brewMethods.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Методы заваривания">
            {brewMethods.slice(0, 2).map((method, index) => <InfoChip key={method.id ?? `${method.name}-${index}`} colors={colors}><AppIcon name={`brew:${method.name}`} size={20} style={{ marginRight: 6 }} />{method.name}</InfoChip>)}
            {brewMethods.length > 2 && <InfoChip colors={colors}>+{brewMethods.length - 2}</InfoChip>}
          </div>
        )}

        {(address || distance !== null) && (
          <p className="mt-3 flex min-w-0 items-center gap-1.5 text-sm" style={{ color: colors.textSecondary }}>
            <AppIcon name="location_on" size={18} color={COLORS.primary} style={{ flexShrink: 0 }} />
            <span className="truncate">{address}</span>
            {distance !== null && <span className="shrink-0">· {formatDistance(distance)} от вас</span>}
          </p>
        )}

        {(type || priceTier) && (
          <div className="mt-3 flex items-center gap-2 border-t pt-3 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
            {type && <span className="inline-flex items-center gap-1.5"><AppIcon name="coffee" size={18} />{type}</span>}
            {type && priceTier && <span>·</span>}
            {priceTier && <span className="inline-flex items-center gap-2" aria-label={`Уровень стоимости ${priceTier}`}><span>Стоимость</span><BeanPriceMarks count={priceTier} size={14} color={COLORS.primary} /></span>}
            <AppIcon name="caret-right" size={20} color={colors.textSecondary} className="ml-auto shrink-0" />
          </div>
        )}
        {children && <div className={coffee ? 'mt-1 flex flex-1 flex-col' : 'mt-3 space-y-3'} onClick={event => { if ((event.target as HTMLElement).closest('a, button, details')) event.stopPropagation(); }}>{children}</div>}
      </div>
    </article>
  );
});

ShopCard.displayName = 'ShopCard';

export const InfoChip: React.FC<{ colors: ShopCardColors; children: React.ReactNode }> = ({ colors, children }) => (
  <span className="inline-flex min-h-8 items-center rounded-full border px-3 text-sm font-medium" style={{ borderColor: colors.border, background: colors.background, color: colors.textSecondary }}>{children}</span>
);

export default ShopCard;
