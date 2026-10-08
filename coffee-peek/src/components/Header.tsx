import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { COLORS } from '../constants/colors';
import { ChatCenteredText, MagnifyingGlass, GearSix, SignOut, CaretDown, User } from '@/components/Icon';
import { CoffeeBean } from '@phosphor-icons/react';
import LogoMark, { HEADER_LOGO_SIZE } from './LogoMark';

const PUBLIC_NAV = [
  { id: 'feed', label: 'Лента', route: '/feed', Icon: ChatCenteredText, match: (p: string) => p.startsWith('/feed') },
  { id: 'discovery', label: 'Поиск', route: '/search', Icon: MagnifyingGlass, match: (p: string) => ['/shops', '/coffee-shops', '/search', '/roasters', '/dashboard', '/map', '/cities', '/coffee-zones'].some(route => p.startsWith(route)) },
  { id: 'coffees', label: 'Кофе', route: '/coffees', Icon: CoffeeBean, match: (p: string) => p.startsWith('/coffees') },
] as const;

const AUTH_NAV = [
  ...PUBLIC_NAV,
  { id: 'profile',  label: 'Профиль',   route: '/profile',  Icon: User, match: (p: string) => ['/profile', '/reviews', '/check-ins', '/my/'].some(route => p.startsWith(route)) },
  { id: 'settings', label: 'Настройки', route: '/settings', Icon: GearSix, match: (p: string) => p.startsWith('/settings') },
] as const;

const Header: React.FC = () => {
  const { theme } = useTheme();
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate('/');
  };

  const isDark = theme === 'dark';
  const gold = COLORS.primary;
  const goldWarm = '#D4A84B';

  const allNav = [...PUBLIC_NAV];

  const currentPath = location.pathname + location.search;
  const isShopDetails = /^\/(?:shops|coffee-shops)\/[^/]+$/.test(location.pathname);
  const isShopCreation = location.pathname === '/coffee-shops/new';
  const currentId = (user ? AUTH_NAV : PUBLIC_NAV).find(n => n.match(currentPath))?.id ?? '';

  const bg = isDark ? 'rgba(26,20,18,0.78)' : 'rgba(250,250,249,0.78)';
  const borderColor = isDark ? '#3D2F28' : '#E7E5E4';
  const textColor = isDark ? '#fff' : '#1C1917';
  const mutedColor = isDark ? '#A39E93' : '#78716C';
  const surfaceBg = isDark ? '#2D241F' : '#fff';
  const hoverBg = isDark ? 'rgba(61,47,40,0.5)' : '#F5F4F2';

  const displayName = user?.userName || user?.email?.split('@')[0] || '';
  const initial = (displayName[0] ?? '?').toUpperCase();
  const displayEmail = user?.email ?? '';
  const avatarUrl = user?.avatarUrl;

  const navBtn = (active: boolean): React.CSSProperties => ({
    minHeight: 34, padding: '0 14px', borderRadius: 999,
    border: 'none',
    background: active ? (isDark ? 'rgba(255,255,255,0.12)' : '#fff') : 'transparent',
    color: active ? gold : mutedColor,
    fontFamily: '"Manrope"', fontWeight: 600, fontSize: 14,
    cursor: 'pointer', transition: 'all .2s',
    boxShadow: active ? (isDark ? '0 2px 10px rgba(0,0,0,.3)' : '0 2px 10px rgba(28,25,23,.12)') : 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  });

  return (
    <>
    <header className="lg:border-b" style={{ background: bg, borderColor, position: 'sticky', top: 0, zIndex: 1100, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
      <div className="relative mx-auto hidden max-w-7xl px-4 sm:px-6 lg:block lg:px-8">
        <div style={{ display: 'flex', alignItems: 'center', height: 64, gap: 12 }}>

          {/* Left: logo — flex:1 so nav sits on the true horizontal center */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', minWidth: 0 }}>
            <button
              type="button"
              className="logo-btn"
              onClick={() => navigate(user ? '/shops' : '/')}
              style={{ display: 'flex', height: 48, alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
              <LogoMark size={HEADER_LOGO_SIZE} />
              <span style={{ fontFamily: '"Manrope"', fontWeight: 800, fontSize: 20, letterSpacing: '-0.045em', color: textColor }}>
                Coffee<span style={{ color: gold }}>Peek</span>
              </span>
            </button>
          </div>

          {/* Center: desktop nav — same axis as page titles in max-w-7xl */}
          <nav
            className="hidden lg:flex"
            aria-label="Основные разделы"
            style={{ flexShrink: 0, alignItems: 'center', justifyContent: 'center', gap: 2, padding: 2, borderRadius: 999, background: isDark ? 'rgba(255,255,255,.07)' : 'rgba(120,113,108,.09)', border: `1px solid ${borderColor}` }}
          >
            {allNav.map(({ id, label, route, Icon }) => (
              <button key={id} onClick={() => navigate(route)} style={navBtn(currentId === id)} aria-current={currentId === id ? 'page' : undefined}>
                <Icon size={18} weight={currentId === id ? 'bold' : 'regular'} />
                {label}
              </button>
            ))}
          </nav>

          {/* Right: actions — matching flex:1 keeps Кофейни/Карта centered vs. the heading */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0 }}>
            {user ? (
              /* ── Profile dropdown: desktop only; on smaller screens this is in the hamburger ── */
              <div className="hidden lg:block" style={{ position: 'relative' }}>
                <button
                  onClick={() => setProfileOpen(o => !o)}
                  style={{
                    display: 'flex', height: 48, alignItems: 'center', gap: 8,
                    padding: '0 10px 0 6px', borderRadius: 99,
                    border: `1px solid ${profileOpen ? gold : borderColor}`,
                    background: profileOpen ? `${gold}12` : (isDark ? 'rgba(255,255,255,0.04)' : '#fff'),
                    cursor: 'pointer', transition: 'all .15s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{ width: 34, height: 34, borderRadius: 99, background: `${gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                    <span style={{ fontFamily: '"Manrope"', fontWeight: 800, fontSize: 13, color: goldWarm }}>{initial}</span>
                    {avatarUrl && (
                      <img
                        key={avatarUrl}
                        src={avatarUrl}
                        alt={displayName}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={event => { event.currentTarget.style.display = 'none'; }}
                      />
                    )}
                  </div>
                  <span className="hidden lg:block" style={{ fontFamily: '"Manrope"', fontWeight: 600, fontSize: 13, color: textColor, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </span>
                  <CaretDown size={18} color={mutedColor} style={{ transition: 'transform .2s', transform: profileOpen ? 'rotate(180deg)' : 'none' }} />
                </button>

                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setProfileOpen(false)} />
                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: 16, boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.14)', zIndex: 30, minWidth: 224, overflow: 'hidden' }}>

                      {/* User info header */}
                      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${borderColor}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 99, background: `${gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                            <span style={{ fontFamily: '"Manrope"', fontWeight: 800, fontSize: 16, color: goldWarm }}>{initial}</span>
                            {avatarUrl && (
                              <img
                                key={avatarUrl}
                                src={avatarUrl}
                                alt={displayName}
                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={event => { event.currentTarget.style.display = 'none'; }}
                              />
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontFamily: '"Manrope"', fontWeight: 700, fontSize: 14, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
                            <p style={{ margin: 0, fontFamily: '"Manrope"', fontSize: 11, color: mutedColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayEmail}</p>
                          </div>
                        </div>
                      </div>

                      {/* Menu */}
                      <div style={{ padding: '6px 0' }}>
                        <DropdownItem icon={<User size={18} color={mutedColor} />} label="Профиль" hoverBg={hoverBg}
                          textColor={textColor} mutedColor={mutedColor}
                          onClick={() => { navigate('/profile'); setProfileOpen(false); }} />
                        <DropdownItem icon={<GearSix size={18} color={mutedColor} />} label="Настройки" hoverBg={hoverBg}
                          textColor={textColor} mutedColor={mutedColor}
                          onClick={() => { navigate('/settings'); setProfileOpen(false); }} />
                      </div>

                      <div style={{ borderTop: `1px solid ${borderColor}`, padding: '6px 0' }}>
                        <DropdownItem icon={<SignOut size={18} color="#EF4444" />} label="Выйти" hoverBg="rgba(239,68,68,0.07)"
                          textColor="#EF4444" mutedColor="#EF4444"
                          onClick={() => { void handleLogout(); }} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* ── Login / Register ── */
              <div className="hidden lg:flex" style={{ gap: 8, alignItems: 'center' }}>
                <button onClick={() => navigate('/login')}
                  style={{ minHeight: 38, padding: '0 16px', borderRadius: 999, border: `1px solid ${borderColor}`, background: 'transparent', color: textColor, fontFamily: '"Manrope"', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all .15s' }}>
                  Войти
                </button>
                <button onClick={() => navigate('/register')}
                  style={{ minHeight: 38, padding: '0 16px', borderRadius: 999, border: `1px solid ${gold}`, background: gold, color: '#1A1412', fontFamily: '"Manrope"', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all .15s' }}>
                  Регистрация
                </button>
              </div>
            )}


          </div>
        </div>
      </div>
    </header>
      <nav
        className={`${isShopDetails || isShopCreation ? 'hidden' : 'grid'} fixed inset-x-0 bottom-0 z-[1200] grid-cols-5 border-t lg:hidden`}
        aria-label="Основная навигация"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', background: bg, borderColor, backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', boxShadow: '0 -8px 28px rgba(0,0,0,.08)' }}
      >
        {AUTH_NAV.map(({ id, label, route, Icon }) => {
          const active = currentId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => navigate(route)}
              className="flex min-h-[64px] flex-col items-center justify-center gap-0.5 border-0 bg-transparent"
              style={{ color: active ? gold : mutedColor }}
              aria-current={active ? 'page' : undefined}
            >
              <span className="flex h-8 min-w-11 items-center justify-center rounded-full" style={{ background: active ? `${gold}1F` : 'transparent' }}>
                <Icon size={23} weight={active ? 'bold' : 'regular'} />
              </span>
              <span style={{ fontFamily: '"Manrope"', fontSize: 10, fontWeight: active ? 700 : 500 }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

interface DropdownItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  textColor: string;
  mutedColor: string;
  hoverBg: string;
  activeBg?: string;
}

const DropdownItem: React.FC<DropdownItemProps> = ({ icon, label, onClick, textColor, hoverBg, activeBg }) => (
  <button
    onClick={onClick}
    style={{ width: '100%', padding: '9px 16px', textAlign: 'left', background: activeBg ?? 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontFamily: '"Manrope"', fontSize: 14, color: textColor, transition: 'background .1s' }}
    onMouseEnter={e => !activeBg && (e.currentTarget.style.background = hoverBg)}
    onMouseLeave={e => !activeBg && (e.currentTarget.style.background = 'none')}
  >
    {icon}
    {label}
  </button>
);

export default Header;
