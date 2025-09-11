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
              <header className="h-16 flex items-center border-b border-[#102A43] bg-[#0A2342] px-3 py-3 shadow-none">
                <SidebarTrigger className="text-white hover:text-white" />
                <div className="ml-auto flex items-center gap-4">
                  <div className="text-base text-white font-semibold">
                    <span className="font-bold text-[]">DeepGuard</span> •
                    Threat Detection Platform
                  </div>
                </div>
              </header>

              {/* Main content */}
              <main className="flex-1 overflow-auto">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/anomaly-alerts" element={<AnomalyAlerts />} />
                  <Route path="/firewall-config" element={<FirewallConfig />} />
                  <Route
                    path="/traffic-inspection"
                    element={<TrafficInspection />}
                  />
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
