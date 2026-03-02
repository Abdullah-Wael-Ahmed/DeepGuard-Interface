import React, { useState, useEffect, useRef } from 'react';
import { Crosshair, Cpu, ShieldAlert, BrainCircuit, Activity, ServerCrash, Bot, TerminalSquare, MapPin } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';

const MitreAttack = () => {
    const [stats, setStats] = useState({ active_techniques: 0, tactics_observed: 0, ai_behavioral_flags: 0, high_severity: 0 });
    const [matrix, setMatrix] = useState({});
    const [loading, setLoading] = useState(true);
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState([
        { type: 'bot', text: 'DeepGuard Security Copilot initialized. How can I assist you with threat investigation today?', payload: null }
    ]);
    const chatEndRef = useRef(null);

    const fetchMapping = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACK || 'http://localhost:5000'}/mitre/attack-mapping`);
            setStats(res.data.stats);
            setMatrix(res.data.matrix);
            setLoading(false);
        } catch (error) {
            console.error('Failed to load ATT&CK mapping:', error);
            toast.error('Failed to load mapping telemetry.', { theme: "dark" });
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMapping();
        // Optional: Polling could be added here
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const handleChatSubmit = async (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const newChat = { type: 'user', text: chatInput, payload: null };
        setChatHistory(prev => [...prev, newChat]);
        setChatInput('');

        try {
            const res = await axios.post(`${import.meta.env.VITE_BACK || 'http://localhost:5000'}/mitre/chatbot/query`, {
                prompt: newChat.text
            });
            const botReply = { type: 'bot', text: res.data.analysis, payload: res.data };
            setChatHistory(prev => [...prev, botReply]);
        } catch (error) {
            setChatHistory(prev => [...prev, { type: 'bot', text: 'Error connecting to the DeepGuard RAG Copilot.', payload: null }]);
        }
    };

    const handleBlockIp = async (ipTarget) => {
        try {
            // Replace with actual block endpoint
            // await axios.post(`${import.meta.env.VITE_BACK}/firewall/block`, { ip: ipTarget });
            toast.success(`IP ${ipTarget} blocked successfully via IPTABLES.`, { theme: "dark" });
        } catch (error) {
            toast.error(`Failed to block IP ${ipTarget}.`, { theme: "dark" });
        }
    }

    if (loading) {
        return <div className="p-6 h-full flex items-center justify-center font-display text-text-main"><Cpu className="animate-pulse w-10 h-10 text-primary" /></div>;
    }

    return (
        <div className="p-6 h-full flex flex-col gap-6 font-display text-text-main">
            <div className="flex justify-between items-center mb-0">
                <div>
                    <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
                        <Crosshair className="text-red-500" />
                        MITRE ATT&CK Mapping & AI Assistant
                    </h1>
                    <p className="text-text-secondary text-sm mt-1">
                        Real-time threat mapping, correlation context, and AI-driven investigation.
                    </p>
                </div>
            </div>

            {/* Global Telemetry Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-card-dark border border-gray-800 rounded-xl p-4 shadow-lg flex items-center gap-4">
                    <div className="p-3 bg-red-500/20 rounded-lg text-red-500">
                        <ShieldAlert size={24} />
                    </div>
                    <div>
                        <p className="text-text-secondary text-sm">Active Techniques Triggered</p>
                        <h2 className="text-2xl font-bold text-text-main">{stats.active_techniques}</h2>
                    </div>
                </div>
                <div className="bg-card-dark border border-gray-800 rounded-xl p-4 shadow-lg flex items-center gap-4">
                    <div className="p-3 bg-orange-500/20 rounded-lg text-orange-500">
                        <Activity size={24} />
                    </div>
                    <div>
                        <p className="text-text-secondary text-sm">Tactics Observed</p>
                        <h2 className="text-2xl font-bold text-text-main">{stats.tactics_observed}</h2>
                    </div>
                </div>
                <div className="bg-card-dark border border-gray-800 rounded-xl p-4 shadow-lg flex items-center gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-lg text-purple-500">
                        <BrainCircuit size={24} />
                    </div>
                    <div>
                        <p className="text-text-secondary text-sm">AI-Behavioral Flags</p>
                        <h2 className="text-2xl font-bold text-text-main">{stats.ai_behavioral_flags}</h2>
                    </div>
                </div>
                <div className="bg-card-dark border border-gray-800 rounded-xl p-4 shadow-lg flex items-center gap-4">
                    <div className="p-3 bg-red-600/20 rounded-lg text-red-600">
                        <ServerCrash size={24} />
                    </div>
                    <div>
                        <p className="text-text-secondary text-sm">High Severity</p>
                        <h2 className="text-2xl font-bold text-text-main">{stats.high_severity}</h2>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 gap-6 min-h-0">
                {/* Tactical Investigation Surface */}
                <div className="flex-[3] bg-card-dark border border-gray-800 rounded-xl flex flex-col overflow-hidden shadow-lg shadow-black/50">
                    <div className="p-4 border-b border-gray-800 font-bold flex justify-between items-center text-sm">
                        <span className="flex items-center gap-2"><MapPin size={16} className="text-primary"/> Attack Matrix & Detection Coverage</span>
                        <div className="flex gap-4 text-xs font-normal">
                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Signature (Suricata)</div>
                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Correlated (Zeek+IDS)</div>
                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> AI Inferred (IsoForest)</div>
                        </div>
                    </div>
                    <div className="flex-1 p-4 overflow-auto">
                        <div className="grid grid-cols-5 gap-4 min-w-[800px]">
                            {['Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Discovery', 'Credential Access'].map(tactic => (
                                <div key={tactic} className="flex flex-col gap-2">
                                    <div className="bg-gray-800/50 p-2 text-center text-xs font-bold uppercase rounded-md">{tactic}</div>
                                    
                                    {(matrix[tactic] || []).map((tech, idx) => {
                                        let borderColor = "border-gray-700";
                                        let dotColor = "bg-gray-600";
                                        let shadowClass = "";

                                        if (tech.source === 'Suricata') {
                                            borderColor = "border-red-500/50"; dotColor = "bg-red-500"; shadowClass="shadow-[0_0_10px_rgba(239,68,68,0.2)]";
                                        } else if (tech.source === 'Zeek' || tech.source === 'Correlated') {
                                            borderColor = "border-orange-500/50"; dotColor = "bg-orange-500"; shadowClass="shadow-[0_0_10px_rgba(249,115,22,0.2)]";
                                        } else if (tech.ai_inferred) {
                                            borderColor = "border-purple-500/50"; dotColor = "bg-purple-500"; shadowClass="shadow-[0_0_10px_rgba(168,85,247,0.2)]";
                                        }

                                        return (
                                            <div key={idx} className={`bg-gray-800/30 p-2 rounded text-xs border ${borderColor} flex justify-between items-center hover:bg-gray-700 cursor-pointer ${shadowClass}`}>
                                                <span title={tech.name}>{tech.id}</span>
                                                <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                                            </div>
                                        );
                                    })}
                                    {(!matrix[tactic] || matrix[tactic].length === 0) && (
                                        <div className="bg-gray-800/20 p-2 rounded text-xs border border-gray-800 text-gray-600 text-center italic">
                                            No Activity
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Security Copilot Drawer */}
                <div className="flex-[1.2] bg-[#0A0C10] border border-gray-800 rounded-xl flex flex-col overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] relative">
                    <div className="p-3 bg-gradient-to-r from-gray-900 to-[#0A0C10] border-b border-gray-800 font-bold flex gap-2 items-center text-sm shadow-md z-10">
                        <Bot className="text-secondary" size={20} />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary">DeepGuard Security Copilot</span>
                    </div>
                     
                    <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={msg.type === 'user' ? "bg-gray-800/40 rounded-lg p-3 max-w-[90%] self-end border border-gray-700 text-sm" : "bg-secondary/10 rounded-lg p-4 max-w-[95%] self-start border border-secondary/30 text-sm flex gap-3 shadow-[0_0_15px_rgba(45,212,191,0.05)]"}>
                                {msg.type === 'bot' && <Cpu size={20} className="text-secondary flex-shrink-0 mt-1"/>}
                                <div className="flex flex-col gap-2">
                                    <p>{msg.text}</p>
                                    
                                    {msg.payload && (
                                        <>
                                            <div className="mt-2 text-xs bg-black/40 p-2 rounded font-mono border border-gray-800 text-gray-300">
                                                <div className="flex justify-between"><span className="text-gray-500">Tactic:</span> <span className="text-primary font-bold">{msg.payload.mapped_tactic}</span></div>
                                                <div className="flex justify-between"><span className="text-gray-500">Confidence:</span> <span className="text-purple-400">{msg.payload.confidence}</span></div>
                                            </div>
                                            {msg.payload.recommended_action && msg.payload.recommended_action.length > 0 && (
                                                <div className="flex flex-col gap-2 mt-2">
                                                    <span className="text-xs text-gray-400 font-bold uppercase">Recommended Actions:</span>
                                                    {msg.payload.recommended_action.map((act, i) => (
                                                        <button key={i} onClick={() => handleBlockIp(act.target)} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 text-xs px-3 py-2 rounded transition-colors flex justify-between items-center group">
                                                            {act.action === 'block_ip' ? `Block IP: ${act.target}` : act.description}
                                                            <ShieldAlert size={14} className="group-hover:scale-110 transition-transform" />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleChatSubmit} className="p-3 border-t border-gray-800 bg-black/20">
                        <div className="relative flex items-center">
                            <input 
                                type="text" 
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target)}
                                placeholder="Ask DeepGuard Copilot..." 
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 placeholder-gray-600 transition-all font-mono"
                            />
                            <button type="submit" className="absolute right-2 p-1.5 bg-secondary/20 text-secondary hover:bg-secondary hover:text-white rounded-md transition-colors">
                                <TerminalSquare size={16} />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default MitreAttack;
