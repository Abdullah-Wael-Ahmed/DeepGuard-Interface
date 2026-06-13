import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
    MonitorSmartphone, Search, Terminal, X, RefreshCw,
    Shield, ShieldAlert, ShieldCheck, Wifi, WifiOff,
    Activity, Crosshair, ChevronRight, ChevronDown,
    Clock, Cpu, Network, FolderSearch, History, BarChart3,
    AlertTriangle, Eye, Play, ShieldBan, Skull,
    Database, Globe, Zap, Filter, ArrowUpDown
} from 'lucide-react';
import AnimatedCounter, { Sparkline } from '../components/ui/AnimatedCounter';
import { SkeletonCard, SkeletonTableRow } from '../components/ui/Skeleton';

// ─── Preset Artifact Catalog ──────────────────────────────────────
const PRESET_ARTIFACTS = [
    { name: 'Generic.Client.Info', label: 'System Info', desc: 'OS, hardware, IPs, agent version', category: 'Triage' },
    { name: 'Windows.System.Pslist', label: 'Process List', desc: 'All running processes with details', category: 'Triage' },
    { name: 'Windows.Network.Netstat', label: 'Network Connections', desc: 'Active TCP/UDP connections', category: 'Triage' },
    { name: 'Windows.System.TaskScheduler', label: 'Scheduled Tasks', desc: 'Persistence via task scheduler', category: 'Persistence' },
    { name: 'Windows.Sys.StartupItems', label: 'Startup Items', desc: 'Auto-start programs', category: 'Persistence' },
    { name: 'Windows.Registry.AutoRuns', label: 'AutoRuns', desc: 'All auto-start extensibility points', category: 'Persistence' },
    { name: 'Windows.EventLogs.Evtx', label: 'Event Logs', desc: 'Search Windows Event Logs', category: 'Forensics' },
    { name: 'Windows.Detection.Yara.Process', label: 'YARA Scan', desc: 'YARA rules on running processes', category: 'Detection' },
    { name: 'Windows.Forensics.Prefetch', label: 'Prefetch Analysis', desc: 'Program execution history', category: 'Forensics' },
    { name: 'Linux.Sys.Crontab', label: 'Crontab', desc: 'Linux scheduled jobs', category: 'Persistence' },
];

