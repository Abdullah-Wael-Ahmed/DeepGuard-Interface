import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ShieldAlert, Activity, Crosshair } from 'lucide-react';
import AnimatedCounter from '../ui/AnimatedCounter';

const ExecutiveSummary = ({ data }) => {
    if (!data || !data.metrics) return <div className="text-text-secondary">No data available.</div>;

    // Transform trends data for Recharts (group by time)
    const chartData = useMemo(() => {
        if (!data.trends) return [];
        const timeMap = {};
        
        data.trends.forEach(item => {
            if (!timeMap[item.time]) {
                timeMap[item.time] = { time: item.time, critical: 0, high: 0, medium: 0 };
            }
            if (item.severity === 1) timeMap[item.time].critical += item.count;
            if (item.severity === 2) timeMap[item.time].high += item.count;
            if (item.severity === 3) timeMap[item.time].medium += item.count;
        });

        // Convert back to array and sort by time
        return Object.values(timeMap).sort((a, b) => new Date(a.time) - new Date(b.time));
    }, [data.trends]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Description */}
            <div className="border-b border-gray-800 pb-4">
                <h2 className="text-2xl font-bold text-text-main">Executive Security Summary</h2>
                <p className="text-text-secondary mt-1">High-level overview of network security posture, SOC performance, and threat landscape.</p>
            </div>

            {/* Global Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-card-dark border border-gray-800">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-500/10 rounded-lg"><ShieldAlert className="text-red-400" size={20} /></div>
                        <h3 className="text-sm font-medium text-text-secondary">Total Threats Blocked/Detected</h3>
                    </div>
                    <p className="text-3xl font-bold text-text-main"><AnimatedCounter value={data.metrics.totalThreats} /></p>
                </div>
                
                <div className="p-5 rounded-xl bg-card-dark border border-gray-800">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg"><Activity className="text-primary" size={20} /></div>
                        <h3 className="text-sm font-medium text-text-secondary">AI Anomalies Detected</h3>
                    </div>
                    <p className="text-3xl font-bold text-text-main"><AnimatedCounter value={data.metrics.totalAnomalies} /></p>
                </div>

                <div className="p-5 rounded-xl bg-card-dark border border-gray-800">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-500/10 rounded-lg"><Crosshair className="text-orange-400" size={20} /></div>
                        <h3 className="text-sm font-medium text-text-secondary">Mean Risk Score (0-10)</h3>
                    </div>
                    <p className="text-3xl font-bold text-text-main">
                        {data.metrics.meanRiskScore}
                    </p>
                </div>
            </div>

            {/* Threat Trends Chart */}
            <div className="p-5 rounded-xl bg-card-dark border border-gray-800 h-96 mb-8">
                <h3 className="text-lg font-medium text-text-main mb-4">Threat Trends Over Time</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorCrit" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickFormatter={(val) => {
                            const d = new Date(val);
                            return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:00`;
                        }} />
                        <YAxis stroke="#9ca3af" fontSize={12} />
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                        <Legend />
                        <Area type="monotone" dataKey="critical" name="Critical" stroke="#ef4444" fillOpacity={1} fill="url(#colorCrit)" />
                        <Area type="monotone" dataKey="high" name="High" stroke="#f97316" fillOpacity={1} fill="url(#colorHigh)" />
                        <Area type="monotone" dataKey="medium" name="Medium" stroke="#eab308" fillOpacity={0} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Top Offenders Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-card-dark border border-gray-800 overflow-hidden">
                    <h3 className="text-lg font-medium text-text-main mb-4">Top Offending Source IPs</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-700 text-text-secondary">
                                    <th className="pb-2 font-medium">IP Address</th>
                                    <th className="pb-2 font-medium text-right">Alert Count</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.topOffenders?.sourceIps.map((item, idx) => (
                                    <tr key={idx} className="border-b border-gray-800/50 last:border-0">
                                        <td className="py-3 font-mono text-primary">{item.src_ip}</td>
                                        <td className="py-3 text-right text-text-main">{item.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="p-5 rounded-xl bg-card-dark border border-gray-800 overflow-hidden">
                    <h3 className="text-lg font-medium text-text-main mb-4">Top Triggered Signatures</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-700 text-text-secondary">
                                    <th className="pb-2 font-medium">Signature</th>
                                    <th className="pb-2 font-medium text-right">Count</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.topOffenders?.signatures.map((item, idx) => (
                                    <tr key={idx} className="border-b border-gray-800/50 last:border-0">
                                        <td className="py-3 text-text-main truncate max-w-[200px]" title={item.signature}>{item.signature}</td>
                                        <td className="py-3 text-right text-orange-400">{item.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExecutiveSummary;