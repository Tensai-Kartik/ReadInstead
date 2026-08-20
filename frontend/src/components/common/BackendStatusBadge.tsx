import React, { useState, useEffect } from 'react';
import { Server, Activity, AlertCircle, RefreshCw, CheckCircle2, Cloud } from 'lucide-react';
import { getBackendUrl, isBackendConfigured, isLiveProduction, BACKEND_URL_CHANGED_EVENT } from '../../lib/config';
import { checkBackendConnection, BackendHealthDetails } from '../../services/backendHealth';
import { cn } from '../../lib/utils';

export interface BackendStatusBadgeProps {
  onOpenConfigModal: () => void;
  className?: string;
}

export const BackendStatusBadge: React.FC<BackendStatusBadgeProps> = ({
  onOpenConfigModal,
  className,
}) => {
  const [health, setHealth] = useState<BackendHealthDetails | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const performCheck = async () => {
    setIsChecking(true);
    try {
      const res = await checkBackendConnection();
      setHealth(res);
    } catch {
      setHealth({
        status: 'offline',
        url: getBackendUrl(),
        error: 'Connection check failed',
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    performCheck();

    const handleUrlChange = () => {
      performCheck();
    };

    window.addEventListener(BACKEND_URL_CHANGED_EVENT, handleUrlChange);
    // Periodically re-check health every 60s
    const interval = setInterval(performCheck, 60000);

    return () => {
      window.removeEventListener(BACKEND_URL_CHANGED_EVENT, handleUrlChange);
      clearInterval(interval);
    };
  }, []);

  const isConfigured = isBackendConfigured();
  const isHealthy = health?.status === 'healthy';
  const isSleeping = health?.status === 'sleeping';

  let badgeColor = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:border-rose-500/40';
  let dotColor = 'bg-rose-500';
  let label = 'API Offline';

  if (isChecking && !health) {
    badgeColor = 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
    dotColor = 'bg-gray-400 animate-ping';
    label = 'Checking...';
  } else if (!isConfigured) {
    badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:border-amber-500/40 animate-pulse';
    dotColor = 'bg-amber-500';
    label = 'Connect Backend';
  } else if (isHealthy) {
    badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40';
    dotColor = 'bg-emerald-500';
    label = health.latencyMs !== undefined ? `API Live (${health.latencyMs}ms)` : 'API Live';
  } else if (isSleeping) {
    badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:border-amber-500/40';
    dotColor = 'bg-amber-500 animate-pulse';
    label = 'Render Sleeping';
  }

  return (
    <button
      onClick={onOpenConfigModal}
      title={
        isHealthy
          ? `Connected to backend: ${health?.url}`
          : isSleeping
          ? 'Render backend is in free-tier sleep mode. Click to wake up.'
          : 'Click to configure or test your Render backend URL.'
      }
      className={cn(
        'group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-200 shadow-sm active:scale-95 cursor-pointer',
        badgeColor,
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        {isHealthy && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={cn('relative inline-flex rounded-full h-2 w-2', dotColor)} />
      </span>

      <span className="truncate max-w-[130px] sm:max-w-[170px]">{label}</span>

      {isChecking && (
        <RefreshCw className="w-2.5 h-2.5 animate-spin opacity-70 ml-0.5" />
      )}
    </button>
  );
};
