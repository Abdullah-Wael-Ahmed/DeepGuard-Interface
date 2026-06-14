import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Calendar, Shield, AlertCircle, HardDrive, BrainCircuit, Search } from 'lucide-react';
import ExecutiveSummary from '../components/reports/ExecutiveSummary';
import EndpointFleetHealth from '../components/reports/EndpointFleetHealth';
import IncidentPostMortem from '../components/reports/IncidentPostMortem';
import DeepGuardAiAnomalies from '../components/reports/DeepGuardAiAnomalies';
import { exportReportToCSV } from '../services/exportService';

const Reports = () => {
    const [activeTemplate, setActiveTemplate] = useState('executive');
    const [timeRange, setTimeRange] = useState(24);
    const [targetIp, setTargetIp] = useState('');
    const [submittedIp, setSubmittedIp] = useState('');
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);

    const templates = [
        { id: 'executive', name: 'Executive Summary', icon: <Shield size={18} /> },
        { id: 'postmortem', name: 'Incident Post-Mortem', icon: <AlertCircle size={18} /> },
        { id: 'endpoint', name: 'Endpoint Fleet Health', icon: <HardDrive size={18} /> },
        { id: 'ai', name: 'DeepGuard AI Anomalies', icon: <BrainCircuit size={18} /> }
    ];

    useEffect(() => {
        const fetchReportData = async () => {
            setLoading(true);
            setReportData(null); // Clear old data to prevent component crashes
            try {
                if (activeTemplate === 'executive') {
                    const res = await axios.get(`${import.meta.env.VITE_BACK}/reports/executive?hours=${timeRange}`, {
                        withCredentials: true
                    });
                    setReportData(res.data);
                } else if (activeTemplate === 'endpoint') {
                    const res = await axios.get(`${import.meta.env.VITE_BACK}/reports/endpoint-health?hours=${timeRange}`, {
                        withCredentials: true
                    });
                    setReportData(res.data);
                } else if (activeTemplate === 'postmortem') {
                    const res = await axios.post(`${import.meta.env.VITE_BACK}/reports/postmortem`, { 
                        hours: timeRange,
                        ip: submittedIp || null
                    }, {
                        withCredentials: true
                    });
                    setReportData(res.data);
                    if (res.data && res.data.targetIp) {
                        setTargetIp(res.data.targetIp);
                    }
                } else if (activeTemplate === 'ai') {
                    const res = await axios.get(`${import.meta.env.VITE_BACK}/reports/ai-anomalies?hours=${timeRange}`, {
                        withCredentials: true
                    });
                    setReportData(res.data);
                } else {
                    setReportData(null);
                }
            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchReportData();
    }, [activeTemplate, timeRange, submittedIp]);

    const handleExportPDF = () => {
        const queryParams = new URLSearchParams({
            template: activeTemplate,
            hours: timeRange
        });
        
        if (activeTemplate === 'postmortem' && submittedIp) {
            queryParams.append('ip', submittedIp);
        }

        // Trigger the backend PDF generation
        const exportUrl = `${import.meta.env.VITE_BACK}/reports/export/pdf?${queryParams.toString()}`;
        window.open(exportUrl, '_blank');
    };

    const handleExportCSV = () => {
        exportReportToCSV(activeTemplate, reportData);
    };

    const handleIpSearch = (e) => {
        e.preventDefault();
        setSubmittedIp(targetIp);
    };

    return (
        <main className="flex-1 p-8 font-display">
            <div className="max-w-7xl mx-auto flex flex-col gap-6">
                
                {/* Horizontal Template Selector Tabs */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-3xl font-bold text-text-main">Reports & Analytics</h2>
                    <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-px">
                        {templates.map(tpl => (
                            <button
                                key={tpl.id}
                                onClick={() => setActiveTemplate(tpl.id)}
                                className={`flex items-center gap-2 px-5 py-3 rounded-t-lg transition-all duration-300 border-b-2 font-medium text-sm ${
                                    activeTemplate === tpl.id 
                                    ? 'bg-primary/10 border-primary text-primary' 
                                    : 'border-transparent text-text-secondary hover:bg-white/5 hover:text-text-main'
                                }`}
                            >
                                {tpl.icon}
                                <span>{tpl.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col gap-6">
                    
                    {/* Header: Controls */}
                    <div className="flex flex-wrap justify-between items-center gap-4 bg-card-dark p-4 rounded-xl border border-gray-800">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Calendar className="text-gray-500" size={20} />
                                <select 
                                    value={timeRange} 
                                    onChange={(e) => setTimeRange(Number(e.target.value))}
                                    className="bg-transparent text-text-main text-sm font-medium focus:outline-none cursor-pointer"
                                >
                                    <option value={24} className="bg-card-dark">Last 24 Hours</option>
                                    <option value={168} className="bg-card-dark">Last 7 Days</option>
                                    <option value={720} className="bg-card-dark">Last 30 Days</option>
                                </select>
                            </div>

                            {/* Conditional Search Bar for Post-Mortem */}
                            {activeTemplate === 'postmortem' && (
                                <form onSubmit={handleIpSearch} className="flex items-center ml-4 pl-4 border-l border-gray-700">
                                    <div className="relative flex items-center">
                                        <Search className="absolute left-3 text-text-secondary" size={16} />
                                        <input 
                                            type="text" 
                                            value={targetIp}
                                            onChange={(e) => setTargetIp(e.target.value)}
                                            placeholder="Enter target IP (e.g., 10.0.0.5)"
                                            className="bg-background-dark border border-gray-700 text-text-main text-sm rounded-l-lg pl-9 pr-3 py-2 w-56 focus:outline-none focus:border-primary/50"
                                        />
                                    </div>
                                    <button 
                                        type="submit" 
                                        className="px-4 py-2 bg-primary/20 text-primary text-sm font-medium rounded-r-lg border border-primary/20 border-l-0 hover:bg-primary/30 transition-colors"
                                    >
                                        Generate
                                    </button>
                                </form>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={handleExportCSV}
                                className="flex items-center gap-2 px-4 py-2 bg-card-dark text-text-secondary text-sm font-medium rounded-lg border border-gray-700 hover:bg-white/5 transition-colors"
                            >
                                <Download size={16} />
                                Export CSV
                            </button>
                            <button 
                                onClick={handleExportPDF}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-background-dark text-sm font-bold rounded-lg hover:shadow-glow-primary transition-all"
                            >
                                <Download size={16} />
                                Export PDF
                            </button>
                        </div>
                    </div>

                    {/* Preview Pane */}
                    <div className="bg-background-dark p-8 rounded-xl border border-gray-800 shadow-xl min-h-[600px]">
                        {loading ? (
                            <div className="flex items-center justify-center h-full text-text-secondary">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
                                Generating Report...
                            </div>
                        ) : activeTemplate === 'executive' ? (
                            <ExecutiveSummary data={reportData} />
                        ) : activeTemplate === 'endpoint' ? (
                            <EndpointFleetHealth data={reportData} />
                        ) : activeTemplate === 'postmortem' ? (
                            <IncidentPostMortem data={reportData} />
                        ) : activeTemplate === 'ai' ? (
                            <DeepGuardAiAnomalies data={reportData} />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-text-secondary space-y-4">
                                <AlertCircle size={48} className="text-gray-600" />
                                <p className="text-lg">Template currently under development.</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </main>
    );
};

export default Reports;