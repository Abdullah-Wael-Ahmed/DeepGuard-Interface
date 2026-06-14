import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
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
    const { auth } = useAuth();
    const user = auth?.user;
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [incidents, setIncidents] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(searchParams.get('search') || '');

    useEffect(() => {
        const query = searchParams.get('search') || '';
        setSearch(query);
    }, [searchParams]);
    const [filterStatus, setFilterStatus] = useState('active');
    const [filterSeverity, setFilterSeverity] = useState('');
    const [filterMitre, setFilterMitre] = useState('');
    const [filterFalsePositive, setFilterFalsePositive] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
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
        assigneeId: null,
        tlp: 'amber'
    });
    const [analysts, setAnalysts] = useState([]);

    // ── Data fetching ────────────────────────────────────────────────────────
    const fetchIncidents = async () => {
        try {
            setLoading(true);
            const params = { page, limit: 20, sortBy: 'createdAt', sortOrder: 'DESC' };
            if (filterStatus) params.status = filterStatus;
            if (filterSeverity) params.severity = filterSeverity;
            if (filterMitre.trim()) params.mitreTechnique = filterMitre.trim();
            if (filterFalsePositive !== '') params.falsePositive = filterFalsePositive;
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

    const fetchAnalysts = async () => {
        try {
            const res = await axios.get(`${BACK}/auth/users`, { withCredentials: true });
            const filtered = res.data.filter(u => u.role === 'analyst');
            setAnalysts(filtered);
        } catch (err) {
            console.error('Error fetching analysts:', err);
        }
    };

    useEffect(() => { 
        fetchStats(); 
        fetchAnalysts();
    }, []);
    useEffect(() => { fetchIncidents(); }, [page, filterStatus, filterSeverity, filterFalsePositive]);

    // Debounced search and mitre
    useEffect(() => {
        const timer = setTimeout(() => { if (page === 1) fetchIncidents(); else setPage(1); }, 400);
        return () => clearTimeout(timer);
    }, [search, filterMitre]);

    // ── Bulk Actions Helpers ─────────────────────────────────────────────────
    const handleBulkAssign = async (assigneeName, assigneeId) => {
        try {
            setLoading(true);
            await axios.post(`${BACK}/incidents/bulk`, {
                incidentIds: selectedIds,
                assignee: assigneeName,
                assigneeId: assigneeId,
                actor: user?.name || 'admin',
                actorId: user?.id || null
            }, { withCredentials: true });
            toast.success(`Assigned ${selectedIds.length} incident(s) to ${assigneeName}`);
            setSelectedIds([]);
            fetchIncidents();
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update incidents');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkClose = async (reason) => {
        if (!reason || !reason.trim()) {
            toast.error("A closure reason/justification is required to close incidents.");
            return;
        }
        try {
            setLoading(true);
            await axios.post(`${BACK}/incidents/bulk`, {
                incidentIds: selectedIds,
                status: "closed",
                reason: reason.trim(),
                actor: user?.name || 'admin',
                actorId: user?.id || null
            }, { withCredentials: true });
            toast.success(`Closed ${selectedIds.length} incident(s)`);
            setSelectedIds([]);
            fetchIncidents();
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to close incidents');
        } finally {
            setLoading(false);
        }
    };

    const handleMerge = async (primaryId, childIds, reason) => {
        try {
            setLoading(true);
            await axios.post(`${BACK}/incidents/merge`, {
                primaryId,
                childIds,
                reason,
                actor: user?.name || 'admin',
                actorId: user?.id || null
            }, { withCredentials: true });
            toast.success(`Successfully merged child incidents into INC-${String(primaryId).padStart(5, '0')}`);
            setSelectedIds([]);
            fetchIncidents();
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to merge incidents');
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        const targetIncidents = incidents.filter(inc => selectedIds.includes(inc.id));
        if (targetIncidents.length === 0) return;

        const headers = ['ID', 'Title', 'Status', 'Severity', 'Priority', 'Assignee', 'Category', 'TLP', 'SLA Deadline', 'Created At'];
        const rows = targetIncidents.map(inc => [
            `INC-${String(inc.id).padStart(5, '0')}`,
            `"${(inc.title || '').replace(/"/g, '""')}"`,
            inc.status || '',
            inc.severity || '',
            inc.priority || '',
            inc.assignee || 'Unassigned',
            inc.category || '',
            inc.tlp || '',
            inc.slaDeadline ? new Date(inc.slaDeadline).toISOString() : '',
            new Date(inc.createdAt).toISOString()
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `deepguard_incidents_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("CSV export download started.");
    };

    const handlePrintPDF = () => {
        const targetIncidents = incidents.filter(inc => selectedIds.includes(inc.id));
        if (targetIncidents.length === 0) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error("Popup blocked! Please allow popups to export PDF/Print.");
            return;
        }

        const rowsHtml = targetIncidents.map(inc => `
            <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 8px; font-family: monospace;">INC-${String(inc.id).padStart(5, '0')}</td>
                <td style="padding: 8px;">${inc.severity.toUpperCase()}</td>
                <td style="padding: 8px; font-weight: bold;">${inc.title}</td>
                <td style="padding: 8px;">${inc.status}</td>
                <td style="padding: 8px;">${inc.priority || '—'}</td>
                <td style="padding: 8px;">${inc.assignee || 'Unassigned'}</td>
                <td style="padding: 8px;">${inc.category || '—'}</td>
                <td style="padding: 8px;">${inc.slaDeadline ? new Date(inc.slaDeadline).toLocaleString() : '—'}</td>
                <td style="padding: 8px;">${new Date(inc.createdAt).toLocaleString()}</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <html>
            <head>
                <title>DeepGuard Incident Management Report</title>
                <style>
                    body { font-family: system-ui, sans-serif; color: #333; margin: 40px; }
                    h1 { color: #003f7f; border-bottom: 2px solid #003f7f; padding-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { text-align: left; background-color: #f5f5f5; padding: 10px; border-bottom: 2px solid #ddd; }
                    td { padding: 10px; border-bottom: 1px solid #eee; }
                    .footer { margin-top: 40px; font-size: 12px; color: #777; text-align: center; }
                </style>
            </head>
            <body>
                <h1>DeepGuard Security Incident Report</h1>
                <p><strong>Generated on:</strong> \${new Date().toLocaleString()}</p>
                <p><strong>Total Incidents Exported:</strong> \${targetIncidents.length}</p>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Severity</th>
                            <th>Title</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Assignee</th>
                            <th>Category</th>
                            <th>SLA Deadline</th>
                            <th>Created At</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${rowsHtml}
                    </tbody>
                </table>
                <div class="footer">
                    DeepGuard SOC Platform Security Report. Confidential.
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        window.close();
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

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
            setNewIncident({ title: '', description: '', severity: 'medium', category: '', assignee: '', assigneeId: null, tlp: 'amber' });
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
                        {user?.role !== 'analyst' && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 px-5 py-2 bg-primary text-background-dark font-medium rounded-lg hover:brightness-110 transition-all"
                            >
                                <Plus size={18} />
                                <span className="text-sm">New Incident</span>
                            </button>
                        )}
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

                {/* SLA Breach Notice Banner */}
                {stats.breachedSLA > 0 && (
                    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 animate-pulse animate-fade-in">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                        <div className="flex-1 text-sm font-medium">
                            Attention: There {stats.breachedSLA === 1 ? 'is 1 active incident' : `are ${stats.breachedSLA} active incidents`} currently breaching SLA response/remediation deadlines! Please prioritize and resolve immediately.
                        </div>
                    </div>
                )}

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
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${showFilters ? 'bg-primary/10 border-primary text-primary' : 'bg-card-dark border-gray-700 text-text-main hover:border-gray-500'}`}
                        >
                            <Filter size={16} />
                            <span className="text-sm">More Filters</span>
                        </button>
                    </div>

                    {showFilters && (
                        <div className="flex flex-wrap gap-4 p-4 bg-card-dark border border-gray-700 rounded-xl animate-fade-in">
                            <div className="flex flex-col gap-1.5 min-w-[200px]">
                                <label className="text-xs text-text-secondary">MITRE Technique</label>
                                <input
                                    type="text"
                                    value={filterMitre}
                                    onChange={(e) => { setFilterMitre(e.target.value); setPage(1); }}
                                    placeholder="e.g. T1078"
                                    className="bg-background-dark border border-gray-700 text-text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary transition-all"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 min-w-[200px]">
                                <label className="text-xs text-text-secondary">False Positive Status</label>
                                <select
                                    value={filterFalsePositive}
                                    onChange={(e) => { setFilterFalsePositive(e.target.value); setPage(1); }}
                                    className="bg-background-dark border border-gray-700 text-text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary transition-all cursor-pointer"
                                >
                                    <option value="">All</option>
                                    <option value="true">False Positive Only</option>
                                    <option value="false">True Positive Only</option>
                                </select>
                            </div>
                        </div>
                    )}
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
                                    {user?.role !== 'analyst' && (
                                        <th className="p-4 w-12 text-left">
                                            <input
                                                type="checkbox"
                                                checked={incidents.length > 0 && selectedIds.length === incidents.length}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedIds(incidents.map(inc => inc.id));
                                                    } else {
                                                        setSelectedIds([]);
                                                    }
                                                }}
                                                className="rounded border-gray-700 text-primary focus:ring-primary bg-background-dark cursor-pointer h-4 w-4"
                                            />
                                        </th>
                                    )}
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
                                            className="hover:bg-white/5 transition-colors cursor-pointer group"
                                        >
                                            {user?.role !== 'analyst' && (
                                                <td className="p-4 w-12" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(inc.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedIds([...selectedIds, inc.id]);
                                                            } else {
                                                                setSelectedIds(selectedIds.filter(id => id !== inc.id));
                                                            }
                                                        }}
                                                        className="rounded border-gray-700 text-primary focus:ring-primary bg-background-dark cursor-pointer h-4 w-4"
                                                    />
                                                </td>
                                            )}
                                            <td className="p-4 text-sm font-mono text-primary" onClick={() => navigate(`/incidents/${inc.id}`)}>
                                                INC-{String(inc.id).padStart(5, '0')}
                                            </td>
                                            <td className="p-4" onClick={() => navigate(`/incidents/${inc.id}`)}>
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${sev.color}`}>
                                                    {sev.label}
                                                </span>
                                            </td>
                                            <td className="p-4" onClick={() => navigate(`/incidents/${inc.id}`)}>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-text-main truncate max-w-xs">{inc.title}</span>
                                                    {inc.category && (
                                                        <span className="text-xs text-text-secondary mt-0.5">
                                                            {CATEGORY_OPTIONS.find(c => c.value === inc.category)?.label || inc.category}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4" onClick={() => navigate(`/incidents/${inc.id}`)}>
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${st.color}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="p-4" onClick={() => navigate(`/incidents/${inc.id}`)}>
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${pr.color}`}>
                                                    {pr.label}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-text-secondary" onClick={() => navigate(`/incidents/${inc.id}`)}>
                                                {inc.assignee || <span className="text-gray-600 italic">Unassigned</span>}
                                            </td>
                                            <td className="p-4" onClick={() => navigate(`/incidents/${inc.id}`)}>
                                                {inc.slaDeadline ? (
                                                    <span className={`text-xs font-mono ${breached ? 'text-red-400 font-bold' : 'text-text-secondary'}`}>
                                                        {breached ? '⚠ BREACHED' : timeAgo(inc.slaDeadline).replace(' ago', ' left').replace('Just now', 'Due now')}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-600">—</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-xs text-text-secondary" onClick={() => navigate(`/incidents/${inc.id}`)}>
                                                {timeAgo(inc.createdAt)}
                                            </td>
                                            <td className="p-4" onClick={() => navigate(`/incidents/${inc.id}`)}>
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

            {/* ═══ FLOATING BULK ACTIONS BAR ═══ */}
            {selectedIds.length > 0 && user?.role !== 'analyst' && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card-dark/95 backdrop-blur-md border border-primary/30 rounded-xl px-6 py-4 flex flex-wrap items-center gap-6 shadow-2xl animate-slide-up text-text-main max-w-[90vw]">
                    <span className="text-sm font-medium text-primary">
                        {selectedIds.length} incident{selectedIds.length > 1 ? 's' : ''} selected
                    </span>
                    <div className="h-6 w-px bg-gray-700 hidden sm:block"></div>
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Bulk Assignment */}
                        <select
                            onChange={(e) => {
                                const analystId = e.target.value;
                                if (analystId) {
                                    const selectedAnalyst = analysts.find(a => String(a.id) === analystId);
                                    handleBulkAssign(selectedAnalyst ? selectedAnalyst.name : '', analystId ? parseInt(analystId) : null);
                                    e.target.value = "";
                                }
                            }}
                            className="bg-background-dark border border-gray-700 text-text-main text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary transition-all cursor-pointer"
                        >
                            <option value="">Assign to...</option>
                            {analysts.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>

                        {/* Bulk Close */}
                        <button
                            onClick={() => {
                                const reason = prompt("Enter closure reason/justification for selected incident(s):");
                                if (reason !== null) {
                                    handleBulkClose(reason);
                                }
                            }}
                            className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-500/20 transition-all cursor-pointer"
                        >
                            Close Selected
                        </button>

                        {/* Merge Selected (Requires 2 or more) */}
                        {selectedIds.length >= 2 && (
                            <button
                                onClick={() => {
                                    const primaryIdStr = prompt(`Enter the ID (e.g. INC-00001 or just the number) of the primary incident to merge others into:`);
                                    if (primaryIdStr) {
                                        const numericId = parseInt(primaryIdStr.replace(/[^0-9]/g, ''));
                                        if (isNaN(numericId)) {
                                            toast.error("Invalid primary incident ID format.");
                                        } else if (!selectedIds.includes(numericId)) {
                                            toast.error("Primary incident must be one of the selected incidents.");
                                        } else {
                                            const reason = prompt(`Enter merge reason/justification (optional):`);
                                            handleMerge(numericId, selectedIds.filter(id => id !== numericId), reason || "Duplicate incident");
                                        }
                                    }
                                }}
                                className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-semibold rounded-lg hover:bg-purple-500/20 transition-all cursor-pointer"
                            >
                                Merge
                            </button>
                        )}

                        {/* CSV Export */}
                        <button
                            onClick={handleExportCSV}
                            className="px-3 py-1.5 bg-primary text-background-dark text-xs font-bold rounded-lg hover:brightness-110 transition-all cursor-pointer"
                        >
                            Export CSV
                        </button>

                        {/* Print/PDF */}
                        <button
                            onClick={handlePrintPDF}
                            className="px-3 py-1.5 bg-card-dark border border-gray-700 text-text-main text-xs font-semibold rounded-lg hover:border-gray-500 transition-all cursor-pointer"
                        >
                            Print PDF
                        </button>
                    </div>
                    <div className="h-6 w-px bg-gray-700 hidden sm:block"></div>
                    <button
                        onClick={() => setSelectedIds([])}
                        className="text-xs text-text-secondary hover:text-text-main transition-colors cursor-pointer"
                    >
                        Clear Selection
                    </button>
                </div>
            )}

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
                                    <select
                                        value={newIncident.assigneeId || ''}
                                        onChange={(e) => {
                                            const selectedId = e.target.value;
                                            const selectedAnalyst = analysts.find(a => String(a.id) === selectedId);
                                            setNewIncident({ 
                                                ...newIncident, 
                                                assigneeId: selectedId ? parseInt(selectedId) : null,
                                                assignee: selectedAnalyst ? selectedAnalyst.name : ''
                                            });
                                        }}
                                        className="w-full bg-background-dark border border-gray-700 text-text-main text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-all cursor-pointer"
                                    >
                                        <option value="">Select analyst...</option>
                                        {analysts.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
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
