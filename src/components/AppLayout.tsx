import { Suspense, type CSSProperties } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { EventProvider } from "@/hooks/useEvent";

// Telas que a equipe de vendas pode abrir; as outras voltam para o ranking.
const TELAS_EQUIPE = ["/", "/compradores"];

export function AppLayout() {
  const { isSeller } = useAuth();
  const { pathname } = useLocation();
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
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
    </EventProvider>
  );
}
