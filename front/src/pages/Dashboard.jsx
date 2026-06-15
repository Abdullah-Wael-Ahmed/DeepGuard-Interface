import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import useWebSocket from 'react-use-websocket';
import { showAlertToast } from '../services/toastService';
import { TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, Activity, RefreshCw } from 'lucide-react';
import AnimatedCounter, { Sparkline } from '../components/ui/AnimatedCounter';
import { SkeletonCard, SkeletonChart, SkeletonTableRow } from '../components/ui/Skeleton';

const Dashboard = () => {
    const [alerts, setAlerts] = useState([]);
    const [alertCount, setAlertCount] = useState(0);
    const [loading, setLoading] = useState(true);
    
    // Refs for throttling the counter
    const totalAlertsRef = useRef(0);
    const lastUpdateRef = useRef(0);

    // Fetch alerts
    const fetchAlerts = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${import.meta.env.VITE_BACK}/logs`, {
                withCredentials: true,
                params: { page: 1 }
            });
            const count = res.data.alertCount || 0;
            setAlerts(res.data.alerts || []);
            setAlertCount(count);
            totalAlertsRef.current = count;
            lastUpdateRef.current = Date.now();
            setLoading(false);
        } catch (error) {
            console.error('Error fetching alerts:', error);
            setLoading(false);
        }
    };

    // WebSocket for real-time updates
    const { lastMessage } = useWebSocket(import.meta.env.VITE_WS, {
        shouldReconnect: () => true,
        reconnectAttempts: 10,
        reconnectInterval: 3000
    });

    useEffect(() => {
        fetchAlerts();
    }, []);

    useEffect(() => {
        try {
            if (!lastMessage?.data) return;
            const message = JSON.parse(lastMessage.data);
            if (message.type === 'new_alert') {
                totalAlertsRef.current += 1;
                setAlerts((prev) => [message.data, ...prev.slice(0, 9)]);
                
                const now = Date.now();
                if (now - lastUpdateRef.current >= 10000) {
                    setAlertCount(totalAlertsRef.current);
                    lastUpdateRef.current = now;
                }
                
                showAlertToast(`New alert: ${message.data.signature?.slice(0, 30)}...`);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }, [lastMessage]);

    // Compute statistics
    const stats = useMemo(() => {
        const highSeverity = alerts.filter(a => a.severity === 1).length;
        const mediumSeverity = alerts.filter(a => a.severity === 2).length;
        const lowSeverity = alerts.filter(a => a.severity === 3).length;
        
        return {
            anomalies: alertCount,
            activeThreats: highSeverity,
            blockedConnections: highSeverity + mediumSeverity,
            lowRisk: lowSeverity
        };
    }, [alerts, alertCount]);

    // Get threat categories from signatures
    const threatCategories = useMemo(() => {
        const categories = { Malware: 0, DDoS: 0, Scan: 0, Exploit: 0, Other: 0 };
        alerts.forEach(alert => {
            const sig = (alert.signature || '').toLowerCase();
            if (sig.includes('malware') || sig.includes('trojan') || sig.includes('virus')) {
                categories.Malware++;
            } else if (sig.includes('ddos') || sig.includes('flood') || sig.includes('dos')) {
                categories.DDoS++;
            } else if (sig.includes('scan') || sig.includes('probe')) {
                categories.Scan++;
            } else if (sig.includes('exploit') || sig.includes('overflow') || sig.includes('injection')) {
                categories.Exploit++;
            } else {
                categories.Other++;
            }
        });
        return categories;
    }, [alerts]);

    // Find max category for highlighting
    const maxCategory = useMemo(() => {
        let max = 'Other';
        let maxVal = 0;
        Object.entries(threatCategories).forEach(([key, val]) => {
            if (val > maxVal) {
                maxVal = val;
                max = key;
            }
        });
        return max;
    }, [threatCategories]);

    // Format latest alerts for table
    const latestIncidents = useMemo(() => {
        return alerts.slice(0, 5).map((alert, idx) => ({
            id: `#INC-${String(alert.id || idx).padStart(5, '0')}`,
            type: alert.signature?.slice(0, 25) || 'Unknown Threat',
            severity: alert.severity === 1 ? 'Critical' : alert.severity === 2 ? 'High' : 'Medium',
            color: alert.severity === 1 ? 'text-red-400' : alert.severity === 2 ? 'text-orange-400' : 'text-yellow-400',
            bgColor: alert.severity === 1 ? 'bg-red-500/10 border-red-500/20' : alert.severity === 2 ? 'bg-orange-500/10 border-orange-500/20' : 'bg-yellow-500/10 border-yellow-500/20',
            time: new Date(alert.createdAt || alert.timestamp).toLocaleString()
        }));
    }, [alerts]);

    // Generate sparkline data from alerts (mock based on time distribution)
    const sparklineData = useMemo(() => {
        return [3, 5, 2, 8, 4, 6, alerts.length || 1];
    }, [alerts]);

    return (
        <div className="flex min-h-screen font-display">
            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="flex flex-col gap-8 max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-wrap justify-between items-center gap-4 animate-fade-in">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-4xl font-bold tracking-tight text-gradient">Dashboard Overview</h1>
                            <p className="text-text-secondary text-base">
                                Real-time monitoring of network security.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-4 py-2 bg-card-dark rounded-lg border border-gray-700">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-green-500 text-sm font-medium">System Online</span>
                            </div>
                            <button 
                                onClick={fetchAlerts}
                                className="flex items-center gap-2 justify-center rounded-lg h-10 px-4 bg-card-dark text-sm font-medium border border-gray-700 hover:bg-primary/10 hover:border-primary transition-all duration-300"
                            >
                                <RefreshCw className="h-4 w-4" />
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>
                    
                    {/* Stats */}
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 stagger-children">
                            {/* Total Alerts */}
                            <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-dark border border-gray-700 hover:border-primary/50 transition-all duration-300 card-lift">
                                <div className="flex justify-between items-start">
                                    <p className="text-text-secondary text-sm font-medium">Total Alerts</p>
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <Activity className="text-primary" size={18} />
                                    </div>
                                </div>
                                <p className="text-text-main text-4xl font-bold">
                                    <AnimatedCounter value={stats.anomalies} />
                                </p>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1 text-primary text-sm font-medium">
                                        <TrendingUp size={14} />
                                        <span>Live</span>
                                    </div>
                                    <Sparkline data={sparklineData} color="var(--color-primary)" />
                                </div>
                            </div>
                            
                            {/* Critical Threats */}
                            <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-dark border border-gray-700 hover:border-red-500/50 transition-all duration-300 card-lift">
                                <div className="flex justify-between items-start">
                                    <p className="text-text-secondary text-sm font-medium">Critical Threats</p>
                                    <div className={`p-2 rounded-lg ${stats.activeThreats > 0 ? 'bg-red-500/20 animate-pulse' : 'bg-red-500/10'}`}>
                                        <AlertTriangle className="text-red-400" size={18} />
                                    </div>
                                </div>
                                <p className="text-text-main text-4xl font-bold">
                                    <AnimatedCounter value={stats.activeThreats} />
                                </p>
                                <p className={`text-sm font-medium ${stats.activeThreats > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                    {stats.activeThreats > 0 ? '⚠ Requires attention' : '✓ All clear'}
                                </p>
                            </div>
                            
                            {/* Actionable Events */}
                            <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-dark border border-gray-700 hover:border-orange-500/50 transition-all duration-300 card-lift">
                                <div className="flex justify-between items-start">
                                    <p className="text-text-secondary text-sm font-medium">Actionable Events</p>
                                    <div className="p-2 bg-orange-500/10 rounded-lg">
                                        <ShieldCheck className="text-orange-400" size={18} />
                                    </div>
                                </div>
                                <p className="text-text-main text-4xl font-bold">
                                    <AnimatedCounter value={stats.blockedConnections} />
                                </p>
                                <p className="text-orange-400 text-sm font-medium">High + Medium severity</p>
                            </div>
                            
                            {/* Low Risk */}
                            <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-dark border border-gray-700 hover:border-green-500/50 transition-all duration-300 card-lift">
                                <div className="flex justify-between items-start">
                                    <p className="text-text-secondary text-sm font-medium">Low Risk</p>
                                    <div className="p-2 bg-green-500/10 rounded-lg">
                                        <TrendingDown className="text-green-400" size={18} />
                                    </div>
                                </div>
                                <p className="text-text-main text-4xl font-bold">
                                    <AnimatedCounter value={stats.lowRisk} />
                                </p>
                                <p className="text-green-400 text-sm font-medium">Informational alerts</p>
                            </div>
                        </div>
                    )}
                    
                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Chart 1 - Event Correlation */}
                        {loading ? (
                            <div className="bg-card-dark rounded-xl border border-gray-800 p-6">
                                <SkeletonChart />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 rounded-xl p-6 bg-card-dark border border-gray-700 card-lift animate-fade-in">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-lg font-medium text-text-main">Event Correlation</p>
                                        <p className="text-text-secondary text-sm">
                                            Trends over the last 24 hours
                                        </p>
                                    </div>
                                    <p className="text-primary text-lg font-bold glow-text">
                                        +<AnimatedCounter value={alerts.length} />
                                    </p>
                                </div>
                                <div className="flex-1 flex flex-col justify-end">
                                    <svg
                                        fill="none"
                                        height="200"
                                        preserveAspectRatio="none"
                                        viewBox="0 0 472 150"
                                        width="100%"
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="animate-fade-in"
                                    >
                                        <path
                                            d="M0 109C18.1538 109 18.1538 21 36.3077 21C54.4615 21 54.4615 41 72.6154 41C90.7692 41 90.7692 93 108.923 93C127.077 93 127.077 33 145.231 33C163.385 33 163.385 101 181.538 101C199.692 101 199.692 61 217.846 61C236 61 236 45 254.154 45C272.308 45 272.308 121 290.462 121C308.615 121 308.615 149 326.769 149C344.923 149 344.923 1 363.077 1C381.231 1 381.231 81 399.385 81C417.538 81 417.538 129 435.692 129C453.846 129 453.846 25 472 25V149H0V109Z"
                                            fill="url(#paint0_linear)"
                                            className="animate-fade-in"
                                        ></path>
                                        <path
                                            d="M0 109C18.1538 109 18.1538 21 36.3077 21C54.4615 21 54.4615 41 72.6154 41C90.7692 41 90.7692 93 108.923 93C127.077 93 127.077 33 145.231 33C163.385 33 163.385 101 181.538 101C199.692 101 199.692 61 217.846 61C236 61 236 45 254.154 45C272.308 45 272.308 121 290.462 121C308.615 121 308.615 149 326.769 149C344.923 149 344.923 1 363.077 1C381.231 1 381.231 81 399.385 81C417.538 81 417.538 129 435.692 129C453.846 129 453.846 25 472 25"
                                            stroke="var(--color-primary)"
                                            strokeLinecap="round"
                                            strokeWidth="3"
                                            className="animate-fade-in"
                                        ></path>
                                        <defs>
                                            <linearGradient
                                                id="paint0_linear"
                                                x1="236"
                                                x2="236"
                                                y1="1"
                                                y2="149"
                                                gradientUnits="userSpaceOnUse"
                                            >
                                                <stop stopColor="var(--color-primary)" stopOpacity="0.3" />
                                                <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                </div>
                            </div>
                        )}
                        
                        {/* Chart 2 - Top Threats by Category */}
                        {loading ? (
                            <div className="bg-card-dark rounded-xl border border-gray-800 p-6">
                                <SkeletonChart />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 rounded-xl p-6 bg-card-dark border border-gray-700 card-lift animate-fade-in">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-lg font-medium text-text-main">Top Threats</p>
                                        <p className="text-text-secondary text-sm">Categorized by type</p>
                                    </div>
                                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                                        {maxCategory}
                                    </span>
                                </div>
                                <div className="grid grid-flow-col gap-4 grid-rows-[1fr_auto] items-end justify-items-center px-3 h-[180px]">
                                    {Object.entries(threatCategories).map(([label, count], i) => {
                                        const maxCount = Math.max(...Object.values(threatCategories), 1);
                                        const heightPercent = (count / maxCount) * 100;
                                        const isMax = label === maxCategory && count > 0;
                                        return (
                                            <React.Fragment key={i}>
                                                <div className="flex flex-col items-center justify-end h-full w-full">
                                                    <div
                                                        className={`w-full max-w-[40px] rounded-t transition-all duration-500 ${
                                                            isMax ? 'bg-gradient-to-t from-primary/50 to-primary glow' : 'bg-primary/20 hover:bg-primary/30'
                                                        }`}
                                                        style={{ 
                                                            height: `${Math.max(heightPercent, 5)}%`,
                                                            animationDelay: `${i * 100}ms`
                                                        }}
                                                    ></div>
                                                </div>
                                                <div className="text-center mt-2">
                                                    <p className={`text-xs font-bold ${isMax ? 'text-primary' : 'text-text-secondary'}`}>
                                                        {label}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        <AnimatedCounter value={count} />
                                                    </p>
                                                </div>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Reports Table */}
                    <div className="rounded-xl bg-card-dark border border-gray-700 overflow-hidden card-lift animate-fade-in">
                        <div className="p-6 border-b border-gray-700">
                            <h2 className="text-lg font-medium text-text-main">Recent Incidents</h2>
                            <p className="text-text-secondary text-sm">Latest security events from your network</p>
                        </div>
                        {loading ? (
                            <table className="w-full">
                                <tbody>
                                    {[...Array(3)].map((_, i) => <SkeletonTableRow key={i} columns={5} />)}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-700 bg-background-dark/30">
                                        {['Incident ID', 'Type', 'Severity', 'Timestamp', 'Actions'].map(
                                            (h, i) => (
                                                <th key={i} className="p-4 text-sm font-medium text-text-secondary">
                                                    {h}
                                                </th>
                                            )
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="stagger-children">
                                    {latestIncidents.length > 0 ? (
                                        latestIncidents.map((r, idx) => (
                                            <tr key={idx} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                                                <td className="p-4 text-sm font-mono text-primary">{r.id}</td>
                                                <td className="p-4 text-sm text-text-main">{r.type}...</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${r.bgColor} ${r.color}`}>
                                                        {r.severity}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm text-text-secondary">{r.time}</td>
                                                <td className="p-4 text-sm">
                                                    <button className="text-primary hover:underline font-medium">
                                                        View Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-text-secondary">
                                                No incidents to display
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
