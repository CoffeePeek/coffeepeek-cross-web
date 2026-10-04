import { displayDrinkName } from '../utils/consumedDrinks';
import PublicEntityLink from '../components/PublicEntityLink';
import { usePublicNavigate } from '../hooks/usePublicNavigate';
import { usePublicResolution } from '../components/PublicAddressPage';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CheckInDto, DetailedCoffeeShop } from '../api/coffeeshop';
import { getPhotoUrl } from '../api/coffeeshop';
import CheckInModal from '../components/CheckInModal';
import GuestAuthCard from '../components/GuestAuthCard';
import { ContactButtons } from '../components/coffeeshop/ContactButtons';
import { PhotoGallery } from '../components/coffeeshop/PhotoGallery';
import { ReviewsSection } from '../components/coffeeshop/ReviewsSection';
import { ShopHeader } from '../components/coffeeshop/ShopHeader';
import { ShopMenuSection } from '../components/coffeeshop/ShopMenuSection';
import { AppIcon, BeanPriceMarks } from '../components/icons';
import Mascot from '../components/Mascot';
import ReportShopIssueModal from '../components/ReportShopIssueModal';
import ShopPhotoPlaceholder from '../components/ShopPhotoPlaceholder';
import { ShopDetailSkeleton } from '../components/skeletons';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useLocalFavorites } from '../hooks/useLocalFavorites';
import { useMyReview } from '../hooks/useMyReview';
import { usePageTitle } from '../hooks/usePageTitle';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useShopData } from '../hooks/useShopData';
import { useUsersCache } from '../hooks/useUsersCache';
import { distanceKm, formatDistance } from '../utils/distance';
import { getDeviceLocation, getLocationLifetime } from '../utils/geolocation';
import { getPriceRangeTier } from '../utils/priceRange';
import { formatDayOfWeekShort, getCurrentDayOfWeek, getCurrentStatus, toLocalSchedules } from '../utils/shopUtils';
import { getThemeClasses } from '../utils/theme';
import {
  ArrowLeft, CaretDown, ChatCircleText, Check, Clock, Heart, MapPin,
  NavigationArrow, NotePencil, ShareNetwork, Star,
} from '@/components/Icon';

const EMPTY_REVIEWS: NonNullable<DetailedCoffeeShop['reviews']> = [];

type DetailColors = {
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  gold: string;
};

