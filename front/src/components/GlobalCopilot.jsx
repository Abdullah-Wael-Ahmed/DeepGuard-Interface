// GlobalCopilot — Gemini AI powered — v2 2026-04-20
import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
    Bot, Send, X, Cpu, ChevronRight, LoaderCircle,
    ShieldAlert, Sparkles, RotateCcw, Copy, Check
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Convert markdown-ish text to safe HTML for display */
function renderMarkdown(text) {
    if (!text) return '';
    return text
        // Bold **text**
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic *text*
        .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>')
        // Inline code `code`
        .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
        // Headers ### text
        .replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
        .replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>')
        // Bullet list items
        .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
        // Wrap consecutive <li> in <ul>
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="md-list">$&</ul>')
        // Numbered list
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Horizontal rules
        .replace(/^---$/gm, '<hr class="md-hr" />')
        // Line breaks (double newline → paragraph break)
        .replace(/\n\n/g, '</p><p class="md-p">')
        // Single newline
        .replace(/\n/g, '<br/>');
}

/** Severity styling */
const severityStyle = (sev) => {
    switch (sev) {
        case 'Critical': return 'bg-red-500/15 text-red-400 border-red-500/30';
        case 'High': return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
        case 'Medium': return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
        case 'Low': return 'bg-green-500/15 text-green-400 border-green-500/30';
        default: return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
    }
};

/** Page-specific suggested prompts */
const PAGE_PROMPTS = {
    '': ['What are the critical alerts right now?', 'Show overall threat status', 'Which tactics are active?'],
    'dashboard': ['What are the critical alerts right now?', 'Show overall threat status', 'Which tactics are active?'],
    'detection': ['Explain the latest anomaly', 'Is this a false positive?', 'How does AI anomaly detection work?'],
    'mitre-attack': ['Explain T1046 alert', 'What is lateral movement?', 'Map DG-ATTCK-2034 to MITRE'],
    'firewall': ['Should I block 185.220.101.34?', 'What firewall rule for brute force?', 'Explain DROP vs REJECT'],
    'traffic': ['Analyze suspicious traffic from 104.152.52.11', 'What is port scanning?', 'Explain this SSH spike'],
    'correlation': ['Explain the correlated attack chain', 'What is 10.0.0.42 doing?', 'Is this a multi-stage attack?'],
    'threat-intel': ['What is GreyNoise classification?', 'Explain IOC enrichment', 'Is 45.155.205.233 malicious?'],
    'reports': ['Summarize current threat posture', 'What should I include in a SOC report?', 'Top risks this week'],
    'network-analytics': ['Explain DNS beaconing behavior', 'What is C2 traffic pattern?', 'Analyze outbound anomaly'],
    'users': ['What user activity triggers alerts?', 'Explain privilege escalation risk', 'MFA recommendation'],
    'settings': ['How to harden SOC platform?', 'Recommended log retention policy', 'Alert threshold best practices'],
};

