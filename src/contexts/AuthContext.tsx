import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, signOut: async () => {} });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const enforceBan = async (s: Session | null) => {
      if (!s?.user) {
        if (!cancelled) { setSession(null); setUser(null); setLoading(false); }
        return;
      }
      const { data } = await supabase.from("profiles").select("banned_at").eq("id", s.user.id).maybeSingle();
      if (cancelled) return;
      if (data?.banned_at) {
        await supabase.auth.signOut();
        if (!cancelled) { setSession(null); setUser(null); setLoading(false); }
        return;
      }
      setSession(s);
      setUser(s.user);
      setLoading(false);
    };

    // Set listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      enforceBan(s);
    });
    // Then fetch existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      enforceBan(session);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };

  return <Ctx.Provider value={{ user, session, loading, signOut }}>{children}</Ctx.Provider>;
};

export const useAuth = () => useContext(Ctx);
