
import { useEffect, useState } from "react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card } from "@/components/ui/card";
import {
    Activity,
    Globe,
    Clock,
    Radio,
    Share2,
    Database,
    Info,
    RefreshCw,
} from "lucide-react";

import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";

import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";

// Types
interface ZeekStats {
    totalConnections: number;
    uniqueSourceIps: number;
    uniqueDestIps: number;
    dnsQueryCount: number;
    avgDuration: number;
}

interface ZeekConnection {
    time: string;
    count: number;
}

interface TopSource {
    id_orig_h: string;
    count: number;
}

interface Protocol {
    proto: string;
    count: number;
}

interface TopDomain {
    query: string;
    count: number;
}

interface RecentConnection {
    id: number;
    timestamp: string;
    id_orig_h: string;
    id_resp_h: string;
    proto: string;
    service: string;
    duration: number;
    orig_bytes: number;
    resp_bytes: number;
}

interface DNSLog {
    id: number;
    timestamp: string;
    id_orig_h: string;
    query: string;
    qtype_name: string;
    rcode_name: string;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function NetworkBehaviorAnalytics() {
    const [stats, setStats] = useState<ZeekStats>({
        totalConnections: 0,
        uniqueSourceIps: 0,
        uniqueDestIps: 0,
        dnsQueryCount: 0,
        avgDuration: 0,
    });
    const [connectionsOverTime, setConnectionsOverTime] = useState<ZeekConnection[]>([]);
    const [topSources, setTopSources] = useState<TopSource[]>([]);
    const [protocols, setProtocols] = useState<Protocol[]>([]);
    const [topDomains, setTopDomains] = useState<TopDomain[]>([]);
    const [durations, setDurations] = useState<number[]>([]); // Raw durations, we'll bin them locally if needed or just use stats
    const [recentConnections, setRecentConnections] = useState<RecentConnection[]>([]);
    const [dnsActivity, setDnsActivity] = useState<DNSLog[]>([]);
    const [loading, setLoading] = useState(true);

    // Configuration for Charts //
    const lineChartConfig: ChartConfig = {
        connections: {
            label: "Connections",
            color: "hsl(var(--primary))",
        },
    };

    const API_BASE = "http://localhost:5000/zeek";

    const fetchData = async () => {
        try {
            setLoading(true);
            const [
                statsRes,
                timeRes,
                sourcesRes,
                protosRes,
                domainsRes,
                recentConnRes,
                dnsRes,
            ] = await Promise.all([
                fetch(`${API_BASE}/stats`).then((r) => r.json()),
                fetch(`${API_BASE}/connections-over-time`).then((r) => r.json()),
                fetch(`${API_BASE}/top-sources`).then((r) => r.json()),
                fetch(`${API_BASE}/protocols`).then((r) => r.json()),
                fetch(`${API_BASE}/top-domains`).then((r) => r.json()),
                fetch(`${API_BASE}/recent-connections`).then((r) => r.json()),
                fetch(`${API_BASE}/dns-activity`).then((r) => r.json()),
            ]);

            setStats(statsRes);
            setConnectionsOverTime(timeRes);
            setTopSources(sourcesRes);
            setProtocols(protosRes);
            setTopDomains(domainsRes);
            setRecentConnections(recentConnRes);
            setDnsActivity(dnsRes);

            // Fetch Durations separately or from the list
            fetch(`${API_BASE}/durations`)
                .then(r => r.json())
                .then(d => setDurations(d))
                .catch(e => console.error(e));
        } catch (err) {
            console.error("Failed to fetch Zeek analytics data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Refresh every 30s
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-6 space-y-6 bg-[#fff] min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground text-[#0A2342]">
                        Network Behavior Analytics
                    </h1>
                    <p className="text-muted-foreground">
                        Zeek-driven behavioral analysis and traffic statistics
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    Last updated: {new Date().toLocaleTimeString()}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                    title="Total Connections"
                    value={stats.totalConnections.toLocaleString()}
                    icon={Activity}
                    variant="default"
                />
                <MetricCard
                    title="Unique Sources"
                    value={stats.uniqueSourceIps.toLocaleString()}
                    icon={Share2}
                    variant="default"
                />
                <MetricCard
                    title="Unique Destinations"
                    value={stats.uniqueDestIps.toLocaleString()}
                    icon={Globe}
                    variant="default"
                />
                <MetricCard
                    title="DNS Queries"
                    value={stats.dnsQueryCount.toLocaleString()}
                    icon={Database}
                    variant="default"
                />
                <MetricCard
                    title="Avg Duration"
                    value={`${stats.avgDuration}s`}
                    icon={Clock}
                    variant="default"
                />
            </div>

            {/* Main Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Connections Over Time */}
                <Card className="p-6 bg-[#0A2342] shadow-card text-white lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">
                            Connections Over Time (24h)
                        </h3>
                        <Activity className="w-5 h-5 text-muted-foreground text-white" />
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={connectionsOverTime}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis
                                    dataKey="time"
                                    tickFormatter={(val) => new Date(val).getHours() + ":00"}
                                    stroke="#888888"
                                />
                                <YAxis stroke="#888888" />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#f8fafc" }}
                                    itemStyle={{ color: "#f8fafc" }}
                                    labelStyle={{ color: "#94a3b8" }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Top Source IPs */}
                <Card className="p-6 bg-[#0A2342] shadow-card text-white">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">
                            Top Source IPs
                        </h3>
                        <Share2 className="w-5 h-5 text-muted-foreground text-white" />
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={topSources}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={true} vertical={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="id_orig_h" type="category" width={100} tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                                <RechartsTooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#f8fafc" }}
                                />
                                <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Secondary Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Protocol Distribution */}
                <Card className="p-6 bg-[#0A2342] shadow-card text-white">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">
                            Protocol Distribution
                        </h3>
                        <Radio className="w-5 h-5 text-muted-foreground text-white" />
                    </div>
                    <div className="h-[250px] w-full flex justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={protocols}
                                    dataKey="count"
                                    nameKey="proto"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    fill="#8884d8"
                                    label={({ proto, percent }: { proto: string, percent: number }) => `${proto} ${(percent * 100).toFixed(1)}%`}
                                >
                                    {protocols.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#f8fafc" }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Top DNS Queries */}
                <Card className="p-6 bg-[#0A2342] shadow-card text-white">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">
                            Top Queried Domains
                        </h3>
                        <Database className="w-5 h-5 text-muted-foreground text-white" />
                    </div>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={topDomains}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={true} vertical={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="query" type="category" width={120} tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                                <RechartsTooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#f8fafc" }}
                                />
                                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Durations Histogram */}
            <div className="grid grid-cols-1 gap-6">
                <Card className="p-6 bg-[#0A2342] shadow-card text-white">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">
                            Connection Duration Distribution
                        </h3>
                        <Clock className="w-5 h-5 text-muted-foreground text-white" />
                    </div>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={
                                // Simple binning
                                [0, 1, 2, 5, 10, 20, 50, 100].map((threshold, idx, arr) => {
                                    const next = arr[idx + 1] || 10000;
                                    const count = durations.filter(d => d >= threshold && d < next).length;
                                    return {
                                        range: next === 10000 ? `> ${threshold}s` : `${threshold}-${next}s`,
                                        count
                                    };
                                })
                            }>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                                <XAxis dataKey="range" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                                <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                                <RechartsTooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#f8fafc" }}
                                />
                                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* AI Readiness Banner */}
            <Card className="p-6 bg-gradient-to-r from-indigo-900 to-[#0A2342] border-indigo-500/30 text-white">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-full bg-indigo-500/20">
                        <Info className="w-6 h-6 text-indigo-300" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-1">AI Anomaly Detection Ready</h3>
                        <p className="text-indigo-200 text-sm max-w-3xl">
                            This dashboard is ingesting high-fidelity behavioral logs from Zeek. The data structure is optimized for future integration with machine learning models to detect zero-day anomalies and beaconing behavior automatically.
                        </p>
                    </div>
                </div>
            </Card>

            {/* Data Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Connections Table */}
                <Card className="p-6 bg-[#0A2342] shadow-card text-white overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">
                            Recent Connections
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-black/20 text-indigo-200">
                                <tr>
                                    <th className="px-4 py-3">Time</th>
                                    <th className="px-4 py-3">Source</th>
                                    <th className="px-4 py-3">Dest</th>
                                    <th className="px-4 py-3">Proto</th>
                                    <th className="px-4 py-3 text-right">Bytes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {recentConnections.slice(0, 10).map((conn) => (
                                    <tr key={conn.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3 font-mono text-xs">
                                            {new Date(conn.timestamp).toLocaleTimeString()}
                                        </td>
                                        <td className="px-4 py-3">{conn.id_orig_h}</td>
                                        <td className="px-4 py-3">{conn.id_resp_h}</td>
                                        <td className="px-4 py-3 uppercase text-xs font-bold text-muted-foreground">{conn.proto}</td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                                            {(conn.orig_bytes + conn.resp_bytes).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Recent DNS Queries Table */}
                <Card className="p-6 bg-[#0A2342] shadow-card text-white overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">
                            Recent DNS Activity
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-black/20 text-indigo-200">
                                <tr>
                                    <th className="px-4 py-3">Time</th>
                                    <th className="px-4 py-3">Source</th>
                                    <th className="px-4 py-3">Query</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3 text-right">Result</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {dnsActivity.slice(0, 10).map((dns) => (
                                    <tr key={dns.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3 font-mono text-xs">
                                            {new Date(dns.timestamp).toLocaleTimeString()}
                                        </td>
                                        <td className="px-4 py-3">{dns.id_orig_h}</td>
                                        <td className="px-4 py-3">{dns.query}</td>
                                        <td className="px-4 py-3 text-xs">{dns.qtype_name}</td>
                                        <td className={`px-4 py-3 text-right font-bold text-xs ${dns.rcode_name === 'NOERROR' ? 'text-green-400' : 'text-red-400'}`}>
                                            {dns.rcode_name}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div >
    );
}
