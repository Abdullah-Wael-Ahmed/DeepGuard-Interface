import React, { useState, useEffect } from 'react';
import { GitPullRequestDraft, Settings, Plus, Play, MoreVertical, Layers, CheckCircle2, Zap, Clock, ShieldAlert } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const BACK = import.meta.env.VITE_BACK;

const STATUS_CONFIG = {
    active: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
    draft: { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
    disabled: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' }
};

const Playbooks = () => {
    const [playbooks, setPlaybooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalExecutions: 0, last24h: 0, successRate: 0, awaitingApproval: 0 });
    const navigate = useNavigate();

    const fetchPlaybooks = async () => {
        setLoading(true);
        try {
            const [pbRes, statsRes] = await Promise.all([
                axios.get(`${BACK}/playbooks`, { withCredentials: true }),
                axios.get(`${BACK}/playbooks/stats`, { withCredentials: true }).catch(() => ({ data: {} }))
            ]);
            setPlaybooks(pbRes.data);
            setStats(statsRes.data);
        } catch (error) {
            toast.error("Failed to load playbooks");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlaybooks();
    }, []);

    const createPlaybook = async () => {
        try {
             const res = await axios.post(`${BACK}/playbooks`, {
                 name: 'New Playbook',
                 description: 'A new automated workflow',
                 triggerType: 'manual',
                 status: 'draft',
                 nodes: JSON.stringify([
                    {
                        id: 'start',
                        type: 'triggerNode',
                        position: { x: 250, y: 100 },
                        data: { triggerType: 'manual' }
                    }
                 ]),
                 edges: '[]'
             }, { withCredentials: true });
             
             navigate(`/playbooks/${res.data.id}`);
        } catch (error) {
            toast.error("Failed to create playbook");
        }
    };

    const seedTemplates = async () => {
        try {
            const res = await axios.post(`${BACK}/playbooks/seed`, {}, { withCredentials: true });
            toast.success(`Seeded ${res.data.created} playbook templates`);
            fetchPlaybooks();
        } catch (error) {
            toast.error("Failed to seed templates");
        }
    };

    return (
        <div className="flex-1 bg-background-dark p-8 overflow-y-auto font-display text-text-main">
            <div className="flex justify-between items-center mb-8 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                        SOAR Playbooks <span className="text-sm px-2 py-0.5 bg-primary/20 text-primary rounded border border-primary/30">V2</span>
                    </h1>
                    <p className="text-text-secondary mt-2">Security Orchestration, Automation, and Response Workflows</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={seedTemplates}
                        className="bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors border border-gray-700"
                    >
                        <Layers size={18} /> Seed Templates
                    </button>
                    <button 
                        onClick={createPlaybook}
                        className="bg-primary hover:bg-primary-dark text-background-dark font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors glow-sm"
                    >
                        <Plus size={18} /> New Playbook
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-card-dark border border-gray-700 p-5 rounded-xl shadow-lg flex items-center justify-between">
                    <div>
                        <p className="text-sm text-text-secondary">Active Workflows</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.activePlaybooks || playbooks.filter(p=>p.status==='active').length}</p>
                    </div>
                    <div className="p-3 bg-green-500/10 rounded-lg text-green-400"><Zap size={24}/></div>
                </div>
                <div className="bg-card-dark border border-gray-700 p-5 rounded-xl shadow-lg flex items-center justify-between">
                    <div>
                        <p className="text-sm text-text-secondary">Executions (24h)</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.last24h || 0}</p>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400"><Play size={24}/></div>
                </div>
                <div className="bg-card-dark border border-gray-700 p-5 rounded-xl shadow-lg flex items-center justify-between">
                    <div>
                        <p className="text-sm text-text-secondary">Success Rate</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.successRate || 0}%</p>
                    </div>
                    <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400"><CheckCircle2 size={24}/></div>
                </div>
                <div className="bg-card-dark border border-gray-700 p-5 rounded-xl shadow-lg flex items-center justify-between">
                    <div>
                        <p className="text-sm text-text-secondary">Pending Approval</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.awaitingApproval || 0}</p>
                    </div>
                    <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-400"><ShieldAlert size={24}/></div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto mt-8 bg-card-dark border border-gray-700 rounded-xl shadow-lg overflow-hidden">
                <div className="p-5 border-b border-gray-700 flex justify-between items-center">
                     <h2 className="text-lg font-bold">Configured Playbooks</h2>
                </div>
                
                {loading ? (
                    <div className="p-8 text-center text-text-secondary">Loading...</div>
                ) : playbooks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-16 text-text-secondary">
                        <GitPullRequestDraft size={64} className="mb-4 opacity-50" />
                        <h3 className="text-xl font-bold text-white mb-2">No Playbooks Yet</h3>
                        <p className="max-w-md text-center mb-6">Create your first SOAR playbook to automate incident response actions like blocking IPs or enriching data.</p>
                        <button onClick={createPlaybook} className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition">Create Playbook</button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-900/50">
                                <tr className="text-text-secondary border-b border-gray-800">
                                    <th className="py-4 px-6 font-medium">Playbook Name</th>
                                    <th className="py-4 px-6 font-medium">Status</th>
                                    <th className="py-4 px-6 font-medium">Trigger</th>
                                    <th className="py-4 px-6 font-medium">Last Updated</th>
                                    <th className="py-4 px-6 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {playbooks.map(pb => (
                                    <tr key={pb.id} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={(e) => {
                                        // Ignore if clicking actions
                                        if (e.target.closest('button')) return;
                                        navigate(`/playbooks/${pb.id}`);
                                    }}>
                                        <td className="py-4 px-6">
                                            <p className="font-bold text-white text-base">{pb.name}</p>
                                            <p className="text-text-secondary truncate max-w-sm mt-0.5">{pb.description}</p>
                                        </td>
                                        <td className="py-4 px-6">
                                             <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_CONFIG[pb.status].bg} ${STATUS_CONFIG[pb.status].color} ${STATUS_CONFIG[pb.status].border} uppercase tracking-wider`}>
                                                {pb.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            {pb.triggerType === 'on_incident_created' ? (
                                                <span className="flex items-center gap-1.5 text-purple-400 bg-purple-500/10 px-2 py-1 rounded w-fit border border-purple-500/20"><ShieldAlert size={14}/> Incident</span>
                                            ) : (
                                                 <span className="flex items-center gap-1.5 text-gray-400 bg-gray-800 px-2 py-1 rounded w-fit"><Play size={14}/> Manual</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-gray-400 flex items-center gap-2">
                                            <Clock size={14}/> {new Date(pb.updatedAt).toLocaleDateString()}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); navigate(`/playbooks/${pb.id}`) }} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition">
                                                    <Settings size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Playbooks;
