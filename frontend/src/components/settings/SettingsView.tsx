import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, User as UserIcon, Camera, Trash2, AlertTriangle, Check, UploadCloud } from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { ConfirmModal } from '../common/ConfirmModal';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const SettingsView: React.FC = () => {
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.full_name) setFullName(user.full_name);
    if (user?.avatar_url) setAvatarUrl(user.avatar_url);
  }, [user]);

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

    // Update global state immediately
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

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Account Settings
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Manage your theme, profile details, and data preferences.
        </p>
      </div>

      {saveMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* 1. Theme Toggle */}
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

      {/* 2. Name & Profile Picture */}
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

      {/* 3. Danger Zone: Delete User Data & Delete Account */}
      <Card className="p-6 flex flex-col gap-4 shadow-soft-sm border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/10">
        <div className="flex items-center gap-2 pb-3 border-b border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400">
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
