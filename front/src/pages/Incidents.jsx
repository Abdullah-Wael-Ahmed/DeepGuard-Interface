import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import {
    AlertTriangle, Shield, Clock, Users, Plus, Search, Filter,
    ChevronDown, RefreshCw, ArrowUpRight, Loader, Inbox,
    Flame, TrendingUp, Timer, CheckCircle2, XCircle
} from 'lucide-react';

const BACK = import.meta.env.VITE_BACK;

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    open:          { label: 'Open',          color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',         dot: 'bg-blue-400' },
    triaging:      { label: 'Triaging',      color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',   dot: 'bg-yellow-400 animate-pulse' },
    investigating: { label: 'Investigating', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30',   dot: 'bg-purple-400 animate-pulse' },
    containing:    { label: 'Containing',    color: 'bg-orange-500/15 text-orange-400 border-orange-500/30',   dot: 'bg-orange-400 animate-pulse' },
    remediated:    { label: 'Remediated',    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
    closed:        { label: 'Closed',        color: 'bg-gray-500/15 text-gray-400 border-gray-500/30',         dot: 'bg-gray-400' },
};

const SEVERITY_CONFIG = {
    critical: { label: 'Critical', color: 'text-red-400 bg-red-500/15 border-red-500/30',         icon: '🔴' },
    high:     { label: 'High',     color: 'text-orange-400 bg-orange-500/15 border-orange-500/30', icon: '🟠' },
    medium:   { label: 'Medium',   color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30', icon: '🟡' },
    low:      { label: 'Low',      color: 'text-green-400 bg-green-500/15 border-green-500/30',    icon: '🟢' },
    info:     { label: 'Info',     color: 'text-blue-400 bg-blue-500/15 border-blue-500/30',       icon: '🔵' },
};

const PRIORITY_CONFIG = {
    P1: { label: 'P1', color: 'text-red-400 bg-red-500/20' },
    P2: { label: 'P2', color: 'text-orange-400 bg-orange-500/20' },
    P3: { label: 'P3', color: 'text-yellow-400 bg-yellow-500/20' },
    P4: { label: 'P4', color: 'text-gray-400 bg-gray-500/20' },
};

const CATEGORY_OPTIONS = [
    { value: 'malware', label: 'Malware' },
    { value: 'phishing', label: 'Phishing' },
    { value: 'brute_force', label: 'Brute Force' },
    { value: 'ddos', label: 'DDoS' },
    { value: 'port_scan', label: 'Port Scan' },
    { value: 'data_exfil', label: 'Data Exfiltration' },
    { value: 'lateral_movement', label: 'Lateral Movement' },
    { value: 'c2', label: 'C2 Communication' },
    { value: 'insider_threat', label: 'Insider Threat' },
    { value: 'policy_violation', label: 'Policy Violation' },
    { value: 'other', label: 'Other' },
];

const Incidents = () => {
    const navigate = useNavigate();
    const [incidents, setIncidents] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('active');
    const [filterSeverity, setFilterSeverity] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // ── New Incident Form ────────────────────────────────────────────────────
    const [newIncident, setNewIncident] = useState({
        title: '',
        description: '',
        severity: 'medium',
        category: '',
        assignee: '',
        tlp: 'amber',
    });

    // ── Data fetching ────────────────────────────────────────────────────────
    const fetchIncidents = async () => {
        try {
            setLoading(true);
            const params = { page, limit: 20, sortBy: 'createdAt', sortOrder: 'DESC' };
            if (filterStatus) params.status = filterStatus;
            if (filterSeverity) params.severity = filterSeverity;
            if (search.trim()) params.search = search.trim();

            const res = await axios.get(`${BACK}/incidents`, { withCredentials: true, params });
            setIncidents(res.data.incidents || []);
            setTotalPages(res.data.totalPages || 1);
        } catch (err) {
            console.error('Error fetching incidents:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await axios.get(`${BACK}/incidents/stats`, { withCredentials: true });
            setStats(res.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    useEffect(() => { fetchStats(); }, []);
    useEffect(() => { fetchIncidents(); }, [page, filterStatus, filterSeverity]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => { if (page === 1) fetchIncidents(); else setPage(1); }, 400);
        return () => clearTimeout(timer);
    }, [search]);

    // ── Create incident ──────────────────────────────────────────────────────
    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newIncident.title.trim()) {
            toast.error('Incident title is required');
            return;
        }
        try {
            setCreating(true);
            const res = await axios.post(`${BACK}/incidents`, newIncident, { withCredentials: true });
            toast.success(`${res.data.incidentRef} created successfully`);
            setShowCreateModal(false);
            setNewIncident({ title: '', description: '', severity: 'medium', category: '', assignee: '', tlp: 'amber' });
            fetchIncidents();
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create incident');
        } finally {
            setCreating(false);
        }
    };

    // ── Time helpers ─────────────────────────────────────────────────────────
    const timeAgo = (dateStr) => {
        if (!dateStr) return 'N/A';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    const isSLABreached = (deadline) => {
        if (!deadline) return false;
        return new Date(deadline) < new Date();
    };

    return (
        <div className="flex-1 bg-background-dark p-8 overflow-y-auto">
            <div className="flex flex-col gap-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-wrap justify-between items-center gap-4 animate-fade-in">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-4xl font-bold tracking-tight text-gradient">Incident Management</h1>
                        <p className="text-text-secondary text-base">
                            Track, investigate, and resolve security incidents
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { fetchIncidents(); fetchStats(); }}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-card-dark rounded-lg border border-gray-700 hover:border-primary transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            <span className="text-sm">Refresh</span>
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-5 py-2 bg-primary text-background-dark font-medium rounded-lg hover:brightness-110 transition-all"
                        >
                            <Plus size={18} />
                            <span className="text-sm">New Incident</span>
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 stagger-children">
                    <div className="p-4 rounded-xl bg-card-dark border border-gray-700 hover:border-primary/50 transition-all card-lift">
                        <div className="flex items-center justify-between mb-2">
                            <Shield size={18} className="text-primary" />
                            <span className="text-xs text-text-secondary">Total</span>
                        </div>
                        <p className="text-2xl font-bold">{stats.total || 0}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-card-dark border border-gray-700 hover:border-blue-500/50 transition-all card-lift">
                        <div className="flex items-center justify-between mb-2">
                            <TrendingUp size={18} className="text-blue-400" />
                            <span className="text-xs text-text-secondary">Active</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-400">{stats.active || 0}</p>
                    </div>
                    <div className={`p-4 rounded-xl bg-card-dark border hover:border-red-500/50 transition-all card-lift ${stats.critical > 0 ? 'border-red-500/40' : 'border-gray-700'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <Flame size={18} className="text-red-400" />
                            <span className="text-xs text-text-secondary">Critical</span>
                        </div>
                        <p className={`text-2xl font-bold ${stats.critical > 0 ? 'text-red-400' : ''}`}>{stats.critical || 0}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-card-dark border border-gray-700 hover:border-orange-500/50 transition-all card-lift">
                        <div className="flex items-center justify-between mb-2">
                            <AlertTriangle size={18} className="text-orange-400" />
                            <span className="text-xs text-text-secondary">High</span>
                        </div>
                        <p className="text-2xl font-bold text-orange-400">{stats.high || 0}</p>
                    </div>
                    <div className={`p-4 rounded-xl bg-card-dark border hover:border-yellow-500/50 transition-all card-lift ${stats.breachedSLA > 0 ? 'border-yellow-500/40' : 'border-gray-700'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <Timer size={18} className="text-yellow-400" />
                            <span className="text-xs text-text-secondary">SLA Breach</span>
                        </div>
                        <p className={`text-2xl font-bold ${stats.breachedSLA > 0 ? 'text-yellow-400' : ''}`}>{stats.breachedSLA || 0}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-card-dark border border-gray-700 hover:border-emerald-500/50 transition-all card-lift">
                        <div className="flex items-center justify-between mb-2">
                            <Clock size={18} className="text-emerald-400" />
                            <span className="text-xs text-text-secondary">MTTR</span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-400">
                            {stats.mttrMinutes ? (stats.mttrMinutes < 60 ? `${stats.mttrMinutes}m` : `${Math.round(stats.mttrMinutes / 60)}h`) : '—'}
                        </p>
                    </div>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col gap-3 animate-fade-in">
                    <div className="flex flex-wrap gap-3">
                        <div className="flex-1 min-w-[250px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary h-4 w-4" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search incidents by title or description..."
                                className="w-full bg-card-dark border border-gray-700 text-text-main text-sm rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary transition-all"
                            />
                        </div>
                        <select
                            value={filterStatus}
                            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                            className="bg-card-dark border border-gray-700 text-text-main text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-all cursor-pointer"
                        >
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                                <option key={key} value={key}>{val.label}</option>
                            ))}
                        </select>
                        <select
                            value={filterSeverity}
                            onChange={(e) => { setFilterSeverity(e.target.value); setPage(1); }}
                            className="bg-card-dark border border-gray-700 text-text-main text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-all cursor-pointer"
                        >
                            <option value="">All Severities</option>
                            {Object.entries(SEVERITY_CONFIG).map(([key, val]) => (
                                <option key={key} value={key}>{val.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Incidents Table */}
                <div className="rounded-xl bg-card-dark border border-gray-700 overflow-hidden animate-fade-in">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader className="animate-spin text-primary" size={40} />
                        </div>
                    ) : incidents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <Inbox size={48} />
                            <p className="mt-4 text-lg font-medium">No incidents found</p>
                            <p className="text-sm mt-1">Create one or adjust your filters</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-700 bg-background-dark/40">
                                    {['ID', 'Severity', 'Title', 'Status', 'Priority', 'Assignee', 'SLA', 'Created', ''].map((h, i) => (
                                        <th key={i} className="p-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {incidents.map((inc) => {
                                    const sev = SEVERITY_CONFIG[inc.severity] || SEVERITY_CONFIG.medium;
                                    const st = STATUS_CONFIG[inc.status] || STATUS_CONFIG.open;
                                    const pr = PRIORITY_CONFIG[inc.priority] || PRIORITY_CONFIG.P3;
                                    const breached = isSLABreached(inc.slaDeadline);

                                    return (
                                        <tr
                                            key={inc.id}
                                            onClick={() => navigate(`/incidents/${inc.id}`)}
                                            className="hover:bg-white/5 transition-colors cursor-pointer group"
                                        >
                                            <td className="p-4 text-sm font-mono text-primary">
                                                INC-{String(inc.id).padStart(5, '0')}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${sev.color}`}>
                                                    {sev.label}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-text-main truncate max-w-xs">{inc.title}</span>
                                                    {inc.category && (
                                                        <span className="text-xs text-text-secondary mt-0.5">
                                                            {CATEGORY_OPTIONS.find(c => c.value === inc.category)?.label || inc.category}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${st.color}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${pr.color}`}>
                                                    {pr.label}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-text-secondary">
                                                {inc.assignee || <span className="text-gray-600 italic">Unassigned</span>}
                                            </td>
                                            <td className="p-4">
                                                {inc.slaDeadline ? (
                                                    <span className={`text-xs font-mono ${breached ? 'text-red-400 font-bold' : 'text-text-secondary'}`}>
                                                        {breached ? '⚠ BREACHED' : timeAgo(inc.slaDeadline).replace(' ago', ' left').replace('Just now', 'Due now')}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-600">—</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-xs text-text-secondary">
                                                {timeAgo(inc.createdAt)}
                                            </td>
                                            <td className="p-4">
                                                <ArrowUpRight size={16} className="text-gray-600 group-hover:text-primary transition-colors" />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t border-gray-700">
                            <span className="text-sm text-text-secondary">Page {page} of {totalPages}</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="px-3 py-1 bg-background-dark border border-gray-700 rounded text-sm disabled:opacity-30 hover:border-primary transition-all"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="px-3 py-1 bg-background-dark border border-gray-700 rounded text-sm disabled:opacity-30 hover:border-primary transition-all"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ CREATE INCIDENT MODAL ═══ */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 blur-overlay animate-fade-in" onClick={() => setShowCreateModal(false)}>
                    <div className="w-full max-w-lg bg-card-dark border border-gray-700 rounded-2xl shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-700">
                            <h2 className="text-xl font-bold text-text-main">Create New Incident</h2>
                            <p className="text-sm text-text-secondary mt-1">Document a security event for investigation</p>
                        </div>

                        <form onSubmit={handleCreate} className="p-6 flex flex-col gap-5">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">Title *</label>
                                <input
                                    type="text"
                                    value={newIncident.title}
                                    onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                                    placeholder="e.g., Suspicious outbound traffic from 192.168.1.50"
                                    className="w-full bg-background-dark border border-gray-700 text-text-main text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-all"
                                    autoFocus
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">Description</label>
                                <textarea
                                    value={newIncident.description}
                                    onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                                    placeholder="Describe the incident, findings, and initial observations..."
                                    rows={3}
                                    className="w-full bg-background-dark border border-gray-700 text-text-main text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-all resize-none"
                                />
                            </div>

                            {/* Severity + Category */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Severity</label>
                                    <select
                                        value={newIncident.severity}
                                        onChange={(e) => setNewIncident({ ...newIncident, severity: e.target.value })}
                                        className="w-full bg-background-dark border border-gray-700 text-text-main text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-all cursor-pointer"
                                    >
                                        {Object.entries(SEVERITY_CONFIG).map(([key, val]) => (
                                            <option key={key} value={key}>{val.icon} {val.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Category</label>
                                    <select
                                        value={newIncident.category}
                                        onChange={(e) => setNewIncident({ ...newIncident, category: e.target.value })}
                                        className="w-full bg-background-dark border border-gray-700 text-text-main text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-all cursor-pointer"
                                    >
                                        <option value="">Select category...</option>
                                        {CATEGORY_OPTIONS.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Assignee + TLP */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Assignee</label>
                                    <input
                                        type="text"
                                        value={newIncident.assignee}
                                        onChange={(e) => setNewIncident({ ...newIncident, assignee: e.target.value })}
                                        placeholder="Analyst name"
                                        className="w-full bg-background-dark border border-gray-700 text-text-main text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1.5">TLP</label>
                                    <select
                                        value={newIncident.tlp}
                                        onChange={(e) => setNewIncident({ ...newIncident, tlp: e.target.value })}
                                        className="w-full bg-background-dark border border-gray-700 text-text-main text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-all cursor-pointer"
                                    >
                                        <option value="red">🔴 TLP:RED</option>
                                        <option value="amber">🟠 TLP:AMBER</option>
                                        <option value="green">🟢 TLP:GREEN</option>
                                        <option value="white">⚪ TLP:WHITE</option>
                                    </select>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 bg-background-dark border border-gray-700 rounded-lg text-sm hover:border-gray-500 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-5 py-2 bg-primary text-background-dark font-medium rounded-lg text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {creating && <Loader className="h-4 w-4 animate-spin" />}
                                    Create Incident
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Incidents;
