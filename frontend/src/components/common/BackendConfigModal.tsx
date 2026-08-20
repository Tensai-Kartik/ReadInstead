import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Server,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Activity,
  Database,
  Key,
  Globe,
  ExternalLink,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import {
  getBackendUrl,
  setBackendUrl,
  resetBackendUrl,
  isLiveProduction,
  BACKEND_URL_STORAGE_KEY,
} from '../../lib/config';
import {
  checkBackendConnection,
  wakeUpRenderBackend,
  BackendHealthDetails,
} from '../../services/backendHealth';

export interface BackendConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackendConfigModal: React.FC<BackendConfigModalProps> = ({ isOpen, onClose }) => {
  const [urlInput, setUrlInput] = useState('');
  const [health, setHealth] = useState<BackendHealthDetails | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [wakeUpMessage, setWakeUpMessage] = useState('');
  const [wakeUpProgress, setWakeUpProgress] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const activeUrl = getBackendUrl();
      setUrlInput(activeUrl);
      setSaveSuccess(false);
      setWakeUpMessage('');
      setWakeUpProgress(0);

      // Perform auto-test when modal opens
      handleTest(activeUrl);
    }
  }, [isOpen]);

  const handleTest = async (testUrl?: string) => {
    setIsTesting(true);
    setSaveSuccess(false);
    try {
      const target = testUrl !== undefined ? testUrl : urlInput;
      const res = await checkBackendConnection(target);
      setHealth(res);
    } catch {
      setHealth({
        status: 'offline',
        url: urlInput,
        error: 'Network connection failed.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const clean = urlInput.trim();
    setBackendUrl(clean);
    setSaveSuccess(true);
    handleTest(clean);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  const handleReset = () => {
    resetBackendUrl();
    const fallback = getBackendUrl();
    setUrlInput(fallback);
    setSaveSuccess(true);
    handleTest(fallback);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 2500);
  };

  const handleWakeUp = async () => {
    setIsWakingUp(true);
    setWakeUpProgress(5);
    try {
      const result = await wakeUpRenderBackend(urlInput, (attempt, max, msg) => {
        setWakeUpMessage(msg);
        setWakeUpProgress(Math.round((attempt / max) * 100));
      });

      if (result.success) {
        await handleTest(urlInput);
      } else {
        setWakeUpMessage(result.error || 'Wake-up failed.');
      }
    } finally {
      setIsWakingUp(false);
    }
  };

  if (!isOpen) return null;

  const isHealthy = health?.status === 'healthy';
  const isLive = isLiveProduction();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="relative w-full max-w-xl bg-white dark:bg-[#12151E] border border-gray-200 dark:border-[#232736] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-[#1E2230] bg-gray-50/50 dark:bg-[#161923]/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Cloud Backend & API Connection
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Configure Render FastAPI connection & check live server health
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
            {/* Backend URL Input Section */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>FastAPI Backend URL</span>
                {localStorage.getItem(BACKEND_URL_STORAGE_KEY) && (
                  <span className="text-[10px] text-primary-600 dark:text-primary-400 font-semibold px-2 py-0.5 bg-primary-500/10 rounded-full">
                    Custom Override Active
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder={
                      isLive
                        ? 'https://your-backend.onrender.com'
                        : 'http://localhost:8000'
                    }
                    className="w-full font-mono text-xs pl-3 pr-8"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleTest()}
                  disabled={isTesting || isWakingUp}
                  className="shrink-0 text-xs px-3"
                >
                  {isTesting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1 text-primary-500" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 mr-1 text-amber-500" />
                  )}
                  Test
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={isTesting || isWakingUp}
                  className="shrink-0 text-xs px-4"
                >
                  {saveSuccess ? (
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  ) : null}
                  {saveSuccess ? 'Saved!' : 'Save URL'}
                </Button>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Paste your deployed Render backend web service URL (e.g.{' '}
                <code className="text-primary-600 dark:text-primary-400 bg-gray-100 dark:bg-[#1E2230] px-1 py-0.5 rounded">
                  https://readinstead-backend.onrender.com
                </code>
                )
              </p>
            </div>

            {/* Health Diagnostics Panel */}
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#161923] border border-gray-200/80 dark:border-[#232736] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary-500" />
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    Live Diagnostics
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isTesting ? (
                    <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Ping...
                    </span>
                  ) : isHealthy ? (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Healthy ({health.latencyMs}ms)
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                      <AlertCircle className="w-3.5 h-3.5" /> Offline / Sleeping
                    </span>
                  )}
                </div>
              </div>

              {/* Metric badges if healthy */}
              {isHealthy && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-200/50 dark:border-[#232736]">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#1A1E2B] border border-gray-200/60 dark:border-[#232736]/60">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                      <Cpu className="w-3 h-3 text-indigo-500" /> Engine
                    </div>
                    <div className="text-xs font-bold text-gray-900 dark:text-white truncate mt-0.5">
                      faster-whisper
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#1A1E2B] border border-gray-200/60 dark:border-[#232736]/60">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                      <Key className="w-3 h-3 text-amber-500" /> Groq Pool
                    </div>
                    <div className="text-xs font-bold text-gray-900 dark:text-white truncate mt-0.5">
                      {health.active_keys_count ?? 1} Key(s) Active
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#1A1E2B] border border-gray-200/60 dark:border-[#232736]/60 col-span-2 sm:col-span-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                      <Database className="w-3 h-3 text-emerald-500" /> Supabase
                    </div>
                    <div className="text-xs font-bold text-gray-900 dark:text-white truncate mt-0.5">
                      Connected
                    </div>
                  </div>
                </div>
              )}

              {/* Offline error details */}
              {!isHealthy && health?.error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Connection Issue
                  </div>
                  <p className="text-[11px] opacity-90">{health.error}</p>
                </div>
              )}

              {/* Render Cold-Start Wake-up Helper */}
              {!isHealthy && (
                <div className="pt-2 border-t border-gray-200/50 dark:border-[#232736] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      Render Free Tier sleeping?
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleWakeUp}
                      disabled={isWakingUp || !urlInput}
                      className="text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                    >
                      {isWakingUp ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                      )}
                      {isWakingUp ? 'Waking Up (~30s)...' : 'Wake Up Server'}
                    </Button>
                  </div>

                  {isWakingUp && (
                    <div className="space-y-1.5">
                      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${wakeUpProgress}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 animate-pulse">
                        {wakeUpMessage || 'Pinging Render server until ready...'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step-by-step Setup Guide */}
            <div className="p-4 rounded-2xl bg-primary-500/5 border border-primary-500/15 space-y-2.5">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary-500" />
                How to configure Vercel & Render permanently
              </h4>
              <ol className="text-xs text-gray-600 dark:text-gray-300 space-y-1.5 list-decimal pl-4">
                <li>
                  Deploy your backend on <strong>Render</strong> using{' '}
                  <code className="bg-gray-100 dark:bg-[#1E2230] px-1 py-0.5 rounded text-primary-600 dark:text-primary-400">
                    render.yaml
                  </code>
                  .
                </li>
                <li>
                  Copy your live Render web service URL (e.g.{' '}
                  <span className="font-mono text-primary-500">
                    https://readinstead-backend.onrender.com
                  </span>
                  ).
                </li>
                <li>
                  In <strong>Vercel Dashboard</strong> ➔ <strong>Project Settings</strong> ➔{' '}
                  <strong>Environment Variables</strong>, add:
                  <div className="mt-1 p-2 rounded-lg bg-gray-900 text-gray-100 font-mono text-[11px] select-all">
                    VITE_BACKEND_URL=https://your-service.onrender.com
                  </div>
                </li>
                <li>Redeploy your Vercel frontend for the build to lock in the environment variable.</li>
              </ol>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-[#1E2230] bg-gray-50/50 dark:bg-[#161923]/50">
            <button
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 underline font-medium"
            >
              Reset to Defaults
            </button>

            <Button variant="outline" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
