import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Target, Plug, Settings, UsersRound, PanelLeftClose, PanelLeftOpen, Trophy, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CupolaLogo } from "@/components/CupolaLogo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const publicItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Metas", url: "/goals", icon: Target },
  { title: "Compradores", url: "/compradores", icon: UsersRound },
];

// A equipe de vendas só vê o ranking e a lista de compradores.
const sellerItems = [
  { title: "Ranking", url: "/", icon: Trophy },
  { title: "Compradores", url: "/compradores", icon: UsersRound },
];

const adminItems = [
  { title: "Integrações", url: "/integrations", icon: Plug },
  { title: "Configurações", url: "/settings", icon: Settings },
];

const itemClass =
  "h-10 rounded-full px-3 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground data-[active=true]:bg-foreground data-[active=true]:text-background data-[active=true]:hover:bg-foreground data-[active=true]:hover:text-background";

export function AppSidebar() {
  const { isAdmin, isSeller, viewingAsSeller, setViewingAsSeller } = useAuth();
  const { pathname } = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const recolhido = state === "collapsed";
  const items = isSeller ? sellerItems : isAdmin ? [...publicItems, ...adminItems] : publicItems;

  return (
    <Sidebar collapsible="icon">
      {/* Topo do menu: logo e o botão de recolher/expandir. Recolhido, o botão fica embaixo do símbolo. */}
      <SidebarHeader className="h-16 flex-row items-center justify-between gap-2 pl-4 pr-2 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        {/* Logo leva ao início; se já estiver nele, volta ao topo da página */}
        <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} title="Ir para o início" className="flex items-center gap-2.5 text-foreground">
          {recolhido ? (
            <img src="/brand/simbolo-cupola-lima.svg" alt="CUPOLA" className="mx-auto h-6 w-6" />
          ) : (
            <CupolaLogo className="h-[22px]" />
          )}
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          title={recolhido ? "Expandir menu" : "Recolher menu"}
          aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
        >
          {recolhido ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground">
            Eventos · Summit 2027
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={item.url === "/" ? pathname === "/" : pathname.startsWith(item.url)}
                    className={itemClass}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu className="gap-1">
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setViewingAsSeller(!viewingAsSeller)}
                tooltip={viewingAsSeller ? "Voltar ao painel completo" : "Ver como a equipe de vendas"}
                className={itemClass}
              >
                {viewingAsSeller ? <EyeOff /> : <Eye />}
                <span>{viewingAsSeller ? "Voltar ao painel completo" : "Ver como a equipe"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
