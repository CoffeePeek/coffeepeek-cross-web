import React, { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const ROUTE_TITLES: Record<string, string> = {
  '/coffees': 'Кофе',
  '/coffee-import': 'Импорт кофе',
  '/roaster-tags': 'Теги обжарщиков',
  '/coffee-filter-values': 'Характеристики кофе',
  '/dashboard': 'Дашборд',
  '/coffee-shops': 'Кофейни',
  '/map': 'Карта',
  '/shop-change-requests': 'Правки кофеен',
  '/shops': 'Заявки на кофейни',
  '/check-ins': 'Чекины на проверке',
  '/check-in-reports': 'Жалобы на чекины',
  '/shop-reports': 'Жалобы на данные',
  '/roasters': 'Заявки на обжарщиков',
  '/published-shops': 'Все кофейни',
  '/import': 'Импорт данных',
  '/coffee-zones': 'Кофейные зоны',
  '/catalogs': 'Справочники',
  '/shop-tags': 'Теги кофеен',
  '/audit': 'Audit log',
  '/users': 'Пользователи',
  '/app-distribution': 'Приложения',
  '/cache': 'Кеш',
  '/my-shops': 'Мои кофейни',
};

export const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { pathname } = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const isImportWorkspace =
    pathname === '/import' ||
    (pathname.startsWith('/import/') && !pathname.startsWith('/import/duplicates'));

  const title = isImportWorkspace
    ? ''
    : Object.entries(ROUTE_TITLES).find(([path]) => pathname.startsWith(path))?.[1] ??
      'CoffeePeek Admin';

  const handleMenuClick = () => {
    if (isDesktop) {
      setCollapsed((c) => !c);
    } else {
      setMobileOpen((o) => !o);
    }
  };

  return (
    <div className="flex h-[100dvh] bg-background-light dark:bg-background-dark overflow-hidden">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Закрыть меню"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
        onToggle={handleMenuClick}
      />

      <div className="flex-1 flex flex-col min-w-0 w-full">
        <Header
          title={title}
          onToggleSidebar={handleMenuClick}
          sidebarCollapsed={isDesktop ? collapsed : mobileOpen}
          hideBorder={isImportWorkspace}
        />
        <main
          className={
            isImportWorkspace
              ? 'flex-1 min-h-0 overflow-hidden p-0 flex flex-col'
              : 'flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]'
          }
        >
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-24">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};
