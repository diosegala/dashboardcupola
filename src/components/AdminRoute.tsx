import { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { registrarAtividade } from "@/lib/registrarAtividade";
import { telaDaRota } from "@/lib/activityLog";

// Telas só de administrador. Quem não é admin volta ao início e a tentativa fica no log.
// O banco também bloqueia os dados: esta proteção é só a camada da tela.
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, rolesLoaded } = useAuth();
  const { pathname } = useLocation();
  const registrado = useRef(false);
  const negado = rolesLoaded && !isAdmin;

  useEffect(() => {
    if (!negado || registrado.current) return;
    registrado.current = true;
    void registrarAtividade("acesso.negado", { p_entidade: "tela", p_rotulo: telaDaRota(pathname), p_detalhe: `Tentou abrir ${pathname} sem ser administrador` });
  }, [negado, pathname]);

  if (!rolesLoaded) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
