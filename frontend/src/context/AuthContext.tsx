import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string; message?: string }>;
  updateUser: (data: Partial<UserProfile>) => void;
  updatePassword: (newPassword: string) => Promise<{ error?: string; message?: string }>;
  isAuthModalOpen: boolean;
  openAuthModal: (mode?: 'signin' | 'signup' | 'forgot') => void;
  closeAuthModal: () => void;
  authModalMode: 'signin' | 'signup' | 'forgot';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getRedirectUrl(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'https://readinstead-chi.vercel.app';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const savedProfile = localStorage.getItem('readinstead_user_profile');
      if (savedProfile) {
        return JSON.parse(savedProfile);
      }
    } catch {}
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | 'forgot'>('signin');

  useEffect(() => {
    const initAuth = async () => {
      let localData: Partial<UserProfile> = {};
      try {
        const savedProfile = localStorage.getItem('readinstead_user_profile');
        if (savedProfile) {
          localData = JSON.parse(savedProfile);
        }
      } catch {}

      if (isSupabaseConfigured()) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const mergedUser: UserProfile = {
              id: session.user.id,
              email: session.user.email || '',
              full_name: localData.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Learner',
              avatar_url: localData.avatar_url || session.user.user_metadata?.avatar_url || '',
              study_hours: localData.study_hours ?? 0,
              daily_goal_minutes: localData.daily_goal_minutes ?? 60,
              daily_goal_progress_minutes: localData.daily_goal_progress_minutes ?? 0,
              completed_sessions: localData.completed_sessions ?? 0,
              avg_session_duration_minutes: localData.avg_session_duration_minutes ?? 0,
            };
            setUser(mergedUser);
            try {
              localStorage.setItem('readinstead_user_profile', JSON.stringify(mergedUser));
            } catch {}
          } else {
            setUser(null);
          }
        } catch (err) {
          console.error('Error fetching Supabase session:', err);
          setUser(null);
        }
      } else {
        if (localData && localData.id) {
          setUser(localData as UserProfile);
        } else {
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();

    if (isSupabaseConfigured()) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          // Open settings or notify user to update password
          openAuthModal('signin');
        }

        if (session?.user) {
          let localData: Partial<UserProfile> = {};
          try {
            const saved = localStorage.getItem('readinstead_user_profile');
            if (saved) localData = JSON.parse(saved);
          } catch {}

          const mergedUser: UserProfile = {
            id: session.user.id,
            email: session.user.email || '',
            full_name: localData.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Learner',
            avatar_url: localData.avatar_url || session.user.user_metadata?.avatar_url || '',
            study_hours: localData.study_hours ?? 0,
            daily_goal_minutes: localData.daily_goal_minutes ?? 60,
            daily_goal_progress_minutes: localData.daily_goal_progress_minutes ?? 0,
            completed_sessions: localData.completed_sessions ?? 0,
            avg_session_duration_minutes: localData.avg_session_duration_minutes ?? 0,
          };
          setUser(mergedUser);
          try {
            localStorage.setItem('readinstead_user_profile', JSON.stringify(mergedUser));
          } catch {}
        } else {
          setUser(null);
          localStorage.removeItem('readinstead_user_profile');
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  const openAuthModal = (mode: 'signin' | 'signup' | 'forgot' = 'signin') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const signIn = async (email: string, password: string) => {
    if (!email || !password) {
      return { error: 'Please fill in all fields' };
    }

    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
    } else {
      const newUser: UserProfile = {
        id: `usr_${Date.now()}`,
        email,
        full_name: email.split('@')[0],
        avatar_url: '',
        study_hours: 0,
        daily_goal_minutes: 60,
        daily_goal_progress_minutes: 0,
        completed_sessions: 0,
        avg_session_duration_minutes: 0,
      };
      setUser(newUser);
      localStorage.setItem('readinstead_user_profile', JSON.stringify(newUser));
    }
    closeAuthModal();
    return {};
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    if (!email || !password) {
      return { error: 'Please fill in all required fields' };
    }

    if (isSupabaseConfigured()) {
      const redirectUrl = getRedirectUrl();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: redirectUrl,
        }
      });
      if (error) return { error: error.message };
    } else {
      const newUser: UserProfile = {
        id: `usr_${Date.now()}`,
        email,
        full_name: fullName || email.split('@')[0],
        avatar_url: '',
        study_hours: 0,
        daily_goal_minutes: 60,
        daily_goal_progress_minutes: 0,
        completed_sessions: 0,
        avg_session_duration_minutes: 0,
      };
      setUser(newUser);
      localStorage.setItem('readinstead_user_profile', JSON.stringify(newUser));
    }
    closeAuthModal();
    return {};
  };

  const signOut = async () => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }
    setUser(null);
    localStorage.removeItem('readinstead_user_profile');
    localStorage.removeItem('readinstead_saved_videos');
    localStorage.removeItem('readinstead_active_video_id');
  };

  const resetPassword = async (email: string) => {
    if (!email) return { error: 'Email is required' };
    if (isSupabaseConfigured()) {
      const redirectUrl = getRedirectUrl();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) return { error: error.message };
    }
    return { message: 'Password reset link sent to your email.' };
  };

  const updatePassword = async (newPassword: string) => {
    if (!newPassword || newPassword.length < 6) {
      return { error: 'Password must be at least 6 characters.' };
    }
    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { error: error.message };
      return { message: 'Password successfully updated.' };
    }
    return { message: 'Password updated locally.' };
  };

  const updateUser = (data: Partial<UserProfile>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      try {
        localStorage.setItem('readinstead_user_profile', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (isSupabaseConfigured()) {
      try {
        supabase.auth.updateUser({
          data: {
            full_name: data.full_name,
            avatar_url: data.avatar_url,
          },
        }).catch(() => {});
      } catch {}
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateUser,
        updatePassword,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        authModalMode
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
