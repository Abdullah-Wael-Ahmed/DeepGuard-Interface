import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { AlertTriangle, Activity, Database, Brain, Cpu, LoaderCircle, Inbox } from 'lucide-react';
import axios from 'axios';
import useWebSocket from 'react-use-websocket';
import { toast } from 'react-toastify';

const AnomalyDetection = () => {
  const [alerts, setAlerts] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);

  // Fetch alerts from backend
  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${import.meta.env.VITE_BACK}/logs`, {
        withCredentials: true,
        params: { page: 1 }
      });
      setAlerts(res.data.alerts || []);
      setAlertCount(res.data.alertCount || 0);
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
      if (!live || !lastMessage?.data) return;
      const message = JSON.parse(lastMessage.data);
      if (message.type === 'new_alert') {
        setAlerts((prev) => [message.data, ...prev.slice(0, 9)]);
        setAlertCount((prev) => prev + 1);
        toast.info(`New anomaly: ${message.data.signature?.slice(0, 30)}...`);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, [lastMessage, live]);

  // Transform alerts data for Network Behavior Chart (group by hour)
  const networkBehaviorData = useMemo(() => {
    if (!alerts.length) return [];
    
    const hourlyData = {};
    const now = new Date();
    
    // Initialize last 24 hours
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      const key = `${hour.getHours().toString().padStart(2, '0')}:00`;
      hourlyData[key] = { time: key, normal: 0, anomaly: 0 };
    }

    // Count alerts per hour
    alerts.forEach(alert => {
      const alertTime = new Date(alert.createdAt || alert.timestamp);
      const hourKey = `${alertTime.getHours().toString().padStart(2, '0')}:00`;
      if (hourlyData[hourKey]) {
        if (alert.severity === 1) {
          hourlyData[hourKey].anomaly += 1;
        } else {
          hourlyData[hourKey].normal += 1;
        }
      }
    });

    return Object.values(hourlyData).slice(-8); // Show last 8 hours
  }, [alerts]);

  // Transform alerts for Threat Prediction Radar (group by protocol/signature type)
  const threatPredictionData = useMemo(() => {
    if (!alerts.length) {
      return [
        { subject: 'TCP', A: 0, fullMark: 100 },
        { subject: 'UDP', A: 0, fullMark: 100 },
        { subject: 'ICMP', A: 0, fullMark: 100 },
        { subject: 'High Sev', A: 0, fullMark: 100 },
        { subject: 'Medium Sev', A: 0, fullMark: 100 },
        { subject: 'Low Sev', A: 0, fullMark: 100 },
      ];
    }

    const protocolCounts = { TCP: 0, UDP: 0, ICMP: 0, Other: 0 };
    const severityCounts = { high: 0, medium: 0, low: 0 };

    alerts.forEach(alert => {
      const proto = alert.protocol?.toUpperCase();
      if (protocolCounts.hasOwnProperty(proto)) {
        protocolCounts[proto]++;
      } else {
        protocolCounts.Other++;
      }

      if (alert.severity === 1) severityCounts.high++;
      else if (alert.severity === 2) severityCounts.medium++;
      else severityCounts.low++;
    });

    const total = alerts.length || 1;
    return [
      { subject: 'TCP', A: Math.round((protocolCounts.TCP / total) * 100), fullMark: 100 },
      { subject: 'UDP', A: Math.round((protocolCounts.UDP / total) * 100), fullMark: 100 },
      { subject: 'ICMP', A: Math.round((protocolCounts.ICMP / total) * 100), fullMark: 100 },
      { subject: 'High Sev', A: Math.round((severityCounts.high / total) * 100), fullMark: 100 },
      { subject: 'Med Sev', A: Math.round((severityCounts.medium / total) * 100), fullMark: 100 },
      { subject: 'Low Sev', A: Math.round((severityCounts.low / total) * 100), fullMark: 100 },
    ];
  }, [alerts]);

  // Detection Logs - use latest alerts
  const detectionLogs = useMemo(() => {
    return alerts.slice(0, 6).map((alert, idx) => ({
      id: alert.id || idx,
      time: new Date(alert.createdAt || alert.timestamp).toLocaleTimeString(),
      type: alert.signature?.slice(0, 25) || 'Unknown',
      source: `${alert.src_ip}:${alert.src_port}`,
      confidence: alert.severity === 1 ? '95%' : alert.severity === 2 ? '75%' : '50%',
      status: alert.severity === 1 ? 'Blocked' : alert.severity === 2 ? 'Flagged' : 'Analyzed'
    }));
  }, [alerts]);

  // System Resource Matrix - mock based on alert count
  const systemNodes = useMemo(() => {
    const highSeverityCount = alerts.filter(a => a.severity === 1).length;
    return [...Array(8)].map((_, i) => ({
      id: i,
      isAlert: i === 3 && highSeverityCount > 0,
      cpuLoad: Math.min(90, 30 + (alerts.length * 2) + (i * 5)),
      memLoad: Math.min(85, 40 + (highSeverityCount * 10) + (i * 3))
    }));
  }, [alerts]);

  const getSeverityColor = (status) => {
    switch (status) {
      case 'Blocked': return 'bg-red-500/10 text-red-500 border border-red-500/20';
      case 'Flagged': return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
      default: return 'bg-green-500/10 text-green-500 border border-green-500/20';
    }
  };

  return (
    <div className="flex-1 bg-background-dark p-8 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gradient">Anomaly Detection</h1>
          <p className="text-text-secondary mt-1">AI-Driven Behavioral Analysis & Threat Prediction</p>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={() => { setLive(!live); if (!live) fetchAlerts(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              live 
                ? 'bg-card-dark border-green-500/50 text-green-500' 
                : 'bg-card-dark border-gray-700 text-gray-500'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${live ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="text-sm font-medium">{live ? 'AI Engine Online' : 'Paused'}</span>
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-card-dark rounded-lg border border-gray-800">
            <span className="text-text-secondary text-sm">Total Alerts:</span>
            <span className="text-primary font-bold">{alertCount}</span>
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Network Behavior Graph */}
        <div className="col-span-12 lg:col-span-8 bg-card-dark rounded-xl border border-gray-800 p-6 shadow-lg backdrop-blur-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
              <Activity className="size-5 text-primary" />
              Network Behavior Analysis
            </h2>
            <span className="text-text-secondary text-sm">Last 8 hours</span>
          </div>
          <div className="h-[300px] w-full">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <LoaderCircle className="animate-spin text-primary" size={48} />
              </div>
            ) : networkBehaviorData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={networkBehaviorData}>
                  <defs>
                    <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAnomaly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                  />
                  <Area type="monotone" dataKey="normal" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorNormal)" name="Normal Traffic" />
                  <Area type="monotone" dataKey="anomaly" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorAnomaly)" name="Anomalies" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Inbox size={48} />
                <p className="mt-2">No data available</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Threat Prediction */}
        <div className="col-span-12 lg:col-span-4 bg-card-dark rounded-xl border border-gray-800 p-6 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -z-10"></div>
          
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2 mb-4">
            <Brain className="size-5 text-purple-500" />
            Threat Distribution
          </h2>
          <div className="h-[300px] w-full flex items-center justify-center">
            {loading ? (
              <LoaderCircle className="animate-spin text-purple-500" size={48} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={threatPredictionData}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Threat %" dataKey="A" stroke="#8b5cf6" strokeWidth={2} fill="#8b5cf6" fillOpacity={0.4} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="text-center">
            <p className="text-text-secondary text-sm">
              Based on <span className="text-purple-400 font-bold">{alerts.length}</span> recent alerts
            </p>
          </div>
        </div>

        {/* System Resource Matrix */}
        <div className="col-span-12 lg:col-span-6 bg-card-dark rounded-xl border border-gray-800 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2 mb-6">
            <Cpu className="size-5 text-cyan-400" />
            System Resource Matrix
          </h2>
          <div className="grid grid-cols-4 gap-4 h-[200px]">
            {systemNodes.map((node) => (
              <div key={node.id} className="bg-background-dark rounded-lg p-3 border border-gray-700 hover:border-cyan-500/50 transition-colors group cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <div className={`w-2 h-2 rounded-full ${node.isAlert ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                  <span className="text-xs text-text-secondary">Node-{node.id + 1}</span>
                </div>
                <div className="space-y-2">
                  <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${node.isAlert ? 'bg-red-500' : 'bg-cyan-500'}`}
                      style={{ width: `${node.cpuLoad}%` }}
                    ></div>
                  </div>
                  <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${node.memLoad}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detection Logs */}
        <div className="col-span-12 lg:col-span-6 bg-card-dark rounded-xl border border-gray-800 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2 mb-4">
            <Database className="size-5 text-yellow-500" />
            Live Detection Feed
          </h2>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <LoaderCircle className="animate-spin text-yellow-500" size={48} />
              </div>
            ) : detectionLogs.length > 0 ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-text-secondary text-sm border-b border-gray-800">
                    <th className="pb-3 font-medium">Time</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Source</th>
                    <th className="pb-3 font-medium">Confidence</th>
                    <th className="pb-3 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {detectionLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-800 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="py-3 text-text-secondary font-mono">{log.time}</td>
                      <td className="py-3 text-text-main font-medium">
                        <span className={`flex items-center gap-1 ${log.status === 'Blocked' ? 'text-red-400' : 'text-text-main'}`}>
                          {log.status === 'Blocked' && <AlertTriangle size={12} />}
                          {log.type}...
                        </span>
                      </td>
                      <td className="py-3 text-cyan-400">{log.source}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-800 h-1 rounded-full overflow-hidden">
                            <div style={{ width: log.confidence }} className="h-full bg-blue-500"></div>
                          </div>
                          <span className="text-xs text-text-secondary">{log.confidence}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(log.status)}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                <Inbox size={36} />
                <p className="mt-2">No alerts to display</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AnomalyDetection;
