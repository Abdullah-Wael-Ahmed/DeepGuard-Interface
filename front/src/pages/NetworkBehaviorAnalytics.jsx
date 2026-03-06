import React, { useState, useEffect } from "react";
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
import AnimatedCounter from "../components/ui/AnimatedCounter";
import { GlassStatCard } from "../components/ui/GlassCard";
import axios from 'axios';

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function NetworkBehaviorAnalytics() {
    const [stats, setStats] = useState({
        totalConnections: 0,
        uniqueSourceIps: 0,
        uniqueDestIps: 0,
        dnsQueryCount: 0,
        avgDuration: 0,
    });
    const [connectionsOverTime, setConnectionsOverTime] = useState([]);
    const [topSources, setTopSources] = useState([]);
    const [protocols, setProtocols] = useState([]);
    const [topDomains, setTopDomains] = useState([]);
    const [durations, setDurations] = useState([]);
    const [recentConnections, setRecentConnections] = useState([]);
    const [dnsActivity, setDnsActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    // Use the env var like Dashboard.jsx or fallback to localhost
    const API_BASE = (import.meta.env.VITE_BACK || "http://localhost:5000") + "/zeek";

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
                durationsRes
            ] = await Promise.all([
                axios.get(`${API_BASE}/stats`),
                axios.get(`${API_BASE}/connections-over-time`),
                axios.get(`${API_BASE}/top-sources`),
                axios.get(`${API_BASE}/protocols`),
                axios.get(`${API_BASE}/top-domains`),
                axios.get(`${API_BASE}/recent-connections`),
                axios.get(`${API_BASE}/dns-activity`),
                axios.get(`${API_BASE}/durations`),
            ]);

            setStats(statsRes.data);
            setConnectionsOverTime(timeRes.data);
            setTopSources(sourcesRes.data);
            setProtocols(protosRes.data);
            setTopDomains(domainsRes.data);
            setRecentConnections(recentConnRes.data);
            setDnsActivity(dnsRes.data);
            setDurations(durationsRes.data);
        } catch (err) {
            console.error("Failed to fetch Zeek analytics data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    // Prepare duration histogram data
    const durationData = [0, 1, 2, 5, 10, 20, 50, 100].map((threshold, idx, arr) => {
        const next = arr[idx + 1] || 10000;
        const count = durations.filter(d => d >= threshold && d < next).length;
        return {
            range: next === 10000 ? `> ${threshold}s` : `${threshold}-${next}s`,
            count
        };
    });

    return (
        <div className="flex min-h-screen font-display">
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="flex flex-col gap-8 max-w-7xl mx-auto">

                    {/* Header */}
                    <div className="flex flex-wrap justify-between items-center gap-4 animate-fade-in">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-4xl font-bold tracking-tight text-gradient">
                                Network Behavior Analytics
                            </h1>
                            <p className="text-text-secondary text-base">
                                Zeek-driven behavioral analysis and traffic statistics
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={fetchData}
                                className="flex items-center gap-2 justify-center rounded-lg h-10 px-4 bg-card-dark text-sm font-medium border border-gray-700 hover:bg-primary/10 hover:border-primary transition-all duration-300"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* We can use GlassStatCard or manual cards matching Dashboard.jsx */}
                        <GlassStatCard title="Total Connections" value={<AnimatedCounter value={stats.totalConnections} />} icon={Activity} color="blue" />
                        <GlassStatCard title="Unique Sources" value={<AnimatedCounter value={stats.uniqueSourceIps} />} icon={Share2} color="green" />
                        <GlassStatCard title="Unique Dests" value={<AnimatedCounter value={stats.uniqueDestIps} />} icon={Globe} color="purple" />
                        <GlassStatCard title="DNS Queries" value={<AnimatedCounter value={stats.dnsQueryCount} />} icon={Database} color="yellow" />
                        <GlassStatCard title="Avg Duration" value={`${stats.avgDuration}s`} icon={Clock} color="red" />
                    </div>

                    {/* Charts Row 1 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="flex flex-col gap-4 rounded-xl p-6 bg-card-dark border border-gray-700 card-lift animate-fade-in lg:col-span-2">
                            <h3 className="text-lg font-medium text-text-main">Connections Over Time (24h)</h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={connectionsOverTime}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                        <XAxis
                                            dataKey="time"
                                            tickFormatter={(val) => new Date(val).getHours() + ":00"}
                                            stroke="#888888"
                                        />
                                        <YAxis stroke="#888888" />
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#f8fafc" }}
                                        />
                                        <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 rounded-xl p-6 bg-card-dark border border-gray-700 card-lift animate-fade-in">
                            <h3 className="text-lg font-medium text-text-main">Top Source IPs</h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={topSources}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} horizontal={true} vertical={false} />
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
                        </div>
                    </div>

                    {/* Charts Row 2 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-4 rounded-xl p-6 bg-card-dark border border-gray-700 card-lift animate-fade-in">
                            <h3 className="text-lg font-medium text-text-main">Protocol Distribution</h3>
                            <div className="h-[250px] w-full">
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
                                            label={({ proto, percent }) => `${proto} ${(percent * 100).toFixed(1)}%`}
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
                        </div>

                        <div className="flex flex-col gap-4 rounded-xl p-6 bg-card-dark border border-gray-700 card-lift animate-fade-in">
                            <h3 className="text-lg font-medium text-text-main">Top Queried Domains</h3>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={topDomains}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} horizontal={true} vertical={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="query" type="category" width={140} tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                                        <RechartsTooltip
                                            cursor={{ fill: 'transparent' }}
                                            contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#f8fafc" }}
                                        />
                                        <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Duration Histogram */}
                    <div className="rounded-xl p-6 bg-card-dark border border-gray-700 card-lift animate-fade-in">
                        <h3 className="text-lg font-medium text-text-main mb-4">Connection Duration Distribution</h3>
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={durationData}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
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
                    </div>

                    {/* AI Banner */}
                    <div className="p-6 bg-gradient-to-r from-indigo-900/50 to-card-dark border border-indigo-500/30 rounded-xl text-white">
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-full bg-indigo-500/20">
                                <Info className="w-6 h-6 text-indigo-300" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-1">AI Anomaly Detection Ready</h3>
                                <p className="text-indigo-200 text-sm max-w-3xl">
                                    This dashboard is ingesting high-fidelity behavioral logs from Zeek. The data structure is optimized for future integration with machine learning models.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Recent Connections */}
                        <div className="rounded-xl bg-card-dark border border-gray-700 overflow-hidden card-lift animate-fade-in">
                            <div className="p-6 border-b border-gray-700">
                                <h3 className="text-lg font-medium text-text-main">Recent Connections</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-700 bg-background-dark/30">
                                            <th className="p-4 text-sm font-medium text-text-secondary">Time</th>
                                            <th className="p-4 text-sm font-medium text-text-secondary">Source</th>
                                            <th className="p-4 text-sm font-medium text-text-secondary">Dest</th>
                                            <th className="p-4 text-sm font-medium text-text-secondary">Proto</th>
                                            <th className="p-4 text-sm font-medium text-text-secondary text-right">Bytes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentConnections.slice(0, 10).map(conn => (
                                            <tr key={conn.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                                                <td className="p-4 text-sm font-mono text-primary">{new Date(conn.timestamp).toLocaleTimeString()}</td>
                                                <td className="p-4 text-sm text-text-main">{conn.id_orig_h}</td>
                                                <td className="p-4 text-sm text-text-main">{conn.id_resp_h}</td>
                                                <td className="p-4 text-sm text-text-secondary uppercase">{conn.proto}</td>
                                                <td className="p-4 text-sm text-text-secondary text-right font-mono">{(conn.orig_bytes + conn.resp_bytes).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* DNS Activity */}
                        <div className="rounded-xl bg-card-dark border border-gray-700 overflow-hidden card-lift animate-fade-in">
                            <div className="p-6 border-b border-gray-700">
                                <h3 className="text-lg font-medium text-text-main">Recent DNS Activity</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-700 bg-background-dark/30">
                                            <th className="p-4 text-sm font-medium text-text-secondary">Time</th>
                                            <th className="p-4 text-sm font-medium text-text-secondary">Source</th>
                                            <th className="p-4 text-sm font-medium text-text-secondary">Query</th>
                                            <th className="p-4 text-sm font-medium text-text-secondary">Type</th>
                                            <th className="p-4 text-sm font-medium text-text-secondary text-right">Result</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dnsActivity.slice(0, 10).map(dns => (
                                            <tr key={dns.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                                                <td className="p-4 text-sm font-mono text-primary">{new Date(dns.timestamp).toLocaleTimeString()}</td>
                                                <td className="p-4 text-sm text-text-main">{dns.id_orig_h}</td>
                                                <td className="p-4 text-sm text-text-main">{dns.query}</td>
                                                <td className="p-4 text-sm text-text-secondary">{dns.qtype_name}</td>
                                                <td className={`p-4 text-sm font-bold text-right ${dns.rcode_name === 'NOERROR' ? 'text-green-400' : 'text-red-400'}`}>
                                                    {dns.rcode_name}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
