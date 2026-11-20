import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@/types/types';
import { DEMO_PROFILES } from '@/services/mockData';
import { toast } from 'sonner';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    console.warn('Failed to load remote profile:', error.message);
    return null;
  }
  return (data as Profile) ?? null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  employeeId: string | null;
  loading: boolean;
  isAdmin: boolean;
  isHR: boolean;
  isFinance: boolean;
  isManager: boolean;
  canManagePeople: boolean;
  hasRole: (...roles: UserRole[]) => boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithUsername: (username: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function createDemoUser(profile: Profile): User {
  return {
    id: profile.id,
    app_metadata: {},
    user_metadata: { full_name: profile.full_name },
    aud: 'authenticated',
    created_at: profile.created_at,
    email: profile.email ?? undefined,
  } as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize from saved demo session or default to admin demo if local
  useEffect(() => {
    const savedDemo = localStorage.getItem('abr_demo_user');
    if (savedDemo && DEMO_PROFILES[savedDemo]) {
      const p = DEMO_PROFILES[savedDemo];
      setProfile(p);
      setUser(createDemoUser(p));
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const savedDemo = localStorage.getItem('abr_demo_user');
    if (savedDemo && DEMO_PROFILES[savedDemo]) {
      const p = DEMO_PROFILES[savedDemo];
      setProfile(p);
      setUser(createDemoUser(p));
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setProfile(null);
      return;
    }
    const profileData = await getProfile(data.user.id);
    setProfile(profileData);
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (session?.user) {
          setUser(session.user);
          const p = await getProfile(session.user.id);
          if (p) {
            setProfile(p);
          } else {
            // If remote profile missing, check if demo session exists
            const savedDemo = localStorage.getItem('abr_demo_user');
            if (savedDemo && DEMO_PROFILES[savedDemo]) {
              setProfile(DEMO_PROFILES[savedDemo]);
            }
          }
        } else {
          const savedDemo = localStorage.getItem('abr_demo_user');
          if (savedDemo && DEMO_PROFILES[savedDemo]) {
            const p = DEMO_PROFILES[savedDemo];
            setProfile(p);
            setUser(createDemoUser(p));
          }
        }
      })
      .catch((error: Error) => {
        console.warn('Session check warning:', error.message);
      })
      .finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        const p = await getProfile(session.user.id);
        if (p) setProfile(p);
      } else {
        const savedDemo = localStorage.getItem('abr_demo_user');
        if (savedDemo && DEMO_PROFILES[savedDemo]) {
          const p = DEMO_PROFILES[savedDemo];
          setProfile(p);
          setUser(createDemoUser(p));
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithUsername = async (username: string, password: string) => {
    try {
      const normalized = username.trim().toLowerCase();
      // Check if this is a known demo account
      if (DEMO_PROFILES[normalized]) {
        const demoProf = DEMO_PROFILES[normalized];
        setProfile(demoProf);
        setUser(createDemoUser(demoProf));
        localStorage.setItem('abr_demo_user', normalized);

        // Try background Supabase auth without failing if credentials aren't set in remote Supabase
        const email = username.includes('@') ? username : `${normalized}@miaoda.com`;
        supabase.auth.signInWithPassword({ email, password }).catch(() => {
          // Ignore background auth failure for demo accounts
        });

        return { error: null };
      }

      // Normal user authentication
      const email = username.includes('@') ? username : `${username}@miaoda.com`;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        const p = await getProfile(data.user.id);
        setProfile(p);
      }
      localStorage.removeItem('abr_demo_user');
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUpWithUsername = async (username: string, password: string, fullName: string) => {
    try {
      const email = `${username}@miaoda.com`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from('profiles').update({ full_name: fullName }).eq('id', data.user.id);
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('abr_demo_user');
    await supabase.auth.signOut().catch(() => {});
    setUser(null);
    setProfile(null);
  };

  const role = profile?.role ?? 'admin';

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      profile,
      role,
      employeeId: profile?.employee_id ?? null,
      loading,
      isAdmin: role === 'admin',
      isHR: role === 'admin' || role === 'hr',
      isFinance: role === 'admin' || role === 'finance',
      isManager: role === 'admin' || role === 'hr' || role === 'manager',
      canManagePeople: role === 'admin' || role === 'hr' || role === 'manager',
      hasRole: (...roles: UserRole[]) => (role ? roles.includes(role) : false),
      signInWithUsername,
      signUpWithUsername,
      signOut,
      refreshProfile,
    }),
    [user, profile, role, loading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
