import { Shield, BarChart3, AlertTriangle, Zap } from "lucide-react";
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

import DeepGuardLogo from "../../assets/DeepGaurd.svg";

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

  const isActivePath = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  // Classes for active vs inactive links
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-primary text-primary-foreground font-bold"
      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground";

  return (
    <Sidebar
      className="border-r border-border bg-card shadow-card m-auto"
      collapsible="icon"
    >
      <SidebarContent>
        {/* Logo / Brand Section */}
        <div className="p-[10px]  border-b border-border bg-[#0A2342]">
          {state !== "collapsed" ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                <img src={DeepGuardLogo} alt="DeepGuard Logo" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-foreground  text-white">DeepGuard</h1>
                <p className="text-xs text-muted-foreground  text-white">
                  Multi-Layer Threat Detection
                </p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 flex items-center justify-start mx-auto">
              <img
                className="w-full"
                src={DeepGuardLogo}
                alt="DeepGuard Logo"
              />
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <SidebarGroup className="mt-4 bg-[] h-full">
          <SidebarGroupLabel
            className={
              state === "collapsed" ? "sr-only" : "text-base text-center w-full text-[#0A2342]"
            }
          >
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
                      className={({ isActive }) =>
                        getNavCls({ isActive }) +
                        " flex items-center gap-4 text-lg py-4 px-3"
                      }
                    >
                      <item.icon className="w-7 h-7" />
                      {state !== "collapsed" && (
                        <span className="text-base font-semibold">
                          {item.title}
                        </span>
                      )}
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
