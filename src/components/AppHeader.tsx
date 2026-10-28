import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EventSelector } from "@/components/EventSelector";

export function AppHeader() {
  const { profile, signOut, user, viewingAsSeller, setViewingAsSeller } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-background/70 px-3 sm:gap-3 sm:px-4 backdrop-blur-[14px] backdrop-saturate-[1.2]">
      {/* O botão de recolher fica no próprio menu; aqui só no celular, onde o menu fica escondido */}
      <SidebarTrigger className="h-9 w-9 shrink-0 rounded-full md:hidden" title="Abrir o menu" />
      {/* No celular o menu lateral fica escondido: o símbolo no topo leva ao início */}
      <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} title="Ir para o início" className="shrink-0 md:hidden">
        <img src="/brand/simbolo-cupola-lima.svg" alt="CUPOLA" className="h-6 w-6" />
      </Link>
      <EventSelector />
      {viewingAsSeller && (
        <button
          type="button"
          onClick={() => setViewingAsSeller(false)}
          className="hidden rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-85 sm:inline-flex"
          title="Voltar ao painel completo"
        >
          Vendo como a equipe · voltar
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <span className="hidden max-w-[160px] truncate text-[13px] text-muted-foreground sm:inline">
          {profile?.name || user?.email}
        </span>
        <Button variant="ghost" size="icon" onClick={signOut} title="Sair" className="h-9 w-9">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
