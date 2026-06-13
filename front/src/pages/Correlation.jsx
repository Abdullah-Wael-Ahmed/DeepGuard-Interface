import React, { useState, useEffect } from 'react';
import { Layers, Network, Zap, Power, PowerOff, ShieldAlert, Cpu, CheckCircle2, ChevronRight, Activity, Database, Flame, ListFilter, Trash2, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';
import useWebSocket from 'react-use-websocket';
import { useSearchParams } from 'react-router-dom';

const BACK = import.meta.env.VITE_BACK;

const STATUS_ICONS = {
  high: Flame,
  critical: ShieldAlert,
  medium: CheckCircle2,
  low: CheckCircle2,
  info: CheckCircle2
};

const STATUS_COLORS = {
  critical: 'text-red-400 bg-red-500/10 border border-red-500/20',
  high: 'text-orange-400 bg-orange-500/10 border border-orange-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20',
  low: 'text-green-400 bg-green-500/10 border border-green-500/20',
  info: 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
};

const Correlation = () => {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [recentIncidents, setRecentIncidents] = useState([]);
    const [searchParams] = useSearchParams();
    const search = searchParams.get('search') || '';
    
    // WebSockets for Real-time Triggers
    const { lastMessage } = useWebSocket(import.meta.env.VITE_WS, {
        shouldReconnect: () => true
    });

    useEffect(() => {
        if (lastMessage?.data) {
            try {
                const message = JSON.parse(lastMessage.data);
                if (message.type === 'new_incident') {
                    setRecentIncidents(prev => [message.data, ...prev].slice(0, 5));
                    fetchRules(); // To update match count
                }
            } catch (err) {
               console.error("WS error:", err);
            }
        }
    }, [lastMessage]);

    const fetchRules = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BACK}/rules`, { withCredentials: true });
            setRules(res.data || []);
        } catch (error) {
            toast.error("Failed to fetch correlation rules");
        } finally {
            setLoading(false);
        }
    };

    const fetchIncidents = async () => {
        try {
            const res = await axios.get(`${BACK}/incidents?source=correlation&limit=5`, { withCredentials: true });
            setRecentIncidents(res.data.incidents || []);
        } catch (error) {
           console.error(error);
        }
    };

    useEffect(() => {
        fetchRules();
        fetchIncidents();
    }, []);

    const handleToggleRule = async (id) => {
        try {
            const res = await axios.post(`${BACK}/rules/${id}/toggle`, {}, { withCredentials: true });
            setRules(rules.map(r => r.id === id ? res.data : r));
            toast.success(`Rule ${res.data.enabled ? 'Enabled' : 'Disabled'}`);
        } catch (error) {
            toast.error("Failed to toggle rule");
        }
    };

    const handleSeedRules = async () => {
        try {
            await axios.post(`${BACK}/rules/seed`, {}, { withCredentials: true });
            toast.success("Default rules seeded!");
            fetchRules();
        } catch (error) {
            toast.error("Failed to seed rules");
        }
    };

    const handleDeleteRule = async (id) => {
        try {
            if(!window.confirm("Are you sure?")) return;
            await axios.delete(`${BACK}/rules/${id}`, { withCredentials: true });
            toast.success("Rule deleted");
            setRules(rules.filter(r => r.id !== id));
        } catch (error) {
            toast.error("Failed to delete rule");
        }
    };

    return (
        <div className="flex-1 bg-background-dark p-8 overflow-y-auto font-display text-text-main">
            <div className="flex justify-between items-center mb-8 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-gradient">Correlation Engine</h1>
                    <p className="text-text-secondary mt-2">Server-side Stateful Event Correlation & Incident Auto-Creation</p>
                </div>
                <div className="flex gap-4">
                    {rules.length === 0 && !loading && (
                        <button 
                            onClick={handleSeedRules}
                            className="bg-primary hover:bg-primary-dark text-background-dark font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors glow-sm"
                        >
                            <Database size={18} /> Load Default Rules
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                
                {/* ══ ENGINE STATUS ══ */}
                <div className="col-span-1 lg:col-span-3 grid grid-cols-4 gap-4">
                    <div className="bg-card-dark border border-gray-700 p-5 rounded-xl flex items-center gap-4">
                        <div className="p-3 bg-purple-500/20 text-purple-400 rounded-lg">
                            <Cpu size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-text-secondary">Engine Status</p>
                            <p className="text-xl font-bold text-white flex items-center gap-2">
                                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span> Online
                            </p>
                        </div>
                    </div>
                    <div className="bg-card-dark border border-gray-700 p-5 rounded-xl flex items-center gap-4">
                        <div className="p-3 bg-primary/20 text-primary rounded-lg">
                            <Layers size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-text-secondary">Active Rules</p>
                            <p className="text-xl font-bold text-white">{rules.filter(r => r.enabled).length} / {rules.length}</p>
                        </div>
                    </div>
                    <div className="bg-card-dark border border-gray-700 p-5 rounded-xl flex items-center gap-4">
                        <div className="p-3 bg-red-500/20 text-red-400 rounded-lg">
                            <Zap size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-text-secondary">Total Triggers</p>
                            <p className="text-xl font-bold text-white">{rules.reduce((acc, r)=> acc + r.matchCount, 0)}</p>
                        </div>
                    </div>
                    <div className="bg-card-dark border border-gray-700 p-5 rounded-xl flex items-center gap-4">
                        <div className="p-3 bg-yellow-500/20 text-yellow-400 rounded-lg">
                            <Activity size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-text-secondary">Avg Cooldown</p>
                            <p className="text-xl font-bold text-white">{rules.length ? Math.round(rules.reduce((acc, r) => acc + r.cooldownSeconds, 0)/rules.length) : 0}s</p>
                        </div>
                    </div>
                </div>

                {/* ══ RULES TABLE ══ */}
                <div className="col-span-1 lg:col-span-2 bg-card-dark border border-gray-700 rounded-xl overflow-hidden shadow-lg h-[600px] flex flex-col relative">
                    <div className="p-5 border-b border-gray-700 flex justify-between items-center z-10 sticky top-0 bg-card-dark/95 backdrop-blur-sm">
                        <h2 className="text-lg font-bold flex items-center gap-2"><ListFilter size={20} className="text-primary"/> Correlation Rules</h2>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
                        {loading ? (
                             <p>Loading...</p>
                        ) : rules.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-text-secondary opacity-60">
                                <Layers size={48} className="mb-4" />
                                <p>No rules defined</p>
                            </div>
                        ) : (
                             <div className="flex flex-col gap-4">
                                 {rules.filter(rule => 
                                     rule.name?.toLowerCase().includes(search.toLowerCase()) ||
                                     rule.description?.toLowerCase().includes(search.toLowerCase()) ||
                                     rule.category?.toLowerCase().includes(search.toLowerCase())
                                 ).map(rule => {
                                     const Ico = STATUS_ICONS[rule.severity] || CheckCircle2;
                                    return (
                                        <div key={rule.id} className={`p-4 rounded-xl border transition-all duration-300 ${rule.enabled ? 'border-primary/30 bg-background-dark shadow-[0_4px_20px_rgba(0,0,0,0.3)]' : 'border-gray-800 bg-gray-900/50 opacity-60'}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex gap-3">
                                                    <div className={`p-2 rounded-lg ${STATUS_COLORS[rule.severity]}`}>
                                                        <Ico size={20} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-white text-lg">{rule.name}</h3>
                                                        <p className="text-sm text-text-secondary mt-0.5">{rule.description}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                     <div className="text-right mr-4">
                                                        <p className="text-2xl font-black text-white">{rule.matchCount}</p>
                                                        <p className="text-[10px] text-primary uppercase tracking-widest">Triggers</p>
                                                    </div>
                                                    <button onClick={() => handleToggleRule(rule.id)} className={`p-2 rounded-lg transition-colors ${rule.enabled ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}>
                                                        {rule.enabled ? <PowerOff size={18}/> : <Power size={18}/>}
                                                    </button>
                                                    <button onClick={() => handleDeleteRule(rule.id)} className="p-2 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition-colors">
                                                        <Trash2 size={18}/>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 mt-4">
                                                <div className="bg-gray-800/50 p-2 rounded flex flex-col">
                                                    <span className="text-[10px] text-gray-500 uppercase">Type</span>
                                                    <span className="text-sm text-white font-mono">{rule.ruleType}</span>
                                                </div>
                                                <div className="bg-gray-800/50 p-2 rounded flex flex-col">
                                                    <span className="text-[10px] text-gray-500 uppercase">Window</span>
                                                    <span className="text-sm text-white font-mono">{rule.windowSeconds}s</span>
                                                </div>
                                                <div className="bg-gray-800/50 p-2 rounded flex flex-col">
                                                    <span className="text-[10px] text-gray-500 uppercase">Target</span>
                                                    <span className="text-sm text-white font-mono">{rule.conditions?.eventType || 'any'}</span>
                                                </div>
                                                <div className="bg-gray-800/50 p-2 rounded flex flex-col">
                                                    <span className="text-[10px] text-gray-500 uppercase">Action</span>
                                                    <span className="text-sm text-primary font-mono">{rule.actions?.[0]}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ══ RECENT AUTO INCIDENTS ══ */}
                <div className="col-span-1 bg-card-dark border border-gray-700 rounded-xl overflow-hidden shadow-lg h-[600px] flex flex-col relative">
                    <div className="p-5 border-b border-gray-700 z-10 sticky top-0 bg-card-dark/95 backdrop-blur-sm">
                        <h2 className="text-lg font-bold flex items-center gap-2"><Network size={20} className="text-purple-400"/> Auto-Generated Incidents</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
                         {recentIncidents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-text-secondary opacity-60">
                                <ShieldAlert size={48} className="mb-4" />
                                <p>No incidents triggered yet</p>
                            </div>
                        ) : (
                            <div className="relative border-l-2 border-gray-700 ml-3 space-y-6">
                                {recentIncidents.map(inc => (
                                    <div key={inc.id} className="relative pl-6">
                                        <div className="absolute w-3 h-3 bg-purple-500 rounded-full -left-[7.5px] top-1.5 ring-4 ring-card-dark"></div>
                                        <div className="bg-background-dark p-4 rounded-lg border border-purple-500/20 hover:border-purple-500/50 transition-colors cursor-pointer" onClick={() => window.location.href = `/incidents/${inc.id}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">INC-{inc.id}</span>
                                                <span className="text-[10px] text-gray-500">{new Date(inc.createdAt).toLocaleTimeString()}</span>
                                            </div>
                                            <p className="text-sm font-bold text-white mb-1 leading-tight">{inc.title}</p>
                                            <p className="text-xs text-text-secondary">Source: Correlation Engine</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Correlation;
