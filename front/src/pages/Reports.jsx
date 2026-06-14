import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Calendar, Shield, AlertCircle, HardDrive, BrainCircuit } from 'lucide-react';
import ExecutiveSummary from '../components/reports/ExecutiveSummary';

const Reports = () => {
    const [activeTemplate, setActiveTemplate] = useState('executive');
    const [timeRange, setTimeRange] = useState(24);
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
            try {
                if (activeTemplate === 'executive') {
                    const res = await axios.get(`${import.meta.env.VITE_BACK}/reports/executive?hours=${timeRange}`, {
                        withCredentials: true
                    });
                    setReportData(res.data);
                } else {
                    // For now, clear data for templates that aren't implemented yet
                    setReportData(null);
                }
            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchReportData();
    }, [activeTemplate, timeRange]);

    const handleExportPDF = () => {
        // Placeholder for Step 4
        alert('PDF Export functionality will be connected to the backend generator soon.');
    };

    return (
        <main className="flex-1 p-8 font-display">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
                
                {/* Sidebar Template Selector */}
                <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-text-main mb-2">Report Templates</h2>
                    {templates.map(tpl => (
                        <button
                            key={tpl.id}
                            onClick={() => setActiveTemplate(tpl.id)}
                            className={`flex items-center gap-3 w-full p-3 rounded-lg text-left transition-all duration-300 border ${
                                activeTemplate === tpl.id 
                                ? 'bg-primary/20 border-primary text-primary shadow-glow-primary' 
                                : 'bg-card-dark border-gray-800 text-text-secondary hover:border-gray-600 hover:text-text-main'
                            }`}
                        >
                            {tpl.icon}
                            <span className="font-medium text-sm">{tpl.name}</span>
                        </button>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col gap-6">
                    
                    {/* Header: Controls */}
                    <div className="flex flex-wrap justify-between items-center gap-4 bg-card-dark p-4 rounded-xl border border-gray-800">
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
                        <div className="flex gap-3">
                            <button className="flex items-center gap-2 px-4 py-2 bg-card-dark text-text-secondary text-sm font-medium rounded-lg border border-gray-700 hover:bg-white/5 transition-colors">
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
