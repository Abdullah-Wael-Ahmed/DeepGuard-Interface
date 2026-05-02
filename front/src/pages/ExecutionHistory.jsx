import React, { useState, useEffect } from 'react';
import { History, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCcw, ChevronDown, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';

const BACK = import.meta.env.VITE_BACK;

const STATUS_STYLES = {
    success: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: CheckCircle2 },
    failed: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: XCircle },
    running: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: RefreshCcw },
    awaiting_approval: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: AlertTriangle },
    rejected: { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', icon: XCircle },
    partial: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: AlertTriangle },
};

const ExecutionHistory = () => {
    const [executions, setExecutions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [filter, setFilter] = useState('');

    const fetchExecutions = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filter) params.status = filter;
            const res = await axios.get(`${BACK}/playbooks/executions`, { params, withCredentials: true });
            setExecutions(res.data.executions || []);
        } catch (error) {
            toast.error("Failed to load executions");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchExecutions(); }, [filter]);

    const handleApprove = async (execId, approved) => {
        try {
            await axios.post(`${BACK}/playbooks/executions/${execId}/approve`, { approved }, { withCredentials: true });
            toast.success(approved ? "Execution approved" : "Execution rejected");
            fetchExecutions();
        } catch (error) {
            toast.error("Failed to process approval");
        }
    };

    const duration = (exec) => {
        if (!exec.completedAt) return 'Running...';
        const ms = new Date(exec.completedAt) - new Date(exec.startedAt || exec.createdAt);
        return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
    };

    return (
        <div className="flex-1 bg-background-dark p-8 overflow-y-auto font-display text-text-main">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                            <History className="text-primary" /> Execution History
                        </h1>
                        <p className="text-text-secondary mt-2">SOAR playbook execution logs and audit trail</p>
                    </div>
                    <div className="flex gap-3">
                        <select
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className="bg-card-dark border border-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-primary"
                        >
                            <option value="">All Statuses</option>
                            <option value="success">Success</option>
                            <option value="failed">Failed</option>
                            <option value="awaiting_approval">Pending Approval</option>
                            <option value="rejected">Rejected</option>
                        </select>
                        <button onClick={fetchExecutions} className="p-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300">
                            <RefreshCcw size={18} />
                        </button>
                    </div>
                </div>

                <div className="bg-card-dark border border-gray-700 rounded-xl shadow-lg overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-text-secondary">Loading...</div>
                    ) : executions.length === 0 ? (
                        <div className="p-16 text-center text-text-secondary">
                            <History size={48} className="mx-auto mb-4 opacity-50" />
                            <h3 className="text-xl font-bold text-white mb-2">No Executions Yet</h3>
                            <p>Run a playbook to see execution history here.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-800">
                            {executions.map(exec => {
                                const st = STATUS_STYLES[exec.status] || STATUS_STYLES.partial;
                                const Icon = st.icon;
                                const isExpanded = expandedId === exec.id;
                                return (
                                    <div key={exec.id}>
                                        <div
                                            className="p-5 hover:bg-white/5 cursor-pointer flex items-center gap-4 transition-colors"
                                            onClick={() => setExpandedId(isExpanded ? null : exec.id)}
                                        >
                                            {isExpanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                                            <Icon size={20} className={st.color} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-white truncate">{exec.playbookName || `Playbook #${exec.playbookId}`}</p>
                                                <p className="text-sm text-gray-400">Trigger: {exec.triggerSource} &middot; Duration: {duration(exec)}</p>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${st.bg} ${st.color} ${st.border} uppercase tracking-wider`}>
                                                {exec.status.replace('_', ' ')}
                                            </span>
                                            <span className="text-sm text-gray-500 flex items-center gap-1">
                                                <Clock size={14} /> {new Date(exec.createdAt).toLocaleString()}
                                            </span>
                                            {exec.status === 'awaiting_approval' && (
                                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => handleApprove(exec.id, true)} className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-sm hover:bg-green-500/30">Approve</button>
                                                    <button onClick={() => handleApprove(exec.id, false)} className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-sm hover:bg-red-500/30">Reject</button>
                                                </div>
                                            )}
                                        </div>
                                        {isExpanded && (
                                            <div className="px-5 pb-5 pl-16">
                                                <div className="bg-[#0f0f13] border border-gray-800 rounded-lg p-4 max-h-80 overflow-y-auto font-mono text-xs space-y-1">
                                                    {(exec.logs || []).map((log, i) => (
                                                        <div key={i} className={`flex gap-2 ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-gray-300'}`}>
                                                            <span className="text-gray-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                                            <span className={`uppercase font-bold w-12 shrink-0 ${log.level === 'error' ? 'text-red-500' : log.level === 'warn' ? 'text-yellow-500' : 'text-blue-500'}`}>{log.level}</span>
                                                            <span>{log.message}</span>
                                                        </div>
                                                    ))}
                                                    {(!exec.logs || exec.logs.length === 0) && <p className="text-gray-500">No logs available</p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExecutionHistory;
