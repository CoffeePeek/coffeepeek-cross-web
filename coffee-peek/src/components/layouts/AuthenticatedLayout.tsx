import React, { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/UserContext';
import Header from '../Header';
import { AppIcon } from '../icons';
import './AuthenticatedLayout.css';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout component for authenticated pages
 * Includes Header and proper spacing
 */
export const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({ children }) => {
  const { theme } = useTheme();
  const { user } = useUser();
  const bgClass = theme === 'dark' ? 'bg-[#1A1412]' : 'bg-[#FAFAF9]';
  const layoutRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const layout = layoutRef.current;
    if (!layout) return;
    const header = layout.querySelector('header');
    const navigation = layout.querySelector('nav[aria-label="Основная навигация"]');
    const notice = noticeRef.current;

    const updateHeight = () => {
      const topHeight = (header?.getBoundingClientRect().height ?? 0) + (notice?.getBoundingClientRect().height ?? 0);
      const bottomHeight = navigation?.getBoundingClientRect().height ?? 0;
      layout.style.setProperty('--app-header-height', `${topHeight}px`);
      layout.style.setProperty('--app-navigation-height', `${bottomHeight}px`);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    [header, navigation, notice].forEach(element => {
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [user?.emailConfirmed]);

  return (
    <div ref={layoutRef} className={`app-layout ${bgClass}`}>
      <Header />
      {user?.emailConfirmed === false && (
        <div ref={noticeRef} style={{ background: 'rgba(234,179,8,0.09)', borderBottom: '1px solid rgba(234,179,8,0.25)', padding: '9px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          <AppIcon name="warning" size={15} color="#EAB308" style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: '"Manrope"', fontSize: 13, color: '#EAB308' }}>
            Ваш email не подтверждён. Некоторые функции могут быть недоступны.
          </span>
          <Link
            to="/settings"
            style={{ fontFamily: '"Manrope"', fontWeight: 600, fontSize: 13, color: '#EAB308', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
            Подтвердить в настройках →
          </Link>
        </div>
      )}
      <div className="app-layout-content">
        {children}
      </div>
    </div>
  );
};
