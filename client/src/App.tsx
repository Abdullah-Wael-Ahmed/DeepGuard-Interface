import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import Dashboard from "./pages/Dashboard";
import AnomalyAlerts from "./pages/AnomalyAlerts";
import FirewallConfig from "./pages/FirewallConfig";
import TrafficInspection from "./pages/TrafficInspection";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <SidebarProvider>
        <BrowserRouter>
          <div className="min-h-screen flex w-full bg-background">
            <AppSidebar />
            <div className="flex-1 flex flex-col">
              {/* Global header with sidebar trigger */}
              <header className="h-14 flex items-center border-b border-border bg-card px-4 shadow-card">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                <div className="ml-auto flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">DeepGuard</span> • Threat Detection Platform
                  </div>
                </div>
              </header>
              
              {/* Main content */}
              <main className="flex-1 overflow-auto">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/anomaly-alerts" element={<AnomalyAlerts />} />
                  <Route path="/firewall-config" element={<FirewallConfig />} />
                  <Route path="/traffic-inspection" element={<TrafficInspection />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
          </div>
        </BrowserRouter>
      </SidebarProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
