import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  // Equipe de vendas: vê só o ranking de cupons e a lista de compradores.
  isSeller: boolean;
  // Administrador vendo o painel como a equipe vê.
  viewingAsSeller: boolean;
  setViewingAsSeller: (v: boolean) => void;
  profile: { name: string | null } | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRealSeller, setIsRealSeller] = useState(false);
  const [viewingAsSeller, setViewing] = useState(() => {
    try {
      return sessionStorage.getItem("cupola-ver-como-equipe") === "1";
    } catch {
      return false;
    }
  });
  const setViewingAsSeller = (v: boolean) => {
    setViewing(v);
    try {
      sessionStorage.setItem("cupola-ver-como-equipe", v ? "1" : "0");
    } catch {
      /* sem armazenamento: vale só nesta tela */
    }
  };
  const [profile, setProfile] = useState<{ name: string | null } | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setIsAdmin(false);
        setIsRealSeller(false);
        setProfile(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile & role when user changes
  useEffect(() => {
    if (!user) return;

    const fetchUserData = async () => {
      try {
        const [profileRes, roleRes] = await Promise.all([
          supabase.from("profiles").select("name").eq("id", user.id).single(),
          supabase.from("user_roles").select("role").eq("user_id", user.id),
        ]);
        const roles = (roleRes.data ?? []).map((r) => String(r.role));
        setProfile(profileRes.data);
        setIsAdmin(roles.includes("admin"));
        setIsRealSeller(roles.includes("seller") && !roles.includes("admin"));
      } catch (err) {
        console.error("[useAuth] Error fetching user data:", err);
        setIsAdmin(false);
        setIsRealSeller(false);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, isSeller: isRealSeller || (isAdmin && viewingAsSeller), viewingAsSeller: isAdmin && viewingAsSeller, setViewingAsSeller, profile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
