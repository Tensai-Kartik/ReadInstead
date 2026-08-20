import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  children,
  className,
  icon,
}) => {
  const variants = {
    primary: 'bg-primary-50 text-primary-700 dark:bg-primary-950/70 dark:text-primary-300 border-primary-200/60 dark:border-primary-800/50',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/50',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/50',
    danger: 'bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-300 border-red-200/60 dark:border-red-800/50',
    neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800/70 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  };

  return (
    <span
      className={cn(
        'inline-flex flex-row items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap shrink-0',
        variants[variant],
        className
      )}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span className="whitespace-nowrap leading-none">{children}</span>
    </span>
  );
};
