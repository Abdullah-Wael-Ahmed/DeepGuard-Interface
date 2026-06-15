import React from 'react';
import { Target, Activity, AlertTriangle, Shield, Search, Terminal } from 'lucide-react';

const getSeverityStyles = (severity) => {
    switch (severity) {
        case 1: return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
        case 2: return { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
        case 3: return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' };
        case 4: return { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' };
        default: return { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' };
    }
};

const getEventIcon = (type, severity) => {
    if (type === 'suricata') return <Shield size={16} className={getSeverityStyles(severity).color} />;
    if (type === 'anomaly') return <Activity size={16} className={getSeverityStyles(severity).color} />;
    if (type === 'zeek') return <Search size={16} className={getSeverityStyles(severity).color} />;
    return <AlertTriangle size={16} className={getSeverityStyles(severity).color} />;
};

const IncidentPostMortem = ({ data }) => {
    if (!data || !data.overview) return <div className="text-text-secondary">No data available.</div>;

    const { overview, timeline, forensicEvidence, targetIp } = data;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Description */}
            <div className="border-b border-gray-800 pb-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-text-main flex items-center gap-2">
                            <Target className="text-primary" /> Incident Post-Mortem
                        </h2>
                        <p className="text-text-secondary mt-1">Formal chronological record of events and evidence for specific entity.</p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-text-secondary mb-1">Target Entity</div>
                        <div className="px-3 py-1 rounded bg-card-dark border border-gray-700 font-mono text-primary text-lg">
                            {targetIp}
                        </div>
                    </div>
                </div>
            </div>

            {/* Overview Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-card-dark border border-gray-800">
                    <h3 className="text-sm font-medium text-text-secondary mb-1">Calculated Risk Score</h3>
                    <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${overview.riskScore >= 7 ? 'text-red-400' : overview.riskScore >= 4 ? 'text-orange-400' : 'text-yellow-400'}`}>
                            {overview.riskScore}
                        </span>
                        <span className="text-text-secondary text-sm">/ 10</span>
                    </div>
                </div>
                
                <div className="p-4 rounded-xl bg-card-dark border border-gray-800">
                    <h3 className="text-sm font-medium text-text-secondary mb-1">Incident Status</h3>
                    <span className={`inline-block px-3 py-1 mt-1 rounded text-sm font-medium ${
                        overview.status === 'Investigating' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                        overview.status === 'Monitoring' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 
                        'bg-green-500/10 text-green-400 border border-green-500/20'
                    }`}>
                        {overview.status}
                    </span>
                </div>

                <div className="p-4 rounded-xl bg-card-dark border border-gray-800">
                    <h3 className="text-sm font-medium text-text-secondary mb-1">Total Correlated Events</h3>
                    <p className="text-2xl font-bold text-text-main">{overview.totalEvents}</p>
                </div>

                <div className="p-4 rounded-xl bg-card-dark border border-gray-800">
                    <h3 className="text-sm font-medium text-text-secondary mb-1">Velociraptor Agent</h3>
                    {overview.relatedClientId ? (
                        <div className="mt-1">
                            <span className="text-green-400 text-sm font-medium">✓ Enrolled</span>
                            <div className="text-xs font-mono text-text-secondary truncate mt-1" title={overview.relatedClientId}>
                                {overview.relatedClientId}
                            </div>
                        </div>
                    ) : (
                        <span className="text-red-400 text-sm font-medium mt-1 inline-block">✗ Not Found</span>
                    )}
                </div>
            </div>

            {/* The Attack Timeline */}
            <div className="p-5 rounded-xl bg-card-dark border border-gray-800">
                <h3 className="text-lg font-medium text-text-main mb-6">The Attack Timeline</h3>
                
                <div className="relative pl-6 border-l border-gray-700 space-y-6 max-h-[400px] overflow-y-auto pr-4">
                    {timeline && timeline.length > 0 ? (
                        timeline.map((event) => {
                            const styles = getSeverityStyles(event.severity);
                            const date = new Date(event.timestamp);
                            return (
                                <div key={event.id} className="relative">
                                    {/* Timeline dot */}
                                    <div className={`absolute -left-[33px] top-1 w-6 h-6 rounded-full flex items-center justify-center border ${styles.bg} ${styles.border}`}>
                                        {getEventIcon(event.type, event.severity)}
                                    </div>
                                    
                                    <div className="bg-background-dark p-3 rounded-lg border border-gray-800">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-medium text-text-main">{event.title}</div>
                                            <div className="text-xs text-text-secondary whitespace-nowrap ml-4">
                                                {`${date.toLocaleDateString()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')}`}
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                            <div className="text-text-secondary">Source: <span className="font-mono text-primary ml-1">{event.source}</span></div>
                                            <div className="text-text-secondary">Dest: <span className="font-mono text-primary ml-1">{event.dest}</span></div>
                                            <div className="col-span-2 text-text-secondary text-xs mt-1 bg-white/5 p-2 rounded">
                                                {event.details}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-text-secondary py-4">No events found in the specified timeframe.</div>
                    )}
                </div>
            </div>

            {/* Forensic Evidence */}
            <div className="p-5 rounded-xl bg-card-dark border border-gray-800">
                <div className="flex items-center gap-2 mb-4">
                    <Terminal className="text-primary" size={18} />
                    <h3 className="text-lg font-medium text-text-main">Forensic Evidence (Velociraptor)</h3>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-700 text-text-secondary">
                                <th className="pb-2 font-medium">Timestamp</th>
                                <th className="pb-2 font-medium">Artifact Hunted</th>
                                <th className="pb-2 font-medium text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {forensicEvidence && forensicEvidence.length > 0 ? (
                                forensicEvidence.map((ev, idx) => {
                                    const d = new Date(ev.timestamp);
                                    return (
                                        <tr key={idx} className="border-b border-gray-800/50 last:border-0">
                                            <td className="py-3 text-text-secondary">{`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}</td>
                                            <td className="py-3 font-mono text-primary text-xs">{ev.artifact}</td>
                                            <td className="py-3 text-right">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    ev.state === 'FINISHED' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                                                }`}>
                                                    {ev.state}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="3" className="py-6 text-center text-text-secondary">
                                        No forensic collections found for this host.
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

export default IncidentPostMortem;