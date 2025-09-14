import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  RefreshCw,
  Download,
  Play,
  Pause,
  Filter,
  Eye,
  Activity,
  Columns,
} from "lucide-react";

export default function TrafficInspection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCapturing, setIsCapturing] = useState(true);

  // Mock traffic data
  const trafficData = [
    {
      timestamp: "2024-07-26 14:30:01",
      sourceIp: "192.168.1.10",
      sourcePort: "54321",
      destinationIp: "172.217.160.142",
      destinationPort: "443",
      protocol: "TCP",
      l7App: "HTTPS",
      payloadPreview: "GET /index.html HTTP/1.1...",
      sessionId: "SESS-001A",
    },
    {
      timestamp: "2024-07-26 14:30:02",
      sourceIp: "10.0.0.5",
      sourcePort: "80",
      destinationIp: "192.168.1.100",
      destinationPort: "60000",
      protocol: "TCP",
      l7App: "HTTP",
      payloadPreview: "200 OK Content-Type: text/html...",
      sessionId: "SESS-001B",
    },
    {
      timestamp: "2024-07-26 14:30:03",
      sourceIp: "192.168.1.20",
      sourcePort: "53210",
      destinationIp: "8.8.8.8",
      destinationPort: "53",
      protocol: "UDP",
      l7App: "DNS",
      payloadPreview: "Query: example.com A...",
      sessionId: "SESS-001C",
    },
    {
      timestamp: "2024-07-26 14:30:04",
      sourceIp: "172.16.0.1",
      sourcePort: "22",
      destinationIp: "192.168.1.10",
      destinationPort: "58901",
      protocol: "TCP",
      l7App: "SSH",
      payloadPreview: "SSH-2.0-OpenSSH_8.9...",
      sessionId: "SESS-001D",
    },
    {
      timestamp: "2024-07-26 14:30:05",
      sourceIp: "192.168.1.10",
      sourcePort: "54322",
      destinationIp: "172.217.160.142",
      destinationPort: "443",
      protocol: "TCP",
      l7App: "HTTPS",
      payloadPreview: "POST /api/data HTTP/1.1...",
      sessionId: "SESS-001E",
    },
    {
      timestamp: "2024-07-26 14:30:06",
      sourceIp: "10.0.0.6",
      sourcePort: "8080",
      destinationIp: "192.168.1.101",
      destinationPort: "60001",
      protocol: "TCP",
      l7App: "HTTP",
      payloadPreview: "404 Not Found...",
      sessionId: "SESS-001F",
    },
    {
      timestamp: "2024-07-26 14:30:07",
      sourceIp: "192.168.1.25",
      sourcePort: "53211",
      destinationIp: "8.8.4.4",
      destinationPort: "53",
      protocol: "UDP",
      l7App: "DNS",
      payloadPreview: "Query: google.com MX...",
      sessionId: "SESS-001G",
    },
    {
      timestamp: "2024-07-26 14:30:08",
      sourceIp: "172.16.0.2",
      sourcePort: "3389",
      destinationIp: "192.168.1.11",
      destinationPort: "58902",
      protocol: "TCP",
      l7App: "RDP",
      payloadPreview: "RDP Connection Request...",
      sessionId: "SESS-001H",
    },
  ];

  const filteredTraffic = trafficData.filter((traffic) => {
    const matchesSearch =
      traffic.sourceIp.includes(searchQuery) ||
      traffic.destinationIp.includes(searchQuery) ||
      traffic.l7App.toLowerCase().includes(searchQuery.toLowerCase()) ||
      traffic.protocol.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const exportTrafficData = () => {
    const headers = [
      "Timestamp",
      "Source IP",
      "Source Port",
      "Destination IP",
      "Destination Port",
      "Protocol",
      "L7 Application",
      "Payload Preview",
      "Session ID",
    ];

    const csvContent = [
      headers.join(","),
      ...filteredTraffic.map((traffic) =>
        [
          traffic.timestamp,
          traffic.sourceIp,
          traffic.sourcePort,
          traffic.destinationIp,
          traffic.destinationPort,
          traffic.protocol,
          traffic.l7App,
          `"${traffic.payloadPreview.replace(/"/g, '""')}"`,
          traffic.sessionId,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `traffic-data-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Network Traffic Inspection
          </h1>
          <p className="text-muted-foreground">
            Analyze real-time network traffic, inspect packet details, and apply
            advanced filters to diagnose anomalies and secure your network
          </p>
        </div>
      </div>

      {/* Traffic Controls */}
      <Card className="p-6 bg-[#0A2342] text-white shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground text-white">
            Traffic Filters & Actions
          </h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Button
            variant={isCapturing ? "default" : "outline"}
            onClick={() => setIsCapturing(!isCapturing)}
            className="bg-gradient-primary text-white hover:opacity-90"
          >
            {isCapturing ? (
              <Pause className="w-4 h-4 mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {isCapturing ? "Pause Capture" : "Start Capture"}
          </Button>

          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2 text-[#0A2342]" />
            
            <span className="text-[#0A2342]">Show Filters</span>
          </Button>

          <Button variant="outline">
            <RefreshCw className="w-4 h-4 mr-2 text-[#0A2342]" />
            <span className="text-[#0A2342]">Refresh</span>
          </Button>

          <Button variant="outline" onClick={exportTrafficData}>
            <Download className="w-4 h-4 mr-2 text-[#0A2342]" />
            <span className="text-[#0A2342]">Export Data</span>
          </Button>

          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search traffic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Live Traffic Log */}
      <Card className="bg-[#0A2342] text-white shadow-card">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground text-white">
                Live Traffic Log
              </h3>
              {isCapturing && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                  <span className="text-sm text-success">Live</span>
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm">
              <Columns className="w-4 h-4 mr-2" />
              Columns
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left p-4 font-medium text-foreground text-white">
                  Timestamp
                </th>
                <th className="text-left p-4 font-medium text-foreground text-white">
                  Source IP:Port
                </th>
                <th className="text-left p-4 font-medium text-foreground text-white">
                  Destination IP:Port
                </th>
                <th className="text-left p-4 font-medium text-foreground text-white">
                  Protocol
                </th>
                <th className="text-left p-4 font-medium text-foreground text-white">
                  L7 App
                </th>
                <th className="text-left p-4 font-medium text-foreground text-white">
                  Payload Preview
                </th>
                <th className="text-left p-4 font-medium text-foreground text-white">
                  Session ID
                </th>
                <th className="text-left p-4 font-medium text-foreground text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTraffic.map((traffic, index) => (
                <tr
                  key={index}
                  className="border-b border-border hover:bg-muted/10 transition-colors"
                >
                  <td className="p-4">
                    <span className="font-mono text-sm text-foreground text-white">
                      {traffic.timestamp}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-sm text-foreground text-white">
                      {traffic.sourceIp}:{traffic.sourcePort}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-sm text-foreground text-white">
                      {traffic.destinationIp}:{traffic.destinationPort}
                    </span>
                  </td>
                  <td className="p-4">
                    <StatusBadge
                      variant={
                        traffic.protocol === "TCP"
                          ? "info"
                          : traffic.protocol === "UDP"
                          ? "warning"
                          : "default"
                      }
                    >
                      {traffic.protocol}
                    </StatusBadge>
                  </td>
                  <td className="p-4">
                    <StatusBadge
                      variant={
                        traffic.l7App === "HTTPS"
                          ? "success"
                          : traffic.l7App === "HTTP"
                          ? "info"
                          : traffic.l7App === "SSH"
                          ? "medium"
                          : traffic.l7App === "DNS"
                          ? "low"
                          : "default"
                      }
                    >
                      {traffic.l7App}
                    </StatusBadge>
                  </td>
                  <td className="p-4 max-w-xs">
                    <span className="font-mono text-sm text-muted-foreground text-white truncate block">
                      {traffic.payloadPreview}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-sm text-muted-foreground text-white">
                      {traffic.sessionId}
                    </span>
                  </td>
                  <td className="p-4">
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTraffic.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No traffic data matches your current filters</p>
          </div>
        )}

        {/* Pagination */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {filteredTraffic.length} entries
          </div>
          <div className="flex items-center gap-2 text-[#0A2342]">
            <Button variant="outline" size="sm" disabled>
              ← Previous
            </Button>
            <Button variant="outline" size="sm">
              1
            </Button>
            <Button variant="outline" size="sm">
              Next →
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
