import React from 'react';
import { Clock, Target, CheckCircle2, Timer } from 'lucide-react';
import { Card } from '../common/Card';
import { ProgressBar } from '../common/ProgressBar';
import { useAuth } from '../../context/AuthContext';

import { ProcessedVideo } from '../../types';

export interface StatsOverviewProps {
  videos?: ProcessedVideo[];
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ videos = [] }) => {
  const { user } = useAuth();

  const totalSummaries = videos.length;

  const totalWatchMinutes = videos.reduce((acc, v) => {
    if (v.duration_seconds && v.duration_seconds > 0) {
      return acc + Math.round(v.duration_seconds / 60);
    }
    const parts = (v.duration || '0:0').split(':').map(Number);
    if (parts.length === 3) return acc + parts[0] * 60 + parts[1];
    if (parts.length === 2) return acc + parts[0];
    return acc + 15;
  }, 0);

  const estimatedReadMinutes = totalSummaries * 3;
  const savedMinutes = Math.max(0, totalWatchMinutes - estimatedReadMinutes);
  const hours = Math.floor(savedMinutes / 60);
  const minutes = savedMinutes % 60;

  const goalMinutes = user?.daily_goal_minutes || 60;
  const goalHoursStr = `${Math.floor(goalMinutes / 60)}h ${goalMinutes % 60}m`;
  const progressMinutes = Math.min(goalMinutes, estimatedReadMinutes);
  const progressHoursStr = `${Math.floor(progressMinutes / 60)}h ${progressMinutes % 60}m`;
  const goalPercentage = totalSummaries > 0 ? Math.min(100, Math.round((progressMinutes / goalMinutes) * 100)) : 0;
  const avgWatchPerVideo = totalSummaries > 0 ? Math.round(totalWatchMinutes / totalSummaries) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Time Saved */}
      <Card className="p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Total Time Saved
          </span>
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-primary-950/60 border border-indigo-100 dark:border-primary-800/40 flex items-center justify-center text-primary-600 dark:text-primary-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {hours}h {minutes}m
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
            {totalSummaries > 0 ? 'Saved by reading instead of watching' : 'Summarize videos to start saving time'}
          </p>
        </div>
      </Card>

      {/* 2. Reading Goal Progress */}
      <Card className="p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Daily Reading Goal
          </span>
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-primary-950/60 border border-indigo-100 dark:border-primary-800/40 flex items-center justify-center text-primary-600 dark:text-primary-400">
            <Target className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {goalPercentage}%
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {progressHoursStr} / {goalHoursStr}
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar progress={goalPercentage} />
          </div>
        </div>
      </Card>

      {/* 3. Summaries Generated */}
      <Card className="p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Summaries Created
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {totalSummaries}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Videos summarized & indexed
          </p>
        </div>
      </Card>

      {/* 4. Avg Reading Time */}
      <Card className="p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Avg Reading Time
          </span>
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Timer className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {totalSummaries > 0 ? '3m' : '0m'}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
            {totalSummaries > 0 ? `Per video vs ${avgWatchPerVideo}m watch duration` : 'Transform 30m+ videos into 3m summaries'}
          </p>
        </div>
      </Card>
    </div>
  );
};
