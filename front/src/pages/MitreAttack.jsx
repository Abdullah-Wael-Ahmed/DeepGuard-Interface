import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useSearchParams } from 'react-router-dom';
import {
    Crosshair, ShieldAlert, BrainCircuit, Activity, ServerCrash,
    MapPin, Eye, X, Clock, Target, LoaderCircle, Inbox, RefreshCw,
    Ban
} from 'lucide-react';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import { SkeletonCard } from '../components/ui/Skeleton';

// ─────────────────────────────────────────────────────────────────────────────
// Source-Color Mapping (Red=Suricata, Orange=Correlated, Purple=AI, Grey=None)
// ─────────────────────────────────────────────────────────────────────────────
const getSourceStyle = (source, aiInferred) => {
    if (source === 'Suricata') return { dot: 'bg-red-500', border: 'border-red-500/40', glow: 'shadow-[0_0_8px_rgba(239,68,68,0.15)]', text: 'text-red-400', bg: 'bg-red-500/10', label: 'Signature' };
    if (source === 'Correlated') return { dot: 'bg-orange-500', border: 'border-orange-500/40', glow: 'shadow-[0_0_8px_rgba(249,115,22,0.15)]', text: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Correlated' };
    if (source === 'AI Behavioral' || aiInferred) return { dot: 'bg-purple-500', border: 'border-purple-500/40', glow: 'shadow-[0_0_8px_rgba(168,85,247,0.15)]', text: 'text-purple-400', bg: 'bg-purple-500/10', label: 'AI Inferred' };
    if (source === 'Zeek') return { dot: 'bg-orange-500', border: 'border-orange-500/40', glow: 'shadow-[0_0_8px_rgba(249,115,22,0.15)]', text: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Zeek Analytics' };
    return { dot: 'bg-gray-600', border: 'border-gray-700', glow: '', text: 'text-gray-500', bg: 'bg-gray-500/5', label: 'Inactive' };
};

const getSeverityBadge = (severity) => {
    switch (severity) {
        case 'Critical': return 'bg-red-500/10 text-red-500 border border-red-500/20';
        case 'High': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
        case 'Medium': return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
        case 'Low': return 'bg-green-500/10 text-green-400 border border-green-500/20';
        default: return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
    }
};

const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMin = Math.round((now - d) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
    return d.toLocaleDateString();
};

// ─────────────────────────────────────────────────────────────────────────────
// Main MitreAttack Page Component
// ─────────────────────────────────────────────────────────────────────────────

const MitreAttack = () => {
    const [searchParams] = useSearchParams();
    const search = searchParams.get('search') || '';
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ active_techniques: 0, tactics_observed: 0, ai_behavioral_flags: 0, high_severity: 0 });
    const [coverage, setCoverage] = useState({ detected: 0, total: 0, score: 0 });
    const [matrix, setMatrix] = useState([]);
    const [recentAlerts, setRecentAlerts] = useState([]);
    const [playbooks, setPlaybooks] = useState([]);

    // Drill-down state
    const [selectedTechnique, setSelectedTechnique] = useState(null);
    const [techniqueDetail, setTechniqueDetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const BACK = import.meta.env.VITE_BACK || 'http://localhost:5000';

    // ─────────────── Data Fetching ───────────────

    const fetchMatrix = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${BACK}/mitre/attack-mapping`, { withCredentials: true });
            setStats(res.data.stats);
            setCoverage(res.data.coverage);
            setMatrix(res.data.matrix);
        } catch (error) {
            console.error('Failed to load ATT&CK mapping:', error);
        }
        setLoading(false);
    };

    const fetchRecentAlerts = async () => {
        try {
            const res = await axios.get(`${BACK}/mitre/recent-alerts`, { withCredentials: true });
            setRecentAlerts(res.data);
        } catch (error) {
            console.error('Failed to load recent alerts:', error);
        }
    };

    const fetchTechniqueDetail = async (techId) => {
        try {
            setLoadingDetail(true);
            const res = await axios.get(`${BACK}/mitre/attack-mapping/${techId}`, { withCredentials: true });
            setTechniqueDetail(res.data);
        } catch (error) {
            console.error('Failed to load technique detail:', error);
        }
        setLoadingDetail(false);
    };

    const fetchPlaybooks = async () => {
        try {
            const res = await axios.get(`${BACK}/playbooks`, { withCredentials: true });
            setPlaybooks(res.data);
        } catch (error) {
            console.error('Failed to load playbooks:', error);
        }
    };

    useEffect(() => {
        fetchMatrix();
        fetchRecentAlerts();
        fetchPlaybooks();
    }, []);

    const coveredTechniques = useMemo(() => {
        const covered = new Set();
        playbooks.forEach(pb => {
            if (pb.mitreTags) pb.mitreTags.forEach(t => covered.add(t));
        });
        return covered;
    }, [playbooks]);

    const filteredAlerts = useMemo(() => {
        if (!search) return recentAlerts;
        const q = search.toLowerCase();
        return recentAlerts.filter(alert => 
            alert.alert_id?.toLowerCase().includes(q) ||
            alert.technique_id?.toLowerCase().includes(q) ||
            alert.signature?.toLowerCase().includes(q) ||
            alert.source?.toLowerCase().includes(q) ||
            alert.src_ip?.toLowerCase().includes(q)
        );
    }, [recentAlerts, search]);

    // ─────────────── Technique Drill-Down ───────────────

    const handleTechniqueClick = (tech) => {
        if (!tech.detected) return;
        setSelectedTechnique(tech);
        fetchTechniqueDetail(tech.id);
    };

    // ─────────────── Quick-action: block IP ───────────────

    const handleBlockIP = async (ip) => {
        try {
            await axios.post(`${BACK}/firewall/add-rule`, {
                chain: 'INPUT', protocol: 'ALL', srcIp: ip, destIp: '', srcPort: '', destPort: '', action: 'DROP', description: `MITRE ATT&CK Copilot auto-block ${ip}`
            }, { withCredentials: true });
            toast.success(`IP ${ip} blocked via iptables.`);
        } catch (error) {
            toast.error(`Failed to block IP ${ip}. ${error.response?.data?.error || ''}`);
        }
    };

    // ─────────────── Render ───────────────

    return (
        <div className="flex-1 bg-background-dark p-4 sm:p-8 overflow-y-auto relative">
            <div className="flex flex-col gap-8 max-w-[1800px] mx-auto pb-24"> 

                {/* ═══════════════ Header ═══════════════ */}
                <div className="flex flex-wrap justify-between items-center gap-4 animate-fade-in">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gradient flex items-center gap-3">
                            MITRE ATT&CK Mapping
                        </h1>
                        <p className="text-text-secondary text-sm sm:text-base max-w-2xl">
                            Real-time threat mapping, correlation analysis, and AI-driven investigation assistant.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => { fetchMatrix(); fetchRecentAlerts(); }}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-card-dark rounded-lg border border-gray-700 hover:border-primary transition-all text-sm"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            <span>Refresh Data</span>
                        </button>
                    </div>
                </div>

                {/* ═══════════════ Stats Row ═══════════════ */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 sm:gap-6">
                        {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 stagger-children">
                        <div className="flex flex-col gap-2 rounded-xl p-5 bg-card-dark border border-gray-700 hover:border-red-500/50 transition-all duration-300 card-lift">
                            <div className="flex justify-between items-start">
                                <p className="text-text-secondary text-sm font-medium">Active Techniques</p>
                                <div className={`p-2 rounded-lg ${stats.active_techniques > 0 ? 'bg-red-500/20 animate-pulse' : 'bg-red-500/10'}`}>
                                    <ShieldAlert className="text-red-400" size={18} />
                                </div>
                            </div>
                            <p className="text-text-main text-3xl font-bold"><AnimatedCounter value={stats.active_techniques} /></p>
                            <p className="text-red-400 text-sm font-medium">Triggered last 24h</p>
                        </div>
                        <div className="flex flex-col gap-2 rounded-xl p-5 bg-card-dark border border-gray-700 hover:border-orange-500/50 transition-all duration-300 card-lift">
                            <div className="flex justify-between items-start">
                                <p className="text-text-secondary text-sm font-medium">Tactics Observed</p>
                                <div className="p-2 bg-orange-500/10 rounded-lg"><Activity className="text-orange-400" size={18} /></div>
                            </div>
                            <p className="text-text-main text-3xl font-bold"><AnimatedCounter value={stats.tactics_observed} /></p>
                            <p className="text-orange-400 text-sm font-medium">of 12 total tactics</p>
                        </div>
                        <div className="flex flex-col gap-2 rounded-xl p-5 bg-card-dark border border-gray-700 hover:border-purple-500/50 transition-all duration-300 card-lift">
                            <div className="flex justify-between items-start">
                                <p className="text-text-secondary text-sm font-medium">AI-Behavioral Flags</p>
                                <div className="p-2 bg-purple-500/10 rounded-lg"><BrainCircuit className="text-purple-400" size={18} /></div>
                            </div>
                            <p className="text-text-main text-3xl font-bold"><AnimatedCounter value={stats.ai_behavioral_flags} /></p>
                            <p className="text-purple-400 text-sm font-medium">Isolation Forest anomalies</p>
                        </div>
                        <div className="flex flex-col gap-2 rounded-xl p-5 bg-card-dark border border-gray-700 hover:border-red-600/50 transition-all duration-300 card-lift">
                            <div className="flex justify-between items-start">
                                <p className="text-text-secondary text-sm font-medium">High Severity</p>
                                <div className={`p-2 rounded-lg ${stats.high_severity > 0 ? 'bg-red-600/20 animate-pulse' : 'bg-red-600/10'}`}>
                                    <ServerCrash className="text-red-500" size={18} />
                                </div>
                            </div>
                            <p className="text-text-main text-3xl font-bold"><AnimatedCounter value={stats.high_severity} /></p>
                            <p className={`text-sm font-medium ${stats.high_severity > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {stats.high_severity > 0 ? '⚠ Requires attention' : '✓ All clear'}
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 rounded-xl p-5 bg-card-dark border border-gray-700 hover:border-primary/50 transition-all duration-300 card-lift sm:col-span-2 xl:col-span-1">
                            <div className="flex justify-between items-start">
                                <p className="text-text-secondary text-sm font-medium">Detection Coverage</p>
                                <div className="p-2 bg-primary/10 rounded-lg"><Target className="text-primary" size={18} /></div>
                            </div>
                            <p className="text-text-main text-3xl font-bold"><AnimatedCounter value={coverage.score} />%</p>
                            <p className="text-primary text-sm font-medium">{coverage.detected}/{coverage.total} techniques</p>
                        </div>
                    </div>
                )}

                {/* ═══════════════ Main workspace: Matrix & Tables ═══════════════ */}
                <div className="flex flex-col gap-6 w-full transition-all duration-300">

                    {/* ─── ATT&CK Matrix ─── */}
                    <div className="bg-card-dark rounded-xl border border-gray-700 overflow-hidden card-lift animate-fade-in w-full">
                        <div className="p-4 sm:p-5 border-b border-gray-700 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                            <div className="flex items-center gap-2">
                                <MapPin className="text-primary" size={18} />
                                <h2 className="text-lg font-medium text-text-main">ATT&CK Matrix — Detection Overlay</h2>
                            </div>
                            <div className="flex flex-wrap gap-3 sm:gap-4 text-xs font-medium">
                                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> Signature</div>
                                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Correlated / Zeek</div>
                                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500"></span> AI Inferred</div>
                                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-600"></span> Not Observed</div>
                            </div>
                        </div>

                        <div className="p-4 overflow-x-auto w-full">
                            {loading ? (
                                <div className="flex items-center justify-center h-64 w-full">
                                    <LoaderCircle className="animate-spin text-primary" size={48} />
                                </div>
                            ) : (
                                <div className="grid gap-3 min-w-[1200px]" style={{ gridTemplateColumns: `repeat(${matrix.length}, minmax(130px, 1fr))` }}>
                                    {matrix.map(tactic => (
                                        <div key={tactic.id} className="flex flex-col gap-1.5">
                                            {/* Tactic Header */}
                                            <div className="bg-background-dark/60 p-2 text-center text-[10px] font-bold uppercase rounded-md text-text-secondary tracking-wider border border-gray-800 truncate">
                                                {tactic.shortName}
                                            </div>
                                            {/* Techniques */}
                                            {tactic.techniques.map(tech => {
                                                const style = getSourceStyle(tech.source, tech.ai_inferred);
                                                const hasPlaybook = coveredTechniques.has(tech.id);
                                                const matchesSearch = !search || 
                                                    tech.id.toLowerCase().includes(search.toLowerCase()) || 
                                                    tech.name.toLowerCase().includes(search.toLowerCase());
                                                return (
                                                    <div
                                                        key={tech.id}
                                                        onClick={() => handleTechniqueClick(tech)}
                                                        className={`p-2 rounded text-[11px] border flex flex-col justify-center transition-all duration-200 ${tech.detected
                                                            ? `${style.border} ${style.glow} hover:bg-white/5 cursor-pointer`
                                                            : 'border-gray-800 bg-gray-800/20 text-gray-600'} ${matchesSearch ? '' : 'opacity-20 pointer-events-none'}`}
                                                    >
                                                        <div className="flex justify-between items-center w-full">
                                                            <span className={`truncate mr-2 ${tech.detected ? 'text-text-main font-medium' : 'text-gray-600'}`} title={tech.name}>{tech.id}</span>
                                                            <span className={`w-2 h-2 rounded-full ${style.dot} flex-shrink-0`}></span>
                                                        </div>
                                                        {hasPlaybook && (
                                                            <span className="text-[9px] bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded px-1 py-0.5 w-fit mt-1 inline-block">SOAR Protect</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── Technique Drill-Down Panel ─── */}
                    {selectedTechnique && (
                        <div className="bg-card-dark rounded-xl border border-gray-700 overflow-hidden animate-fade-in w-full">
                            <div className="p-4 sm:p-5 border-b border-gray-700 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Eye className="text-primary hidden sm:block" size={18} />
                                    <h2 className="text-base sm:text-lg font-medium text-text-main truncate">
                                        {selectedTechnique.id} — {selectedTechnique.name}
                                    </h2>
                                    <span className={`hidden sm:inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityBadge(selectedTechnique.severity)}`}>
                                        {selectedTechnique.severity}
                                    </span>
                                </div>
                                <button onClick={() => { setSelectedTechnique(null); setTechniqueDetail(null); }} className="p-1 hover:bg-gray-700 rounded transition-colors flex-shrink-0">
                                    <X size={18} className="text-text-secondary" />
                                </button>
                            </div>
                            <div className="p-4 sm:p-5">
                                {loadingDetail ? (
                                    <div className="flex items-center justify-center h-32">
                                        <LoaderCircle className="animate-spin text-primary" size={36} />
                                    </div>
                                ) : techniqueDetail && techniqueDetail.alerts?.length > 0 ? (
                                    <div className="space-y-4">
                                        {techniqueDetail.alerts.map((alert, idx) => {
                                            const aStyle = getSourceStyle(alert.source, alert.ai_inferred);
                                            return (
                                                <div key={idx} className={`p-4 rounded-lg bg-background-dark border ${aStyle.border} ${aStyle.glow}`}>
                                                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold ${aStyle.bg} ${aStyle.text}`}>{aStyle.label}</span>
                                                            <span className="text-xs text-text-secondary font-mono">{alert.alert_id}</span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${getSeverityBadge(alert.severity)}`}>{alert.severity}</span>
                                                        </div>
                                                        <span className="text-[10px] sm:text-xs text-text-secondary flex items-center gap-1">
                                                            <Clock size={12} /> {formatTime(alert.timestamp)}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-text-main mb-3 break-words">{alert.signature}</p>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                                        <div><span className="text-text-secondary">Source IP</span><p className="text-cyan-400 font-mono mt-0.5">{alert.src_ip}</p></div>
                                                        <div><span className="text-text-secondary">Dest IP</span><p className="text-purple-400 font-mono mt-0.5">{alert.dest_ip}</p></div>
                                                        <div><span className="text-text-secondary">Ports</span><p className="text-text-main font-mono mt-0.5">{alert.dest_ports?.join(', ')}</p></div>
                                                        <div><span className="text-text-secondary">Confidence</span><p className={`font-bold mt-0.5 ${alert.confidence >= 0.9 ? 'text-red-400' : alert.confidence >= 0.7 ? 'text-orange-400' : 'text-yellow-400'}`}>{(alert.confidence * 100).toFixed(0)}%</p></div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 mt-4">
                                                        <button onClick={() => handleBlockIP(alert.src_ip)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded text-xs font-medium hover:bg-red-500/20 transition-colors">
                                                            <Ban size={12} /> Block IP
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                                        <Inbox size={36} />
                                        <p className="mt-2 text-sm text-center">No alerts for this technique.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── Recent ATT&CK Alerts Table ─── */}
                    <div className="bg-card-dark rounded-xl border border-gray-700 overflow-hidden card-lift animate-fade-in w-full">
                        <div className="p-4 sm:p-5 border-b border-gray-700">
                            <h2 className="text-lg font-medium text-text-main">Recent ATT&CK Detections</h2>
                            <p className="text-text-secondary text-xs sm:text-sm">Latest mapped events from Suricata, Zeek, and AI engines</p>
                        </div>
                        {loading ? (
                            <div className="flex items-center justify-center h-32 w-full">
                                <LoaderCircle className="animate-spin text-primary" size={36} />
                            </div>
                        ) : filteredAlerts.length > 0 ? (
                            <div className="overflow-x-auto w-full">
                                <table className="w-full text-left text-sm min-w-[800px]">
                                    <thead>
                                        <tr className="border-b border-gray-700 bg-background-dark/30">
                                            {['Time', 'Alert ID', 'Technique', 'Source', 'Severity', 'Src IP', 'Confidence'].map(h => (
                                                <th key={h} className="p-4 text-[11px] sm:text-xs font-medium text-text-secondary uppercase tracking-wider">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800 stagger-children">
                                        {filteredAlerts.map((alert, idx) => {
                                            const s = getSourceStyle(alert.source, alert.ai_inferred);
                                            return (
                                                <tr key={idx} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => handleTechniqueClick({ id: alert.technique_id, name: alert.signature, detected: true, source: alert.source, severity: alert.severity, ai_inferred: alert.ai_inferred })}>
                                                    <td className="p-4 text-text-secondary font-mono text-[11px] sm:text-xs whitespace-nowrap">{formatTime(alert.timestamp)}</td>
                                                    <td className="p-4 text-primary font-mono text-[11px] sm:text-xs">{alert.alert_id}</td>
                                                    <td className="p-4 text-text-main font-medium text-[11px] sm:text-xs whitespace-nowrap">{alert.technique_id}</td>
                                                    <td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium whitespace-nowrap ${s.bg} ${s.text}`}>{alert.source}</span></td>
                                                    <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${getSeverityBadge(alert.severity)}`}>{alert.severity}</span></td>
                                                    <td className="p-4 text-cyan-400 font-mono text-[11px] sm:text-xs">{alert.src_ip}</td>
                                                    <td className="p-4 text-[11px] sm:text-xs font-bold">{(alert.confidence * 100).toFixed(0)}%</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                                <Inbox size={36} />
                                <p className="mt-2 text-sm text-center">No recent ATT&CK detections</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MitreAttack;