// ─── Severity Helpers ─────────────────────────────────────────────
const severityConfig = {
    1: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    2: { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
    3: { label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
};

const riskColor = (score) => {
    if (score >= 7) return { text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'Critical' };
    if (score >= 4) return { text: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', label: 'High' };
    if (score >= 2) return { text: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', label: 'Medium' };
    return { text: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', label: 'Low' };
};

const timeAgo = (ts) => {
    if (!ts) return 'Unknown';
    const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};


// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const Endpoints = () => {
    // ─── State ────────────────────────────────────────────────────
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState(null);
    const [overview, setOverview] = useState({ totalEndpoints: 0, activeAlerts: 0, criticalAlerts: 0 });
    const [searchQuery, setSearchQuery] = useState('');
    const [filterOS, setFilterOS] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortBy, setSortBy] = useState('hostname');
    const [sortDir, setSortDir] = useState('asc');

    // Detail panel
    const [selectedEndpoint, setSelectedEndpoint] = useState(null);
    const [endpointContext, setEndpointContext] = useState(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    // Hunt modal
    const [showHuntModal, setShowHuntModal] = useState(false);
    const [huntTarget, setHuntTarget] = useState(null);
    const [manualTargetId, setManualTargetId] = useState('');
    const [selectedArtifact, setSelectedArtifact] = useState('Generic.Client.Info');
    const [huntCategory, setHuntCategory] = useState('all');

    // Isolate confirmation modal
    const [showIsolateModal, setShowIsolateModal] = useState(false);
    const [isolateTarget, setIsolateTarget] = useState(null);
    const [isolateConfirm, setIsolateConfirm] = useState('');

    // Collections
    const [collections, setCollections] = useState([]);
    const [loadingCollections, setLoadingCollections] = useState(false);

    // ─── Data fetching ────────────────────────────────────────────
    const fetchStatus = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACK}/api/velociraptor/status`, { withCredentials: true });
            setStatus(res.data.status);
        } catch { setStatus('Offline'); }
    };

    const fetchClients = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${import.meta.env.VITE_BACK}/api/velociraptor/clients`, { withCredentials: true });
            setClients(res.data.items || res.data.Items || []);
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchOverview = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACK}/api/velociraptor/overview`, { withCredentials: true });
            setOverview(res.data);
        } catch (error) {
            console.error('Error fetching overview:', error);
        }
    };

    const fetchEndpointContext = async (ip) => {
        setLoadingContext(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACK}/api/velociraptor/context/${ip}`, { withCredentials: true });
            setEndpointContext(res.data);
        } catch (error) {
            console.error('Error fetching endpoint context:', error);
            toast.error('Failed to load endpoint context');
        } finally {
            setLoadingContext(false);
        }
    };

    const fetchCollections = async (clientId) => {
        setLoadingCollections(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACK}/api/velociraptor/clients/${clientId}/collections`, { withCredentials: true });
            setCollections(res.data.Items || res.data.items || []);
        } catch (error) {
            console.error('Error fetching collections:', error);
        } finally {
            setLoadingCollections(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchClients();
        fetchOverview();
    }, []);

    // When selecting an endpoint, load its context and collections
    const selectEndpoint = useCallback((client) => {
        setSelectedEndpoint(client);
        setActiveTab('overview');
        const ip = client.os_info?.ip || client.ip || '';
        if (ip) fetchEndpointContext(ip);
        if (client.client_id) fetchCollections(client.client_id);
    }, []);

    // ─── Filtering & Sorting ──────────────────────────────────────
    const filteredClients = useMemo(() => {
        let list = [...clients];

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(c =>
                (c.os_info?.hostname || '').toLowerCase().includes(q) ||
                (c.client_id || '').toLowerCase().includes(q) ||
                (c.os_info?.ip || '').toLowerCase().includes(q)
            );
        }

        if (filterOS !== 'all') {
            list = list.filter(c => (c.os_info?.system || '').toLowerCase().includes(filterOS));
        }

        if (filterStatus !== 'all') {
            list = list.filter(c => {
                const lastSeen = c.last_seen_at / 1000;
                const isOnline = (Date.now() / 1000) - lastSeen < 600;
                return filterStatus === 'online' ? isOnline : !isOnline;
            });
        }

        list.sort((a, b) => {
            let aVal, bVal;
            if (sortBy === 'hostname') {
                aVal = (a.os_info?.hostname || '').toLowerCase();
                bVal = (b.os_info?.hostname || '').toLowerCase();
            } else if (sortBy === 'lastSeen') {
                aVal = a.last_seen_at || 0;
                bVal = b.last_seen_at || 0;
            } else if (sortBy === 'os') {
                aVal = (a.os_info?.system || '').toLowerCase();
                bVal = (b.os_info?.system || '').toLowerCase();
            }
            if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return list;
    }, [clients, searchQuery, filterOS, filterStatus, sortBy, sortDir]);

    const toggleSort = (field) => {
        if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(field); setSortDir('asc'); }
    };

    // ─── Actions ──────────────────────────────────────────────────
    const handleRunHunt = async (e) => {
        e.preventDefault();
        try {
            const targetId = huntTarget?.client_id || manualTargetId;
            if (!targetId) {
                toast.error('Please select a target endpoint');
                return;
            }
            await axios.post(`${import.meta.env.VITE_BACK}/api/velociraptor/hunt`, {
                artifact: selectedArtifact,
                clientId: targetId
            }, { withCredentials: true });
            toast.success(`Hunt "${selectedArtifact}" started on ${huntTarget?.os_info?.hostname || targetId}`);
            setShowHuntModal(false);
            setManualTargetId('');
            if (targetId && selectedEndpoint?.client_id === targetId) {
                fetchCollections(targetId);
            }
        } catch (error) {
            toast.error('Failed to trigger hunt');
        }
    };

    const handleIsolate = async () => {
        const hostname = isolateTarget?.os_info?.hostname || isolateTarget?.client_id || '';
        if (isolateConfirm !== hostname) {
            toast.error('Hostname confirmation does not match');
            return;
        }
        toast.warning(`[STUB] Host isolation requested for ${hostname}. Velociraptor integration pending.`);
        setShowIsolateModal(false);
        setIsolateConfirm('');
    };

    // ─── Unique OS values for filter dropdown ─────────────────────
    const osOptions = useMemo(() => {
        const systems = new Set(clients.map(c => (c.os_info?.system || 'Unknown').toLowerCase()));
        return [...systems];
    }, [clients]);

    const onlineCount = useMemo(() =>
        clients.filter(c => (Date.now() / 1000) - (c.last_seen_at / 1000) < 600).length
    , [clients]);


    // ═══════════════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className="flex min-h-screen font-display">
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="flex flex-col gap-8 max-w-[1600px] mx-auto">

                    {/* ─── Header ──────────────────────────────────────── */}
                    <div className="flex flex-wrap justify-between items-center gap-4 animate-fade-in">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-4xl font-bold tracking-tight text-gradient">Endpoints</h1>
                            <p className="text-text-secondary text-base">
                                Endpoint Detection & Response via Velociraptor — Monitor, investigate, and respond to endpoint threats.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-4 py-2 bg-card-dark rounded-lg border border-gray-700">
                                <div className={`w-2 h-2 rounded-full animate-pulse ${status === 'Online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className={`${status === 'Online' ? 'text-green-500' : 'text-red-500'} text-sm font-medium`}>
                                    Server {status || 'Checking...'}
                                </span>
                            </div>
                            <button
                                onClick={() => { fetchClients(); fetchOverview(); fetchStatus(); }}
                                className="flex items-center gap-2 justify-center rounded-lg h-10 px-4 bg-card-dark text-sm font-medium border border-gray-700 hover:bg-primary/10 hover:border-primary transition-all duration-300"
                            >
                                <RefreshCw className="h-4 w-4" />
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* ─── KPI Cards ───────────────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
                        {/* Total Agents */}
                        <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-dark border border-gray-700 hover:border-primary/50 transition-all duration-300 card-lift">
                            <div className="flex justify-between items-start">
                                <p className="text-text-secondary text-sm font-medium">Total Agents</p>
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <MonitorSmartphone className="text-primary" size={18} />
                                </div>
                            </div>
                            <p className="text-text-main text-4xl font-bold">
                                <AnimatedCounter value={clients.length || overview.totalEndpoints} />
                            </p>
                            <p className="text-text-secondary text-sm">Enrolled endpoints</p>
                        </div>

                        {/* Online */}
                        <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-dark border border-gray-700 hover:border-green-500/50 transition-all duration-300 card-lift">
                            <div className="flex justify-between items-start">
                                <p className="text-text-secondary text-sm font-medium">Online</p>
                                <div className="p-2 bg-green-500/10 rounded-lg">
                                    <Wifi className="text-green-400" size={18} />
                                </div>
                            </div>
                            <p className="text-text-main text-4xl font-bold">
                                <AnimatedCounter value={onlineCount} />
                            </p>
                            <p className="text-green-400 text-sm font-medium">Active in last 10 min</p>
                        </div>

                        {/* Offline */}
                        <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-dark border border-gray-700 hover:border-gray-500/50 transition-all duration-300 card-lift">
                            <div className="flex justify-between items-start">
                                <p className="text-text-secondary text-sm font-medium">Offline</p>
                                <div className="p-2 bg-gray-500/10 rounded-lg">
                                    <WifiOff className="text-gray-400" size={18} />
                                </div>
                            </div>
                            <p className="text-text-main text-4xl font-bold">
                                <AnimatedCounter value={Math.max(clients.length - onlineCount, 0)} />
                            </p>
                            <p className="text-gray-400 text-sm font-medium">Not responding</p>
                        </div>

                        {/* Active Alerts */}
                        <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-dark border border-gray-700 hover:border-red-500/50 transition-all duration-300 card-lift">
                            <div className="flex justify-between items-start">
                                <p className="text-text-secondary text-sm font-medium">Active Alerts</p>
                                <div className={`p-2 rounded-lg ${overview.criticalAlerts > 0 ? 'bg-red-500/20 animate-pulse' : 'bg-red-500/10'}`}>
                                    <AlertTriangle className="text-red-400" size={18} />
                                </div>
                            </div>
                            <p className="text-text-main text-4xl font-bold">
                                <AnimatedCounter value={overview.activeAlerts} />
                            </p>
                            <p className={`text-sm font-medium ${overview.criticalAlerts > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {overview.criticalAlerts > 0 ? `${overview.criticalAlerts} critical` : '✓ All clear'}
                            </p>
                        </div>
                    </div>

                    {/* ─── Search & Filter Bar ─────────────────────────── */}
                    <div className="flex flex-wrap items-center gap-3 animate-fade-in">
                        <div className="relative flex-1 min-w-[250px]">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by hostname, Client ID, or IP..."
                                className="w-full bg-card-dark border border-gray-700 text-text-main text-sm rounded-lg pl-10 pr-4 py-2.5 focus:ring-primary focus:border-primary transition-colors"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter size={14} className="text-text-secondary" />
                            <select
                                value={filterOS}
                                onChange={(e) => setFilterOS(e.target.value)}
                                className="bg-card-dark border border-gray-700 text-text-main text-sm rounded-lg px-3 py-2.5 focus:ring-primary focus:border-primary"
                            >
                                <option value="all">All OS</option>
                                {osOptions.map(os => (
                                    <option key={os} value={os}>{os.charAt(0).toUpperCase() + os.slice(1)}</option>
                                ))}
                            </select>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="bg-card-dark border border-gray-700 text-text-main text-sm rounded-lg px-3 py-2.5 focus:ring-primary focus:border-primary"
                            >
                                <option value="all">All Status</option>
                                <option value="online">Online</option>
                                <option value="offline">Offline</option>
                            </select>
                        </div>
                    </div>

                    {/* ─── Main Content Grid ───────────────────────────── */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                        {/* ═════ Agent Table ═════ */}
                        <div className={`${selectedEndpoint ? 'xl:col-span-1' : 'xl:col-span-3'} rounded-xl bg-card-dark border border-gray-700 overflow-hidden card-lift animate-fade-in transition-all duration-300`}>
                            <div className="p-5 border-b border-gray-700 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-medium text-text-main">Enrolled Agents</h2>
                                    <p className="text-text-secondary text-sm">{filteredClients.length} endpoint{filteredClients.length !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                                {loading ? (
                                    <table className="w-full"><tbody>
                                        {[...Array(6)].map((_, i) => <SkeletonTableRow key={i} columns={selectedEndpoint ? 3 : 6} />)}
                                    </tbody></table>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="border-b border-gray-700 bg-background-dark/80 backdrop-blur-sm">
                                                <th onClick={() => toggleSort('hostname')} className="p-4 text-sm font-medium text-text-secondary cursor-pointer hover:text-primary transition-colors">
                                                    <div className="flex items-center gap-1">Hostname <ArrowUpDown size={12} /></div>
                                                </th>
                                                {!selectedEndpoint && (
                                                    <>
                                                        <th className="p-4 text-sm font-medium text-text-secondary">Client ID</th>
                                                        <th onClick={() => toggleSort('os')} className="p-4 text-sm font-medium text-text-secondary cursor-pointer hover:text-primary transition-colors">
                                                            <div className="flex items-center gap-1">OS <ArrowUpDown size={12} /></div>
                                                        </th>
                                                    </>
                                                )}
                                                <th onClick={() => toggleSort('lastSeen')} className="p-4 text-sm font-medium text-text-secondary cursor-pointer hover:text-primary transition-colors">
                                                    <div className="flex items-center gap-1">Status <ArrowUpDown size={12} /></div>
                                                </th>
                                                {!selectedEndpoint && <th className="p-4 text-sm font-medium text-text-secondary">Actions</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="stagger-children">
                                            {filteredClients.length > 0 ? (
                                                filteredClients.map((client, idx) => {
                                                    const lastSeen = client.last_seen_at / 1000;
                                                    const isOnline = (Date.now() / 1000) - lastSeen < 600;
                                                    const isSelected = selectedEndpoint?.client_id === client.client_id;
                                                    return (
                                                        <tr
                                                            key={idx}
                                                            onClick={() => selectEndpoint(client)}
                                                            className={`border-b border-gray-800 cursor-pointer transition-colors ${
                                                                isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-white/5'
                                                            }`}
                                                        >
                                                            <td className="p-4 text-sm font-medium text-text-main flex items-center gap-2">
                                                                <MonitorSmartphone size={16} className={isOnline ? 'text-green-400' : 'text-gray-500'} />
                                                                <span className="truncate max-w-[150px]">{client.os_info?.hostname || 'Unknown'}</span>
                                                            </td>
                                                            {!selectedEndpoint && (
                                                                <>
                                                                    <td className="p-4 text-sm font-mono text-text-secondary truncate max-w-[120px]">{client.client_id}</td>
                                                                    <td className="p-4 text-sm text-text-secondary">{client.os_info?.system || 'Unknown'}</td>
                                                                </>
                                                            )}
                                                            <td className="p-4">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium border ${
                                                                        isOnline ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-gray-500/10 border-gray-500/20 text-gray-400'
                                                                    }`}>
                                                                        {isOnline ? 'Online' : 'Offline'}
                                                                    </span>
                                                                    <span className="text-xs text-text-secondary">{timeAgo(new Date(lastSeen * 1000))}</span>
                                                                </div>
                                                            </td>
                                                            {!selectedEndpoint && (
                                                                <td className="p-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); selectEndpoint(client); }}
                                                                            className="p-1.5 rounded-lg hover:bg-primary/10 text-text-secondary hover:text-primary transition-colors"
                                                                            title="View Details"
                                                                        >
                                                                            <Eye size={16} />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setHuntTarget(client); setShowHuntModal(true); }}
                                                                            className="p-1.5 rounded-lg hover:bg-primary/10 text-text-secondary hover:text-primary transition-colors"
                                                                            title="Run Hunt"
                                                                        >
                                                                            <Terminal size={16} />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setIsolateTarget(client); setShowIsolateModal(true); }}
                                                                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                                                                            title="Isolate Host"
                                                                        >
                                                                            <ShieldBan size={16} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={selectedEndpoint ? 2 : 5} className="p-12 text-center">
                                                        <div className="flex flex-col items-center gap-3 text-text-secondary">
                                                            <MonitorSmartphone size={40} className="opacity-30" />
                                                            <p className="font-medium">No agents found</p>
                                                            <p className="text-sm">Agents will appear once Velociraptor clients are enrolled and reporting.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* ═════ Endpoint Detail Panel ═════ */}
                        {selectedEndpoint && (
                            <div className="xl:col-span-2 rounded-xl bg-card-dark border border-gray-700 overflow-hidden animate-fade-in flex flex-col max-h-[800px]">
                                {/* Detail Header */}
                                <div className="p-5 border-b border-gray-700 flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-primary/10 rounded-xl">
                                            <MonitorSmartphone size={22} className="text-primary" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                                                {selectedEndpoint.os_info?.hostname || 'Unknown'}
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
                                                    (Date.now() / 1000) - (selectedEndpoint.last_seen_at / 1000) < 600
                                                        ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                                        : 'bg-gray-500/10 border-gray-500/20 text-gray-400'
                                                }`}>
                                                    {(Date.now() / 1000) - (selectedEndpoint.last_seen_at / 1000) < 600 ? 'Online' : 'Offline'}
                                                </span>
                                            </h2>
                                            <p className="text-text-secondary text-sm font-mono">{selectedEndpoint.client_id} · {selectedEndpoint.os_info?.system || 'Unknown OS'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => { setHuntTarget(selectedEndpoint); setShowHuntModal(true); }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/30 rounded-lg text-sm font-medium hover:bg-primary/20 transition-all"
                                        >
                                            <Play size={14} /> Collect
                                        </button>
                                        <button
                                            onClick={() => { setIsolateTarget(selectedEndpoint); setShowIsolateModal(true); }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-all"
                                        >
                                            <ShieldBan size={14} /> Isolate
                                        </button>
                                        <button onClick={() => { setSelectedEndpoint(null); setEndpointContext(null); }} className="p-1.5 text-text-secondary hover:text-white transition-colors">
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="flex border-b border-gray-700 overflow-x-auto">
                                    {[
                                        { id: 'overview', icon: Eye, label: 'Overview' },
                                        { id: 'alerts', icon: ShieldAlert, label: 'Alerts' },
                                        { id: 'network', icon: Network, label: 'Network' },
                                        { id: 'collections', icon: Database, label: 'Collections' },
                                        { id: 'timeline', icon: History, label: 'Timeline' },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                                activeTab === tab.id
                                                    ? 'border-primary text-primary'
                                                    : 'border-transparent text-text-secondary hover:text-text-main hover:border-gray-600'
                                            }`}
                                        >
                                            <tab.icon size={14} />
                                            {tab.label}
                                            {tab.id === 'alerts' && endpointContext?.summary?.totalAlerts > 0 && (
                                                <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">{endpointContext.summary.totalAlerts}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content */}
                                <div className="flex-1 overflow-y-auto p-5">
                                    {loadingContext ? (
                                        <div className="flex flex-col gap-4 animate-pulse">
                                            {[...Array(4)].map((_, i) => (
                                                <div key={i} className="h-20 bg-gray-800 rounded-lg w-full"></div>
                                            ))}
                                        </div>
                                    ) : (
                                        <>
                                            {/* ── Overview Tab ── */}
                                            {activeTab === 'overview' && (
                                                <div className="flex flex-col gap-5">
                                                    {/* Risk Score Banner */}
                                                    {endpointContext && (
                                                        <div className={`p-4 rounded-xl border ${riskColor(endpointContext.riskScore).bg} flex items-center justify-between`}>
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2 rounded-lg ${endpointContext.riskScore >= 7 ? 'bg-red-500/20' : endpointContext.riskScore >= 4 ? 'bg-orange-500/20' : 'bg-green-500/20'}`}>
                                                                    <Shield size={20} className={riskColor(endpointContext.riskScore).text} />
                                                                </div>
                                                                <div>
                                                                    <p className={`text-sm font-bold ${riskColor(endpointContext.riskScore).text}`}>
                                                                        Risk Level: {riskColor(endpointContext.riskScore).label}
                                                                    </p>
                                                                    <p className="text-xs text-text-secondary">Based on correlated alerts, connections, and anomalies (24h)</p>
                                                                </div>
                                                            </div>
                                                            <div className={`text-3xl font-bold ${riskColor(endpointContext.riskScore).text}`}>
                                                                {endpointContext.riskScore}/10
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Endpoint Info Grid */}
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <InfoCard label="Hostname" value={selectedEndpoint.os_info?.hostname || 'Unknown'} icon={MonitorSmartphone} />
                                                        <InfoCard label="Operating System" value={`${selectedEndpoint.os_info?.system || 'Unknown'} ${selectedEndpoint.os_info?.release || ''}`} icon={Cpu} />
                                                        <InfoCard label="Client ID" value={selectedEndpoint.client_id || 'N/A'} icon={Database} mono />
                                                        <InfoCard label="Last Seen" value={timeAgo(new Date((selectedEndpoint.last_seen_at || 0) / 1000))} icon={Clock} />
                                                    </div>

                                                    {/* Summary Stats */}
                                                    {endpointContext && (
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <MiniStat label="Alerts" value={endpointContext.summary.totalAlerts} icon={ShieldAlert}
                                                                accent={endpointContext.summary.criticalAlerts > 0 ? 'red' : 'green'} />
                                                            <MiniStat label="Connections" value={endpointContext.summary.totalConnections} icon={Network} accent="blue" />
                                                            <MiniStat label="Anomalies" value={endpointContext.summary.totalAnomalies} icon={Zap}
                                                                accent={endpointContext.summary.highSeverityAnomalies > 0 ? 'orange' : 'green'} />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* ── Alerts Tab ── */}
                                            {activeTab === 'alerts' && (
                                                <div className="flex flex-col gap-3">
                                                    {endpointContext?.alerts?.length > 0 ? (
                                                        endpointContext.alerts.map((alert, i) => {
                                                            const sev = severityConfig[alert.severity] || severityConfig[3];
                                                            return (
                                                                <div key={i} className={`p-4 rounded-lg border ${sev.bg} flex items-start justify-between gap-4`}>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${sev.bg} ${sev.color}`}>{sev.label}</span>
                                                                            <span className="text-xs text-text-secondary">{new Date(alert.timestamp || alert.createdAt).toLocaleString()}</span>
                                                                        </div>
                                                                        <p className="text-sm text-text-main font-medium truncate">{alert.signature || 'Unknown Alert'}</p>
                                                                        <p className="text-xs text-text-secondary mt-1">{alert.src_ip}:{alert.src_port} → {alert.dest_ip}:{alert.dest_port} ({alert.protocol})</p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <EmptyState icon={ShieldCheck} message="No alerts found for this endpoint in the last 24 hours." />
                                                    )}
                                                </div>
                                            )}

                                            {/* ── Network Tab ── */}
                                            {activeTab === 'network' && (
                                                <div className="flex flex-col gap-3">
                                                    {endpointContext && (
                                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                                            <div className="p-3 rounded-lg bg-background-dark/50 border border-gray-800">
                                                                <p className="text-xs text-text-secondary">Unique Dest Ports</p>
                                                                <p className="text-lg font-bold text-primary">{endpointContext.summary.uniqueDestPorts}</p>
                                                            </div>
                                                            <div className="p-3 rounded-lg bg-background-dark/50 border border-gray-800">
                                                                <p className="text-xs text-text-secondary">Unique Dest IPs</p>
                                                                <p className="text-lg font-bold text-primary">{endpointContext.summary.uniqueDestIPs}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {endpointContext?.zeekConnections?.length > 0 ? (
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-left text-sm">
                                                                <thead>
                                                                    <tr className="border-b border-gray-700">
                                                                        <th className="p-3 text-xs text-text-secondary font-medium">Source</th>
                                                                        <th className="p-3 text-xs text-text-secondary font-medium">Destination</th>
                                                                        <th className="p-3 text-xs text-text-secondary font-medium">Protocol</th>
                                                                        <th className="p-3 text-xs text-text-secondary font-medium">Duration</th>
                                                                        <th className="p-3 text-xs text-text-secondary font-medium">State</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {endpointContext.zeekConnections.map((conn, i) => (
                                                                        <tr key={i} className="border-b border-gray-800 hover:bg-white/5">
                                                                            <td className="p-3 font-mono text-xs">{conn.id_orig_h}:{conn.id_orig_p}</td>
                                                                            <td className="p-3 font-mono text-xs">{conn.id_resp_h}:{conn.id_resp_p}</td>
                                                                            <td className="p-3 text-xs">{conn.proto || conn.service || '—'}</td>
                                                                            <td className="p-3 text-xs">{conn.duration ? `${conn.duration.toFixed(2)}s` : '—'}</td>
                                                                            <td className="p-3">
                                                                                <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                                                                                    conn.conn_state === 'SF' ? 'bg-green-500/10 text-green-400' :
                                                                                    conn.conn_state === 'S0' ? 'bg-red-500/10 text-red-400' :
                                                                                    'bg-gray-500/10 text-gray-400'
                                                                                }`}>
                                                                                    {conn.conn_state || '—'}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <EmptyState icon={Network} message="No network connections found for this endpoint." />
                                                    )}
                                                </div>
                                            )}

                                            {/* ── Collections Tab ── */}
                                            {activeTab === 'collections' && (
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <p className="text-sm text-text-secondary">Artifact collection results for this endpoint</p>
                                                        <button
                                                            onClick={() => { setHuntTarget(selectedEndpoint); setShowHuntModal(true); }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/30 rounded-lg text-xs font-medium hover:bg-primary/20 transition-all"
                                                        >
                                                            <Play size={12} /> New Collection
                                                        </button>
                                                    </div>
                                                    {loadingCollections ? (
                                                        <div className="animate-pulse flex flex-col gap-3">
                                                            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-800 rounded-lg w-full"></div>)}
                                                        </div>
                                                    ) : collections.length > 0 ? (
                                                        collections.map((col, i) => (
                                                            <div key={i} className="p-4 bg-background-dark/50 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                                                                <div className="flex justify-between items-start mb-1">
                                                                    <span className="text-sm font-medium text-primary">{col.artifacts ? col.artifacts.join(', ') : col.artifact || 'Custom Hunt'}</span>
                                                                    <span className={`text-xs px-2 py-0.5 rounded border ${
                                                                        col.state === 'FINISHED' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                                        col.state === 'RUNNING' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse' :
                                                                        'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                                                    }`}>
                                                                        {col.state}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-text-secondary font-mono">Flow: {col.urn || col.flow_id || 'N/A'}</p>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <EmptyState icon={Database} message="No artifact collections found. Run a hunt to collect data." />
                                                    )}
                                                </div>
                                            )}

                                            {/* ── Timeline Tab ── */}
                                            {activeTab === 'timeline' && (
                                                <div className="flex flex-col gap-0">
                                                    {endpointContext ? (() => {
                                                        // Merge all events into a single timeline
                                                        const events = [
                                                            ...endpointContext.alerts.map(a => ({
                                                                time: a.timestamp || a.createdAt,
                                                                type: 'alert',
                                                                label: a.signature || 'Alert',
                                                                detail: `${a.src_ip} → ${a.dest_ip}:${a.dest_port}`,
                                                                severity: a.severity
                                                            })),
                                                            ...endpointContext.zeekConnections.slice(0, 10).map(c => ({
                                                                time: c.timestamp || c.createdAt,
                                                                type: 'connection',
                                                                label: `${c.proto || 'tcp'} connection`,
                                                                detail: `${c.id_orig_h}:${c.id_orig_p} → ${c.id_resp_h}:${c.id_resp_p}`,
                                                                severity: null
                                                            })),
                                                            ...endpointContext.anomalies.map(a => ({
                                                                time: a.timestamp,
                                                                type: 'anomaly',
                                                                label: `Anomaly (${a.severity})`,
                                                                detail: `Score: ${a.anomaly_score?.toFixed(4)} — Port ${a.dest_port}`,
                                                                severity: a.severity === 'HIGH' ? 1 : a.severity === 'MEDIUM' ? 2 : 3
                                                            }))
                                                        ].sort((a, b) => new Date(b.time) - new Date(a.time));

                                                        if (events.length === 0) return <EmptyState icon={History} message="No events found for this endpoint in the last 24 hours." />;

                                                        return events.map((evt, i) => (
                                                            <div key={i} className="flex gap-4 group">
                                                                {/* Timeline line */}
                                                                <div className="flex flex-col items-center">
                                                                    <div className={`w-2.5 h-2.5 rounded-full mt-2 ${
                                                                        evt.type === 'alert' ? 'bg-red-400' :
                                                                        evt.type === 'anomaly' ? 'bg-orange-400' :
                                                                        'bg-blue-400'
                                                                    }`} />
                                                                    {i < events.length - 1 && <div className="w-px flex-1 bg-gray-700 group-hover:bg-gray-600 transition-colors" />}
                                                                </div>
                                                                {/* Event content */}
                                                                <div className="pb-4 flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-0.5">
                                                                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                                                            evt.type === 'alert' ? 'bg-red-500/10 text-red-400' :
                                                                            evt.type === 'anomaly' ? 'bg-orange-500/10 text-orange-400' :
                                                                            'bg-blue-500/10 text-blue-400'
                                                                        }`}>
                                                                            {evt.type === 'alert' ? 'Suricata' : evt.type === 'anomaly' ? 'AI Anomaly' : 'Zeek'}
                                                                        </span>
                                                                        <span className="text-xs text-text-secondary">{new Date(evt.time).toLocaleString()}</span>
                                                                    </div>
                                                                    <p className="text-sm text-text-main truncate">{evt.label}</p>
                                                                    <p className="text-xs text-text-secondary font-mono truncate">{evt.detail}</p>
                                                                </div>
                                                            </div>
                                                        ));
                                                    })() : (
                                                        <EmptyState icon={History} message="Select an endpoint to view its timeline." />
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ─── Hunt Management ─────────────────────────────── */}
                    <div className="rounded-xl bg-card-dark border border-gray-700 overflow-hidden card-lift animate-fade-in">
                        <div className="p-5 border-b border-gray-700 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-medium text-text-main flex items-center gap-2">
                                    <Crosshair size={18} className="text-primary" />
                                    Hunt Management
                                </h2>
                                <p className="text-text-secondary text-sm">Quick-launch artifact hunts across your endpoints</p>
                            </div>
                        </div>
                        <div className="p-5">
                            {/* Category Filters */}
                            <div className="flex gap-2 mb-4 flex-wrap">
                                {['all', 'Triage', 'Persistence', 'Forensics', 'Detection'].map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setHuntCategory(cat)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                            huntCategory === cat
                                                ? 'bg-primary/20 text-primary border-primary/50'
                                                : 'bg-background-dark/50 text-text-secondary border-gray-700 hover:border-gray-600'
                                        }`}
                                    >
                                        {cat === 'all' ? 'All' : cat}
                                    </button>
                                ))}
                            </div>
                            {/* Artifact Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                                {PRESET_ARTIFACTS
                                    .filter(a => huntCategory === 'all' || a.category === huntCategory)
                                    .map((artifact, i) => (
                                        <button
                                            key={i}
                                            onClick={() => { setSelectedArtifact(artifact.name); setHuntTarget(null); setShowHuntModal(true); }}
                                            className="p-4 rounded-lg bg-background-dark/50 border border-gray-800 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <Terminal size={14} className="text-primary" />
                                                <span className="text-sm font-medium text-text-main group-hover:text-primary transition-colors">{artifact.label}</span>
                                            </div>
                                            <p className="text-xs text-text-secondary line-clamp-2">{artifact.desc}</p>
                                            <span className="inline-block mt-2 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">{artifact.category}</span>
                                        </button>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* ═══════════════════════════════════════════════════════════
                 MODALS
                ═══════════════════════════════════════════════════════════ */}

            {/* ─── Run Hunt Modal ── */}
            {showHuntModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-card-dark border border-gray-700 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="p-4 flex justify-between items-center border-b border-gray-800">
                            <h3 className="text-lg font-medium text-text-main flex items-center gap-2">
                                <Terminal size={18} className="text-primary" /> Run Artifact Hunt
                            </h3>
                            <button onClick={() => setShowHuntModal(false)} className="text-text-secondary hover:text-white transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleRunHunt} className="p-6 flex flex-col gap-4">
                            {huntTarget ? (
                                <div>
                                    <p className="text-sm text-text-secondary mb-1">Target Endpoint:</p>
                                    <p className="font-mono text-sm bg-background-dark p-2.5 rounded-lg text-text-main border border-gray-800">
                                        {huntTarget.os_info?.hostname || 'Unknown'} ({huntTarget.client_id})
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm text-text-secondary mb-1">Target Endpoint:</label>
                                    <select
                                        value={manualTargetId}
                                        onChange={(e) => setManualTargetId(e.target.value)}
                                        className="w-full bg-background-dark border border-gray-700 text-text-main text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5"
                                    >
                                        <option value="">-- Select an endpoint --</option>
                                        {clients.map(c => (
                                            <option key={c.client_id} value={c.client_id}>
                                                {c.os_info?.hostname || 'Unknown'} ({c.client_id})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm text-text-secondary mb-1">Artifact Name</label>
                                <select
                                    value={selectedArtifact}
                                    onChange={(e) => setSelectedArtifact(e.target.value)}
                                    className="w-full bg-background-dark border border-gray-700 text-text-main text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5"
                                >
                                    {PRESET_ARTIFACTS.map(a => (
                                        <option key={a.name} value={a.name}>{a.label} — {a.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="p-3 rounded-lg bg-background-dark/50 border border-gray-800">
                                <p className="text-xs text-text-secondary">{PRESET_ARTIFACTS.find(a => a.name === selectedArtifact)?.desc || 'Custom artifact'}</p>
                            </div>
                            <div className="mt-2 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowHuntModal(false)} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-white transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors shadow-glow-primary">Launch Hunt</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Isolate Host Confirmation Modal ── */}
            {showIsolateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-card-dark border border-red-500/30 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-4 flex justify-between items-center border-b border-red-500/20 bg-red-500/5">
                            <h3 className="text-lg font-medium text-red-400 flex items-center gap-2">
                                <ShieldBan size={18} /> Isolate Host
                            </h3>
                            <button onClick={() => { setShowIsolateModal(false); setIsolateConfirm(''); }} className="text-text-secondary hover:text-white transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle size={20} className="text-red-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-red-400">⚠ Destructive Action</p>
                                        <p className="text-xs text-text-secondary mt-1">
                                            This will cut all network access for the endpoint <strong className="text-text-main">{isolateTarget?.os_info?.hostname}</strong> except the Velociraptor agent channel. All active sessions will be terminated.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-1">
                                    Type <strong className="text-text-main">{isolateTarget?.os_info?.hostname || isolateTarget?.client_id}</strong> to confirm:
                                </label>
                                <input
                                    type="text"
                                    value={isolateConfirm}
                                    onChange={(e) => setIsolateConfirm(e.target.value)}
                                    className="w-full bg-background-dark border border-gray-700 text-text-main text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5 font-mono"
                                    placeholder={isolateTarget?.os_info?.hostname || isolateTarget?.client_id}
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => { setShowIsolateModal(false); setIsolateConfirm(''); }} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-white transition-colors">Cancel</button>
                                <button
                                    onClick={handleIsolate}
                                    disabled={isolateConfirm !== (isolateTarget?.os_info?.hostname || isolateTarget?.client_id)}
                                    className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all"
                                >
                                    Confirm Isolation
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

const InfoCard = ({ label, value, icon: Icon, mono = false }) => (
    <div className="p-3 rounded-lg bg-background-dark/50 border border-gray-800">
        <div className="flex items-center gap-2 mb-1">
            <Icon size={12} className="text-text-secondary" />
            <p className="text-xs text-text-secondary">{label}</p>
        </div>
        <p className={`text-sm text-text-main font-medium truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
);

const MiniStat = ({ label, value, icon: Icon, accent = 'blue' }) => {
    const colors = {
        red: 'text-red-400 bg-red-500/10 border-red-500/20',
        orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        green: 'text-green-400 bg-green-500/10 border-green-500/20',
    };
    return (
        <div className={`p-3 rounded-lg border ${colors[accent]}`}>
            <div className="flex items-center justify-between">
                <p className="text-xs text-text-secondary">{label}</p>
                <Icon size={14} className={colors[accent].split(' ')[0]} />
            </div>
            <p className={`text-xl font-bold mt-1 ${colors[accent].split(' ')[0]}`}>{value}</p>
        </div>
    );
};

const EmptyState = ({ icon: Icon, message }) => (
    <div className="flex flex-col items-center justify-center py-12 text-text-secondary gap-3">
        <Icon size={36} className="opacity-30" />
        <p className="text-sm text-center max-w-xs">{message}</p>
    </div>
);


export default Endpoints;
