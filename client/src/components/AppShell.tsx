import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Activity, 
  Cpu, 
  FileText, 
  Layers, 
  Bell, 
  ShieldCheck, 
  Radio, 
  Terminal, 
  User as UserIcon,
  ChevronDown,
  Sparkles,
  Sliders
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useRunStore } from '../store/runStore';
import { AlertDrawer } from './AlertDrawer';
import { VoiceCopilot } from './VoiceCopilot';
import { DemoModeModal } from './DemoModeModal';
import { UserRole } from '../types';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const location = useLocation();
  const { user, switchRoleDemo } = useAuthStore();
  const { unreadAlertCount, isSocketConnected } = useRunStore();
  const [isAlertDrawerOpen, setIsAlertDrawerOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  const navLinks = [
    { name: 'Mission Console', path: '/dashboard', icon: Activity },
    { name: 'Burn-In Runs', path: '/runs', icon: Cpu },
    { name: 'Qualification Reports', path: '/reports', icon: FileText },
    { name: 'AI Ensemble & SHAP', path: '/models', icon: Layers },
    { name: 'Settings', path: '/settings', icon: Sliders },
  ];

  const rolesList: { role: UserRole; title: string; badge: string }[] = [
    { role: 'reliability_engineer', title: 'Reliability Lead', badge: 'ENGINEER' },
    { role: 'qa_manager', title: 'QA Director', badge: 'QA MANAGER' },
    { role: 'operator', title: 'Floor Operator', badge: 'OPERATOR' },
    { role: 'fa_engineer', title: 'Failure Analysis Lead', badge: 'FA ENGINEER' },
    { role: 'admin', title: 'System Administrator', badge: 'ADMIN' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-space-950 text-slate-100 selection:bg-cyber-cyan selection:text-space-950">
      {/* Aerospace Navigation Bar */}
      <header className="sticky top-0 z-40 bg-space-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-cyber-cyan/20 to-blue-600/30 border border-cyber-cyan/50 shadow-cyan-glow group-hover:scale-105 transition-transform">
                <Radio className="w-5 h-5 text-cyber-cyan animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-wider text-base lg:text-lg bg-gradient-to-r from-white via-slate-200 to-cyber-cyan bg-clip-text text-transparent">
                    SENTINEL<span className="text-cyber-cyan">BURN</span> AI
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono tracking-widest uppercase bg-blue-900/50 text-cyber-cyan border border-cyber-cyan/30">
                    SIH26170
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 tracking-tight flex items-center gap-1.5">
                  <span className="text-amber-400">ISRO</span> QUALIFICATION SCREENING & BURN-IN CORE
                </div>
              </div>
            </Link>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-800">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname.startsWith(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Header Status & User Actions */}
          <div className="flex items-center gap-4">
            {/* Live Telemetry Bus Status Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-space-850 border border-slate-800 text-[11px] font-mono">
              <span className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span className={isSocketConnected ? 'text-emerald-400' : 'text-amber-400'}>
                {isSocketConnected ? 'LIVE BUS ACTIVE' : 'RECONNECTING'}
              </span>
            </div>

            {/* 1-Click Presentation Demo Mode Button */}
            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-600 text-space-950 font-mono font-bold text-xs shadow-amber-glow hover:brightness-110 transition-all cursor-pointer"
              title="Launch 1-Click Presentation Demo Storyline"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">DEMO MODE</span>
            </button>

            {/* Anomaly Alerts Drawer Button */}
            <button
              onClick={() => setIsAlertDrawerOpen(true)}
              className="relative p-2 rounded-lg bg-space-850 hover:bg-slate-800 border border-slate-800 transition-colors"
              title="View Anomaly Alerts"
            >
              <Bell className="w-4 h-4 text-slate-300" />
              {unreadAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-alert-critical text-[10px] font-bold text-white shadow-crimson-glow animate-pulse">
                  {unreadAlertCount}
                </span>
              )}
            </button>

            {/* Role Demo Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-space-850 border border-slate-800 hover:border-slate-700 transition-all text-left"
              >
                <div className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center text-cyber-cyan">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-semibold text-slate-200 leading-none">{user?.name || 'Engineer'}</div>
                  <div className="text-[10px] font-mono text-cyber-cyan uppercase mt-0.5 tracking-wider">{user?.role?.replace('_', ' ')}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Role Dropdown Menu */}
              {isRoleMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-space-900 border border-slate-700 rounded-lg shadow-2xl p-2 z-50">
                  <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <span>DEMO ROLE SWITCHER</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="space-y-1 mt-1">
                    {rolesList.map((r) => (
                      <button
                        key={r.role}
                        onClick={() => {
                          switchRoleDemo(r.role);
                          setIsRoleMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-colors text-left ${
                          user?.role === r.role
                            ? 'bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-medium">{r.title}</div>
                          <div className="text-[10px] text-slate-400">{r.badge}</div>
                        </div>
                        {user?.role === r.role && <ShieldCheck className="w-4 h-4 text-cyber-cyan" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 lg:px-8 py-6">
        {children}
      </main>

      {/* Alert Notifications Drawer */}
      <AlertDrawer isOpen={isAlertDrawerOpen} onClose={() => setIsAlertDrawerOpen(false)} />

      {/* xtWave Voice Reliability Copilot (Draggable Floating Assistant) */}
      <VoiceCopilot />

      {/* 1-Click Judge Presentation Demo Modal */}
      <DemoModeModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-space-950 py-4 px-4 lg:px-8 text-center text-xs font-mono text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            ISRO SIH26170 · Smart Automation Theme · Flight Hardware Qualification
          </div>
          <div className="text-slate-400">
            Ensemble AI Core (Isolation Forest + STL Drift + Sequence Autoencoder + SHAP) · SHA-256 Hash Chain
          </div>
        </div>
      </footer>
    </div>
  );
};
