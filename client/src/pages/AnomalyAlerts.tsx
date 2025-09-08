import { useState } from "react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertTriangle, 
  Shield, 
  CheckCircle, 
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Clock
} from "lucide-react";

export default function AnomalyAlerts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Mock alert data
  const alerts = [
    {
      id: "DG-001",
      type: "Unusual Port Scan",
      sourceIp: "192.168.1.105",
      timeDetected: "2024-07-26 14:35:01 UTC",
      severity: "critical",
      status: "new",
      description: "Multiple rapid port scans detected from internal host"
    },
    {
      id: "DG-002", 
      type: "Suspected Data Exfiltration",
      sourceIp: "172.16.0.22",
      timeDetected: "2024-07-26 13:02:45 UTC", 
      severity: "high",
      status: "investigating",
      description: "Large data transfer to external IP address"
    },
    {
      id: "DG-003",
      type: "Malware Command & Control",
      sourceIp: "10.0.5.15", 
      timeDetected: "2024-07-26 10:15:20 UTC",
      severity: "critical",
      status: "new",
      description: "C2 communication pattern detected"
    },
    {
      id: "DG-004",
      type: "Unauthorized RDP Attempt", 
      sourceIp: "203.0.113.12",
      timeDetected: "2024-07-26 09:40:00 UTC",
      severity: "medium", 
      status: "resolved",
      description: "Multiple failed RDP login attempts"
    },
    {
      id: "DG-005",
      type: "Suspicious File Activity",
      sourceIp: "192.168.2.30",
      timeDetected: "2024-07-26 08:22:10 UTC",
      severity: "low",
      status: "false-positive", 
      description: "Unusual file system access patterns"
    },
  ];

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         alert.sourceIp.includes(searchQuery) ||
                         alert.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === "all" || alert.severity === severityFilter;
    const matchesStatus = statusFilter === "all" || alert.status === statusFilter;
    
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Anomaly Detection & AI Alerts</h1>
          <p className="text-muted-foreground">AI-powered threat detection and security incident management</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          Last 24 Hours
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Active Alerts"
          value="1,245"
          description="↗ 5% from yesterday"
          icon={AlertTriangle}
          variant="default"
          trend="up"
        />
        <MetricCard
          title="Critical Alerts (24h)"
          value="12"
          description="Immediate attention required"
          icon={Shield}
          variant="critical"
        />
        <MetricCard
          title="Resolved Alerts (7d)"
          value="340"
          description="↗ 15% resolution rate"
          icon={CheckCircle}
          variant="success"
          trend="up"
        />
      </div>

      {/* Filter Section */}
      <Card className="p-6 bg-card shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Filter Alerts</h3>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by ID, IP, or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="false-positive">False Positive</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Alerts Table */}
      <Card className="bg-card shadow-card">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Security Alerts</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left p-4 font-medium text-foreground">ID</th>
                <th className="text-left p-4 font-medium text-foreground">TYPE</th>
                <th className="text-left p-4 font-medium text-foreground">TIME DETECTED</th>
                <th className="text-left p-4 font-medium text-foreground">SEVERITY</th>
                <th className="text-left p-4 font-medium text-foreground">SOURCE IP</th>
                <th className="text-left p-4 font-medium text-foreground">STATUS</th>
                <th className="text-left p-4 font-medium text-foreground">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((alert) => (
                <tr key={alert.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                  <td className="p-4">
                    <span className="font-mono text-sm text-foreground">{alert.id}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-medium text-foreground">{alert.type}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground">{alert.timeDetected}</span>
                  </td>
                  <td className="p-4">
                    <StatusBadge variant={alert.severity as any}>
                      {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                    </StatusBadge>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-sm text-foreground">{alert.sourceIp}</span>
                  </td>
                  <td className="p-4">
                    <StatusBadge variant={alert.status as any}>
                      {alert.status === 'false-positive' ? 'False Positive' : 
                       alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                    </StatusBadge>
                  </td>
                  <td className="p-4">
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredAlerts.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No alerts match your current filters</p>
          </div>
        )}
      </Card>
    </div>
  );
}