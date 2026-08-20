import React, { useState, useEffect, useRef } from 'react';
import {
  Sun,
  Moon,
  User as UserIcon,
  Camera,
  Trash2,
  AlertTriangle,
  Check,
  UploadCloud,
  Cloud,
  Server,
  Activity,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Key,
  Database,
  Cpu,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { ConfirmModal } from '../common/ConfirmModal';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  getBackendUrl,
  setBackendUrl,
  resetBackendUrl,
  isLiveProduction,
  BACKEND_URL_STORAGE_KEY,
  BACKEND_URL_CHANGED_EVENT,
} from '../../lib/config';
import {
  checkBackendConnection,
  wakeUpRenderBackend,
  BackendHealthDetails,
} from '../../services/backendHealth';

export interface SettingsViewProps {
  onOpenBackendModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenBackendModal }) => {
  const { theme, setTheme } = useTheme();
  const { user, signOut, updateUser } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [isDragging, setIsDragging] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [imageError, setImageError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isConfirmDeleteAccountOpen, setIsConfirmDeleteAccountOpen] = useState(false);
  const [isConfirmDeleteDataOpen, setIsConfirmDeleteDataOpen] = useState(false);

  // Backend connection state
  const [backendUrlInput, setBackendUrlInput] = useState(getBackendUrl());
  const [backendHealth, setBackendHealth] = useState<BackendHealthDetails | null>(null);
  const [isTestingBackend, setIsTestingBackend] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [wakeUpMsg, setWakeUpMsg] = useState('');
  const [wakeUpProg, setWakeUpProg] = useState(0);
  const [backendSaveMsg, setBackendSaveMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.full_name) setFullName(user.full_name);
    if (user?.avatar_url) setAvatarUrl(user.avatar_url);
  }, [user]);

  const testBackend = async (urlToTest?: string) => {
    setIsTestingBackend(true);
    try {
      const res = await checkBackendConnection(urlToTest !== undefined ? urlToTest : backendUrlInput);
      setBackendHealth(res);
    } catch {
      setBackendHealth({
        status: 'offline',
        url: backendUrlInput,
        error: 'Connection check failed',
      });
    } finally {
      setIsTestingBackend(false);
    }
  };

  useEffect(() => {
    testBackend(getBackendUrl());
    const onUrlChange = () => {
      setBackendUrlInput(getBackendUrl());
      testBackend(getBackendUrl());
    };
    window.addEventListener(BACKEND_URL_CHANGED_EVENT, onUrlChange);
    return () => window.removeEventListener(BACKEND_URL_CHANGED_EVENT, onUrlChange);
  }, []);

  const handleSaveBackendUrl = () => {
    const clean = backendUrlInput.trim();
    setBackendUrl(clean);
    setBackendSaveMsg('Backend URL updated successfully!');
    testBackend(clean);
    setTimeout(() => setBackendSaveMsg(''), 3000);
  };

  const handleResetBackendUrl = () => {
    resetBackendUrl();
    const fallback = getBackendUrl();
    setBackendUrlInput(fallback);
    setBackendSaveMsg('Reset to default backend configuration.');
    testBackend(fallback);
    setTimeout(() => setBackendSaveMsg(''), 3000);
  };

  const handleWakeUpRender = async () => {
    setIsWakingUp(true);
    setWakeUpProg(10);
    try {
      const res = await wakeUpRenderBackend(backendUrlInput, (attempt, max, msg) => {
        setWakeUpMsg(msg);
        setWakeUpProg(Math.round((attempt / max) * 100));
      });
      if (res.success) {
        await testBackend(backendUrlInput);
      } else {
        setWakeUpMsg(res.error || 'Wake-up timed out.');
      }
    } finally {
      setIsWakingUp(false);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setImageError('Please select a valid image file (PNG, JPG, WebP, etc.).');
      setTimeout(() => setImageError(''), 3500);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image size should be less than 5MB.');
      setTimeout(() => setImageError(''), 3500);
      return;
    }
    setImageError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const newUrl = e.target.result as string;
        setAvatarUrl(newUrl);
        updateUser({
          avatar_url: newUrl,
        });
        setSaveMessage('Profile picture updated successfully!');
        setTimeout(() => setSaveMessage(''), 2500);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({
      full_name: fullName,
      avatar_url: avatarUrl,
    });

    setSaveMessage('Profile details updated successfully!');
    setTimeout(() => setSaveMessage(''), 2500);

    if (isSupabaseConfigured() && user?.id) {
      try {
        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: fullName,
          avatar_url: avatarUrl,
        });
      } catch (err) {
        console.error('Error saving profile to Supabase:', err);
      }
    }
  };

  const handleDeleteAllUserData = async () => {
    setIsDeletingData(true);
    if (isSupabaseConfigured() && user?.id) {
      try {
        await supabase.from('notes').delete().eq('user_id', user.id);
        await supabase.from('history').delete().eq('user_id', user.id);
      } catch (err) {
        console.error('Error purging user data from Supabase:', err);
      }
    }
    setIsDeletingData(false);
    setIsConfirmDeleteDataOpen(false);
    setSaveMessage('All your personal study data has been deleted from database.');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    if (isSupabaseConfigured() && user?.id) {
      try {
        await supabase.from('profiles').delete().eq('id', user.id);
        await supabase.from('notes').delete().eq('user_id', user.id);
        await supabase.from('history').delete().eq('user_id', user.id);
      } catch (err) {
        console.error('Error purging profile:', err);
      }
    }
    setIsDeletingAccount(false);
    setIsConfirmDeleteAccountOpen(false);
    await signOut();
  };

  const isHealthy = backendHealth?.status === 'healthy';
  const isLive = isLiveProduction();

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Account & System Settings
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Manage your cloud backend connection, appearance theme, profile details, and data preferences.
        </p>
      </div>

      {saveMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* 1. Cloud Backend & API Infrastructure Section */}
      <Card className="p-6 flex flex-col gap-5 shadow-soft-sm">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-border-dark">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-primary-500" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Backend & Cloud API (Render / FastAPI)
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            {isHealthy ? (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Healthy ({backendHealth.latencyMs}ms)
              </span>
            ) : (
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                <AlertCircle className="w-3.5 h-3.5" /> Offline / Disconnected
              </span>
            )}
          </div>
        </div>

        {backendSaveMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{backendSaveMsg}</span>
          </div>
        )}

        <div className="space-y-3">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
            <span>FastAPI Server Endpoint</span>
            {localStorage.getItem(BACKEND_URL_STORAGE_KEY) && (
              <span className="text-[10px] text-primary-600 dark:text-primary-400 font-semibold px-2 py-0.5 bg-primary-500/10 rounded-full">
                Custom Override Saved
              </span>
            )}
          </label>

          <div className="flex gap-2">
            <Input
              value={backendUrlInput}
              onChange={(e) => setBackendUrlInput(e.target.value)}
              placeholder={isLive ? 'https://your-service.onrender.com' : 'http://localhost:8000'}
              className="flex-1 font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => testBackend()}
              disabled={isTestingBackend || isWakingUp}
              className="shrink-0 text-xs px-3"
            >
              {isTestingBackend ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1 text-primary-500" />
              ) : (
                <Zap className="w-3.5 h-3.5 mr-1 text-amber-500" />
              )}
              Test
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveBackendUrl}
              disabled={isTestingBackend || isWakingUp}
              className="shrink-0 text-xs px-4"
            >
              Save URL
            </Button>
          </div>

          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            For live Vercel deployments, enter your Render web service URL (e.g.{' '}
            <code className="text-primary-600 dark:text-primary-400 font-mono bg-gray-100 dark:bg-[#1E2230] px-1 py-0.5 rounded">
              https://readinstead-backend.onrender.com
            </code>
            ).
          </p>

          {/* Diagnostic metrics when healthy */}
          {isHealthy && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-[#1E2230]">
              <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#161923] border border-gray-200/60 dark:border-[#232736]/60">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                  <Cpu className="w-3 h-3 text-indigo-500" /> Engine
                </div>
                <div className="text-xs font-bold text-gray-900 dark:text-white truncate mt-0.5">
                  faster-whisper
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#161923] border border-gray-200/60 dark:border-[#232736]/60">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                  <Key className="w-3 h-3 text-amber-500" /> Groq Pool
                </div>
                <div className="text-xs font-bold text-gray-900 dark:text-white truncate mt-0.5">
                  {backendHealth.active_keys_count ?? 1} Key(s) Active
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#161923] border border-gray-200/60 dark:border-[#232736]/60 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                  <Database className="w-3 h-3 text-emerald-500" /> Database
                </div>
                <div className="text-xs font-bold text-gray-900 dark:text-white truncate mt-0.5">
                  Supabase PostgreSQL
                </div>
              </div>
            </div>
          )}

          {/* Render cold-start wake-up button if disconnected */}
          {!isHealthy && (
            <div className="pt-2 border-t border-gray-100 dark:border-[#1E2230] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Render free tier instance sleeping?
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleWakeUpRender}
                disabled={isWakingUp || !backendUrlInput}
                className="text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              >
                {isWakingUp ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                )}
                {isWakingUp ? 'Waking Up (~30s)...' : 'Wake Up Render Backend'}
              </Button>
            </div>
          )}

          {isWakingUp && (
            <div className="space-y-1.5 pt-1">
              <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${wakeUpProg}%` }}
                />
              </div>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 animate-pulse">
                {wakeUpMsg || 'Sending wake-up ping to Render...'}
              </p>
            </div>
          )}

          <div className="pt-2 flex justify-between items-center text-xs">
            <button
              onClick={handleResetBackendUrl}
              className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 underline font-medium"
            >
              Reset to Defaults
            </button>
            {onOpenBackendModal && (
              <button
                onClick={onOpenBackendModal}
                className="text-primary-600 dark:text-primary-400 font-semibold hover:underline"
              >
                Open Full Connection Wizard ➔
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* 2. Theme Toggle */}
      <Card className="p-6 flex flex-col gap-4 shadow-soft-sm">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-border-dark">
          <Sun className="w-4 h-4 text-primary-500" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Appearance Theme
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`p-4 rounded-2xl border flex items-center justify-center gap-3 transition-all ${
              theme === 'light'
                ? 'border-primary-500 bg-primary-50/50 text-primary-700 font-bold shadow-soft-sm'
                : 'border-gray-200 dark:border-border-dark text-gray-600 dark:text-gray-400 hover:bg-gray-50'
            }`}
          >
            <Sun className="w-5 h-5 text-amber-500" />
            <span className="text-xs font-semibold">Light Mode</span>
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-2xl border flex items-center justify-center gap-3 transition-all ${
              theme === 'dark'
                ? 'border-primary-500 bg-[#161923] text-white font-bold shadow-soft-sm'
                : 'border-gray-200 dark:border-border-dark text-gray-600 dark:text-gray-400 hover:bg-gray-50'
            }`}
          >
            <Moon className="w-5 h-5 text-indigo-400" />
            <span className="text-xs font-semibold">Dark Mode</span>
          </button>
        </div>
      </Card>

      {/* 3. Name & Profile Picture */}
      <Card className="p-6 flex flex-col gap-5 shadow-soft-sm">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-border-dark">
          <UserIcon className="w-4 h-4 text-primary-500" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Profile Information
          </h3>
        </div>

        <form onSubmit={handleSaveProfile} className="flex flex-col gap-5">
          {/* Avatar Drag & Drop Zone */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Profile Photo
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-5">
              {/* Circular Preview with Click Overlay */}
              <div className="relative group shrink-0">
                <img
                  src={avatarUrl || '/assets/logo_bg.png'}
                  alt="Profile Preview"
                  className="w-20 h-20 rounded-full object-cover border-2 border-primary-500 shadow-md ring-4 ring-primary-500/10"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  title="Upload picture"
                >
                  <Camera className="w-5 h-5 mb-0.5" />
                  <span className="text-[9px] font-semibold">Change</span>
                </button>
              </div>

              {/* Drag & Drop Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 w-full border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-950/40 scale-[1.01]'
                    : 'border-gray-300 dark:border-[#282D3D] bg-gray-50/50 dark:bg-[#141722]/50 hover:border-primary-400 dark:hover:border-primary-500/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="p-2.5 rounded-full bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    <span className="text-primary-600 dark:text-primary-400 underline">Click to upload</span> or drag and drop photo
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    PNG, JPG, WebP, SVG up to 5MB
                  </p>
                </div>
              </div>
            </div>

            {imageError && (
              <p className="text-xs text-red-500 font-medium mt-1">{imageError}</p>
            )}
          </div>

          <Input
            label="Full Name"
            placeholder="Your Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            leftIcon={<UserIcon className="w-4 h-4" />}
          />

          <Button type="submit" className="w-max self-end mt-1">
            Save Profile
          </Button>
        </form>
      </Card>

      {/* 4. Danger Zone: Delete User Data & Delete Account */}
      <Card className="p-6 flex flex-col gap-4 shadow-soft-sm border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/10">
        <div className="flex items-center gap-2 pb-3 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400">
          <AlertTriangle className="w-4 h-4" />
          <h3 className="text-sm font-bold uppercase tracking-wider">
            Danger Zone
          </h3>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
          Destructive actions are permanent. Deleting data removes your personal notes and study history from the Supabase database.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConfirmDeleteDataOpen(true)}
            className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50"
          >
            Clear My Study Data
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsConfirmDeleteAccountOpen(true)}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete My Account
          </Button>
        </div>
      </Card>

      {/* Confirm Modal: Delete Data */}
      <ConfirmModal
        isOpen={isConfirmDeleteDataOpen}
        title="Delete All Personal Study Data?"
        description="This action will permanently delete all your custom video notes and learning history from the Supabase database. Videos and pre-generated summaries will remain cached for public reuse."
        confirmText="Yes, Delete My Data"
        isLoading={isDeletingData}
        onConfirm={handleDeleteAllUserData}
        onClose={() => setIsConfirmDeleteDataOpen(false)}
      />

      {/* Confirm Modal: Delete Account */}
      <ConfirmModal
        isOpen={isConfirmDeleteAccountOpen}
        title="Delete Your Account Permanently?"
        description="Are you absolutely sure? This will delete your user profile, purge all linked study records, and sign you out immediately. This operation cannot be undone."
        confirmText="Yes, Delete Account"
        isLoading={isDeletingAccount}
        onConfirm={handleDeleteAccount}
        onClose={() => setIsConfirmDeleteAccountOpen(false)}
      />
    </div>
  );
};
