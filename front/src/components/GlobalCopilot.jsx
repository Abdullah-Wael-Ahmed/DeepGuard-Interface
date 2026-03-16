import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Bot, Send, X, Cpu, ChevronRight, LoaderCircle } from 'lucide-react';

const getSeverityBadge = (severity) => {
    switch (severity) {
        case 'Critical': return 'bg-red-500/10 text-red-500 border border-red-500/20';
        case 'High': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
        case 'Medium': return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
        case 'Low': return 'bg-green-500/10 text-green-400 border border-green-500/20';
        default: return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
    }
};

const GlobalCopilot = () => {
    const [copilotOpen, setCopilotOpen] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState([
        { role: 'bot', text: 'DeepGuard Security Copilot online. I can help you investigate alerts, explain network traffic, suggest mitigations, and generate firewall rules.', payload: null }
    ]);
    const chatEndRef = useRef(null);

    const BACK = import.meta.env.VITE_BACK || 'http://localhost:5000';

    useEffect(() => {
        if (copilotOpen) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, copilotOpen]);

    const handleChatSubmit = async (e) => {
        e.preventDefault();
        if (!chatInput.trim() || chatLoading) return;

        const userMsg = chatInput.trim();
        setChatHistory(prev => [...prev, { role: 'user', text: userMsg, payload: null }]);
        setChatInput('');
        setChatLoading(true);

        try {
            // Note: Update this endpoint if you make a more generic global chatbot route in your backend
            const res = await axios.post(`${BACK}/mitre/chatbot/query`, { prompt: userMsg }, { withCredentials: true });
            setChatHistory(prev => [...prev, { role: 'bot', text: res.data.analysis, payload: res.data }]);
        } catch (error) {
            setChatHistory(prev => [...prev, { role: 'bot', text: '⚠ Failed to reach the DeepGuard Copilot inference engine.', payload: null }]);
        }
        setChatLoading(false);
    };

    const handleBlockIP = async (ip) => {
        try {
            await axios.post(`${BACK}/firewall/add-rule`, {
                chain: 'INPUT', protocol: 'ALL', srcIp: ip, destIp: '', srcPort: '', destPort: '', action: 'DROP', description: `Copilot auto-block ${ip}`
            }, { withCredentials: true });
            toast.success(`IP ${ip} blocked via iptables.`);
        } catch (error) {
            toast.error(`Failed to block IP ${ip}.`);
        }
    };

    return (
        <>
            {/* Floating Action Button (FAB) */}
            <button
                onClick={() => setCopilotOpen(!copilotOpen)}
                className={`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 p-4 rounded-full shadow-2xl z-[9999] transition-all duration-300 flex items-center justify-center ${
                    copilotOpen 
                    ? 'bg-gray-700 text-white hover:bg-gray-600 rotate-90' 
                    : 'bg-primary text-background-dark hover:bg-primary-dark hover:-translate-y-1 hover:shadow-glow-primary'
                }`}
            >
                {copilotOpen ? <X size={24} /> : <Bot size={24} />}
            </button>

            {/* Copilot Overlay Window */}
            {copilotOpen && (
                <div 
                    className="fixed bottom-24 right-4 sm:right-8 w-[calc(100vw-2rem)] sm:w-[420px] flex flex-col bg-card-dark rounded-xl border border-gray-700 shadow-2xl z-[9998] overflow-hidden animate-slide-up origin-bottom-right" 
                    style={{ maxHeight: 'calc(100vh - 140px)', height: '600px' }}
                >
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-r from-card-dark to-background-dark border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/20 rounded-lg">
                                <Bot className="text-primary" size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm sm:text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">DeepGuard Copilot</h3>
                                <p className="text-[10px] sm:text-xs text-text-secondary">AI Security Assistant</p>
                            </div>
                        </div>
                    </div>

                    {/* Chat History */}
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`rounded-xl p-3 sm:p-4 text-xs sm:text-sm max-w-[85%] ${msg.role === 'user'
                                    ? 'bg-primary/10 border border-primary/20 text-text-main rounded-tr-sm'
                                    : 'bg-background-dark border border-gray-700 rounded-tl-sm'}`}>

                                    {msg.role === 'bot' && msg.payload?.severity && (
                                        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-gray-800">
                                            <Cpu size={14} className="text-primary" />
                                            <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Analysis</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ml-auto ${getSeverityBadge(msg.payload.severity)}`}>
                                                {msg.payload.severity}
                                            </span>
                                        </div>
                                    )}

                                    <p className="leading-relaxed whitespace-pre-line text-gray-200">{msg.text}</p>

                                    {msg.payload?.recommended_action?.length > 0 && (
                                        <div className="space-y-2 pt-4 mt-2 border-t border-gray-800">
                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Recommended Actions</span>
                                            {msg.payload.recommended_action.map((act, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => act.action === 'block_ip' ? handleBlockIP(act.target) : toast.info(act.description)}
                                                    className={`w-full text-left p-2.5 rounded text-[11px] sm:text-xs border transition-colors flex items-center justify-between group ${act.action === 'block_ip'
                                                        ? 'bg-red-500/5 border-red-500/20 text-red-400 hover:bg-red-500/15'
                                                        : 'bg-primary/5 border-primary/20 text-primary hover:bg-primary/15'}`}
                                                >
                                                    <span className="truncate pr-2">{act.description}</span>
                                                    <ChevronRight size={14} className="flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="self-start max-w-[85%]">
                                <div className="flex items-center gap-3 text-text-secondary text-xs sm:text-sm p-4 bg-background-dark rounded-xl rounded-tl-sm border border-gray-700">
                                    <LoaderCircle className="animate-spin text-primary" size={16} />
                                    Synthesizing response...
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <form onSubmit={handleChatSubmit} className="p-3 sm:p-4 border-t border-gray-700 bg-background-dark flex-shrink-0">
                        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                            {['Why T1046?', 'Lateral movement', 'Block 192.168.1.50'].map(q => (
                                <button
                                    key={q}
                                    type="button"
                                    onClick={() => { setChatInput(q); }}
                                    className="flex-shrink-0 px-2.5 py-1 text-[11px] bg-gray-800 border border-gray-700 text-text-secondary rounded-full hover:bg-gray-700 hover:text-text-main hover:border-gray-500 transition-colors"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Ask DeepGuard Copilot..."
                                className="w-full bg-card-dark border border-gray-600 rounded-lg py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 placeholder-gray-500 transition-all shadow-inner"
                                disabled={chatLoading}
                            />
                            <button
                                type="submit"
                                disabled={chatLoading || !chatInput.trim()}
                                className="absolute right-2 p-2 bg-primary text-background-dark hover:bg-primary-dark rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
};

export default GlobalCopilot;