/** Get page context description for AI injection */
const PAGE_CONTEXT = {
    '': 'User is on the Dashboard page viewing overall SOC metrics and recent alerts.',
    'dashboard': 'User is on the Dashboard page viewing overall SOC metrics and recent alerts.',
    'detection': 'User is on the Anomaly Detection page viewing AI-detected behavioral anomalies.',
    'mitre-attack': 'User is on the MITRE ATT&CK Matrix page viewing active technique detections mapped to the ATT&CK framework.',
    'firewall': 'User is on the Firewall Management page viewing and managing iptables rules.',
    'traffic': 'User is on the Traffic Inspection page analyzing network traffic logs from Suricata/Zeek.',
    'correlation': 'User is on the Correlation Engine page viewing correlated multi-stage attack chains.',
    'threat-intel': 'User is on the Threat Intelligence page viewing IOC enrichment data from GreyNoise, AbuseIPDB, VirusTotal.',
    'reports': 'User is on the Reports page generating SOC security reports.',
    'network-analytics': 'User is on the Network Behavior Analytics page viewing behavioral baselines and deviations.',
    'users': 'User is on the User Management page managing platform access and roles.',
    'settings': 'User is on the Settings page configuring platform behavior.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Message component
// ─────────────────────────────────────────────────────────────────────────────
const BotMessage = ({ msg, onBlockIP }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(msg.text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const htmlContent = renderMarkdown(msg.text);

    return (
        <div className="flex justify-start group">
            <div className="flex flex-col gap-1 max-w-[90%]">
                {/* Avatar + label */}
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                        <Bot size={12} className="text-primary" />
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">DeepGuard AI</span>
                </div>

                {/* Bubble */}
                <div className="relative bg-[#0f1117] border border-gray-700/60 rounded-xl rounded-tl-sm p-4 text-xs sm:text-sm text-gray-200 leading-relaxed shadow-md">
                    {/* Analysis header if severity present */}
                    {msg.severity && (
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-800">
                            <ShieldAlert size={13} className="text-primary flex-shrink-0" />
                            <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Threat Analysis</span>
                            <span className={`ml-auto px-2 py-0.5 rounded text-[9px] font-bold border ${severityStyle(msg.severity)}`}>
                                {msg.severity}
                            </span>
                        </div>
                    )}

                    {/* Markdown content */}
                    <div
                        className="copilot-markdown leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: `<p class="md-p">${htmlContent}</p>` }}
                    />

                    {/* Copy button */}
                    <button
                        onClick={handleCopy}
                        className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-300 hover:bg-gray-800"
                        title="Copy response"
                    >
                        {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    </button>
                </div>

                {/* Timestamp */}
                {msg.timestamp && (
                    <span className="text-[10px] text-gray-600 ml-2">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>
        </div>
    );
};

const UserMessage = ({ msg }) => (
    <div className="flex justify-end">
        <div className="flex flex-col items-end gap-1 max-w-[85%]">
            <div className="bg-primary/10 border border-primary/20 rounded-xl rounded-tr-sm px-4 py-3 text-xs sm:text-sm text-gray-200 leading-relaxed">
                {msg.text}
            </div>
            {msg.timestamp && (
                <span className="text-[10px] text-gray-600 mr-2">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            )}
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main GlobalCopilot component
// ─────────────────────────────────────────────────────────────────────────────
const GlobalCopilot = () => {
    const [copilotOpen, setCopilotOpen] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
    const [chatHistory, setChatHistory] = useState([
        {
            role: 'bot',
            text: 'DeepGuard Security Copilot online.\n\nI can help you **investigate alerts**, **explain threats**, **recommend mitigations**, **map to MITRE ATT&CK**, and support your **firewall decisions**.\n\nAsk me anything about the current threat landscape or paste an alert for analysis.',
            timestamp: new Date().toISOString(),
            severity: null,
        }
    ]);
    const chatEndRef = useRef(null);
    const inputRef = useRef(null);
    const countdownRef = useRef(null);
    const location = useLocation();

    const BACK = import.meta.env.VITE_BACK || '/api';
    const currentPage = location.pathname.split('/')[1] || '';
    const suggestedPrompts = PAGE_PROMPTS[currentPage] || PAGE_PROMPTS[''];
    const pageCtx = PAGE_CONTEXT[currentPage] || PAGE_CONTEXT[''];

    // Auto-scroll to bottom
    useEffect(() => {
        if (copilotOpen) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, copilotOpen]);

    // Focus input when opened
    useEffect(() => {
        if (copilotOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [copilotOpen]);

    // Keyboard shortcut: Ctrl+Shift+K to toggle
    useEffect(() => {
        const handler = (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'K') {
                e.preventDefault();
                setCopilotOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const sendMessage = useCallback(async (messageText) => {
        const userMsg = messageText.trim();
        if (!userMsg || chatLoading) return;

        const userEntry = { role: 'user', text: userMsg, timestamp: new Date().toISOString() };
        setChatHistory(prev => [...prev, userEntry]);
        setChatInput('');
        setChatLoading(true);

        try {
            const res = await axios.post(
                `${BACK}/copilot/query`,
                { prompt: userMsg, pageContext: pageCtx },
                { withCredentials: true, timeout: 60000 }
            );

            const botEntry = {
                role: 'bot',
                text: res.data.analysis || 'No response received.',
                timestamp: res.data.timestamp || new Date().toISOString(),
                severity: res.data.severity || null,
                model: res.data.model || 'gemini-2.5-flash',
            };
            setChatHistory(prev => [...prev, botEntry]);
        } catch (error) {
            const isTimeout = error.code === 'ECONNABORTED';
            const responseData = error.response?.data;
            const isRateLimit = error.response?.status === 429 || responseData?.isRateLimit;
            const isOverloaded = error.response?.status === 503 || responseData?.isOverloaded;
            const retryAfter = responseData?.retryAfter || null;

            let errText;
            if (isOverloaded) {
                errText = `Gemini models are experiencing **high demand** on Google's servers. The backend tried multiple models with retries but all returned 503. This is temporary — please try again in a few seconds.`;
            } else if (isRateLimit) {
                errText = `Rate limit reached — Gemini free tier quota exhausted.${retryAfter ? ` Cooling down for **${retryAfter}s**...` : ' Please wait a moment and try again.'}`;
                // Start countdown timer
                if (retryAfter) {
                    setRateLimitCountdown(retryAfter);
                    if (countdownRef.current) clearInterval(countdownRef.current);
                    countdownRef.current = setInterval(() => {
                        setRateLimitCountdown(prev => {
                            if (prev <= 1) {
                                clearInterval(countdownRef.current);
                                return 0;
                            }
                            return prev - 1;
                        });
                    }, 1000);
                }
            } else if (isTimeout) {
                errText = 'Request timed out. The backend retried multiple models but none responded in time. Please try again.';
            } else {
                errText = responseData?.error || 'Failed to reach the DeepGuard Copilot inference engine. Check that the backend is running.';
            }

            setChatHistory(prev => [...prev, {
                role: 'bot',
                text: `**Error:** ${errText}`,
                timestamp: new Date().toISOString(),
                severity: null,
                isError: true,
                isRateLimit,
                isOverloaded,
                retryAfter,
            }]);
        } finally {
            setChatLoading(false);
        }
    }, [chatLoading, BACK, pageCtx]);

    const handleChatSubmit = (e) => {
        e.preventDefault();
        sendMessage(chatInput);
    };

    const handleSuggestedPrompt = (prompt) => {
        setChatInput(prompt);
        inputRef.current?.focus();
    };

    const handleClearHistory = () => {
        setChatHistory([{
            role: 'bot',
            text: 'Chat cleared. DeepGuard Copilot is ready for your next query.',
            timestamp: new Date().toISOString(),
            severity: null,
        }]);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(chatInput);
        }
    };

    return (
        <>
            {/* CSS for markdown rendering */}
            <style>{`
                .copilot-markdown .md-p { margin-bottom: 0.5rem; }
                .copilot-markdown .md-h3 { font-size: 0.85rem; font-weight: 700; color: #a78bfa; margin: 0.75rem 0 0.25rem; }
                .copilot-markdown .md-h4 { font-size: 0.8rem; font-weight: 600; color: #c4b5fd; margin: 0.5rem 0 0.25rem; }
                .copilot-markdown .md-list { padding-left: 1.25rem; margin: 0.5rem 0; list-style-type: disc; }
                .copilot-markdown .md-list li { margin-bottom: 0.2rem; }
                .copilot-markdown .md-hr { border: none; border-top: 1px solid #374151; margin: 0.75rem 0; }
                .copilot-markdown .inline-code { background: #1f2937; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.78rem; font-family: 'JetBrains Mono', monospace; color: #34d399; }
                .copilot-markdown strong { color: #f3f4f6; font-weight: 600; }
                .copilot-markdown em { color: #d1d5db; }
                @keyframes slideUpCopilot {
                    from { opacity: 0; transform: translateY(24px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .copilot-window { animation: slideUpCopilot 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                @keyframes pulseGlow {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
                    50% { box-shadow: 0 0 0 8px rgba(139, 92, 246, 0); }
                }
                .fab-pulse { animation: pulseGlow 2.5s infinite; }
            `}</style>

            {/* ── Floating Action Button ── */}
            <button
                id="copilot-fab"
                onClick={() => setCopilotOpen(!copilotOpen)}
                title="DeepGuard AI Copilot (Ctrl+Shift+K)"
                className={`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[9999] flex items-center justify-center rounded-full shadow-2xl transition-all duration-300 ${
                    copilotOpen
                        ? 'w-11 h-11 bg-gray-700 hover:bg-gray-600 rotate-90'
                        : 'w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-700 hover:-translate-y-1 fab-pulse'
                }`}
            >
                {copilotOpen
                    ? <X size={20} className="text-white" />
                    : <Bot size={24} className="text-white" />
                }
            </button>

            {/* ── Copilot Window ── */}
            {copilotOpen && (
                <div
                    id="copilot-window"
                    className="copilot-window fixed bottom-24 right-4 sm:right-8 z-[9998] flex flex-col rounded-2xl border border-gray-700/80 shadow-2xl overflow-hidden"
                    style={{
                        width: 'min(440px, calc(100vw - 2rem))',
                        height: 'min(640px, calc(100vh - 140px))',
                        background: 'linear-gradient(145deg, #0d0f14 0%, #111318 100%)',
                    }}
                >
                    {/* ── Header ── */}
                    <div className="flex-shrink-0 px-4 py-3 border-b border-gray-700/60 bg-gradient-to-r from-[#0d0f14] to-[#141720]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/30 to-purple-700/30 border border-purple-500/30 flex items-center justify-center">
                                    <Bot size={16} className="text-violet-400" />
                                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0d0f14]"></span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent leading-none mb-0.5">
                                        DeepGuard Copilot
                                    </h3>
                                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                        <Sparkles size={9} className="text-violet-500" />
                                        Gemini 2.5 Flash — SOC Analyst
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleClearHistory}
                                    title="Clear chat"
                                    className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                                >
                                    <RotateCcw size={13} />
                                </button>
                                <button
                                    onClick={() => setCopilotOpen(false)}
                                    className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                                >
                                    <X size={13} />
                                </button>
                            </div>
                        </div>

                        {/* Page context badge */}
                        <div className="mt-2 px-2 py-1 rounded-lg bg-gray-800/60 border border-gray-700/40 flex items-center gap-1.5">
                            <Cpu size={10} className="text-violet-500 flex-shrink-0" />
                            <span className="text-[10px] text-gray-400 truncate">{pageCtx}</span>
                        </div>
                    </div>

                    {/* ── Chat History ── */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 scroll-smooth">
                        {chatHistory.map((msg, idx) =>
                            msg.role === 'user'
                                ? <UserMessage key={idx} msg={msg} />
                                : <BotMessage key={idx} msg={msg} />
                        )}

                        {/* Loading indicator */}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="flex items-center gap-3 text-gray-400 text-xs px-4 py-3 bg-[#0f1117] border border-gray-700/60 rounded-xl rounded-tl-sm">
                                    <LoaderCircle size={14} className="animate-spin text-violet-500" />
                                    <span>Analyzing threat data...</span>
                                </div>
                            </div>
                        )}

                        <div ref={chatEndRef} />
                    </div>

                    {/* ── Input Area ── */}
                    <div className="flex-shrink-0 border-t border-gray-700/60 bg-[#0d0f14]">
                        {/* Suggested prompts */}
                        <div className="px-3 pt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {suggestedPrompts.map((q) => (
                                <button
                                    key={q}
                                    type="button"
                                    onClick={() => handleSuggestedPrompt(q)}
                                    disabled={chatLoading}
                                    className="flex-shrink-0 px-2.5 py-1 text-[10px] bg-gray-800/70 border border-gray-700/60 text-gray-400 rounded-full hover:bg-gray-700 hover:text-gray-200 hover:border-violet-500/40 transition-all disabled:opacity-40"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>

                        {/* Text input */}
                        <form onSubmit={handleChatSubmit} className="px-3 pb-3">
                            {/* Rate limit cooldown banner */}
                            {rateLimitCountdown > 0 && (
                                <div className="mb-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center gap-2 text-[11px] text-orange-400">
                                    <LoaderCircle size={12} className="animate-spin flex-shrink-0" />
                                    <span>Rate limit — cooling down. Ready in <strong>{rateLimitCountdown}s</strong></span>
                                </div>
                            )}
                            <div className="relative flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    id="copilot-input"
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={rateLimitCountdown > 0 ? `Cooling down... retry in ${rateLimitCountdown}s` : "Ask DeepGuard Copilot..."}
                                    disabled={chatLoading || rateLimitCountdown > 0}
                                    className="w-full bg-gray-800/60 border border-gray-700 rounded-xl py-3 pl-4 pr-12 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500/70 focus:ring-1 focus:ring-violet-500/30 transition-all disabled:opacity-50"
                                />
                                <button
                                    type="submit"
                                    id="copilot-send"
                                    disabled={chatLoading || !chatInput.trim() || rateLimitCountdown > 0}
                                    className="absolute right-2 w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-700 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:from-violet-400 hover:to-purple-600 active:scale-95"
                                >
                                    {chatLoading
                                        ? <LoaderCircle size={14} className="animate-spin text-white" />
                                        : <Send size={14} className="text-white" />
                                    }
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-600 mt-1.5 text-center">
                                Press Enter to send · Ctrl+Shift+K to toggle
                            </p>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default GlobalCopilot;