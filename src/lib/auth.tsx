import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  isLocal: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshAuth: () => Promise<void>;
  startLocalSession: (email: string, name?: string) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_EVENT = 'edureach-auth-changed';

function readStoredProfile(): Record<string, any> | null {
  try {
    return JSON.parse(localStorage.getItem('edureach-student-profile') || 'null');
  } catch {
    return null;
  }
}

function readLocalUser(): AuthUser | null {
  const email = localStorage.getItem('edureach-local-user-email');
  if (!email) return null;

  const profile = readStoredProfile();
  const fullName = profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || email.split('@')[0] || 'Student';

  return {
    id: `local-${email.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    email,
    name: fullName,
    avatarUrl: profile?.avatar_url || null,
    isLocal: true,
  };
}

function dispatchAuthChanged() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

async function resolveCurrentUser(): Promise<AuthUser | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      const meta = session.user.user_metadata || {};
      return {
        id: session.user.id,
        email: session.user.email || '',
        name: meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || session.user.email?.split('@')[0] || 'Student',
        avatarUrl: meta.avatar_url || null,
        isLocal: false,
      };
    }
  } catch {
    // Continue to local preview session fallback.
  }

  return isSupabaseConfigured ? null : readLocalUser();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    const nextUser = await resolveCurrentUser();
    setUser(nextUser);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refreshAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user;
      if (authUser) {
        const meta = authUser.user_metadata || {};
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || authUser.email?.split('@')[0] || 'Student',
          avatarUrl: meta.avatar_url || null,
          isLocal: false,
        });
        setIsLoading(false);
        return;
      }
      void refreshAuth();
    });

    const onAuthChanged = () => void refreshAuth();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith('edureach-')) void refreshAuth();
    };

    window.addEventListener(AUTH_EVENT, onAuthChanged);
    window.addEventListener('storage', onStorage);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener(AUTH_EVENT, onAuthChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [refreshAuth]);

  const startLocalSession = useCallback((email: string, name = 'Student') => {
    if (isSupabaseConfigured || !email.trim()) return;
    localStorage.setItem('edureach-local-user-email', email.trim());
    const existing = readStoredProfile();
    if (!existing) {
      localStorage.setItem(
        'edureach-student-profile',
        JSON.stringify({
          first_name: name.split(' ')[0] || 'EduReach',
          last_name: name.split(' ').slice(1).join(' ') || 'Student',
          full_name: name,
          email: email.trim(),
          account_type: 'student',
        }),
      );
    }
    setUser(readLocalUser());
    setIsLoading(false);
    dispatchAuthChanged();
  }, []);

  const signOut = useCallback(async () => {
    window.sessionStorage.removeItem('edureach-admin-student-view');
    localStorage.removeItem('edureach-local-user-email');
    try {
      if (isSupabaseConfigured) await supabase.auth.signOut();
      else await supabase.auth.signOut();
    } catch {
      // Local preview sessions may not have a real Supabase session to clear.
    }
    setUser(null);
    setIsLoading(false);
    dispatchAuthChanged();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      refreshAuth,
      startLocalSession,
      signOut,
    }),
    [isLoading, refreshAuth, signOut, startLocalSession, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function notifyAuthChanged() {
  dispatchAuthChanged();
}
