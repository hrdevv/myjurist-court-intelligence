import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { hasAnyRole as hasAnyRoleHelper, type AppRole } from "@/lib/permissions";

export type { AppRole };

interface AuthState {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRoles = (userId: string | undefined) => {
      if (!userId) {
        setRoles([]);
        return;
      }
      // Defer the Supabase call to avoid deadlocks inside the auth callback.
      setTimeout(async () => {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
        setRoles((data ?? []).map((r) => r.role as AppRole));
      }, 0);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      loadRoles(newSession?.user?.id);
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      loadRoles(existing?.user?.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    roles,
    loading,
    hasRole: (role) => roles.includes(role),
    hasAnyRole: (rs) => hasAnyRoleHelper(roles, rs),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
