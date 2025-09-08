import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Shield,
  Settings
} from "lucide-react";

export default function FirewallConfig() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [protocolFilter, setProtocolFilter] = useState("all");

  // Mock firewall rules data
  const firewallRules = [
    {
      id: "FR001",
      protocol: "TCP",
      source: "ANY",
      destination: "192.168.1.100",
      port: "80,443",
      action: "allow",
      status: "enabled",
      description: "Allow web traffic to internal server",
      lastModified: "2024-07-20 10:30"
    },
    {
      id: "FR002",
      protocol: "UDP", 
      source: "10.0.0.5",
      destination: "ANY",
      port: "53",
      action: "deny",
      status: "enabled",
      description: "Block DNS queries from rogue device",
      lastModified: "2024-07-20 09:15"
    },
    {
      id: "FR003",
      protocol: "ICMP",
      source: "ANY",
      destination: "ANY", 
      port: "N/A",
      action: "allow",
      status: "disabled",
      description: "Allow ping requests for diagnostics",
      lastModified: "2024-07-19 18:00"
    },
    {
      id: "FR004",
      protocol: "TCP",
      source: "172.16.0.0/16",
      destination: "EXTERNAL",
      port: "22",
      action: "deny",
      status: "enabled", 
      description: "Block outbound SSH from internal network",
      lastModified: "2024-07-18 14:00"
    },
    {
      id: "FR005",
      protocol: "ANY",
      source: "ANY",
      destination: "192.168.1.0/24",
      port: "ANY",
      action: "deny",
      status: "enabled",
      description: "Block all incoming traffic to internal subnet (default deny)",
      lastModified: "2024-07-18 10:00"
    },
  ];

  const filteredRules = firewallRules.filter(rule => {
    const matchesSearch = rule.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         rule.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         rule.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         rule.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || rule.status === statusFilter;
    const matchesProtocol = protocolFilter === "all" || rule.protocol.toLowerCase() === protocolFilter.toLowerCase();
    
    return matchesSearch && matchesStatus && matchesProtocol;
  });

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Firewall Configuration</h1>
          <p className="text-muted-foreground">Manage network access rules and security policies</p>
        </div>
        <Button className="bg-gradient-primary text-white hover:opacity-90">
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="p-6 bg-card shadow-card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search rules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={protocolFilter} onValueChange={setProtocolFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Protocols" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Protocols</SelectItem>
              <SelectItem value="tcp">TCP</SelectItem>
              <SelectItem value="udp">UDP</SelectItem>
              <SelectItem value="icmp">ICMP</SelectItem>
              <SelectItem value="any">ANY</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Firewall Rules Table */}
      <Card className="bg-card shadow-card">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Security Rules</h3>
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredRules.length} rules configured
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left p-4 font-medium text-foreground">ID</th>
                <th className="text-left p-4 font-medium text-foreground">Protocol</th>
                <th className="text-left p-4 font-medium text-foreground">Source</th>
                <th className="text-left p-4 font-medium text-foreground">Destination</th>
                <th className="text-left p-4 font-medium text-foreground">Port</th>
                <th className="text-left p-4 font-medium text-foreground">Action</th>
                <th className="text-left p-4 font-medium text-foreground">Status</th>
                <th className="text-left p-4 font-medium text-foreground">Description</th>
                <th className="text-left p-4 font-medium text-foreground">Last Modified</th>
                <th className="text-left p-4 font-medium text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => (
                <tr key={rule.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                  <td className="p-4">
                    <span className="font-mono text-sm text-foreground">{rule.id}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-medium text-foreground">{rule.protocol}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-sm text-foreground">{rule.source}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-sm text-foreground">{rule.destination}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-sm text-foreground">{rule.port}</span>
                  </td>
                  <td className="p-4">
                    <StatusBadge variant={rule.action as any}>
                      {rule.action.charAt(0).toUpperCase() + rule.action.slice(1)}
                    </StatusBadge>
                  </td>
                  <td className="p-4">
                    <StatusBadge variant={rule.status as any}>
                      {rule.status.charAt(0).toUpperCase() + rule.status.slice(1)}
                    </StatusBadge>
                  </td>
                  <td className="p-4 max-w-xs">
                    <span className="text-sm text-muted-foreground truncate">{rule.description}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground">{rule.lastModified}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-critical hover:text-critical">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredRules.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No firewall rules match your current filters</p>
          </div>
        )}
      </Card>

      {/* Advanced Settings */}
      <Card className="p-6 bg-card shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Advanced Settings</h3>
        </div>
        
        <div className="space-y-4">
          <details className="group">
            <summary className="flex items-center justify-between p-4 rounded-lg border border-border cursor-pointer hover:bg-muted/20 transition-colors">
              <span className="font-medium text-foreground">Intrusion Detection/Prevention System (IDS/IPS) Policies</span>
              <span className="group-open:rotate-180 transition-transform">↓</span>
            </summary>
            <div className="p-4 mt-2 rounded-lg border border-border bg-muted/10">
              <p className="text-sm text-muted-foreground">Configure advanced IDS/IPS rules and policies for enhanced threat detection.</p>
            </div>
          </details>
          
          <details className="group">
            <summary className="flex items-center justify-between p-4 rounded-lg border border-border cursor-pointer hover:bg-muted/20 transition-colors">
              <span className="font-medium text-foreground">Signature-Based Detection</span>
              <span className="group-open:rotate-180 transition-transform">↓</span>
            </summary>
            <div className="p-4 mt-2 rounded-lg border border-border bg-muted/10">
              <p className="text-sm text-muted-foreground">Manage signature databases and configure pattern matching rules.</p>
            </div>
          </details>
        </div>
      </Card>
    </div>
  );
}