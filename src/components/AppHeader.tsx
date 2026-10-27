import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppHeader() {
  const { profile, signOut, user } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/70 px-4 backdrop-blur-[14px] backdrop-saturate-[1.2]">
      <SidebarTrigger className="h-9 w-9 rounded-full" title="Expandir ou recolher o menu" />
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