function formatCheckInDate(value?: string): string {
  if (!value) return 'Дата не указана';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Дата не указана' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

const CoffeeShopPage: React.FC = () => {
  const { shopId: routeId } = useParams<{ shopId: string }>();
  const resolution = usePublicResolution();
  const shopId = resolution?.id ?? routeId;
  const navigate = useNavigate();
  const openPublic = usePublicNavigate();
  const { theme } = useTheme();
  const { user, requireAuth } = useRequireAuth();
  const { showToast } = useToast();
  const legacyShop = useShopData(resolution ? null : shopId ?? '');
  const { shop, isLoading, error, reloadShop } = resolution ? { shop: resolution.data as DetailedCoffeeShop, isLoading: false, error: null, reloadShop: resolution.reload } : legacyShop;
  const { myReviewId } = useMyReview(shop);
  const reviews = shop?.reviews ?? EMPTY_REVIEWS;
  const usersCache = useUsersCache(reviews);
  const { isFavorite, toggleFavorite } = useLocalFavorites();
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  usePageTitle(shop?.name || 'Кофейня');

  useEffect(() => {
    let cancelled = false;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    void getDeviceLocation().then(position => {
      if (cancelled || !position) return;
      const lifetime = getLocationLifetime(position.timestamp);
      if (lifetime === 0) return setUserLocation(null);
      setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      expiry = setTimeout(() => setUserLocation(null), lifetime);
    });
    return () => { cancelled = true; clearTimeout(expiry); };
  }, []);

  if (!shopId) {
    navigate('/shops', { replace: true });
    return null;
  }

  const themeClasses = getThemeClasses(theme);
  const textMain = themeClasses.text.primary;
  const textMuted = themeClasses.text.secondary;
  const cardBg = themeClasses.bg.card;
  const borderColor = themeClasses.border.default;
  const isDark = theme === 'dark';
  const colors: DetailColors = {
    bg: isDark ? '#171210' : '#F8F7F5',
    surface: isDark ? '#2B211C' : '#FFFFFF',
    border: isDark ? '#46362F' : '#E7E5E4',
    text: isDark ? '#FFFFFF' : '#1C1917',
    muted: isDark ? '#A39E93' : '#78716C',
    gold: '#EAB308',
  };

  if (isLoading) return <ShopDetailSkeleton />;

  if (error || !shop) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-4 ${themeClasses.bg.primary}`}>
        <div className="text-center">
          <Mascot pose="astonishment" size={148} />
          <p className={`mb-4 text-xl ${textMain}`}>{error || 'Кофейня не найдена'}</p>
          <button type="button" onClick={() => navigate('/shops')} className="rounded-full bg-[#EAB308] px-6 py-3 font-bold text-[#1A1412]">Вернуться назад</button>
        </div>
      </div>
    );
  }

  const reviewsTotalCount = shop.reviewCount || reviews.length;
  const shopIsFavorite = isFavorite(shopId);
  const status = getCurrentStatus(shop);
  const localSchedules = toLocalSchedules(shop.schedules);
  const todaySchedule = localSchedules.find(schedule => schedule.dayOfWeek === getCurrentDayOfWeek());
  const statusTime = status?.isOpen ? todaySchedule?.closeTime : todaySchedule?.openTime;
  const priceTier = getPriceRangeTier(shop.priceRange);
  const latitude = shop.location?.latitude;
  const longitude = shop.location?.longitude;
  const distance = userLocation && latitude !== undefined && longitude !== undefined
    ? formatDistance(distanceKm(userLocation.latitude, userLocation.longitude, latitude, longitude))
    : null;
  const directionsUrl = latitude !== undefined && longitude !== undefined
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.location?.address || shop.name)}`;
  const shopBasicInfo = {
    name: shop.name,
    address: shop.location?.address || 'Адрес не указан',
    photo: shop.photos?.[0] ? getPhotoUrl(shop.photos[0], 'card') : '',
    averageRating: shop.rating,
  };

  const handleToggleFavorite = () => {
    const favorite = toggleFavorite(shopId);
    showToast(favorite ? 'Добавлено в избранное' : 'Удалено из избранного', 'success');
  };

  const handleReview = () => {
    if (!requireAuth()) return;
    const suffix = myReviewId ? '/reviews/edit' : '/reviews/new';
    openPublic('shops', shopId!, suffix, { state: { shop: shopBasicInfo, reviewId: myReviewId } });
  };

  const handleCheckIn = () => {
    if (!requireAuth()) return;
    setShowCheckInModal(true);
  };

  const handleEditShop = () => {
    if (!requireAuth()) return;
    openPublic('shops', shopId!, '/edit');
  };

  const handleShare = async () => {
    try {
      const address = shop.publicAddress;
      if (!address) throw new Error('Address unavailable');
      const data = { title: shop.name, text: `Кофейня «${shop.name}» в CoffeePeek`, url: `https://coffeepeek.by${address.canonicalPath}` };
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.url);
        showToast('Ссылка скопирована', 'success');
      }
    } catch (cause) {
      if ((cause as DOMException).name !== 'AbortError') showToast('Не удалось поделиться ссылкой', 'error');
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden pb-28 font-body" style={{ background: colors.bg }}>
      <section className="relative mx-auto h-[320px] max-w-7xl overflow-hidden rounded-b-[28px] sm:mt-6 sm:h-[420px] sm:rounded-[28px] lg:h-[520px]">
        {shop.photos?.length ? (
          <div className="grid h-full grid-cols-1 md:grid-cols-12 md:grid-rows-2 md:gap-3">
            <PhotoGallery shop={shop} cardBg={cardBg} borderColor={borderColor} textMuted={textMuted} />
          </div>
        ) : <ShopPhotoPlaceholder fontSize={24} />}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/65" />
        <div className="absolute inset-x-5 top-5 flex items-center justify-between gap-3 lg:hidden">
          <CircleButton label="Назад" onClick={() => navigate(-1)}><ArrowLeft /></CircleButton>
          <div className="flex gap-2">
            <CircleButton label="Предложить изменение" onClick={handleEditShop}><NotePencil /></CircleButton>
            <CircleButton label={shopIsFavorite ? 'Убрать из избранного' : 'Добавить в избранное'} onClick={handleToggleFavorite} pressed={shopIsFavorite}><Heart weight={shopIsFavorite ? 'fill' : 'regular'} color={shopIsFavorite ? colors.gold : 'currentColor'} /></CircleButton>
            <CircleButton label="Поделиться" onClick={() => { void handleShare(); }}><ShareNetwork /></CircleButton>
          </div>
        </div>
        <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3 text-white">
          <div className="min-w-0 space-y-1 text-sm font-semibold drop-shadow">
            <h1 className="truncate text-2xl font-extrabold sm:text-3xl">{shop.name}</h1>
            <p className="flex items-center gap-2"><MapPin size={20} weight="fill" /><span className="truncate">{shop.location?.address || 'Адрес не указан'}</span></p>
            {distance && <p className="flex items-center gap-2"><NavigationArrow size={20} weight="fill" />{distance} от вас</p>}
          </div>
          {!!shop.photos?.length && <span className="shrink-0 text-sm font-bold">1 / {shop.photos.length}</span>}
        </div>
      </section>

      <main className="mx-auto max-w-[920px] space-y-7 px-4 py-6 sm:px-6 sm:py-8">
        <section>
          <ShopHeader shop={shop} avgRating={shop.rating || 0} reviewsTotalCount={reviewsTotalCount} isFavorite={shopIsFavorite} isCheckingFavorite={false} onToggleFavorite={handleToggleFavorite} onCheckIn={handleCheckIn} onReportIssue={() => setShowReportModal(true)} textMuted={textMuted} borderColor={borderColor} />
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-[22px] p-4" style={{ background: isDark ? '#382F1E' : '#FFF9E8', color: colors.text }}><div className="flex items-center gap-2"><Star size={23} weight="fill" color={colors.gold} /><strong className="text-lg sm:text-xl">{(shop.rating || 0).toFixed(1)}</strong></div><p className="mt-1 text-xs" style={{ color: colors.muted }}>{reviewsTotalCount} отзывов</p></div>
            <div className="rounded-[22px] p-4" style={{ background: status?.isOpen ? (isDark ? '#183B2A' : '#DCF7E7') : (isDark ? '#442727' : '#FEE2E2'), color: status?.isOpen ? '#22C55E' : '#EF4444' }}><strong className="block text-sm sm:text-xl">● {status?.isOpen ? 'Открыта' : 'Закрыта'}</strong>{statusTime && <p className="mt-1 text-xs opacity-75">{status?.isOpen ? 'до' : 'с'} {statusTime}</p>}</div>
            <div className="rounded-[22px] border p-4" style={{ background: colors.surface, borderColor: colors.border, color: colors.text }}>{priceTier ? <BeanPriceMarks count={priceTier} size={17} color={colors.gold} /> : <strong className="text-lg">—</strong>}<p className="mt-1 text-xs" style={{ color: colors.muted }}>Стоимость</p></div>
          </div>
          {!!shop.tags?.length && <div className="mt-4 flex flex-wrap gap-2">{shop.tags.map(tag => <span key={tag.id} className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: colors.border, color: colors.muted, background: colors.surface }}>{tag.name}</span>)}</div>}
        </section>

        {shop.description && <section><SectionTitle colors={colors}>О кофейне</SectionTitle><div className="rounded-[24px] border p-5" style={{ background: colors.surface, borderColor: colors.border }}><p className="leading-relaxed" style={{ color: colors.muted }}>{shop.description}</p></div></section>}
        <ShopMenuSection menu={shop.menu ?? null} textMain={textMain} textMuted={textMuted} cardBg={cardBg} borderColor={borderColor} />
        {!!shop.schedules?.length && <HoursCard shop={shop} schedules={localSchedules} colors={colors} />}

        {!!shop.roasters?.length && <section><SectionTitle colors={colors}>Обжарщики</SectionTitle><div className="overflow-hidden rounded-[24px] border" style={{ background: colors.surface, borderColor: colors.border }}>{shop.roasters.map((roaster, index) => <PublicEntityLink key={roaster.id} kind="roasters" entityId={roaster.id} address={roaster.publicAddress} className="flex min-h-[72px] w-full items-center gap-4 px-5 py-3 text-left" style={{ borderTop: index ? `1px solid ${colors.border}` : undefined, color: colors.text }}>{roaster.photoUrl ? <img src={roaster.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 font-bold text-stone-700">{roaster.name[0]}</span>}<span className="flex-1 font-semibold">{roaster.name}</span><AppIcon name="chevron_right" size={20} color={colors.muted} /></PublicEntityLink>)}</div></section>}

        {!!shop.brewMethods?.length && <section><SectionTitle colors={colors}>Методы заваривания</SectionTitle><div className="flex flex-wrap gap-2 rounded-[24px] border p-5" style={{ background: colors.surface, borderColor: colors.border }}>{shop.brewMethods.map(method => <span key={method.id} className="rounded-full px-3 py-2 text-sm font-semibold" style={{ background: isDark ? '#3A321F' : '#FBF4DF', color: '#B38B32' }}>{method.name}</span>)}</div></section>}

        {(shop.equipments?.length || shop.beans?.length) ? <section><SectionTitle colors={colors}>Кофе и оборудование</SectionTitle><div className="grid gap-4 rounded-[24px] border p-5 sm:grid-cols-2" style={{ background: colors.surface, borderColor: colors.border }}>{!!shop.equipments?.length && <div><h3 className="mb-2 font-bold" style={{ color: colors.text }}>Оборудование</h3><p className="text-sm leading-relaxed" style={{ color: colors.muted }}>{shop.equipments.map(item => item.name).join(', ')}</p></div>}{!!shop.beans?.length && <div><h3 className="mb-2 font-bold" style={{ color: colors.text }}>Зёрна</h3><p className="text-sm leading-relaxed" style={{ color: colors.muted }}>{shop.beans.map(item => item.name).join(', ')}</p></div>}</div></section> : null}

        <ContactButtons shop={shop} cardBg={cardBg} borderColor={borderColor} textMain={textMain} textMuted={textMuted} />
        {user && <CheckInsList checkIns={shop.userCheckIns ?? []} colors={colors} onEdit={reviewId => openPublic('shops', shopId!, '/reviews/edit', { state: { shop: shopBasicInfo, reviewId } })} />}
        <ReviewsSection reviews={reviews} usersCache={usersCache} isLoading={false} myReviewId={myReviewId} isCheckingMyReview={false} onWriteOrEditReview={handleReview} onUserSelect={userId => { const path = usersCache.get(userId)?.canonicalPath; if (path) navigate(path);  }} user={user} textMain={textMain} textMuted={textMuted} cardBg={cardBg} borderColor={borderColor} coffeeShopName={shop.name} averageRating={shop.rating || 0} totalCount={reviewsTotalCount} />
        {!user && <GuestAuthCard {...colors} />}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-[1150] flex items-center gap-2 border-t px-4 py-3 backdrop-blur-xl lg:hidden" style={{ background: isDark ? 'rgba(23,18,16,.9)' : 'rgba(248,247,245,.9)', borderColor: colors.border, paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <a href={directionsUrl} target="_blank" rel="noopener noreferrer" aria-label="Построить маршрут" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-lg" style={{ background: colors.gold, color: '#1A1412' }}><NavigationArrow size={22} weight="fill" /></a>
        <button type="button" onClick={handleReview} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border text-sm font-bold shadow-lg" style={{ background: colors.surface, borderColor: colors.border, color: colors.text }}><ChatCircleText size={20} />Отзыв</button>
        <button type="button" onClick={handleCheckIn} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border text-sm font-bold shadow-lg" style={{ background: colors.surface, borderColor: colors.border, color: colors.text }}><Check size={20} />Чекин</button>
      </div>

      <CheckInModal isOpen={showCheckInModal} onClose={() => setShowCheckInModal(false)} shop={shop} onSuccess={reloadShop} />
      <ReportShopIssueModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} shopId={shopId} shopName={shop.name} />
    </div>
  );
};

const CircleButton: React.FC<{ label: string; onClick: () => void; pressed?: boolean; children: React.ReactNode }> = ({ label, onClick, pressed, children }) => (
  <button type="button" onClick={onClick} aria-label={label} aria-pressed={pressed} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-stone-900 shadow-lg backdrop-blur [&_svg]:h-7 [&_svg]:w-7 [&_svg]:shrink-0">{children}</button>
);

const SectionTitle: React.FC<{ colors: DetailColors; children: React.ReactNode }> = ({ colors, children }) => (
  <h2 className="mb-3 text-2xl font-extrabold" style={{ color: colors.text }}>{children}</h2>
);

const HoursCard: React.FC<{ shop: DetailedCoffeeShop; schedules: ReturnType<typeof toLocalSchedules>; colors: DetailColors }> = ({ shop, schedules, colors }) => {
  const [open, setOpen] = useState(false);
  const currentDay = getCurrentDayOfWeek();
  const today = schedules.find(schedule => schedule.dayOfWeek === currentDay);
  return (
    <section className="overflow-hidden rounded-[24px] border" style={{ background: colors.surface, borderColor: colors.border }}>
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex min-h-[76px] w-full items-center gap-4 border-0 bg-transparent px-5 text-left" style={{ color: colors.text }}>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${colors.gold}18`, color: colors.gold }}><Clock size={24} /></span>
        <strong className="flex-1 text-lg">Часы работы</strong>
        {!open && <span className="text-sm tabular-nums" style={{ color: colors.muted }}>{today?.openTime && today?.closeTime ? `${today.openTime}–${today.closeTime}` : shop.isOpen ? 'Открыто' : 'Закрыто'}</span>}
        <CaretDown size={18} className={open ? 'rotate-180' : ''} />
      </button>
      {open && <div className="grid grid-cols-[40px_1fr] gap-y-2 border-t py-4 pl-[84px] pr-5 text-sm" style={{ borderColor: colors.border }}>{schedules.map(schedule => <React.Fragment key={schedule.dayOfWeek}><span style={{ color: schedule.dayOfWeek === currentDay ? colors.gold : colors.muted }}>{formatDayOfWeekShort(schedule.dayOfWeek)}</span><span className="tabular-nums" style={{ color: colors.text }}>{schedule.openTime && schedule.closeTime ? `${schedule.openTime}–${schedule.closeTime}` : 'Закрыто'}</span></React.Fragment>)}</div>}
    </section>
  );
};

const CheckInsList: React.FC<{ checkIns: CheckInDto[]; colors: DetailColors; onEdit: (reviewId: string) => void }> = ({ checkIns, colors, onEdit }) => {
  if (!checkIns.length) return null;
  return <section><SectionTitle colors={colors}>Мои чекины</SectionTitle><div className="space-y-2">{checkIns.map(checkIn => <article key={checkIn.id} className="rounded-[20px] border p-4" style={{ background: colors.surface, borderColor: colors.border }}><div className="flex items-center justify-between gap-3"><div><strong style={{ color: colors.text }}>{formatCheckInDate(checkIn.visitedAt || checkIn.createdAt)}</strong><p className="mt-1 text-sm" style={{ color: colors.muted }}>Напиток: {displayDrinkName(checkIn)}</p>{checkIn.note && <p className="mt-1 text-sm" style={{ color: colors.muted }}>{checkIn.note}</p>}</div>{checkIn.reviewId && <button type="button" onClick={() => onEdit(checkIn.reviewId!)} className="min-h-11 rounded-full border px-4 text-sm font-bold" style={{ borderColor: colors.border, color: colors.text }}>Отзыв</button>}</div></article>)}</div></section>;
};

export default CoffeeShopPage;
