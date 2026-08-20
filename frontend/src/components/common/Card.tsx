import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface CardProps extends HTMLMotionProps<'div'> {
  hoverEffect?: boolean;
  glass?: boolean;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  hoverEffect = false,
  glass = false,
  className,
  children,
  ...props
}) => {
  return (
    <motion.div
      whileHover={hoverEffect ? { y: -3, transition: { duration: 0.2 } } : undefined}
      className={cn(
        'rounded-2xl border transition-all duration-200',
        glass 
          ? 'glass-panel-light dark:glass-panel-dark shadow-soft-sm' 
          : 'bg-white dark:bg-card-dark border-border-light dark:border-border-dark shadow-soft-sm',
        hoverEffect && 'hover:shadow-soft-md hover:border-primary-200 dark:hover:border-primary-800/60',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};
