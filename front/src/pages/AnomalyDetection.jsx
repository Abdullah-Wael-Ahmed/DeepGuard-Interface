import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ReferenceLine
} from 'recharts';
import {
  AlertTriangle, Activity, Brain, Shield, ShieldCheck, ShieldAlert,
  LoaderCircle, Inbox, RefreshCw, Clock, Eye
} from 'lucide-react';
import axios from 'axios';

const SEVERITY_COLORS = {
  HIGH: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', fill: '#ef4444' },
  MEDIUM: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30', fill: '#eab308' },
  LOW: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30', fill: '#22c55e' },
};

const POLL_INTERVAL = 15_000; // 15 seconds

// ─── Custom Tooltip ──────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-gray-400 mb-1 font-mono text-xs">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-text-main">
          <span style={{ color: p.color }} className="font-medium">{p.name}: </span>
          {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Stat Card ───────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <div className="bg-card-dark rounded-xl border border-gray-800 p-5 shadow-lg hover:border-gray-700 transition-colors card-lift">
    <div className="flex items-center justify-between mb-3">
      <span className="text-text-secondary text-sm font-medium">{label}</span>
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={18} />
      </div>
    </div>
    <p className="text-3xl font-bold text-text-main tabular-nums">{value}</p>
    {sub && <p className="text-text-secondary text-xs mt-1">{sub}</p>}
  </div>
);

