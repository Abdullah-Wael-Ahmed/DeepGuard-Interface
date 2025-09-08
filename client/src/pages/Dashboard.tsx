import { MetricCard } from "@/components/dashboard/MetricCard";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { 
  AlertTriangle, 
  Shield, 
  Activity, 
  CheckCircle, 
  TrendingUp,
  Eye,
  Clock,
  Server
} from "lucide-react";

export default function Dashboard() {
  // Mock data for demonstration
  const alerts = [
    { type: "Malware Infection", source: "Endpoint 192.168.1.10", severity: "critical", time: "2 min ago", status: "active" },
    { type: "Port Scan", source: "External IP 203.0.113.45", severity: "high", time: "10 min ago", status: "active" },
    { type: "Phishing Attempt", source: "User john.doe", severity: "high", time: "30 min ago", status: "active" },
    { type: "Failed Login Attempts", source: "Server 10.0.0.5", severity: "medium", time: "1 hr ago", status: "active" },
    { type: "Unusual Traffic", source: "Network Segment A", severity: "medium", time: "2 hr ago", status: "active" },
    { type: "IDS Signature Match", source: "Firewall Zone B", severity: "low", time: "5 hr ago", status: "acknowledged" },
  ];

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Security Dashboard</h1>
          <p className="text-muted-foreground">Real-time threat monitoring and system status</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          Last updated: 2 minutes ago
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Active Alerts"
          value="1,245"
          description="↗ 12% from last 24h"
          icon={AlertTriangle}
          variant="critical"
          trend="up"
        />
        <MetricCard
          title="Critical Alerts (24h)"
          value="12"
          description="Requires immediate attention"
          icon={Shield}
          variant="critical"
        />
        <MetricCard
          title="Resolved Alerts (7d)"
          value="340"
          description="↗ 8% improvement"
          icon={CheckCircle}
          variant="success"
          trend="up"
        />
        <MetricCard
          title="System Health"
          value="98.7%"
          description="All modules operational"
          icon={Activity}
          variant="success"
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Threat Trends Chart Placeholder */}
        <Card className="p-6 bg-card shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Threat Trends</h3>
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="h-64 bg-muted/20 rounded-lg flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-2" />
              <p>Threat trend visualization</p>
              <p className="text-sm">Malware • Phishing • Intrusion • DDoS</p>
            </div>
          </div>
        </Card>

        {/* Active Alerts Table */}
        <Card className="p-6 bg-card shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Active Alerts</h3>
            <button className="text-sm text-primary hover:text-primary/80">View All</button>
          </div>
          <div className="space-y-3">
            {alerts.slice(0, 6).map((alert, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <StatusBadge variant={alert.severity as any} />
                    <div>
                      <p className="font-medium text-foreground">{alert.type}</p>
                      <p className="text-sm text-muted-foreground">{alert.source}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{alert.time}</p>
                  <StatusBadge variant={alert.status as any} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* System Health Status */}
      <Card className="p-6 bg-card shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <Server className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">System Health Status</h3>
          <p className="text-sm text-muted-foreground">Operational status of core DeepGuard modules</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-border">
            <span className="font-medium text-foreground">DeepGuard Firewall</span>
            <StatusBadge variant="operational">Operational</StatusBadge>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg border border-border">
            <span className="font-medium text-foreground">IDS/IPS Engine</span>
            <StatusBadge variant="operational">Operational</StatusBadge>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg border border-border">
            <span className="font-medium text-foreground">AI Analysis Core</span>
            <StatusBadge variant="operational">Operational</StatusBadge>
          </div>
        </div>
      </Card>
    </div>
  );
}