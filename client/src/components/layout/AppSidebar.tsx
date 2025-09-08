import { Shield, BarChart3, AlertTriangle, Settings, Zap } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import DeepGuardLogo from "../../assets/DeepGaurd.svg"

const navigationItems = [
  { title: "Dashboard", url: "/", icon: BarChart3 },
  { title: "Anomaly Alerts", url: "/anomaly-alerts", icon: AlertTriangle },
  { title: "Firewall Config", url: "/firewall-config", icon: Shield },
  { title: "Traffic Inspection", url: "/traffic-inspection", icon: Zap },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const getNavCls = ({ isActive: active }: { isActive: boolean }) =>
    active 
      ? "bg-primary text-primary-foreground font-medium shadow-cyber" 
      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground";

  return (
    <Sidebar
      className="border-r border-border bg-card shadow-card"
      collapsible="icon"
    >
      <SidebarContent>
        {/* Logo/Brand */}
        <div className="p-4 border-b border-border">
          {state !== "collapsed" ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                <img src={DeepGuardLogo} />
              </div>
              <div>
                <h1 className="font-bold text-lg text-foreground">DeepGuard</h1>
                <p className="text-xs text-muted-foreground">Multi-Layer Threat Detection</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 flex items-center justify-start mx-auto">
              <img className=" w-full" src={DeepGuardLogo} />
              {/* <Shield className="w-5 h-5 text-white" /> */}
            </div>
          )}
        </div>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className={state === "collapsed" ? "sr-only" : ""}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.url === "/"}
                      className={({ isActive }) => getNavCls({ isActive })}
                    >
                      <item.icon className="w-5 h-5" />
                      {state !== "collapsed" && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}