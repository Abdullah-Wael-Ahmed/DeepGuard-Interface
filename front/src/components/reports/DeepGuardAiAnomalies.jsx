import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BrainCircuit, Activity, AlertTriangle } from 'lucide-react';
import AnimatedCounter from '../ui/AnimatedCounter';

const DeepGuardAiAnomalies = ({ data }) => {
    if (!data || !data.metrics) return <div className="text-text-secondary p-8">No data available.</div>;

    const { metrics = {}, deviations = [], log = [] } = data;

    // Colors for the bar chart
    const colors = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6'];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Description */}
            <div className="border-b border-gray-800 pb-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-text-main flex items-center gap-2">
                            <BrainCircuit className="text-primary" /> DeepGuard AI Anomalies
                        </h2>
                        <p className="text-text-secondary mt-1">Zero-Day detection and behavioral analysis metrics from the ML engine.</p>
                    </div>
                </div>
            </div>

            {/* ML Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-card-dark border border-gray-800 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-500/10 rounded-lg"><Activity className="text-blue-400" size={20} /></div>
                            <h3 className="text-sm font-medium text-text-secondary">Total Connections Analyzed (AI)</h3>
                        </div>
                        <p className="text-3xl font-bold text-text-main pl-11">
                            <AnimatedCounter value={metrics?.totalAnalyzed || 0} />
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-text-secondary mb-1">Processing Rate</div>
                        <div className="text-sm font-mono text-primary">~{(metrics?.totalAnalyzed / (data?.timeRange?.hours || 24)).toFixed(0)} / hr</div>
                    </div>
                </div>
                
                <div className="p-5 rounded-xl bg-card-dark border border-gray-800 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-red-500/10 rounded-lg"><AlertTriangle className="text-red-400" size={20} /></div>
                            <h3 className="text-sm font-medium text-text-secondary">Anomalies Flagged</h3>
                        </div>
                        <p className="text-3xl font-bold text-red-400 pl-11">
                            <AnimatedCounter value={metrics?.totalFlagged || 0} />
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-text-secondary mb-1">Detection Rate</div>
                        <div className="text-sm font-mono text-red-400">
                            {metrics?.totalAnalyzed > 0 ? ((metrics.totalFlagged / metrics.totalAnalyzed) * 100).toFixed(2) : 0}%
                        </div>
                    </div>
                </div>
            </div>

            {/* Behavioral Deviations Chart */}
            <div className="p-5 rounded-xl bg-card-dark border border-gray-800 h-96">
                <h3 className="text-lg font-medium text-text-main mb-4">Behavioral Deviations Breakdown</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deviations || []} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis 
                            dataKey="name" 
                            stroke="#9ca3af" 
                            fontSize={12} 
                            tick={{ fill: '#9ca3af' }}
                            angle={-25}
                            textAnchor="end"
                            interval={0}
                        />
                        <YAxis stroke="#9ca3af" fontSize={12} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '0.5rem' }} 
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {(deviations || []).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* AI Detections Log Table */}
            <div className="p-5 rounded-xl bg-card-dark border border-gray-800 overflow-hidden">
                <h3 className="text-lg font-medium text-text-main mb-4">AI Detections Log</h3>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto pr-2">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-card-dark z-10">
                            <tr className="border-b border-gray-700 text-text-secondary">
                                <th className="pb-3 font-medium">Timestamp</th>
                                <th className="pb-3 font-medium">Source IP</th>
                                <th className="pb-3 font-medium">Destination IP</th>
                                <th className="pb-3 font-medium text-center">Confidence</th>
                                <th className="pb-3 font-medium">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {log && log.length > 0 ? (
                                log.map((entry, idx) => {
                                    const d = new Date(entry?.timestamp || Date.now());
                                    return (
                                        <tr key={idx} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                                            <td className="py-3 text-text-secondary whitespace-nowrap">
                                                {`${d.toLocaleDateString()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
                                            </td>
                                            <td className="py-3 font-mono text-primary">{entry?.srcIp || 'N/A'}</td>
                                            <td className="py-3 font-mono text-text-main">{entry?.destIp || 'N/A'}</td>
                                            <td className="py-3 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    (entry?.score || 0) >= 90 ? 'bg-red-500/20 text-red-400' :
                                                    (entry?.score || 0) >= 70 ? 'bg-orange-500/20 text-orange-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                    {entry?.score || 0}%
                                                </span>
                                            </td>
                                            <td className="py-3 text-text-main">{entry?.description || 'Behavioral Deviation'}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="5" className="py-8 text-center text-text-secondary">
                                        No behavioral anomalies detected in this timeframe.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DeepGuardAiAnomalies;