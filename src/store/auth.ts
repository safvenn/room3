import { supabase } from '../lib/supabase';
import type { User } from '../types';

let _user: User | null = null;
const _listeners: Set<() => void> = new Set();

// Helper to convert Supabase user to our App User
const mapSupabaseUser = (sbUser: any): User => {
  return {
    id: sbUser.id,
    name: sbUser.user_metadata?.display_name || sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || 'User',
    email: sbUser.email || '',
    avatar_url: sbUser.user_metadata?.avatar_url || '',
    created_at: sbUser.created_at || new Date().toISOString(),
  };
};

// Listen to session changes
supabase.auth.onAuthStateChange(async (_event, session) => {
  if (session?.user) {
    _user = mapSupabaseUser(session.user);
    localStorage.setItem('access_token', session.access_token);
    localStorage.setItem('refresh_token', session.refresh_token || '');
    localStorage.setItem('user', JSON.stringify(_user));
  } else {
    _user = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  }
  _listeners.forEach(l => l());
});

// Initialize from local storage sync
try {
  const stored = localStorage.getItem('user');
  if (stored) _user = JSON.parse(stored);
} catch {}

export const useAuthStore = () => {
  const token = localStorage.getItem('access_token');
  const user = _user;
  return {
    user,
    accessToken: token,
    isAuthenticated: !!token && !!user,
    setAuth: (user: User, accessToken: string, refreshToken: string) => {
      _user = user;
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      _listeners.forEach(l => l());
    },
    setUser: (user: User) => {
      _user = user;
      localStorage.setItem('user', JSON.stringify(user));
      _listeners.forEach(l => l());
    },
    logout: async () => {
      await supabase.auth.signOut();
      _user = null;
      localStorage.clear();
      _listeners.forEach(l => l());
    },
  };
};

export const subscribe = (listener: () => void) => {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
};

export const getAuth = () => ({
  user: _user,
  accessToken: localStorage.getItem('access_token'),
  isAuthenticated: !!localStorage.getItem('access_token') && !!_user,
});
