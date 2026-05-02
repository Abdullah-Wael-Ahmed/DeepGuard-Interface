import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { MonitorSmartphone, Search, Terminal, X } from 'lucide-react';
import { SkeletonTableRow } from '../components/ui/Skeleton';

const Endpoints = () => {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState(null);
    
    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);
    const [artifactName, setArtifactName] = useState('Generic.Client.Info');
    
    // Collections panel states
    const [collections, setCollections] = useState([]);
    const [loadingCollections, setLoadingCollections] = useState(false);
    const [viewingClient, setViewingClient] = useState(null);

    const fetchStatus = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACK}/api/velociraptor/status`, {
                withCredentials: true
            });
            setStatus(res.data.status);
        } catch (error) {
            setStatus('Offline');
        }
    };

    const fetchClients = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${import.meta.env.VITE_BACK}/api/velociraptor/clients`, {
                withCredentials: true
            });
            setClients(res.data.Items || []);
        } catch (error) {
            console.error('Error fetching clients:', error);
            toast.error('Failed to load endpoints');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchClients();
    }, []);

    const handleRunHunt = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${import.meta.env.VITE_BACK}/api/velociraptor/hunt`, {
                artifact: artifactName,
                clientId: selectedClient.client_id
            }, {
                withCredentials: true
            });
            toast.success(`Hunt started on ${selectedClient.os_info?.hostname || selectedClient.client_id}`);
            setShowModal(false);
        } catch (error) {
            console.error('Error triggering hunt:', error);
            toast.error('Failed to trigger hunt');
        }
    };

    const viewCollections = async (client) => {
        setViewingClient(client);
        setLoadingCollections(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACK}/api/velociraptor/clients/${client.client_id}/collections`, {
                withCredentials: true
            });
            setCollections(res.data.Items || []);
        } catch (error) {
            console.error('Error fetching collections:', error);
            toast.error('Failed to load collections');
        } finally {
            setLoadingCollections(false);
        }
    };

    return (
        <div className="flex min-h-screen font-display">
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="flex flex-col gap-8 max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-wrap justify-between items-center gap-4 animate-fade-in">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-4xl font-bold tracking-tight text-gradient">Endpoints</h1>
                            <p className="text-text-secondary text-base">
                                Endpoint Detection and Response via Velociraptor
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-4 py-2 bg-card-dark rounded-lg border border-gray-700">
                                <div className={`w-2 h-2 rounded-full animate-pulse ${status === 'Online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className={`${status === 'Online' ? 'text-green-500' : 'text-red-500'} text-sm font-medium`}>
                                    Server {status || 'Checking...'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Table section */}
                        <div className="lg:col-span-2 rounded-xl bg-card-dark border border-gray-700 overflow-hidden card-lift animate-fade-in">
                            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-medium text-text-main">Enrolled Agents</h2>
                                    <p className="text-text-secondary text-sm">Active and offline endpoints</p>
                                </div>
                                <button onClick={fetchClients} className="text-primary hover:underline text-sm font-medium">
                                    Refresh List
                                </button>
                            </div>
                            {loading ? (
                                <table className="w-full">
                                    <tbody>
                                        {[...Array(5)].map((_, i) => <SkeletonTableRow key={i} columns={5} />)}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-700 bg-background-dark/30">
                                            <th className="p-4 text-sm font-medium text-text-secondary">Hostname</th>
                                            <th className="p-4 text-sm font-medium text-text-secondary">Client ID</th>
                                            <th className="p-4 text-sm font-medium text-text-secondary">OS</th>
                                            <th className="p-4 text-sm font-medium text-text-secondary">Status</th>
                                            <th className="p-4 text-sm font-medium text-text-secondary">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="stagger-children">
                                        {clients.length > 0 ? (
                                            clients.map((client, idx) => {
                                                const lastSeen = client.last_seen_at / 1000; // Convert if it's in micro/nanoseconds depending on VR API
                                                const isOnline = (Date.now() / 1000) - lastSeen < 600; // Online if seen in last 10 mins
                                                return (
                                                    <tr key={idx} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                                                        <td className="p-4 text-sm font-medium text-text-main flex items-center gap-2">
                                                            <MonitorSmartphone size={16} className="text-primary" />
                                                            {client.os_info?.hostname || 'Unknown'}
                                                        </td>
                                                        <td className="p-4 text-sm font-mono text-text-secondary">{client.client_id}</td>
                                                        <td className="p-4 text-sm text-text-secondary">{client.os_info?.system || 'Unknown'}</td>
                                                        <td className="p-4">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${isOnline ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-gray-500/10 border-gray-500/20 text-gray-400'}`}>
                                                                {isOnline ? 'Online' : 'Offline'}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 flex items-center gap-3 text-sm">
                                                            <button onClick={() => viewCollections(client)} className="text-text-main hover:text-primary transition-colors">
                                                                View
                                                            </button>
                                                            <button 
                                                                onClick={() => { setSelectedClient(client); setShowModal(true); }}
                                                                className="text-primary hover:text-primary/80 transition-colors font-medium flex items-center gap-1"
                                                            >
                                                                <Terminal size={14} /> Run Hunt
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-text-secondary">
                                                    No agents found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Collections Side Panel */}
                        <div className="rounded-xl bg-card-dark border border-gray-700 overflow-hidden card-lift animate-fade-in flex flex-col max-h-[600px]">
                            <div className="p-6 border-b border-gray-700">
                                <h2 className="text-lg font-medium text-text-main">Recent Collections</h2>
                                <p className="text-text-secondary text-sm">
                                    {viewingClient ? `For ${viewingClient.os_info?.hostname || viewingClient.client_id}` : 'Select an endpoint to view'}
                                </p>
                            </div>
                            <div className="p-4 flex-1 overflow-y-auto">
                                {!viewingClient ? (
                                    <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-3 opacity-50">
                                        <Search size={32} />
                                        <p>No endpoint selected</p>
                                    </div>
                                ) : loadingCollections ? (
                                    <div className="animate-pulse flex flex-col gap-3">
                                        {[...Array(4)].map((_, i) => (
                                            <div key={i} className="h-16 bg-gray-800 rounded-lg w-full"></div>
                                        ))}
                                    </div>
                                ) : collections.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {collections.map((col, i) => (
                                            <div key={i} className="p-3 bg-background-dark/50 rounded-lg border border-gray-800">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-sm font-medium text-primary">{col.artifact}</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded border ${col.state === 'FINISHED' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                                                        {col.state}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-text-secondary">Flow ID: {col.urn}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-text-secondary mt-10">No collections found.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Run Hunt Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-card-dark border border-gray-700 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-4 flex justify-between items-center border-b border-gray-800">
                            <h3 className="text-lg font-medium text-text-main flex items-center gap-2">
                                <Terminal size={18} className="text-primary" /> Run Artifact Hunt
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-text-secondary hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleRunHunt} className="p-6 flex flex-col gap-4">
                            <div>
                                <p className="text-sm text-text-secondary mb-1">Target Endpoint:</p>
                                <p className="font-mono text-sm bg-background-dark p-2 rounded text-text-main border border-gray-800">
                                    {selectedClient?.os_info?.hostname} ({selectedClient?.client_id})
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-1">Artifact Name</label>
                                <input 
                                    type="text" 
                                    value={artifactName}
                                    onChange={(e) => setArtifactName(e.target.value)}
                                    className="w-full bg-background-dark border border-gray-700 text-text-main text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5"
                                    placeholder="Generic.Client.Info"
                                    required
                                />
                            </div>
                            <div className="mt-4 flex justify-end gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors shadow-glow-primary"
                                >
                                    Launch Hunt
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Endpoints;
