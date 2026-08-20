import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  PlusCircle,
  History,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NavTab } from '../../types';
import { cn } from '../../lib/utils';

export interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  hasActiveVideo?: boolean;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  hasActiveVideo,
  setIsMobileOpen,
}) => {
  const { user, signOut, openAuthModal, isAuthenticated } = useAuth();

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'new_video',
      label: hasActiveVideo ? 'Video Summary' : 'New Video',
      icon: <PlusCircle className="w-4 h-4" />,
    },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
    { id: 'notes', label: 'Notes', icon: <FileText className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const handleNavClick = (tab: NavTab) => {
    setActiveTab(tab);
    if (setIsMobileOpen) setIsMobileOpen(false);
  };

  return (
    <aside className="w-64 h-screen flex flex-col justify-between bg-white dark:bg-[#0E1017] border-r border-gray-200 dark:border-[#1E2230] select-none shrink-0 transition-colors duration-300">
      {/* Top Header Section */}
      <div className="p-5 flex flex-col gap-5 overflow-y-auto">
        {/* Brand Logo & Tagline */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <img
              src="/assets/logo_bg.png"
              alt="ReadInstead Logo"
              className="w-8 h-8 object-contain drop-shadow-sm"
            />
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              Read<span className="text-primary-600 dark:text-primary-400">Instead</span>
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium pl-0.5">
            Learn more. Watch less.
          </p>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeSidebarPill"
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary-600 dark:bg-primary-400 rounded-r-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className={cn(isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500')}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Section */}
      <div className="p-4 border-t border-gray-100 dark:border-[#1E2230] flex flex-col gap-3">
        {/* User Profile Card */}
        {isAuthenticated && user ? (
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-[#161923] border border-gray-200/70 dark:border-[#232736]">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img
                src={user.avatar_url || '/assets/logo_bg.png'}
                alt={user.full_name}
                className="w-8 h-8 rounded-full object-cover shrink-0 border border-primary-300 dark:border-primary-700"
              />
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {user.full_name || 'Learner'}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                  {user.email}
                </span>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              title="Logout"
              className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => openAuthModal('signin')}
            className="w-full py-2.5 px-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-soft-sm transition-all text-center"
          >
            Sign In / Register
          </button>
        )}
      </div>
    </aside>
  );
};
