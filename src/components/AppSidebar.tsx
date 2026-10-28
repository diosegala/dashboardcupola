import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Target, Plug, Settings, UsersRound, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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

const adminItems = [
  { title: "Integrações", url: "/integrations", icon: Plug },
  { title: "Configurações", url: "/settings", icon: Settings },
];

const itemClass =
  "h-10 rounded-full px-3 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground data-[active=true]:bg-foreground data-[active=true]:text-background data-[active=true]:hover:bg-foreground data-[active=true]:hover:text-background";

export function AppSidebar() {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const recolhido = state === "collapsed";
  const items = isAdmin ? [...publicItems, ...adminItems] : publicItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 justify-center px-4 group-data-[collapsible=icon]:px-2">
        <Link to="/" className="flex items-center gap-2.5 text-foreground">
          {recolhido ? (
            <img src="/brand/simbolo-cupola-lima.svg" alt="CUPOLA" className="mx-auto h-6 w-6" />
          ) : (
            <CupolaLogo className="h-[22px]" />
          )}
        </Link>
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleSidebar}
              tooltip={recolhido ? "Expandir menu" : "Recolher menu"}
              className={itemClass}
            >
              {recolhido ? <PanelLeftOpen /> : <PanelLeftClose />}
              <span>Recolher menu</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
