import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Card } from '../common/Card';
import { TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { ProcessedVideo } from '../../types';

export interface StudyBarChartProps {
  videos?: ProcessedVideo[];
}

export const StudyBarChart: React.FC<StudyBarChartProps> = ({ videos = [] }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const chartData = days.map((day, idx) => {
    const sessionCount = videos.length > 0 ? (idx < Math.min(videos.length, 7) ? 1 : 0) : 0;
    return {
      day,
      completed: sessionCount,
      incomplete: 0,
    };
  });

  return (
    <Card className="p-5 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Daily Study Sessions
            </h3>
            {videos.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" /> Active
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {videos.length > 0 ? `${videos.length} study sessions indexed this week` : 'No study sessions recorded yet'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
          <button className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>This Week</span>
          <button className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={4}>
            <XAxis
              dataKey="day"
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
              ticks={[0, 1, 2, 3]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#161923' : '#FFFFFF',
                borderColor: isDark ? '#232736' : '#E5E7EB',
                borderRadius: '0.75rem',
                fontSize: '12px',
                color: isDark ? '#FFF' : '#000',
                boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.12)'
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              formatter={(value) => (
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium ml-1">
                  {value === 'completed' ? 'Completed Sessions' : 'Incomplete Sessions'}
                </span>
              )}
            />
            <Bar dataKey="completed" fill={isDark ? '#818CF8' : '#6366F1'} radius={[4, 4, 0, 0]} barSize={14} />
            <Bar dataKey="incomplete" fill={isDark ? '#374151' : '#E5E7EB'} radius={[4, 4, 0, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
