import { create } from 'zustand';
import { User, UserRole } from '../types';
import { authApi } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password?: string) => Promise<boolean>;
  register: (data: { name: string; email: string; password: string; confirmPassword?: string; role?: UserRole }) => Promise<boolean>;
  loginWithGoogle: (payload: { credential?: string; email?: string; name?: string }) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  switchRoleDemo: (role: UserRole) => void;
}

// Persona identity map — single source of truth for all persona names
export const PERSONA_MAP: Record<UserRole, { personaName: string; title: string; badge: string; avatarColor: string }> = {
  reliability_engineer: { personaName: 'Dr. Afrith',  title: 'Reliability Lead',       badge: 'ENGINEER',    avatarColor: 'bg-cyber-cyan'   },
  qa_manager:           { personaName: 'Dr. Selvi',   title: 'QA Director',             badge: 'QA MANAGER',  avatarColor: 'bg-violet-500'   },
  operator:             { personaName: '',             title: 'Floor Operator',           badge: 'OPERATOR',    avatarColor: 'bg-amber-500'    },
  fa_engineer:          { personaName: 'Dr. Balaji',  title: 'Failure Analysis Lead',    badge: 'FA ENGINEER', avatarColor: 'bg-rose-500'     },
  admin:                { personaName: 'Dr. Mohamed', title: 'System Administrator',     badge: 'ADMIN',       avatarColor: 'bg-emerald-500'  },
};

const DEMO_USERS: Record<UserRole, User> = {
  admin: {
    id: 'u-admin-01',
    name: PERSONA_MAP.admin.personaName,
    personaName: PERSONA_MAP.admin.personaName,
    email: 'admin@sentinelburn.aero',
    role: 'admin'
  },
  reliability_engineer: {
    id: 'u-rel-01',
    name: PERSONA_MAP.reliability_engineer.personaName,
    personaName: PERSONA_MAP.reliability_engineer.personaName,
    email: 'engineer@sentinelburn.aero',
    role: 'reliability_engineer'
  },
  qa_manager: {
    id: 'u-qa-01',
    name: PERSONA_MAP.qa_manager.personaName,
    personaName: PERSONA_MAP.qa_manager.personaName,
    email: 'qa@sentinelburn.aero',
    role: 'qa_manager'
  },
  operator: {
    id: 'u-op-01',
    name: 'Floor Operator',
    personaName: '',
    email: 'operator@sentinelburn.aero',
    role: 'operator'
  },
  fa_engineer: {
    id: 'u-fa-01',
    name: PERSONA_MAP.fa_engineer.personaName,
    personaName: PERSONA_MAP.fa_engineer.personaName,
    email: 'fa@sentinelburn.aero',
    role: 'fa_engineer'
  }
};

// Restore persisted session if available
const storedToken = localStorage.getItem('sentinel_token');
let initialUser: User | null = null;
try {
  const storedUserStr = localStorage.getItem('sentinel_user');
  if (storedUserStr) {
    initialUser = JSON.parse(storedUserStr);
    // Back-fill personaName if loading an older stored session
    if (initialUser && !initialUser.personaName && initialUser.role) {
      initialUser.personaName = PERSONA_MAP[initialUser.role]?.personaName || initialUser.name;
    }
  } else if (storedToken) {
    initialUser = DEMO_USERS.reliability_engineer;
  }
} catch (_) {
  initialUser = null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  token: storedToken,
  isAuthenticated: Boolean(storedToken && initialUser),
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  login: async (email: string, password = 'password123'): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.login({ email, password });
      const personaName = PERSONA_MAP[data.user?.role as UserRole]?.personaName || data.user?.name || '';
      const enrichedUser: User = { ...data.user, personaName };
      localStorage.setItem('sentinel_token', data.token);
      localStorage.setItem('sentinel_user', JSON.stringify(enrichedUser));
      set({ user: enrichedUser, token: data.token, isAuthenticated: true, isLoading: false, error: null });
      return true;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Invalid email or password';
      const matched = Object.values(DEMO_USERS).find(u => u.email.toLowerCase() === email.toLowerCase());
      if (matched && !err.response) {
        const mockToken = `mock-token-${matched.role}`;
        localStorage.setItem('sentinel_token', mockToken);
        localStorage.setItem('sentinel_user', JSON.stringify(matched));
        set({ user: matched, token: mockToken, isAuthenticated: true, isLoading: false, error: null });
        return true;
      }
      set({ error: errMsg, isLoading: false });
      return false;
    }
  },

  register: async (data: { name: string; email: string; password: string; confirmPassword?: string; role?: UserRole }): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.register(data);
      const personaName = PERSONA_MAP[res.user?.role as UserRole]?.personaName || res.user?.name || '';
      const enrichedUser: User = { ...res.user, personaName };
      localStorage.setItem('sentinel_token', res.token);
      localStorage.setItem('sentinel_user', JSON.stringify(enrichedUser));
      set({ user: enrichedUser, token: res.token, isAuthenticated: true, isLoading: false, error: null });
      return true;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Registration failed. Please check your information.';
      set({ error: errMsg, isLoading: false });
      return false;
    }
  },

  loginWithGoogle: async (payload: { credential?: string; email?: string; name?: string }): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.loginGoogle(payload);
      const personaName = PERSONA_MAP[res.user?.role as UserRole]?.personaName || res.user?.name || '';
      const enrichedUser: User = { ...res.user, personaName };
      localStorage.setItem('sentinel_token', res.token);
      localStorage.setItem('sentinel_user', JSON.stringify(enrichedUser));
      set({ user: enrichedUser, token: res.token, isAuthenticated: true, isLoading: false, error: null });
      return true;
    } catch (err: any) {
      const fallbackUser: User = {
        id: `u-g-${Date.now().toString(36)}`,
        name: PERSONA_MAP.reliability_engineer.personaName,
        personaName: PERSONA_MAP.reliability_engineer.personaName,
        email: payload.email || 'engineer@sentinelburn.aero',
        role: 'reliability_engineer'
      };
      const mockToken = 'google-oauth-mock-token';
      localStorage.setItem('sentinel_token', mockToken);
      localStorage.setItem('sentinel_user', JSON.stringify(fallbackUser));
      set({ user: fallbackUser, token: mockToken, isAuthenticated: true, isLoading: false, error: null });
      return true;
    }
  },

  logout: () => {
    localStorage.removeItem('sentinel_token');
    localStorage.removeItem('sentinel_user');
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  switchRoleDemo: (role: UserRole) => {
    const user = DEMO_USERS[role] || DEMO_USERS.reliability_engineer;
    const token = `mock-token-${role}`;
    localStorage.setItem('sentinel_token', token);
    localStorage.setItem('sentinel_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true, error: null });
  }
}));
