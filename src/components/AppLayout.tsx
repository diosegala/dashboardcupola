import { Suspense, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { EventProvider, useEvent } from "@/hooks/useEvent";
import { usePipedriveAutoSync } from "@/hooks/useSponsorship";
import { CouponPeopleProvider } from "@/hooks/useCouponPeople";
import { BatchCalendarProvider } from "@/hooks/useEventBatches";
import { registrarAtividade } from "@/lib/registrarAtividade";
import { telaDaRota } from "@/lib/activityLog";

// Telas que a equipe de vendas pode abrir; as outras voltam para o ranking.
const TELAS_EQUIPE = ["/", "/compradores", "/perfil"];

export function AppLayout() {
  const { isSeller, isAdmin, role } = useAuth();
  const { pathname } = useLocation();
  // Pipedrive atualiza sozinho enquanto um administrador está com o painel aberto.
  usePipedriveAutoSync(isAdmin && !isSeller);
  // Ao entrar na visão da equipe (login de vendedor, recarregar a página ou "Ver como a equipe"), abre sempre no ranking.
  const navigate = useNavigate();
  const entrou = useRef(false);
  useEffect(() => {
    if (!isSeller) {
      entrou.current = false;
      return;
    }
    if (entrou.current) return;
    entrou.current = true;
    if (pathname !== "/") navigate("/", { replace: true });
  }, [isSeller, pathname, navigate]);
  // Vendedor que tenta abrir tela fora do ranking: a tentativa fica no log (admin em "Ver como a equipe" não conta).
  const bloqueada = role === "seller" && !TELAS_EQUIPE.includes(pathname);
  const avisado = useRef<string | null>(null);
  useEffect(() => {
    if (!bloqueada || avisado.current === pathname) return;
    avisado.current = pathname;
    void registrarAtividade("acesso.negado", { p_entidade: "tela", p_rotulo: telaDaRota(pathname), p_tela: telaDaRota(pathname), p_detalhe: `Tentou abrir ${pathname} com a função Ranking` });
  }, [bloqueada, pathname]);
  if (isSeller && !TELAS_EQUIPE.includes(pathname)) return <Navigate to="/" replace />;

  return (
    <EventProvider>
    {/* Menu mais fino (o padrão é 16rem): sobra mais espaço para o conteúdo */}
    <SidebarProvider style={{ "--sidebar-width": "12.5rem" } as CSSProperties}>
      <div className="app-bg" aria-hidden>
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
      </div>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-16 pt-10 sm:px-6">
            {/* O menu e o topo ficam na tela enquanto a página abre */}
            <Suspense fallback={null}>
              <BatchCalendarProvider>
                <CouponPeopleProvider>
                  <SemEventoAviso isAdmin={isAdmin} pathname={pathname}><Outlet /></SemEventoAviso>
                </CouponPeopleProvider>
              </BatchCalendarProvider>
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
    </EventProvider>
  );
}

// Quem não é admin e não tem nenhum evento liberado vê um aviso em vez de um painel zerado.
function SemEventoAviso({ isAdmin, pathname, children }: { isAdmin: boolean; pathname: string; children: ReactNode }) {
  const { events, hasEventsTable, isLoading } = useEvent();
  if (isAdmin || isLoading || !hasEventsTable || events.length > 0 || pathname === "/perfil") return <>{children}</>;
  return (
    <div className="mx-auto max-w-md rounded-[24px] border bg-card p-8 text-center">
      <p className="font-medium">Você ainda não tem acesso a nenhum evento.</p>
      <p className="mt-2 text-sm text-muted-foreground">Fale com um administrador para liberar o evento que você precisa ver.</p>
    </div>
  );
}
