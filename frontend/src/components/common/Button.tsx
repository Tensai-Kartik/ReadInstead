import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex flex-row items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-xl whitespace-nowrap';

  const variants = {
    primary: 'bg-primary-600 hover:bg-primary-500 text-white shadow-soft-sm shadow-primary-500/20 active:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-500',
    secondary: 'bg-indigo-50 hover:bg-indigo-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 dark:hover:bg-primary-900/60 border border-primary-200/50 dark:border-primary-800/40',
    outline: 'border border-gray-200 dark:border-border-dark bg-white dark:bg-card-dark text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-card-dark-hover hover:border-gray-300 dark:hover:border-gray-600',
    ghost: 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5',
    danger: 'bg-red-600 hover:bg-red-500 text-white shadow-soft-sm shadow-red-500/20',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5 rounded-2xl',
  };

  return (
    <motion.button
      whileHover={{ y: -1, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
      )}
      <span className="whitespace-nowrap flex items-center leading-none">{children}</span>
      {!isLoading && rightIcon && <span className="shrink-0 flex items-center">{rightIcon}</span>}
    </motion.button>
  );
};
