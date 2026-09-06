import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Terminal, Lock, AlertCircle, ArrowLeft, ShieldCheck, Flame, KeyRound } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export const FloorLogin: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const success = await login(email, password);
    if (success) {
      // Check role
      const currentUser = useAuthStore.getState().user;
      if (currentUser && currentUser.role !== 'operator') {
        setError(
          `Access Denied: Account role '${currentUser.role}' is not authorized for Floor Terminal Bay 04. Use the main portal.`
        );
        return;
      }
      navigate('/dashboard');
    } else {
      setError(useAuthStore.getState().error || 'Invalid terminal badge ID or password');
    }
  };

  const handleFillDemo = () => {
    setEmail('operator@sentinelburn.aero');
    setPassword('password123');
  };

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Back button */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Main Login
        </Link>
        <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
          TERMINAL // BAY-04
        </span>
      </div>

      <div className="w-full max-w-md bg-surface-card border-2 border-amber-500/40 rounded-3xl p-8 space-y-6 shadow-2xl relative z-10">
        {/* Terminal Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 mb-1">
            <Flame className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">
            Floor Operator Terminal
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Cleanroom Chamber Bay 04 • High-Reliability Authentication
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5 font-mono">
              Operator Badge Email / ID
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@sentinelburn.aero"
              className="w-full bg-surface-elevated border-2 border-white/10 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500 font-mono transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5 font-mono">
              Terminal Security Key / Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-surface-elevated border-2 border-white/10 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500 font-mono transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-black text-sm font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 disabled:opacity-50"
          >
            {isLoading ? 'Authenticating Terminal...' : 'Unlock Bay Terminal'}
          </button>
        </form>

        {/* Demo Fill Helper */}
        <div className="pt-2 border-t border-white/5 text-center">
          <button
            type="button"
            onClick={handleFillDemo}
            className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Fill Operator Demo Credentials (operator@sentinelburn.aero)
          </button>
        </div>
      </div>
    </div>
  );
};
