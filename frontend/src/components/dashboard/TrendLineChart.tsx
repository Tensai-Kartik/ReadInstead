import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Card } from '../common/Card';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { ProcessedVideo } from '../../types';

export interface TrendLineChartProps {
  videos?: ProcessedVideo[];
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({ videos = [] }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const totalSessions = videos.length;
  const totalWatchMinutes = videos.reduce((acc, v) => {
    if (v.duration_seconds && v.duration_seconds > 0) return acc + Math.round(v.duration_seconds / 60);
    const parts = (v.duration || '0:0').split(':').map(Number);
    if (parts.length === 3) return acc + parts[0] * 60 + parts[1];
    if (parts.length === 2) return acc + parts[0];
    return acc + 25;
  }, 0);

  const avgDuration = totalSessions > 0 ? Math.round(totalWatchMinutes / totalSessions) : 0;
  const totalHours = (totalWatchMinutes / 60).toFixed(1);

  const trendData = videos.length > 0
    ? videos.slice(0, 6).map((v, i) => ({
        label: `S${i + 1}`,
        duration: v.duration_seconds ? Math.round(v.duration_seconds / 60) : 25,
      }))
    : [
        { label: 'S1', duration: 0 },
        { label: 'S2', duration: 0 },
        { label: 'S3', duration: 0 },
        { label: 'S4', duration: 0 },
      ];

  return (
    <Card className="p-5 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Study Duration Trend
            </h3>
            {totalSessions > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {totalSessions > 0
              ? `Average: ${avgDuration} min • Total: ${totalHours}h • ${totalSessions} sessions`
              : 'No study sessions recorded yet'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
          <button className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>Recent Sessions</span>
          <button className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isDark ? '#818CF8' : '#6366F1'} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={isDark ? '#818CF8' : '#6366F1'} stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              stroke={isDark ? '#6B7280' : '#9CA3AF'}
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke={isDark ? '#6B7280' : '#9CA3AF'}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              unit="m"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#161923' : '#FFFFFF',
                borderColor: isDark ? '#232736' : '#E5E7EB',
                borderRadius: '0.75rem',
                fontSize: '12px',
                color: isDark ? '#FFF' : '#000'
              }}
            />
            <Area
              type="monotone"
              dataKey="duration"
              stroke={isDark ? '#818CF8' : '#6366F1'}
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#purpleGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#232736] grid grid-cols-3 text-center">
        <div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-medium">Avg Duration</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{avgDuration}m</span>
        </div>
        <div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-medium">Total Time</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{totalHours}h</span>
        </div>
        <div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-medium">Sessions</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{totalSessions}</span>
        </div>
      </div>
    </Card>
  );
};
