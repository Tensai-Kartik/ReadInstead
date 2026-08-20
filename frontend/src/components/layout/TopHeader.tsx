import React from 'react';
import { Menu } from 'lucide-react';
import { NavTab } from '../../types';

export interface TopHeaderProps {
  activeTab: NavTab;
  onOpenMobileSidebar: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ activeTab, onOpenMobileSidebar }) => {
  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard Overview';
      case 'new_video': return 'Upload New Video';
      case 'history': return 'Learning History';
      case 'notes': return 'Notes Workspace';
      case 'settings': return 'Settings';
      default: return 'ReadInstead';
    }
  };

  return (
    <header className="w-full bg-white dark:bg-[#0E1017] border-b border-gray-200 dark:border-[#1E2230] px-4 py-3 flex items-center justify-between lg:hidden shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <img
            src="/assets/logo_bg.png"
            alt="ReadInstead Logo"
            className="w-7 h-7 object-contain"
          />
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {getTitle()}
          </span>
        </div>
      </div>
    </header>
  );
};
