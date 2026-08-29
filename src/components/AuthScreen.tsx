import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Lock, User, Mail, Gamepad2, Sword, Coins } from 'lucide-react';
import { dataService } from '../services/dataService';

export const AuthScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter your email address first.');
      return;
    }
    setError(null);
    setInfoMessage(null);
    setResetLoading(true);
    try {
      await dataService.resetPassword(email.trim());
      setInfoMessage(`Password reset link sent to ${email.trim()}! Please check your inbox.`);
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!username.trim()) throw new Error('Username is required.');
        if (username.length < 3) throw new Error('Username must be at least 3 characters.');
        await signUp(username.trim(), email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-[#09090b]">
      {/* Background RPG accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 dark:bg-purple-500/5 rounded-full filter blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full filter blur-3xl" />
      </div>

      <div className="w-full max-w-md bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden relative z-10 transition-colors">
        
        {/* Game Badge Header */}
        <div className="p-6 text-center border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="inline-flex p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-3 ring-4 ring-blue-50 dark:ring-blue-950/20">
            <Gamepad2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center justify-center gap-2">
            Budget<span className="text-blue-500 dark:text-blue-400">RPG</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Level up your savings, conquer your expenses.
          </p>

          {/* Connection Mode Indicator */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">
            <span className={`w-2 h-2 rounded-full ${dataService.isFirebase ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            {dataService.isFirebase ? 'Firebase Database Connected' : 'Local Storage Mode (Offline)'}
          </div>
        </div>

        {/* Auth Tabs */}
        <div className="grid grid-cols-2 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => { setIsSignUp(false); setError(null); }}
            className={`py-3 text-sm font-semibold transition-all border-b-2 ${
              !isSignUp
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-900/10'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Enter Tavern (Sign In)
          </button>
          <button
            onClick={() => { setIsSignUp(true); setError(null); }}
            className={`py-3 text-sm font-semibold transition-all border-b-2 ${
              isSignUp
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-900/10'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Create Hero (Sign Up)
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {infoMessage && (
            <div className="p-3.5 rounded-lg border text-sm flex gap-2.5 items-start bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400">
              <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-lg border text-sm flex gap-2.5 items-start bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30 text-rose-800 dark:text-rose-400">
              <Sword className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isSignUp && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Hero Name (Username)
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4.5 h-4.5 text-zinc-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. BudgetKnight"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {isSignUp ? 'Email Address' : 'Email or Username'}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4.5 h-4.5 text-zinc-400" />
              <input
                type={isSignUp ? 'email' : 'text'}
                required
                placeholder={isSignUp ? 'hero@realm.com' : 'hero@realm.com or Username'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>
            {!isSignUp && dataService.isFirebase && (
              <span className="block text-[10px] text-zinc-400 mt-1">
                * Live Firebase Mode requires Email for login
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Secret Cipher (Password)
              </label>
              {!isSignUp && dataService.isFirebase && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-[11px] text-blue-500 hover:text-blue-600 dark:text-blue-400 hover:underline transition-colors disabled:opacity-50"
                >
                  {resetLoading ? 'Sending...' : 'Forgot password?'}
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4.5 h-4.5 text-zinc-400" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500/50 text-white rounded-lg py-2.5 font-bold transition-all shadow-md active:scale-[0.98]"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                {isSignUp ? 'Embark on Quest (Sign Up)' : 'Enter Sanctuary (Sign In)'}
              </>
            )}
          </button>
        </form>

        {/* Start Game Tips */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/30 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 space-y-1 text-center">
          <p className="font-semibold flex items-center justify-center gap-1 text-zinc-700 dark:text-zinc-300">
            <Coins className="w-3.5 h-3.5 text-yellow-500" /> Starting Loot: 100 gold coins included!
          </p>
          <p>Staying under budget increases your Streak & earns bonus XP/Gold.</p>
        </div>
      </div>
    </div>
  );
};

