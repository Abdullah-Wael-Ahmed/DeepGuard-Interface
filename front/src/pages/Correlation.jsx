import React, { useState, useEffect, useMemo } from 'react';
import { Network, GitBranch, AlertOctagon, ArrowRight, Layers, LoaderCircle, Inbox, RefreshCw } from 'lucide-react';
import axios from 'axios';
import useWebSocket from 'react-use-websocket';

const Correlation = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch alerts from backend
  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${import.meta.env.VITE_BACK}/logs`, {
        withCredentials: true,
        params: { page: 1 }
      });
      setAlerts(res.data.alerts || []);
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
        setAlerts((prev) => [message.data, ...prev.slice(0, 49)]);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, [lastMessage]);

  // Build correlation rules dynamically from alerts
  const correlationRules = useMemo(() => {
    if (!alerts.length) return [];

    // Group alerts by source IP to detect patterns
    const sourceGroups = {};
    alerts.forEach(alert => {
      const srcIp = alert.src_ip;
      if (!sourceGroups[srcIp]) {
        sourceGroups[srcIp] = [];
      }
      sourceGroups[srcIp].push(alert);
    });

    // Find IPs with multiple alerts (potential attack patterns)
    const rules = [];
    
    // Rule 1: Multiple alerts from same source
    const multiAlertSources = Object.entries(sourceGroups)
      .filter(([ip, alerts]) => alerts.length >= 2)
      .slice(0, 3);
    
    if (multiAlertSources.length > 0) {
      rules.push({
        name: 'Repeated Source Activity',
        status: 'Active',
        matches: multiAlertSources.reduce((acc, [_, alerts]) => acc + alerts.length, 0),
        description: `${multiAlertSources.length} IPs with multiple alerts`
      });
    }

    // Rule 2: High severity alerts correlation
    const highSeverityAlerts = alerts.filter(a => a.severity === 1);
    if (highSeverityAlerts.length > 0) {
      rules.push({
        name: 'Critical Threat Chain',
        status: 'Active',
        matches: highSeverityAlerts.length,
        description: 'High severity events detected'
      });
    }

    // Rule 3: Port scanning detection (multiple destination ports from same source)
    const portScanSuspects = Object.entries(sourceGroups)
      .filter(([ip, alerts]) => {
        const uniquePorts = new Set(alerts.map(a => a.dest_port));
        return uniquePorts.size >= 3;
      });
    
    if (portScanSuspects.length > 0) {
      rules.push({
        name: 'Port Scan Detection',
        status: 'Active',
        matches: portScanSuspects.length,
        description: 'Possible port scanning activity'
      });
    }

    // Rule 4: Protocol distribution anomaly
    const protocolCounts = {};
    alerts.forEach(a => {
      const proto = a.protocol || 'Unknown';
      protocolCounts[proto] = (protocolCounts[proto] || 0) + 1;
    });
    
    rules.push({
      name: 'Protocol Distribution Monitor',
      status: 'Monitoring',
      matches: Object.keys(protocolCounts).length,
      description: `Tracking ${Object.keys(protocolCounts).join(', ')}`
    });

    return rules;
  }, [alerts]);

  // Get the most critical incident for visualization
  const criticalIncident = useMemo(() => {
    if (!alerts.length) return null;

    // Find high severity alert with most context
    const highSeverity = alerts.filter(a => a.severity === 1 || a.severity === 2);
    if (highSeverity.length === 0) return alerts[0];
    
    return highSeverity[0];
  }, [alerts]);

  // Find related alerts for the critical incident
  const relatedAlerts = useMemo(() => {
    if (!criticalIncident) return [];
    return alerts
      .filter(a => a.id !== criticalIncident.id && 
        (a.src_ip === criticalIncident.src_ip || a.dest_ip === criticalIncident.dest_ip))
      .slice(0, 3);
  }, [criticalIncident, alerts]);

  return (
    <div className="flex-1 bg-background-dark p-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gradient">Event Correlation</h1>
          <p className="text-text-secondary mt-1">Cross-referencing events to identify complex attack patterns</p>
        </div>
        <button 
          onClick={fetchAlerts}
          className="flex items-center gap-2 px-4 py-2 bg-card-dark border border-gray-700 rounded-lg hover:border-primary transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span className="text-sm">Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Correlation Rules */}
        <div className="bg-card-dark rounded-xl border border-gray-800 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2 mb-4">
            <Layers className="size-5 text-primary" />
            Active Correlation Rules
          </h2>
          
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <LoaderCircle className="animate-spin text-primary" size={48} />
            </div>
          ) : correlationRules.length > 0 ? (
            <div className="space-y-4">
              {correlationRules.map((rule, idx) => (
                <div key={idx} className="bg-background-dark p-4 rounded-lg border border-gray-700 flex justify-between items-center hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/20 p-2 rounded-md">
                      <GitBranch className="text-primary" size={18} />
                    </div>
                    <div>
                      <h3 className="text-text-main font-medium text-sm">{rule.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${rule.status === 'Active' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                        <span className="text-xs text-text-secondary">{rule.status}</span>
                        <span className="text-xs text-gray-600">•</span>
                        <span className="text-xs text-text-secondary">{rule.description}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-xl font-bold text-white">{rule.matches}</span>
                    <span className="text-xs text-text-secondary">Related Events</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <Inbox size={48} />
              <p className="mt-2">No correlation data available</p>
            </div>
          )}
        </div>

        {/* Visual Correlation Flow */}
        <div className="bg-card-dark rounded-xl border border-gray-800 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2 mb-4">
            <Network className="size-5 text-purple-500" />
            Incident Reconstruction
            {criticalIncident && (
              <span className="text-xs text-gray-500 font-normal ml-2">(ID: #{criticalIncident.id})</span>
            )}
          </h2>
          
          {loading ? (
            <div className="flex items-center justify-center h-[300px]">
              <LoaderCircle className="animate-spin text-purple-500" size={48} />
            </div>
          ) : criticalIncident ? (
            <div className="relative h-[300px] bg-background-dark rounded-lg border border-gray-700 p-4 flex flex-col justify-center items-center">
              {/* Node visualization */}
              <div className="flex items-center gap-4 mb-8">
                <div className="flex flex-col items-center">
                  <div className={`w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center border-2 font-mono text-xs
                    ${criticalIncident.severity === 1 ? 'border-red-500 text-red-500' : 
                      criticalIncident.severity === 2 ? 'border-yellow-500 text-yellow-500' : 
                      'border-blue-500 text-blue-500'}`}>
                    SRC
                  </div>
                  <span className="text-xs text-gray-400 mt-2 font-mono">{criticalIncident.src_ip}</span>
                  <span className="text-xs text-gray-600">:{criticalIncident.src_port}</span>
                </div>
                
                <div className="flex flex-col items-center">
                  <ArrowRight className="text-gray-600" size={24} />
                  <span className={`text-xs mt-1 px-2 py-0.5 rounded ${
                    criticalIncident.protocol === 'TCP' ? 'bg-blue-500/20 text-blue-400' :
                    criticalIncident.protocol === 'UDP' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>{criticalIncident.protocol || 'N/A'}</span>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center border-2 border-cyan-500 text-cyan-400 font-mono text-xs">
                    DST
                  </div>
                  <span className="text-xs text-gray-400 mt-2 font-mono">{criticalIncident.dest_ip}</span>
                  <span className="text-xs text-gray-600">:{criticalIncident.dest_port}</span>
                </div>
              </div>
              
              {/* Alert details */}
              <div className={`p-3 rounded-md w-full max-w-md ${
                criticalIncident.severity === 1 ? 'bg-red-500/10 border border-red-500/30' :
                criticalIncident.severity === 2 ? 'bg-yellow-500/10 border border-yellow-500/30' :
                'bg-blue-500/10 border border-blue-500/30'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertOctagon className={`mt-0.5 ${
                    criticalIncident.severity === 1 ? 'text-red-500' :
                    criticalIncident.severity === 2 ? 'text-yellow-500' :
                    'text-blue-500'
                  }`} size={16} />
                  <div>
                    <p className={`text-sm font-bold ${
                      criticalIncident.severity === 1 ? 'text-red-400' :
                      criticalIncident.severity === 2 ? 'text-yellow-400' :
                      'text-blue-400'
                    }`}>
                      {criticalIncident.severity === 1 ? 'Critical' : criticalIncident.severity === 2 ? 'Warning' : 'Info'} Pattern Detected
                    </p>
                    <p className="text-gray-400 text-xs mt-1">{criticalIncident.signature || 'Unknown signature'}</p>
                    <p className="text-gray-600 text-xs mt-1">
                      {new Date(criticalIncident.createdAt || criticalIncident.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Related alerts indicator */}
              {relatedAlerts.length > 0 && (
                <div className="mt-4 text-xs text-gray-500">
                  <span className="text-primary font-medium">{relatedAlerts.length}</span> related events from this source/destination
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
              <Network size={48} />
              <p className="mt-2">No incidents to reconstruct</p>
            </div>
          )}
        </div>

        {/* Recent Correlated Events Timeline */}
        <div className="col-span-1 lg:col-span-2 bg-card-dark rounded-xl border border-gray-800 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-text-main mb-4">Recent Correlated Events</h2>
          
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <LoaderCircle className="animate-spin text-primary" size={36} />
            </div>
          ) : alerts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-text-secondary border-b border-gray-800">
                    <th className="pb-3 font-medium">Time</th>
                    <th className="pb-3 font-medium">Source</th>
                    <th className="pb-3 font-medium">Destination</th>
                    <th className="pb-3 font-medium">Protocol</th>
                    <th className="pb-3 font-medium">Signature</th>
                    <th className="pb-3 font-medium text-right">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {alerts.slice(0, 5).map((alert) => (
                    <tr key={alert.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 text-text-secondary font-mono text-xs">
                        {new Date(alert.createdAt || alert.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 text-cyan-400 font-mono text-xs">{alert.src_ip}:{alert.src_port}</td>
                      <td className="py-3 text-purple-400 font-mono text-xs">{alert.dest_ip}:{alert.dest_port}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          alert.protocol === 'TCP' ? 'bg-blue-500/20 text-blue-400' :
                          alert.protocol === 'UDP' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>{alert.protocol}</span>
                      </td>
                      <td className="py-3 text-text-main text-xs max-w-xs truncate">{alert.signature}</td>
                      <td className="py-3 text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          alert.severity === 1 ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                          alert.severity === 2 ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                          'bg-green-500/10 text-green-500 border border-green-500/20'
                        }`}>
                          {alert.severity === 1 ? 'High' : alert.severity === 2 ? 'Medium' : 'Low'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Inbox size={36} />
              <p className="mt-2">No events to display</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Correlation;
