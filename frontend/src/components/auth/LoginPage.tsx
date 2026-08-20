import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, User as UserIcon, ArrowRight, CheckCircle2, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useTheme } from '../../context/ThemeContext';

export const LoginPage: React.FC = () => {
  const { signIn, signUp, resetPassword } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const res = await signIn(email, password);
        if (res.error) setErrorMsg(res.error);
      } else if (mode === 'signup') {
        const res = await signUp(email, password, fullName);
        if (res.error) {
          setErrorMsg(res.error);
        } else {
          // Auto sign in immediately on signup
          await signIn(email, password);
        }
      } else if (mode === 'forgot') {
        const res = await resetPassword(email);
        if (res.error) setErrorMsg(res.error);
        else if (res.message) setSuccessMsg(res.message);
      }
    } catch {
      setErrorMsg('An error occurred during authentication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-between items-center bg-gradient-to-br from-indigo-950 via-[#0E1017] to-purple-950 text-white selection:bg-primary-500 selection:text-white p-4 sm:p-8 relative overflow-hidden transition-colors duration-300">
      {/* Purple Ambient Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-600/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="w-full max-w-5xl flex items-center justify-between z-10 pt-2">
        <div className="flex items-center gap-1.5">
          <img
            src="/assets/logo_bg.png"
            alt="ReadInstead Logo"
            className="w-9 h-9 object-contain drop-shadow-md"
          />
          <span className="text-2xl font-extrabold tracking-tight text-white">
            Read<span className="text-primary-400">Instead</span>
          </span>
        </div>

        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 transition-colors"
          title="Toggle Theme"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </header>

      {/* Centered Login / Sign Up Card */}
      <main className="w-full my-auto flex items-center justify-center z-10 py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-md bg-[#131620]/90 backdrop-blur-xl border border-primary-500/20 rounded-3xl p-7 sm:p-10 shadow-2xl shadow-primary-950/50 flex flex-col gap-6"
        >
          {/* Header */}
          <div className="flex flex-col items-center text-center gap-1.5">
            <img
              src="/assets/logo_bg.png"
              alt="ReadInstead Logo"
              className="w-14 h-14 object-contain mb-1 drop-shadow-md hover:scale-105 transition-transform"
            />
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {mode === 'signin' && 'Welcome Back'}
              {mode === 'signup' && 'Create Your Account'}
              {mode === 'forgot' && 'Reset Password'}
            </h2>
            <p className="text-xs text-gray-400 max-w-xs">
              {mode === 'signin' && 'Sign in to access your video summaries and personal notes'}
              {mode === 'signup' && 'Sign up to start transforming video lectures into knowledge'}
              {mode === 'forgot' && 'Enter your email address to receive reset instructions'}
            </p>
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-xs font-medium text-red-300">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-xs font-medium text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <Input
                label="Full Name"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                leftIcon={<UserIcon className="w-4 h-4" />}
                required
              />
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            {mode !== 'forgot' && (
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />
            )}

            {mode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs text-primary-400 font-semibold hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="mt-2 w-full bg-primary-600 hover:bg-primary-500 shadow-glow-purple"
            >
              {mode === 'signin' && 'Sign In'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'forgot' && 'Send Reset Link'}
            </Button>
          </form>

          {/* Mode Switcher Footer */}
          <div className="pt-4 border-t border-white/10 text-center text-xs text-gray-400">
            {mode === 'signin' ? (
              <p>
                Don't have an account?{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="text-primary-400 font-bold hover:underline"
                >
                  Sign Up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  onClick={() => setMode('signin')}
                  className="text-primary-400 font-bold hover:underline"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </motion.div>
      </main>

      {/* Footer Tagline */}
      <footer className="z-10 text-xs text-gray-400 font-medium pb-2 text-center">
        ReadInstead • Learn more. Watch less.
      </footer>
    </div>
  );
};
