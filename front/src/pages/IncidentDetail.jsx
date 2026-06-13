import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import {
    ArrowLeft, Clock, User, Shield, Tag, MessageSquare,
    Paperclip, ChevronRight, Loader, AlertTriangle,
    CheckCircle2, XCircle, Play, Pause, RotateCcw,
    Send, Plus, Trash2, ExternalLink, FileText,
    Timer, Flag, Lock
} from 'lucide-react';

const BACK = import.meta.env.VITE_BACK;

// ── Config objects ───────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    open:          { label: 'Open',          color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',         dot: 'bg-blue-400' },
    triaging:      { label: 'Triaging',      color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',   dot: 'bg-yellow-400' },
    investigating: { label: 'Investigating', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30',   dot: 'bg-purple-400' },
    containing:    { label: 'Containing',    color: 'bg-orange-500/15 text-orange-400 border-orange-500/30',   dot: 'bg-orange-400' },
    remediated:    { label: 'Remediated',    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
    closed:        { label: 'Closed',        color: 'bg-gray-500/15 text-gray-400 border-gray-500/30',         dot: 'bg-gray-400' },
};

const SEVERITY_CONFIG = {
    critical: { label: 'Critical', color: 'text-red-400 bg-red-500/15 border-red-500/30' },
    high:     { label: 'High',     color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' },
    medium:   { label: 'Medium',   color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30' },
    low:      { label: 'Low',      color: 'text-green-400 bg-green-500/15 border-green-500/30' },
    info:     { label: 'Info',     color: 'text-blue-400 bg-blue-500/15 border-blue-500/30' },
};

const TLP_CONFIG = {
    red:   { label: 'TLP:RED',   color: 'bg-red-500/20 text-red-400 border-red-500/40' },
    amber: { label: 'TLP:AMBER', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
    green: { label: 'TLP:GREEN', color: 'bg-green-500/20 text-green-400 border-green-500/40' },
    white: { label: 'TLP:WHITE', color: 'bg-gray-500/20 text-gray-300 border-gray-500/40' },
};

const VALID_TRANSITIONS = {
    open:          ['triaging', 'investigating', 'closed'],
    triaging:      ['investigating', 'open', 'closed'],
    investigating: ['containing', 'triaging', 'remediated', 'closed'],
    containing:    ['remediated', 'investigating', 'closed'],
    remediated:    ['closed', 'investigating'],
    closed:        ['open'],
};

const TIMELINE_ICONS = {
    created:          { icon: Plus,          color: 'text-primary bg-primary/20' },
    status_change:    { icon: ChevronRight,  color: 'text-blue-400 bg-blue-500/20' },
    severity_change:  { icon: AlertTriangle, color: 'text-orange-400 bg-orange-500/20' },
    priority_change:  { icon: Flag,          color: 'text-yellow-400 bg-yellow-500/20' },
    assigned:         { icon: User,          color: 'text-cyan-400 bg-cyan-500/20' },
    unassigned:       { icon: User,          color: 'text-gray-400 bg-gray-500/20' },
    comment:          { icon: MessageSquare,  color: 'text-purple-400 bg-purple-500/20' },
    evidence_added:   { icon: Paperclip,     color: 'text-green-400 bg-green-500/20' },
    evidence_removed: { icon: Trash2,        color: 'text-red-400 bg-red-500/20' },
    escalated:        { icon: AlertTriangle, color: 'text-red-400 bg-red-500/20' },
    closed:           { icon: CheckCircle2,  color: 'text-emerald-400 bg-emerald-500/20' },
    reopened:         { icon: RotateCcw,     color: 'text-blue-400 bg-blue-500/20' },
};

const EVIDENCE_ICONS = {
    alert:        { icon: AlertTriangle, color: 'text-red-400' },
    ioc:          { icon: Shield,        color: 'text-orange-400' },
    log:          { icon: FileText,      color: 'text-blue-400' },
    note:         { icon: MessageSquare, color: 'text-purple-400' },
    network_flow: { icon: ExternalLink,  color: 'text-cyan-400' },
    url:          { icon: ExternalLink,  color: 'text-green-400' },
    file:         { icon: Paperclip,     color: 'text-yellow-400' },
};

const IncidentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [incident, setIncident] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [evidence, setEvidence] = useState([]);
    const [loading, setLoading] = useState(true);
    const [comment, setComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);
    const [changingStatus, setChangingStatus] = useState(false);
    const [showAddEvidence, setShowAddEvidence] = useState(false);
    const [newEvidence, setNewEvidence] = useState({ type: 'note', title: '', content: '' });
    const [activeTab, setActiveTab] = useState('timeline');

    // ── Fetch data ───────────────────────────────────────────────────────────
    const fetchIncident = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${BACK}/incidents/${id}`, { withCredentials: true });
            setIncident(res.data.incident);
            setTimeline(res.data.timeline || []);
            setEvidence(res.data.evidence || []);
        } catch (err) {
            console.error('Error fetching incident:', err);
            toast.error('Failed to load incident');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchIncident(); }, [id]);

    // ── Status transition ────────────────────────────────────────────────────
    const handleStatusChange = async (newStatus) => {
        try {
            setChangingStatus(true);
            await axios.patch(`${BACK}/incidents/${id}/status`, { status: newStatus }, { withCredentials: true });
            toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
            fetchIncident();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update status');
        } finally {
            setChangingStatus(false);
        }
    };

    // ── Add comment ──────────────────────────────────────────────────────────
    const handleComment = async (e) => {
        e.preventDefault();
        if (!comment.trim()) return;
        try {
            setSubmittingComment(true);
            await axios.post(`${BACK}/incidents/${id}/comment`, { message: comment.trim() }, { withCredentials: true });
            setComment('');
            fetchIncident();
        } catch (err) {
            toast.error('Failed to add comment');
        } finally {
            setSubmittingComment(false);
        }
    };

    // ── Add evidence ─────────────────────────────────────────────────────────
    const handleAddEvidence = async (e) => {
        e.preventDefault();
        if (!newEvidence.title.trim()) {
            toast.error('Evidence title is required');
            return;
        }
        try {
            await axios.post(`${BACK}/incidents/${id}/evidence`, newEvidence, { withCredentials: true });
            toast.success('Evidence added');
            setShowAddEvidence(false);
            setNewEvidence({ type: 'note', title: '', content: '' });
            fetchIncident();
        } catch (err) {
            toast.error('Failed to add evidence');
        }
    };

    // ── Remove evidence ──────────────────────────────────────────────────────
    const handleRemoveEvidence = async (evidenceId) => {
        try {
            await axios.delete(`${BACK}/incidents/${id}/evidence/${evidenceId}`, { withCredentials: true });
            toast.success('Evidence removed');
            fetchIncident();
        } catch (err) {
            toast.error('Failed to remove evidence');
        }
    };

    // ── Time helpers ─────────────────────────────────────────────────────────
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleString();
    };

    const timeAgo = (dateStr) => {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
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

    if (loading) {
        return (
            <div className="flex-1 bg-background-dark flex items-center justify-center">
                <Loader className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    if (!incident) {
        return (
            <div className="flex-1 bg-background-dark flex flex-col items-center justify-center text-gray-500">
                <XCircle size={48} />
                <p className="mt-4 text-lg">Incident not found</p>
                <button onClick={() => navigate('/incidents')} className="mt-4 text-primary hover:underline">
                    ← Back to incidents
                </button>
            </div>
        );
    }

    const sev = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.medium;
    const st = STATUS_CONFIG[incident.status] || STATUS_CONFIG.open;
    const tlp = TLP_CONFIG[incident.tlp] || TLP_CONFIG.amber;
    const transitions = VALID_TRANSITIONS[incident.status] || [];
    const breached = isSLABreached(incident.slaDeadline);

    return (
        <div className="flex-1 bg-background-dark overflow-y-auto">
            {/* Top Bar */}
            <div className="sticky top-0 z-10 bg-background-dark/90 backdrop-blur-sm border-b border-gray-800 px-8 py-4">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/incidents')}
                            className="p-2 hover:bg-card-dark rounded-lg transition-colors"
                        >
                            <ArrowLeft size={20} className="text-text-secondary" />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-mono text-primary font-bold">
                                    INC-{String(incident.id).padStart(5, '0')}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${sev.color}`}>
                                    {sev.label}
                                </span>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${st.color}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                                    {st.label}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${tlp.color}`}>
                                    {tlp.label}
                                </span>
                            </div>
                            <h1 className="text-xl font-bold text-text-main mt-1 max-w-2xl truncate">{incident.title}</h1>
                        </div>
                    </div>

                    {/* Status transitions */}
                    <div className="flex items-center gap-2">
                        {transitions.map(s => {
                            const cfg = STATUS_CONFIG[s];
                            return (
                                <button
                                    key={s}
                                    onClick={() => handleStatusChange(s)}
                                    disabled={changingStatus}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:brightness-125 disabled:opacity-50 ${cfg.color}`}
                                >
                                    {s === 'closed' ? 'Close' : s === 'open' ? 'Reopen' : cfg.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="px-8 py-6 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* ═══ LEFT COLUMN — Main Content ═══ */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        {/* Description */}
                        {incident.description && (
                            <div className="bg-card-dark rounded-xl border border-gray-700 p-6 animate-fade-in">
                                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Description</h3>
                                <p className="text-sm text-text-main whitespace-pre-wrap leading-relaxed">{incident.description}</p>
                            </div>
                        )}

                        {/* Tabs: Timeline / Evidence */}
                        <div className="bg-card-dark rounded-xl border border-gray-700 overflow-hidden animate-fade-in">
                            <div className="flex border-b border-gray-700">
                                <button
                                    onClick={() => setActiveTab('timeline')}
                                    className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all ${
                                        activeTab === 'timeline'
                                            ? 'text-primary border-b-2 border-primary bg-primary/5'
                                            : 'text-text-secondary hover:text-text-main'
                                    }`}
                                >
                                    <Clock size={16} />
                                    Timeline ({timeline.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('evidence')}
                                    className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all ${
                                        activeTab === 'evidence'
                                            ? 'text-primary border-b-2 border-primary bg-primary/5'
                                            : 'text-text-secondary hover:text-text-main'
                                    }`}
                                >
                                    <Paperclip size={16} />
                                    Evidence ({evidence.length})
                                </button>
                            </div>

                            {/* ── Timeline Tab ── */}
                            {activeTab === 'timeline' && (
                                <div className="p-6">
                                    {/* Comment input */}
                                    <form onSubmit={handleComment} className="flex gap-3 mb-6">
                                        <input
                                            type="text"
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            placeholder="Add a comment or investigation note..."
                                            className="flex-1 bg-background-dark border border-gray-700 text-text-main text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-all"
                                        />
                                        <button
                                            type="submit"
                                            disabled={submittingComment || !comment.trim()}
                                            className="px-4 py-2 bg-primary text-background-dark rounded-lg text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {submittingComment ? <Loader className="h-4 w-4 animate-spin" /> : <Send size={16} />}
                                        </button>
                                    </form>

                                    {/* Timeline events */}
                                    <div className="relative">
                                        {/* Vertical line */}
                                        <div className="absolute left-[17px] top-0 bottom-0 w-px bg-gray-700"></div>

                                        <div className="space-y-4">
                                            {timeline.map((event, idx) => {
                                                const cfg = TIMELINE_ICONS[event.type] || TIMELINE_ICONS.status_change;
                                                const Icon = cfg.icon;
                                                return (
                                                    <div key={event.id || idx} className="flex gap-4 relative">
                                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${cfg.color}`}>
                                                            <Icon size={16} />
                                                        </div>
                                                        <div className="flex-1 min-w-0 pt-1">
                                                            <div className="flex items-baseline justify-between gap-2">
                                                                <p className="text-sm text-text-main">
                                                                    <span className="font-medium text-primary">{event.actor}</span>
                                                                    {' — '}
                                                                    {event.message}
                                                                </p>
                                                                <span className="text-xs text-text-secondary whitespace-nowrap">
                                                                    {timeAgo(event.createdAt)}
                                                                </span>
                                                            </div>
                                                            {event.type === 'comment' && (
                                                                <div className="mt-2 p-3 bg-background-dark rounded-lg border border-gray-700 text-sm text-text-main">
                                                                    {event.message}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {timeline.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                                <Clock size={32} />
                                                <p className="mt-2">No timeline events yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Evidence Tab ── */}
                            {activeTab === 'evidence' && (
                                <div className="p-6">
                                    <button
                                        onClick={() => setShowAddEvidence(true)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 mb-4 bg-background-dark border border-dashed border-gray-600 rounded-lg text-sm text-text-secondary hover:text-primary hover:border-primary transition-all"
                                    >
                                        <Plus size={16} />
                                        Attach Evidence
                                    </button>

                                    {showAddEvidence && (
                                        <form onSubmit={handleAddEvidence} className="mb-6 p-4 bg-background-dark rounded-lg border border-gray-700 space-y-3 animate-fade-in">
                                            <div className="grid grid-cols-2 gap-3">
                                                <select
                                                    value={newEvidence.type}
                                                    onChange={(e) => setNewEvidence({ ...newEvidence, type: e.target.value })}
                                                    className="bg-card-dark border border-gray-700 text-text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                                                >
                                                    <option value="note">📝 Note</option>
                                                    <option value="alert">🚨 Alert</option>
                                                    <option value="ioc">🛡️ IOC</option>
                                                    <option value="log">📄 Log</option>
                                                    <option value="network_flow">🔗 Network Flow</option>
                                                    <option value="url">🌐 URL</option>
                                                    <option value="file">📎 File</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    value={newEvidence.title}
                                                    onChange={(e) => setNewEvidence({ ...newEvidence, title: e.target.value })}
                                                    placeholder="Evidence title"
                                                    className="bg-card-dark border border-gray-700 text-text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                            <textarea
                                                value={newEvidence.content}
                                                onChange={(e) => setNewEvidence({ ...newEvidence, content: e.target.value })}
                                                placeholder="Details, paste log entries, URLs, etc."
                                                rows={3}
                                                className="w-full bg-card-dark border border-gray-700 text-text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary resize-none"
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button type="button" onClick={() => setShowAddEvidence(false)} className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-main">Cancel</button>
                                                <button type="submit" className="px-4 py-1.5 bg-primary text-background-dark text-sm rounded-lg font-medium hover:brightness-110">Add</button>
                                            </div>
                                        </form>
                                    )}

                                    <div className="space-y-3">
                                        {evidence.map((ev) => {
                                            const evCfg = EVIDENCE_ICONS[ev.type] || EVIDENCE_ICONS.note;
                                            const EvIcon = evCfg.icon;
                                            return (
                                                <div key={ev.id} className="flex items-start gap-3 p-4 bg-background-dark rounded-lg border border-gray-700 hover:border-gray-600 transition-colors group">
                                                    <div className={`mt-0.5 ${evCfg.color}`}>
                                                        <EvIcon size={18} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium text-text-main">{ev.title}</span>
                                                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-text-secondary uppercase">{ev.type}</span>
                                                        </div>
                                                        {ev.content && (
                                                            <p className="text-xs text-text-secondary mt-1 line-clamp-3 whitespace-pre-wrap">{ev.content}</p>
                                                        )}
                                                        <p className="text-xs text-gray-600 mt-1">Added by {ev.addedBy} • {timeAgo(ev.createdAt)}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveEvidence(ev.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                                                    >
                                                        <Trash2 size={14} className="text-red-400" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {evidence.length === 0 && !showAddEvidence && (
                                            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                                <Paperclip size={32} />
                                                <p className="mt-2">No evidence attached</p>
                                                <p className="text-xs mt-1">Attach alerts, IOCs, logs, or notes</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ═══ RIGHT COLUMN — Sidebar ═══ */}
                    <div className="flex flex-col gap-6">
                        {/* Details Card */}
                        <div className="bg-card-dark rounded-xl border border-gray-700 p-6 animate-fade-in">
                            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Details</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-text-secondary flex items-center gap-2"><User size={14} /> Assignee</span>
                                    <span className="text-sm font-medium">{incident.assignee || <span className="text-gray-600 italic">Unassigned</span>}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-text-secondary flex items-center gap-2"><Flag size={14} /> Priority</span>
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                                        incident.priority === 'P1' ? 'text-red-400 bg-red-500/20' :
                                        incident.priority === 'P2' ? 'text-orange-400 bg-orange-500/20' :
                                        incident.priority === 'P3' ? 'text-yellow-400 bg-yellow-500/20' :
                                        'text-gray-400 bg-gray-500/20'
                                    }`}>{incident.priority}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-text-secondary flex items-center gap-2"><Tag size={14} /> Category</span>
                                    <span className="text-sm font-medium">{incident.category?.replace('_', ' ') || '—'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-text-secondary flex items-center gap-2"><Shield size={14} /> Source</span>
                                    <span className="text-sm font-medium capitalize">{incident.source}</span>
                                </div>
                                {incident.sourceRef && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-text-secondary flex items-center gap-2"><ExternalLink size={14} /> Source Ref</span>
                                        <span className="text-sm font-mono text-primary">{incident.sourceRef}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* SLA Card */}
                        <div className={`bg-card-dark rounded-xl border p-6 animate-fade-in ${breached ? 'border-red-500/50' : 'border-gray-700'}`}>
                            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Timer size={14} /> SLA Status
                            </h3>
                            {incident.slaDeadline ? (
                                <div>
                                    <p className={`text-lg font-bold ${breached ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {breached ? '⚠ BREACHED' : '✓ On Track'}
                                    </p>
                                    <p className="text-xs text-text-secondary mt-1">
                                        Deadline: {formatDate(incident.slaDeadline)}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">No SLA set</p>
                            )}
                        </div>

                        {/* Timestamps Card */}
                        <div className="bg-card-dark rounded-xl border border-gray-700 p-6 animate-fade-in">
                            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Clock size={14} /> Timestamps
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-text-secondary">Created</span>
                                    <span className="text-text-main font-mono text-xs">{formatDate(incident.createdAt)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-text-secondary">Updated</span>
                                    <span className="text-text-main font-mono text-xs">{formatDate(incident.updatedAt)}</span>
                                </div>
                                {incident.resolvedAt && (
                                    <div className="flex justify-between">
                                        <span className="text-text-secondary">Resolved</span>
                                        <span className="text-emerald-400 font-mono text-xs">{formatDate(incident.resolvedAt)}</span>
                                    </div>
                                )}
                                {incident.closedAt && (
                                    <div className="flex justify-between">
                                        <span className="text-text-secondary">Closed</span>
                                        <span className="text-gray-400 font-mono text-xs">{formatDate(incident.closedAt)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tags */}
                        {incident.tags && incident.tags.length > 0 && (
                            <div className="bg-card-dark rounded-xl border border-gray-700 p-6 animate-fade-in">
                                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Tag size={14} /> Tags
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {incident.tags.map((tag, idx) => (
                                        <span key={idx} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/30">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IncidentDetail;
