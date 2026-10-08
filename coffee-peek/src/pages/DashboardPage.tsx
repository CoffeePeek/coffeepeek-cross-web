import React, { useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { getThemeClasses } from '../utils/theme';
import CoffeeShopList from '../components/CoffeeShopList';
import FeedPage from './FeedPage';
import SettingsPage from '../pages/SettingsPage';
import { usePageTitle } from '../hooks/usePageTitle';

const DashboardPage: React.FC = () => {
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const { user, isLoading } = useUser();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const page = searchParams.get('page') || 'coffeeshops';

  useEffect(() => {
    if (!isLoading && page === 'settings' && !user) {
      navigate('/login', { state: { from: location }, replace: true });
    }
  }, [page, user, isLoading, navigate, location]);
  
  const pageTitles: Record<string, string> = {
    'coffeeshops': 'Кофейни',
    'home': 'Главная',
    'map': 'Карта',
    'settings': 'Настройки',
  };
  usePageTitle(pageTitles[page] || 'Панель управления');

  if (page === 'settings' && (isLoading || !user)) {
    return null;
  }

  return (
    <div className={`min-h-screen ${themeClasses.bg.primary}`}>
      {page === 'home' || page === 'feed' ? <FeedPage /> : page === 'settings' ? (
        <SettingsPage />
      ) : (
        <CoffeeShopList initialMapExpanded={page === 'map'} />
      )}
    </div>
  );
};

export default DashboardPage;
