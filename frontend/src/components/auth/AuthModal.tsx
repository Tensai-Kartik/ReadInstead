import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User as UserIcon, Sparkles, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalMode, signIn, signUp, resetPassword, openAuthModal } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      if (authModalMode === 'signin') {
        const res = await signIn(email, password);
        if (res.error) setErrorMsg(res.error);
      } else if (authModalMode === 'signup') {
        const res = await signUp(email, password, fullName);
        if (res.error) setErrorMsg(res.error);
      } else if (authModalMode === 'forgot') {
        const res = await resetPassword(email);
        if (res.error) setErrorMsg(res.error);
        else if (res.message) setSuccessMsg(res.message);
      }
    } catch {
      setErrorMsg('An unexpected authentication error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAuthModal}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Dialog Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-3xl p-6 sm:p-8 shadow-soft-lg z-10"
        >
          {/* Close button */}
          <button
            onClick={closeAuthModal}
            className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-950/80 border border-primary-200 dark:border-primary-800 flex items-center justify-center text-primary-600 dark:text-primary-400 mb-3 shadow-soft-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {authModalMode === 'signin' && 'Welcome Back'}
              {authModalMode === 'signup' && 'Create Your Account'}
              {authModalMode === 'forgot' && 'Reset Password'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {authModalMode === 'signin' && 'Log in to access your video summaries and flashcards'}
              {authModalMode === 'signup' && 'Transform long videos into instant structured knowledge'}
              {authModalMode === 'forgot' && 'Enter your email to receive a password reset link'}
            </p>
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/60 text-xs font-medium text-red-600 dark:text-red-300">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-xs font-medium text-emerald-600 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {authModalMode === 'signup' && (
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

            {authModalMode !== 'forgot' && (
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

            {authModalMode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => openAuthModal('forgot')}
                  className="text-xs text-primary-600 hover:text-primary-500 font-medium"
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
              className="mt-2 w-full"
            >
              {authModalMode === 'signin' && 'Sign In'}
              {authModalMode === 'signup' && 'Create Account'}
              {authModalMode === 'forgot' && 'Send Reset Link'}
            </Button>
          </form>

          {/* Toggle Footer */}
          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-border-dark text-center text-xs text-gray-500 dark:text-gray-400">
            {authModalMode === 'signin' ? (
              <p>
                Don't have an account?{' '}
                <button
                  onClick={() => openAuthModal('signup')}
                  className="text-primary-600 dark:text-primary-400 font-semibold hover:underline"
                >
                  Sign Up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  onClick={() => openAuthModal('signin')}
                  className="text-primary-600 dark:text-primary-400 font-semibold hover:underline"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
