import React from 'react';
import { Menu, Sun, Moon } from 'lucide-react';
import { NavTab } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { BackendStatusBadge } from '../common/BackendStatusBadge';

export interface TopHeaderProps {
  activeTab: NavTab;
  onOpenMobileSidebar: () => void;
  onOpenBackendModal?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  onOpenMobileSidebar,
  onOpenBackendModal,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { isAdmin } = useAuth();

  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard';
      case 'new_video': return 'Video Summary';
      case 'history': return 'History';
      case 'notes': return 'Notes';
      case 'settings': return 'Settings';
      default: return 'ReadInstead';
    }
  };

  return (
    <header className="w-full bg-white dark:bg-[#0E1017] border-b border-gray-200 dark:border-[#1E2230] px-4 py-3 flex items-center justify-between lg:hidden shrink-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          aria-label="Open Navigation Menu"
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 active:scale-95 transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <img
            src="/assets/logo_bg.png"
            alt="ReadInstead Logo"
            className="w-7 h-7 object-contain"
          />
          <span className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[130px] sm:max-w-[200px]">
            {getTitle()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isAdmin && onOpenBackendModal && (
          <BackendStatusBadge onOpenConfigModal={onOpenBackendModal} className="text-[11px] px-2 py-0.5" />
        )}

        <button
          onClick={toggleTheme}
          aria-label="Toggle Dark/Light Mode"
          className="p-2 rounded-xl border border-gray-200 dark:border-[#232736] bg-gray-50 dark:bg-card-dark text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 active:scale-95 transition-all"
        >
          {theme === 'light' ? <Moon className="w-4 h-4 text-indigo-500" /> : <Sun className="w-4 h-4 text-amber-400" />}
        </button>
      </div>
    </header>
  );
};
