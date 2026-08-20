import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface ProgressBarProps {
  progress: number; // 0 to 100
  showLabel?: boolean;
  className?: string;
  barColor?: string;
  glow?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showLabel = false,
  className,
  barColor = 'bg-primary-600 dark:bg-primary-500',
  glow = true,
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full flex flex-col gap-1.5">
      {showLabel && (
        <div className="flex justify-between items-center text-xs font-semibold text-gray-600 dark:text-gray-400">
          <span>Progress</span>
          <span>{clampedProgress}%</span>
        </div>
      )}
      <div className={cn("w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden relative", className)}>
        <motion.div
          className={cn("h-full rounded-full transition-all duration-300 relative", barColor, glow && "shadow-glow-purple")}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="absolute inset-0 bg-white/20 animate-shimmer" />
        </motion.div>
      </div>
    </div>
  );
};
