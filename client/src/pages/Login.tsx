import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, ShieldCheck, ArrowRight, UserCheck, Lock } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, switchRoleDemo } = useAuthStore();
  const [email, setEmail] = useState('engineer@sentinelburn.aero');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await login(email, password);
    setLoading(false);
    navigate('/dashboard');
  };

  const handleQuickRole = (role: UserRole, userEmail: string) => {
    switchRoleDemo(role);
    navigate('/dashboard');
  };

  return (
    <div className="max-w-md mx-auto my-12 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-cyber-cyan/20 to-blue-600/30 border border-cyber-cyan/50 shadow-cyan-glow">
          <Radio className="w-8 h-8 text-cyber-cyan animate-pulse" />
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-wider">
          SENTINEL<span className="text-cyber-cyan">BURN</span> AI
        </h1>
        <p className="text-xs font-mono text-slate-400">
          ISRO Space-Grade Qualification & Telemetry Surveillance
        </p>
      </div>

      <div className="bg-space-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-2xl space-y-5">
        <form onSubmit={handleLogin} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-slate-300 mb-1.5">AEROSPACE ID (EMAIL)</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-space-850 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyber-cyan"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1.5">SECURITY CREDENTIAL (PASSWORD)</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-space-850 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyber-cyan"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-cyber-cyan text-space-950 font-bold hover:bg-cyan-300 transition-colors shadow-cyan-glow flex items-center justify-center gap-2 mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In to Operations Console'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* 1-Click Demo Quick Role Login */}
        <div className="pt-4 border-t border-slate-800 space-y-2 text-xs font-mono">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>QUICK DEMO ROLES (1-CLICK)</span>
            <span className="text-amber-400">FOR JUDGES</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickRole('reliability_engineer', 'engineer@sentinelburn.aero')}
              className="p-2 rounded bg-space-850 hover:bg-slate-800 border border-slate-700 text-left text-slate-200 transition-colors"
            >
              <div className="font-semibold text-cyber-cyan">Reliability Lead</div>
              <div className="text-[10px] text-slate-400">Monitoring & Dispositions</div>
            </button>

            <button
              onClick={() => handleQuickRole('qa_manager', 'qa@sentinelburn.aero')}
              className="p-2 rounded bg-space-850 hover:bg-slate-800 border border-slate-700 text-left text-slate-200 transition-colors"
            >
              <div className="font-semibold text-emerald-400">QA Director</div>
              <div className="text-[10px] text-slate-400">Audit Reports & Approval</div>
            </button>

            <button
              onClick={() => handleQuickRole('operator', 'operator@sentinelburn.aero')}
              className="p-2 rounded bg-space-850 hover:bg-slate-800 border border-slate-700 text-left text-slate-200 transition-colors"
            >
              <div className="font-semibold text-blue-400">Floor Operator</div>
              <div className="text-[10px] text-slate-400">Run Start / Stop Only</div>
            </button>

            <button
              onClick={() => handleQuickRole('fa_engineer', 'fa@sentinelburn.aero')}
              className="p-2 rounded bg-space-850 hover:bg-slate-800 border border-slate-700 text-left text-slate-200 transition-colors"
            >
              <div className="font-semibold text-amber-400">Failure Analysis</div>
              <div className="text-[10px] text-slate-400">SHAP Root Cause Deep Dive</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
