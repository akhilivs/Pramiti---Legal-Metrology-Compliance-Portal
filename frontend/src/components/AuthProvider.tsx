'use client';
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { api, hasRole, session, UNAUTHORIZED_EVENT, type Officer, type Role } from '@/lib/api';
import AppShell from './AppShell';
import PublicShell from './PublicShell';

// Signed-in officers never see the sign-in screen (or Google's button), so it loads only when needed
const LoginScreen = dynamic(() => import('./LoginScreen'), { loading: () => <div className="min-h-screen bg-ivory" /> });

interface AuthContextValue {
  officer: Officer;
  logout: () => void;
  can: (role: Role) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Pages anyone can open without signing in (the consumer complaint portal). */
const PUBLIC_PREFIXES = ['/complaint'];

const noopSubscribe = () => () => {};

export default function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // false during SSR / hydration, so the server and first client render match
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // undefined = follow the stored session; null = signed out; Officer = just signed in
  const [override, setOverride] = useState<Officer | null | undefined>(undefined);
  const officer = !hydrated ? undefined : override !== undefined ? override : session.token ? session.officer : null;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!hydrated) return;
    if (session.token) {
      // refresh the profile (role may have changed); a 401 fires UNAUTHORIZED_EVENT
      api
        .me()
        .then((me) => {
          session.save(session.token!, me);
          setOverride(me);
        })
        .catch(() => {});
    }
    const onUnauthorized = () => setOverride(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [hydrated]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    session.save(res.token, res.officer);
    setOverride(res.officer);
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const res = await api.loginWithGoogle(credential);
    session.save(res.token, res.officer);
    setOverride(res.officer);
  }, []);

  const logout = useCallback(() => {
    session.clear();
    setOverride(null);
  }, []);

  const can = useCallback((role: Role) => hasRole(officer, role), [officer]);

  if (isPublic) {
    return <PublicShell>{children}</PublicShell>;
  }
  if (officer === undefined) {
    return <div className="min-h-screen bg-ivory" />;
  }
  if (!officer) {
    return <LoginScreen onLogin={login} onGoogleLogin={loginWithGoogle} />;
  }
  return (
    <AuthContext.Provider value={{ officer, logout, can }}>
      <AppShell>{children}</AppShell>
    </AuthContext.Provider>
  );
}
