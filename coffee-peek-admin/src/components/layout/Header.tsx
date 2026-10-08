import React from 'react';
import { Menu, Moon, PanelLeftOpen, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';

interface HeaderProps {
  title: string;
  onToggleSidebar: () => void;
  sidebarExpanded: boolean;
  hideBorder?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onToggleSidebar,
  sidebarExpanded,
  hideBorder,
}) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header
      className={[
        'h-16 bg-white/95 dark:bg-surface-dark/95 backdrop-blur flex items-center px-3 sm:px-5 gap-2 sm:gap-4 shrink-0 pt-[env(safe-area-inset-top)]',
        hideBorder ? '' : 'border-b border-border-light dark:border-border-dark',
      ].join(' ')}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        id="admin-menu-toggle"
        onClick={onToggleSidebar}
        className="-ml-1 shrink-0"
        aria-label={sidebarExpanded ? 'Закрыть меню' : 'Открыть меню'}
        aria-expanded={sidebarExpanded}
        aria-controls="admin-sidebar"
      >
        {sidebarExpanded ? <Menu className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
      </Button>

      <h1 className="text-sm font-semibold text-text-main dark:text-white font-display flex-1 truncate min-w-0">
        {title}
      </h1>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        aria-label="Переключить тему"
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </header>
  );
};