const AnomalyDetection = () => {
  const [stats, setStats] = useState(null);
  const [results, setResults] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  // ─── Data fetching ───────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, resultsRes, healthRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_BACK}/anomaly/stats`, { withCredentials: true }),
        axios.get(`${import.meta.env.VITE_BACK}/anomaly/results`, { withCredentials: true }),
        axios.get(`${import.meta.env.VITE_BACK}/anomaly/health`, { withCredentials: true }),
      ]);
      setStats(statsRes.data);
      setResults(resultsRes.data.results || []);
      setHealth(healthRes.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching anomaly data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial + polling
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [live, fetchAll]);

  // ─── Derived chart data ──────────────────────────────

  // Timeline: use last 20 results, show score vs threshold
  const timelineData = useMemo(() => {
    if (!results.length) return [];
    return [...results]
      .reverse()
      .slice(-20)
      .map((r) => ({
        time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        normal: r.is_anomaly ? 0 : r.anomaly_score,
        anomaly: r.is_anomaly ? r.anomaly_score : 0,
        score: r.anomaly_score,
        isAnomaly: r.is_anomaly,
        severity: r.severity,
        src_ip: r.src_ip,
      }));
  }, [results]);

  // Severity pie
  const severityPieData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'HIGH', value: stats.high_severity || 0 },
      { name: 'MEDIUM', value: stats.medium_severity || 0 },
      { name: 'Normal', value: stats.normal_events || 0 },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const pieCellColors = ['#ef4444', '#eab308', '#22c55e'];

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="flex-1 bg-background-dark p-8 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gradient">Anomaly Detection</h1>
          <p className="text-text-secondary mt-1">Window-Based Behavioral Analysis &mdash; Autoencoder Engine</p>
        </div>

        <div className="flex gap-3 items-center">
          {/* Live toggle */}
          <button
            onClick={() => { setLive(!live); if (!live) fetchAll(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors cursor-pointer ${live
              ? 'bg-card-dark border-green-500/50 text-green-400'
              : 'bg-card-dark border-gray-700 text-gray-500'
              }`}
          >
            <div className={`w-2 h-2 rounded-full ${live ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-sm font-medium">{live ? 'Live' : 'Paused'}</span>
          </button>

          {/* Refresh */}
          <button
            onClick={fetchAll}
            className="p-2 bg-card-dark border border-gray-700 rounded-lg text-text-secondary hover:text-primary transition-colors cursor-pointer"
            title="Refresh now"
          >
            <RefreshCw size={16} />
          </button>

          {/* Last refresh */}
          {lastRefresh && (
            <div className="flex items-center gap-1.5 text-text-secondary text-xs">
              <Clock size={12} />
              {lastRefresh.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <LoaderCircle className="animate-spin text-primary" size={48} />
        </div>
      ) : (
        <>
          {/* ─── Stat Cards ─────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6 stagger-children">
            <StatCard
              icon={Eye}
              label="Windows Analyzed"
              value={stats?.total_events ?? 0}
              color="bg-blue-500/10 text-blue-400"
              sub="Total behavioral windows scored"
            />
            <StatCard
              icon={ShieldAlert}
              label="Anomalies Detected"
              value={stats?.total_anomalies ?? 0}
              color="bg-red-500/10 text-red-400"
              sub={stats?.total_events
                ? `${((stats.total_anomalies / stats.total_events) * 100).toFixed(1)}% anomaly rate`
                : '—'}
            />
            <StatCard
              icon={AlertTriangle}
              label="High Severity"
              value={stats?.high_severity ?? 0}
              color="bg-orange-500/10 text-orange-400"
              sub="Critical behavioral anomalies"
            />
            <StatCard
              icon={ShieldCheck}
              label="Normal Windows"
              value={stats?.normal_events ?? 0}
              color="bg-green-500/10 text-green-400"
              sub="Below reconstruction threshold"
            />
          </div>

          {/* ─── Charts Row ─────────────────────────────── */}
          <div className="grid grid-cols-12 gap-6 mb-6">
            {/* Anomaly Timeline */}
            <div className="col-span-12 lg:col-span-8 bg-card-dark rounded-xl border border-gray-800 p-6 shadow-lg">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
                  <Activity className="size-5 text-primary" />
                  Anomaly Score Timeline
                </h2>
                <span className="text-text-secondary text-xs">
                  Threshold: <span className="text-primary font-mono font-bold">{health?.threshold?.toFixed(4) ?? '—'}</span>
                </span>
              </div>
              <div className="h-[300px] w-full">
                {timelineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData}>
                      <defs>
                        <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorAnomaly" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      {health?.threshold && (
                        <ReferenceLine
                          y={health.threshold}
                          stroke="#64FFDA"
                          strokeDasharray="6 4"
                          strokeWidth={2}
                          label={{ value: 'Threshold', fill: '#64FFDA', fontSize: 11, position: 'right' }}
                        />
                      )}
                      <Area type="monotone" dataKey="normal" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorNormal)" name="Normal Score" />
                      <Area type="monotone" dataKey="anomaly" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorAnomaly)" name="Anomaly Score" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Inbox size={48} />
                    <p className="mt-2">No scored windows yet</p>
                    <p className="text-xs mt-1">Windows flush every {health?.window_seconds ?? 30}s</p>
                  </div>
                )}
              </div>
            </div>

            {/* Severity Distribution */}
            <div className="col-span-12 lg:col-span-4 bg-card-dark rounded-xl border border-gray-800 p-6 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -z-10" />
              <h2 className="text-xl font-bold text-text-main flex items-center gap-2 mb-4">
                <Brain className="size-5 text-purple-500" />
                Severity Distribution
              </h2>
              <div className="h-[280px] w-full flex items-center justify-center">
                {severityPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={severityPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={4}
                        strokeWidth={0}
                      >
                        {severityPieData.map((entry, i) => (
                          <Cell key={i} fill={pieCellColors[i % pieCellColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          fontSize: '13px',
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    <Shield size={40} />
                    <p className="mt-2 text-sm">No data yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─── Detection Results Table ────────────────── */}
          <div className="bg-card-dark rounded-xl border border-gray-800 p-6 shadow-lg">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
                <Shield className="size-5 text-yellow-500" />
                Detection Results
              </h2>
              <span className="text-text-secondary text-sm">{results.length} recent windows</span>
            </div>
            <div className="overflow-x-auto">
              {results.length > 0 ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-text-secondary text-sm border-b border-gray-800">
                      <th className="pb-3 font-medium">Time</th>
                      <th className="pb-3 font-medium">Source IP</th>
                      <th className="pb-3 font-medium">Port</th>
                      <th className="pb-3 font-medium">Score</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium text-right">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {results.map((r, idx) => {
                      const sev = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.LOW;
                      return (
                        <tr key={idx} className="border-b border-gray-800/50 last:border-0 hover:bg-white/5 transition-colors">
                          <td className="py-3 text-text-secondary font-mono text-xs">
                            {new Date(r.timestamp).toLocaleString([], {
                              month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit', second: '2-digit'
                            })}
                          </td>
                          <td className="py-3 text-cyan-400 font-mono">{r.src_ip}</td>
                          <td className="py-3 text-text-main tabular-nums">{r.dest_port}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${r.is_anomaly ? 'bg-red-500' : 'bg-blue-500'}`}
                                  style={{ width: `${Math.min(100, (r.anomaly_score / (health?.threshold || 0.1)) * 50)}%` }}
                                />
                              </div>
                              <span className="text-text-secondary font-mono text-xs">{r.anomaly_score?.toFixed(4)}</span>
                            </div>
                          </td>
                          <td className="py-3">
                            {r.is_anomaly ? (
                              <span className="flex items-center gap-1 text-red-400 font-medium">
                                <AlertTriangle size={13} /> Anomaly
                              </span>
                            ) : (
                              <span className="text-green-400">Normal</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${sev.bg} ${sev.text} ${sev.border}`}>
                              {r.severity}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                  <Inbox size={36} />
                  <p className="mt-2">No detection results yet</p>
                  <p className="text-xs mt-1 text-gray-600">Results appear after windows are scored</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnomalyDetection;
