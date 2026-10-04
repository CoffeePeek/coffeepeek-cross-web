import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../constants/colors';
import { usePageTitle } from '../hooks/usePageTitle';
import { LEGAL_ROUTES } from '../constants/legalRoutes';
import {
  usePublicStats,
  formatStatCount,
  formatStatCompact,
  formatStatRating,
} from '../hooks/queries/usePublicStats';
import { AppIcon, StarIcon } from '../components/icons';
import { MobileAppDownload } from '../components/mobile-app';
import LandingMapWidget from '../components/LandingMapWidget';
import Header from '../components/Header';
import LandingProductDemo from '../components/LandingProductDemo';
import LogoMark from '../components/LogoMark';
import Mascot from '../components/Mascot';

const LandingPage: React.FC = () => {
  usePageTitle('Главная');
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { data: publicStats, isLoading: isStatsLoading } = usePublicStats();

  const footerCols = [
    { t: 'Продукт', items: ['Кофейни', 'Карта'] },
    { t: 'Помощь',  items: ['Условия', 'Политика'] },
  ];
  const footerLinks: Record<string, string> = {
    Кофейни: '/shops',
    Карта: '/dashboard?page=map',
    Условия: LEGAL_ROUTES.terms,
    Политика: LEGAL_ROUTES.privacy,
  };

  const statsMobile = [
    {
      value: publicStats ? formatStatCount(publicStats.totalCoffeeShops) : '—',
      label: 'Кофеен',
    },
    {
      value: publicStats ? formatStatCompact(publicStats.totalReviews) : '—',
      label: 'Отзывов',
    },
    {
      value: publicStats ? formatStatCompact(publicStats.totalCheckIns) : '—',
      label: 'Чек-инов',
    },
    {
      value: publicStats ? formatStatRating(publicStats.averageRating) : '—',
      label: 'Средняя оценка',
      isRating: true,
    },
  ];

  const statsDesktop = [
    {
      value: publicStats ? formatStatCount(publicStats.totalCoffeeShops) : '—',
      label: 'кофеен на карте',
    },
    {
      value: publicStats ? formatStatCompact(publicStats.totalReviews) : '—',
      label: 'отзывов',
    },
    {
      value: publicStats ? formatStatCompact(publicStats.totalCheckIns) : '—',
      label: 'чек-инов',
    },
    {
      value: publicStats ? formatStatRating(publicStats.averageRating) : '—',
      label: 'средняя оценка',
      isRating: true,
    },
  ];

  const isDark = theme === 'dark';
  const c = getThemeColors(theme);

  return (
    <div className="min-h-screen relative overflow-clip" style={{ background: c.background, color: c.textPrimary }}>
      {/* Dotted background */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `radial-gradient(${c.surface} 1px, transparent 1px)`, backgroundSize: '40px 40px', opacity: isDark ? 0.55 : 0.9 }} />
      {/* Gold glows — kept inside the box so overflow clip doesn't leave a 1px edge in Firefox */}
      <div className="absolute pointer-events-none" style={{ top: -80, left: '50%', transform: 'translateX(-50%)', width: 720, height: 480, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(234,179,8,0.12), transparent 60%)', filter: 'blur(60px)' }} />
      <div className="absolute pointer-events-none" style={{ bottom: -40, right: -40, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(180,140,75,0.10), transparent 60%)', filter: 'blur(60px)' }} />

      <div className="relative">
        <Header />

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="max-w-[1280px] mx-auto px-5 lg:px-8 pt-8 lg:pt-16 pb-9 relative">
          <div className="lg:grid lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:items-center min-w-0">
            {/* Left: text */}
            <div className="min-w-0 text-center lg:text-left" style={{ containerType: 'inline-size' }}>
              {/* Badge */}
              <span className="inline-flex items-center gap-2 px-[14px] py-[6px] rounded-full text-[#EAB308] font-body font-bold text-[10px] lg:text-[12px] uppercase tracking-[.06em] border border-[#EAB308]/20"
                style={{ background: 'rgba(234,179,8,.10)' }}>
                <span className="w-[6px] h-[6px] lg:w-[7px] lg:h-[7px] rounded-full bg-[#22C55E]" />
                Ваш проводник в мире кофе
              </span>

              {/* H1 — Dewi Expanded is wider than the viewport at a fixed 54px */}
              <h1 className="mt-5 lg:mt-6 min-w-0 font-extended font-black leading-[0.95] tracking-[-0.035em]" style={{ color: c.textPrimary }}>
                <span className="block font-body font-medium text-[13px] lg:text-[28px] tracking-[0.01em] normal-case mb-2 lg:mb-3" style={{ color: c.textSecondary }}>
                  Добро пожаловать в
                </span>
                <span className="block max-w-full whitespace-nowrap text-[#EAB308] tracking-[-0.05em] [font-size:clamp(1.75rem,12cqi,5.5rem)]">
                  CoffeePeek
                </span>
              </h1>

              {/* Description */}
              <p className="mt-5 lg:mt-6 mx-auto lg:mx-0 max-w-[320px] lg:max-w-[520px] font-body text-[14px] lg:text-[17px] leading-[1.55]" style={{ color: c.textSecondary }}>
                Удобный инструмент для любителей кофе. Открой для себя лучшие кофейни, оставляй отзывы и делись впечатлениями с единомышленниками.
              </p>

              <div className="lg:hidden flex justify-center mt-6" aria-hidden>
                <Mascot pose="happy" size={168} eager />
              </div>

              {/* CTAs */}
              <div className="mt-[26px] lg:mt-8 flex flex-col lg:flex-row lg:inline-flex gap-[10px]">
                <button onClick={() => navigate('/register')}
                  className="h-[52px] px-7 rounded-[14px] bg-[#EAB308] text-[#1A1412] border-none font-extended font-bold text-[15px] inline-flex items-center justify-center gap-2 hover:bg-[#FACC15] active:scale-[0.98] transition-all"
                  style={{ boxShadow: '0 4px 6px -4px rgba(180,140,75,.3), 0 10px 25px -3px rgba(234,179,8,.25)' }}>
                  <AppIcon name="arrow_forward" size={18} />
                  Создать аккаунт
                </button>
                <button onClick={() => navigate('/login')}
                  className="h-[52px] px-[26px] rounded-[14px] font-extended font-semibold text-[15px] inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', border: `1px solid ${c.border}`, color: c.textPrimary }}>
                  <AppIcon name="login" size={18} />
                  Войти
                </button>
              </div>
            </div>

            {/* Right: live map preview (desktop only) */}
            <div className="hidden lg:block">
              <LandingMapWidget />
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-8 lg:mt-16 rounded-[16px] lg:rounded-[20px] px-4 py-4 lg:px-8 lg:py-6 border"
            style={{ background: isDark ? 'rgba(45,36,31,0.55)' : 'rgba(255,255,255,0.72)', borderColor: c.border, backdropFilter: 'blur(12px)', boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
            {/* Mobile: 2x2 grid */}
            <div className="grid grid-cols-2 gap-4 lg:hidden">
              {statsMobile.map(({ value, label, isRating }) => (
                <div key={label}>
                  <div className={`font-extended font-bold text-[22px] tracking-[-0.02em] leading-none inline-flex items-center gap-1.5 ${isStatsLoading ? 'animate-pulse opacity-40' : ''}`} style={{ color: c.textPrimary }}>
                    {isRating && value !== '—' && <StarIcon filled size={18} className="text-[#EAB308]" />}
                    {value}
                  </div>
                  <div className="mt-1 font-body text-[10px] uppercase tracking-[.04em]" style={{ color: c.textSecondary }}>{label}</div>
                </div>
              ))}
            </div>
            {/* Desktop: row */}
            <div className="hidden lg:flex items-center justify-between gap-8">
              {statsDesktop.map(({ value, label, isRating }, i) => (
                <React.Fragment key={label}>
                  <div className="text-left">
                    <div className={`font-extended font-bold text-[32px] tracking-[-0.02em] leading-none inline-flex items-center gap-2 ${isStatsLoading ? 'animate-pulse opacity-40' : ''}`} style={{ color: c.textPrimary }}>
                      {isRating && value !== '—' && <StarIcon filled size={22} className="text-[#EAB308]" />}
                      {value}
                    </div>
                    <div className="mt-[6px] font-body text-[12px] uppercase tracking-[.04em]" style={{ color: c.textSecondary }}>{label}</div>
                  </div>
                  {i < statsDesktop.length - 1 && <div className="w-px h-9" style={{ background: c.border }} />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section className="max-w-[1280px] mx-auto px-5 lg:px-8 pt-4 lg:pt-6 pb-4">
          <div className="mb-3 lg:mb-4">
            <span className="font-body font-bold text-[10px] lg:text-[12px] uppercase tracking-[.08em] text-[#EAB308]">Что внутри</span>
            <h2 className="mt-2 font-extended font-bold text-[22px] lg:text-[36px] tracking-[-0.025em]" style={{ color: c.textPrimary }}>Всё для жизни вокруг кофе</h2>
          </div>
          <LandingProductDemo />
        </section>

        {/* ── Mobile app download ──────────────────────────────── */}
        <section className="max-w-[1280px] mx-auto px-5 lg:px-8 pt-4 lg:pt-6 pb-4">
          <MobileAppDownload variant="full" />
        </section>

        {/* ── CTA Banner ───────────────────────────────────────── */}
        <section className="max-w-[1280px] mx-auto px-5 lg:px-8 pt-[30px] lg:pt-14 pb-6">
          <div className="relative overflow-hidden rounded-[18px] lg:rounded-[24px] p-5 lg:pl-12 lg:pr-56 lg:py-9 border border-[rgba(180,140,75,.35)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6"
            style={{ background: isDark ? 'linear-gradient(135deg, #2D241F 0%, rgba(180,140,75,0.18) 100%)' : 'linear-gradient(135deg, #FFFFFF 0%, rgba(212,168,75,0.16) 100%)', boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
            <div className="absolute top-[-80px] right-[-80px] w-[320px] h-[320px] rounded-full pointer-events-none lg:block hidden"
              style={{ background: 'radial-gradient(circle, rgba(234,179,8,0.18), transparent 60%)', filter: 'blur(40px)' }} />
            <div className="absolute top-[-50px] right-[-50px] w-[200px] h-[200px] rounded-full pointer-events-none lg:hidden"
              style={{ background: 'radial-gradient(circle, rgba(234,179,8,0.20), transparent 60%)' }} />
            <div className="hidden lg:block absolute right-2 bottom-[-48px] pointer-events-none" aria-hidden>
              <Mascot pose="happy" size={236} />
            </div>
            <div className="relative">
              <span className="font-body font-bold text-[10px] lg:text-[11px] uppercase tracking-[.08em] text-[#EAB308]">Присоединяйся к сообществу</span>
              <h2 className="mt-[6px] font-extended font-bold text-[20px] lg:text-[32px] tracking-[-0.02em] leading-[1.15]" style={{ color: c.textPrimary }}>
                Делись опытом и открывай<br className="hidden lg:block" />новые кофейни рядом с тобой.
              </h2>
            </div>
            <div className="lg:hidden flex justify-center" aria-hidden>
              <Mascot pose="happy" size={128} />
            </div>
            <button onClick={() => navigate('/register')}
              className="relative h-12 lg:h-[56px] px-6 lg:px-8 rounded-xl lg:rounded-[14px] bg-[#EAB308] text-[#1A1412] border-none font-extended font-bold text-[14px] lg:text-[15px] inline-flex items-center justify-center gap-[8px] lg:gap-[10px] whitespace-nowrap hover:bg-[#FACC15] active:scale-[0.98] transition-all"
              style={{ boxShadow: '0 4px 6px -4px rgba(180,140,75,.4), 0 10px 25px -3px rgba(234,179,8,.35)' }}>
              <AppIcon name="rocket_launch" size={18} />
              Создать аккаунт
            </button>
          </div>
        </section>

        {/* ── Footer desktop ───────────────────────────────────── */}
        <footer className="max-w-[1280px] mx-auto px-8 pt-10 pb-12 hidden lg:block">
          <div className="flex items-start justify-between gap-6 pb-7 border-b" style={{ borderColor: c.border }}>
            <div className="max-w-[320px]">
              <div className="flex items-center gap-[10px]">
                <LogoMark size={32} />
                <span className="font-extended font-bold text-[17px]" style={{ color: c.textPrimary }}>Coffee<span className="text-[#EAB308]">Peek</span></span>
              </div>
              <p className="mt-3 font-body text-[13px] leading-[1.55]" style={{ color: c.textSecondary }}>
                Проводник в мире кофе. Карта, отзывы, инструменты и сообщество — в одном приложении.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-14">
              {footerCols.map((col) => (
                <div key={col.t} className="text-center">
                  <div className="font-body font-bold text-[11px] uppercase tracking-[.08em] mb-3" style={{ color: c.textSecondary }}>{col.t}</div>
                  <div className="flex flex-col items-center gap-2">
                    {col.items.map((item) => {
                      const href = footerLinks[item];
                      if (!href) {
                        return (
                          <span key={item} className="font-body text-[13px]" style={{ color: c.textSecondary }}>{item}</span>
                        );
                      }
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => navigate(href)}
                          className="font-body text-[13px] text-center cursor-pointer hover:text-[#EAB308] transition-colors p-0"
                          style={{ color: c.textPrimary }}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-[18px] flex items-center justify-between font-body text-[12px]" style={{ color: c.textTertiary }}>
            <span>© 2026 CoffeePeek</span>
            <div className="flex items-center gap-[14px]">
              <span className="inline-flex items-center gap-[5px]"><AppIcon name="language" size={14} />Русский</span>
              <span>Минск</span>
              <span>·</span>
              <span className="text-[#22C55E] inline-flex items-center gap-1">
                <AppIcon name="circle" filled size={8} color="#22C55E" />
                Все системы работают
              </span>
            </div>
          </div>
        </footer>

        {/* ── Footer mobile ────────────────────────────────────── */}
        <footer className="lg:hidden px-5 pt-7 pb-10 mt-2 border-t" style={{ borderColor: c.border }}>
          <div className="grid grid-cols-2 gap-6 pb-5">
            {footerCols.map((col) => (
              <div key={col.t} className="text-center">
                <div className="font-body font-bold text-[11px] uppercase tracking-[.08em] mb-3" style={{ color: c.textSecondary }}>{col.t}</div>
                <div className="flex flex-col items-center gap-2">
                  {col.items.map((item) => {
                    const href = footerLinks[item];
                    if (!href) {
                      return (
                        <span key={item} className="font-body text-[13px]" style={{ color: c.textSecondary }}>{item}</span>
                      );
                    }
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => navigate(href)}
                        className="font-body text-[13px] text-center cursor-pointer hover:text-[#EAB308] transition-colors p-0"
                        style={{ color: c.textPrimary }}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-body text-[11px] leading-[1.7]" style={{ borderColor: c.border, color: c.textTertiary }}>
            <span>© 2026 CoffeePeek</span>
            <span className="inline-flex items-center gap-[5px]"><AppIcon name="language" size={14} />Русский</span>
            <span>Минск</span>
            <span className="text-[#22C55E] inline-flex items-center justify-center gap-1">
              <AppIcon name="circle" filled size={8} color="#22C55E" />
              Все системы работают
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
