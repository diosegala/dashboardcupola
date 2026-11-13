import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { clearPeriod } from "@/hooks/usePeriod";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  // Admin ou visualizador: vê todos os dados (só admin edita).
  canViewAll: boolean;
  // Equipe de vendas: vê só o ranking de cupons e a lista de compradores.
  isSeller: boolean;
  // Administrador vendo o painel como a equipe vê.
  viewingAsSeller: boolean;
  setViewingAsSeller: (v: boolean) => void;
  profile: { name: string | null } | null;
  signOut: () => Promise<void>;
  // Relê o nome depois que a pessoa salva o perfil.
  refreshProfile: () => Promise<void>;
  role: "admin" | "viewer" | "seller" | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [, setRolesKey] = useState<string | null>(null);
  const [recheck, setRecheck] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") setRecheck((n) => n + 1);
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        // Saiu ou o login expirou: o período escolhido volta para o evento inteiro.
        clearPeriod();
        setIsAdmin(false);        setIsViewer(false);
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
        if (roleRes.error) throw roleRes.error;
        const roles = (roleRes.data ?? []).map((r) => String(r.role));
        // Papel mudou enquanto a pessoa estava no painel: descarta os dados do papel antigo.
        const key = `${user.id}:${[...roles].sort().join(",")}`;
        setRolesKey((antes) => {
          if (antes && antes !== key) queryClient.invalidateQueries();
          return key;
        });
        setProfile(profileRes.data);
        setIsAdmin(roles.includes("admin"));
        setIsViewer(roles.includes("viewer"));
        setIsRealSeller(roles.includes("seller") && !roles.includes("admin"));
      } catch (err) {
        // Falha momentânea: mantém o papel já lido em vez de zerar a tela.
        console.error("[useAuth] Error fetching user data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user, recheck, queryClient]);

  // Relê o papel ao voltar para a aba e a cada 2 minutos, para trocas de papel valerem sem sair.
  useEffect(() => {
    if (!user) return;
    const reler = () => document.visibilityState === "visible" && setRecheck((n) => n + 1);
    document.addEventListener("visibilitychange", reler);
    const id = window.setInterval(reler, 120_000);
    return () => {
      document.removeEventListener("visibilitychange", reler);
      window.clearInterval(id);
    };
  }, [user]);

  const refreshProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    if (data) setProfile(data);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, canViewAll: isAdmin || isViewer, isSeller: isRealSeller || (isAdmin && viewingAsSeller), viewingAsSeller: isAdmin && viewingAsSeller, setViewingAsSeller, profile, signOut, refreshProfile, role: isAdmin ? "admin" : isViewer ? "viewer" : isRealSeller ? "seller" : null }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
