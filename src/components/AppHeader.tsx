import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { CupolaLogo } from "@/components/CupolaLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

const publicItems = [
  { title: "Dashboard", url: "/" },
  { title: "Metas", url: "/goals" },
];

const adminItems = [
  { title: "Integrações", url: "/integrations" },
  { title: "Configurações", url: "/settings" },
];

function NavItems() {
  const { isAdmin } = useAuth();
  const items = isAdmin ? [...publicItems, ...adminItems] : publicItems;

  return (
    <>
      {items.map((item) => (
        <NavLink
          key={item.url}
          to={item.url}
          end={item.url === "/"}
          className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
          activeClassName="bg-foreground text-background hover:bg-foreground hover:text-background"
        >
          {item.title}
        </NavLink>
      ))}
    </>
  );
}

export function AppHeader() {
  const { profile, signOut, user } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-[14px] backdrop-saturate-[1.2]">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-5 px-4">
        <Link to="/" className="flex items-center gap-2.5 text-foreground">
          <CupolaLogo className="h-[22px]" />
          <span className="hidden border-l border-line-strong pl-2.5 text-xs font-medium text-muted-foreground sm:inline">
            Eventos · Summit 2027
          </span>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          <NavItems />
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-2">
          <ThemeToggle />
          <span className="hidden max-w-[160px] truncate text-[13px] text-muted-foreground lg:inline">
            {profile?.name || user?.email}
          </span>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair" className="h-9 w-9">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <nav className="mx-auto flex max-w-[1240px] gap-1 overflow-x-auto px-4 pb-2.5 md:hidden">
        <NavItems />
      </nav>
    </header>
  );
}
