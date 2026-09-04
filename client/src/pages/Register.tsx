import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Radio, ShieldCheck, ArrowRight, UserPlus, Lock, Mail, User } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('reliability_engineer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authApi.register({ name, email, password, role });
      login(res.user, res.token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please verify information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-space-900/90 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-cyber-cyan/20 to-blue-600/30 border border-cyber-cyan/50 flex items-center justify-center shadow-cyan-glow mb-4">
            <Radio className="w-6 h-6 text-cyber-cyan animate-pulse" />
          </div>
          <h2 className="text-2xl font-extrabold text-white uppercase tracking-wider font-mono">
            Register Aerospace Account
          </h2>
          <p className="mt-2 text-xs text-slate-400 font-mono">
            ISRO SIH26170 · Component Screening & Burn-In Intelligence
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Registration Form */}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">FULL NAME & TITLE</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. K. Radhakrishnan"
                className="w-full bg-space-950 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyber-cyan font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">ORGANIZATION EMAIL</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="engineer@sentinelburn.aero"
                className="w-full bg-space-950 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyber-cyan font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">PASSWORD</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-space-950 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyber-cyan font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">QUALIFICATION ROLE</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full bg-space-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyber-cyan font-mono"
            >
              <option value="reliability_engineer">Reliability Lead (Monitor, SHAP & Dispositions)</option>
              <option value="qa_manager">QA Director (Review, Approve & Reports)</option>
              <option value="operator">Floor Operator (Chamber & Telemetry Operation)</option>
              <option value="fa_engineer">Failure Analysis Specialist (In-depth Review)</option>
              <option value="admin">System Administrator (Full Privileges)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyber-cyan text-space-950 font-bold text-xs shadow-cyan-glow hover:bg-cyan-300 transition-colors font-mono uppercase mt-4"
          >
            <UserPlus className="w-4 h-4" />
            {loading ? 'Creating Credentials...' : 'Create Aerospace Account'}
          </button>
        </form>

        <div className="text-center pt-2">
          <Link to="/login" className="text-xs font-mono text-cyber-cyan hover:underline">
            Already have an account? Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
};
