import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';
import { localStorageKey, readLocalPreviewValue } from './localPreview';

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
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_EVENT = 'edureach-auth-changed';

function readStoredProfile(): Record<string, any> | null {
  try {
    return JSON.parse(readLocalPreviewValue('profile') || 'null');
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
    // Local preview sessions resolve synchronously so a fresh sign-in is visible
    // to ProtectedRoute on the very next render (no redirect-back-to-login race).
    if (!isSupabaseConfigured) {
      const localUser = readLocalUser();
      if (localUser) {
        setUser(localUser);
        setIsLoading(false);
        return;
      }
    }
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

    const onAuthChanged = () => {
      // Hold protected pages in their loading state while the session is re-read,
      // instead of bouncing a just-signed-in student back to /login.
      setIsLoading(true);
      void refreshAuth();
    };
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
      signOut,
    }),
    [isLoading, refreshAuth, signOut, user],
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
