import { create } from 'zustand';
import { User, UserRole } from '../types';
import { authApi } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  switchRoleDemo: (role: UserRole) => void;
}

const DEMO_USERS: Record<UserRole, User> = {
  admin: {
    id: 'u-admin-01',
    name: 'Dr. Vikram Sarabhai',
    email: 'admin@sentinelburn.aero',
    role: 'admin'
  },
  reliability_engineer: {
    id: 'u-rel-01',
    name: 'K. Radhakrishnan',
    email: 'engineer@sentinelburn.aero',
    role: 'reliability_engineer'
  },
  qa_manager: {
    id: 'u-qa-01',
    name: 'A. S. Kiran Kumar',
    email: 'qa@sentinelburn.aero',
    role: 'qa_manager'
  },
  operator: {
    id: 'u-op-01',
    name: 'Floor Operator 04',
    email: 'operator@sentinelburn.aero',
    role: 'operator'
  },
  fa_engineer: {
    id: 'u-fa-01',
    name: 'Dr. Tessy Thomas',
    email: 'fa@sentinelburn.aero',
    role: 'fa_engineer'
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: DEMO_USERS.reliability_engineer,
  token: 'mock-aerospace-jwt-token',
  isAuthenticated: true,
  isLoading: false,
  error: null,

  login: async (email: string, password = 'password123') => {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.login({ email, password });
      localStorage.setItem('sentinel_token', data.token);
      set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      // Fallback for offline/demo: find matching demo user
      const matched = Object.values(DEMO_USERS).find(u => u.email === email);
      if (matched) {
        set({ user: matched, token: 'mock-aerospace-jwt-token', isAuthenticated: true, isLoading: false });
      } else {
        set({ error: err.response?.data?.error || 'Login failed', isLoading: false });
      }
    }
  },

  logout: () => {
    localStorage.removeItem('sentinel_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  switchRoleDemo: (role: UserRole) => {
    const user = DEMO_USERS[role] || DEMO_USERS.reliability_engineer;
    set({ user, isAuthenticated: true });
  }
}));
