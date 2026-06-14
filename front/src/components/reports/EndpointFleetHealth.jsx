import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { HardDrive, Server, ShieldAlert } from 'lucide-react';

const COLORS = {
    online: '#10b981', // green-500
    offline: '#6b7280', // gray-500
    windows: '#3b82f6', // blue-500
    linux: '#eab308', // yellow-500
    macos: '#8b5cf6', // blue-400
    other: '#9ca3af' // gray-400
};

const EndpointFleetHealth = ({ data }) => {
    if (!data) return <div className="text-text-secondary">No data available.</div>;

    const agentStatusData = useMemo(() => [
        { name: 'Online', value: data.agentStatus?.online || 0, color: COLORS.online },
        { name: 'Offline', value: data.agentStatus?.offline || 0, color: COLORS.offline }
    ], [data.agentStatus]);

    const osBreakdownData = useMemo(() => {
        if (!data.osBreakdown) return [];
        return Object.entries(data.osBreakdown)
            .filter(([_, count]) => count > 0)
            .map(([os, count]) => ({
                name: os,
                value: count,
                color: COLORS[os.toLowerCase()] || COLORS.other
            }));
    }, [data.osBreakdown]);

    const totalEndpoints = (data.agentStatus?.online || 0) + (data.agentStatus?.offline || 0);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="border-b border-gray-800 pb-4">
                <h2 className="text-2xl font-bold text-text-main">Endpoint Fleet Health & Compliance</h2>
                <p className="text-text-secondary mt-1">Audit status of enrolled agents and active analyst response actions.</p>
            </div>

            {/* Metrics and Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Total Summary */}
                <div className="flex flex-col gap-4">
                    <div className="p-5 rounded-xl bg-card-dark border border-gray-800 flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-lg"><HardDrive className="text-primary" size={20} /></div>
                            <h3 className="text-sm font-medium text-text-secondary">Total Enrolled Agents</h3>
                        </div>
                        <p className="text-4xl font-bold text-text-main">{totalEndpoints}</p>
                    </div>
                    <div className="p-5 rounded-xl bg-card-dark border border-gray-800 flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-red-500/10 rounded-lg"><ShieldAlert className="text-red-400" size={20} /></div>
                            <h3 className="text-sm font-medium text-text-secondary">High-Risk Assets</h3>
                        </div>
                        <p className="text-4xl font-bold text-red-400">{data.highRiskAssets?.length || 0}</p>
                        <p className="text-xs text-text-secondary mt-1">Endpoints with Risk Score {'>'} 7</p>
                    </div>
                </div>

                {/* Agent Status Chart */}
                <div className="p-5 rounded-xl bg-card-dark border border-gray-800 h-72">
                    <h3 className="text-base font-medium text-text-main mb-2">Agent Status</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={agentStatusData}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {agentStatusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* OS Breakdown Chart */}
                <div className="p-5 rounded-xl bg-card-dark border border-gray-800 h-72">
                    <h3 className="text-base font-medium text-text-main mb-2">OS Breakdown</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={osBreakdownData}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {osBreakdownData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Tables Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* High Risk Assets */}
                <div className="p-5 rounded-xl bg-card-dark border border-gray-800 overflow-hidden flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                        <ShieldAlert className="text-red-400" size={18} />
                        <h3 className="text-lg font-medium text-text-main">High-Risk Assets (Needs Patching)</h3>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-700 text-text-secondary">
                                    <th className="pb-2 font-medium">Asset IP</th>
                                    <th className="pb-2 font-medium text-right">Risk Score</th>
                                    <th className="pb-2 font-medium text-right">Alert Count</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.highRiskAssets && data.highRiskAssets.length > 0 ? (
                                    data.highRiskAssets.map((asset, idx) => (
                                        <tr key={idx} className="border-b border-gray-800/50 last:border-0">
                                            <td className="py-3 font-mono text-primary">{asset.ip}</td>
                                            <td className="py-3 text-right">
                                                <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded font-medium">
                                                    {asset.riskScore}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right text-text-main">{asset.totalAlerts}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3" className="py-6 text-center text-text-secondary">No high-risk assets detected in this timeframe.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Active Response Audit Log */}
                <div className="p-5 rounded-xl bg-card-dark border border-gray-800 overflow-hidden flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                        <Server className="text-primary" size={18} />
                        <h3 className="text-lg font-medium text-text-main">Active Response Audit Log</h3>
                    </div>
                    <div className="overflow-x-auto flex-1 max-h-80 overflow-y-auto pr-2">
                        <table className="w-full text-left text-sm">
                            <thead className="sticky top-0 bg-card-dark z-10">
                                <tr className="border-b border-gray-700 text-text-secondary">
                                    <th className="pb-2 font-medium">Time</th>
                                    <th className="pb-2 font-medium">Analyst</th>
                                    <th className="pb-2 font-medium">Action (Hunt)</th>
                                    <th className="pb-2 font-medium text-right">State</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.auditLog && data.auditLog.length > 0 ? (
                                    data.auditLog.map((log, idx) => {
                                        const d = new Date(log.timestamp);
                                        return (
                                            <tr key={idx} className="border-b border-gray-800/50 last:border-0">
                                                <td className="py-3 text-text-secondary">{`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}</td>
                                                <td className="py-3 text-primary">{log.analystId}</td>
                                                <td className="py-3 text-text-main truncate max-w-[150px]" title={log.description}>{log.description}</td>
                                                <td className="py-3 text-right">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        log.state === 'FINISHED' ? 'bg-green-500/10 text-green-400' : 
                                                        log.state === 'RUNNING' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'
                                                    }`}>
                                                        {log.state || 'UNKNOWN'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="py-6 text-center text-text-secondary">No recent active response actions.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default EndpointFleetHealth;