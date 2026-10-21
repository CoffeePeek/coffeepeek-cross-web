import type { ReactNode, CSSProperties } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { brand, getThemeColors } from '../design-system';
import { useMobileAppDownloads } from '../hooks/queries/useMobileAppDownloads';
import { LEGAL_ROUTES } from '../constants/legalRoutes';
import LogoMark from './LogoMark';
import './Footer.css';

const footerCols = [
  {
    title: 'Открывай',
    items: [
      { label: 'Кофейни', href: '/shops' }, { label: 'Карта', href: '/map' },
      { label: 'Кофе', href: '/coffees' }, { label: 'Обжарщики', href: '/roasters' },
      { label: 'Лента', href: '/feed' }, { label: 'Добавить кофейню', href: '/coffee-shops/new' },
    ],
  },
  {
    title: 'Приложение',
    items: [
      { label: 'App Store', href: '/download/ios' },
      { label: 'Google Play', href: '/download/android' },
    ],
  },
  {
    title: 'Контакты',
    items: [
      { label: 'Instagram', href: 'https://www.instagram.com/coffeepeek.by/' },
      { label: 'Threads', href: 'https://www.threads.com/@coffeepeek.by' },
      { label: 'Поддержка', href: '/support' },
    ],
  },
  {
    title: 'Документы',
    items: [
      { label: 'Условия', href: LEGAL_ROUTES.terms }, { label: 'Конфиденциальность', href: LEGAL_ROUTES.privacy },
      { label: 'Настройки cookie', href: `${LEGAL_ROUTES.privacy}#analytics-settings` },
    ],
  },
];

function FooterLink({ href, children, className }: { href: string; children: ReactNode; className: string }) {
  const inRouter = useInRouterContext();
  const external = href.startsWith('https://');
  const props = { className, target: external ? '_blank' : undefined, rel: external ? 'noopener noreferrer' : undefined };
  return inRouter
    ? <Link to={href} reloadDocument={href.startsWith('/download/') || href === '/support'} {...props}>{children}</Link>
    : <a href={href} {...props}>{children}</a>;
}

export default function Footer() {
  const { theme } = useTheme();
  const c = getThemeColors(theme);
  const downloads = useMobileAppDownloads();
  const stores = new Map([
    ['/download/ios', !!(downloads.data?.ios.appStore.available && downloads.data.ios.appStore.url)],
    ['/download/android', !!(downloads.data?.android.googlePlay.available && downloads.data.android.googlePlay.url)],
  ]);

  return (
    <footer className="site-footer" style={{
      background: c.background, color: c.textPrimary,
      '--footer-border': c.border, '--footer-muted': c.textSecondary, '--footer-accent': brand.primary,
    } as CSSProperties}>
      <div className="site-footer-inner">
        <div>
          <FooterLink href="/" className="site-footer-brand">
            <LogoMark size={40} /><span>Coffee<span style={{ color: brand.primary }}>Peek</span></span>
          </FooterLink>
          <p className="site-footer-tagline">Твой кофейный Минск.</p>
          <p className="site-footer-copyright">© 2026 CoffeePeek · Минск</p>
        </div>
        <div className="site-footer-columns">
          {footerCols.map(col => <nav key={col.title} aria-label={col.title}>
            <h2>{col.title}</h2>
            <ul>{col.items.map(({ label, href }) => {
              const status = stores.get(href) === false ? downloads.isPending ? 'Загрузка…' : downloads.isError ? 'Недоступно' : 'Скоро' : '';
              return <li key={label}>
                <FooterLink href={status ? '/settings#app-download-title' : href} className="site-footer-link">
                  {label}{status && <span className="site-footer-store-status">{status}</span>}
                </FooterLink>
              </li>;
            })}</ul>
          </nav>)}
        </div>
      </div>
    </footer>
  );
}
