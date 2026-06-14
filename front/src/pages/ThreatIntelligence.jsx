import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
    Globe, 
    Shield, 
    AlertTriangle, 
    Search, 
    ExternalLink, 
    RefreshCw,
    Database,
    Zap,
    Target,
    Clock,
    CheckCircle,
    XCircle,
    Info,
    Plus,
    Loader,
    ChevronDown,
    ChevronUp,
    Link as LinkIcon,
    Server,
    Wifi,
    AlertCircle
} from 'lucide-react';
import threatIntelService from '../services/threatIntelService';

const ThreatIntelligence = () => {
    const [searchIP, setSearchIP] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [searching, setSearching] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expandedProviders, setExpandedProviders] = useState(false);
    
    // Real data states
    const [threatFeeds, setThreatFeeds] = useState([]);
    const [recentIOCs, setRecentIOCs] = useState([]);
    const [blockedIPs, setBlockedIPs] = useState([]);
    const [providers, setProviders] = useState([]);
    const [stats, setStats] = useState({
        totalIOCs: 0,
        blockedIPs: 0,
        activeFeeds: 0,
        configuredProviders: 0,
        lastUpdate: null
    });

    // Load all data on mount
    useEffect(() => {
        loadData();
        loadProviders();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [feedsData, iocsData, blockedData, statsData] = await Promise.all([
                threatIntelService.getFeeds().catch(() => []),
                threatIntelService.getIOCs({ limit: 10 }).catch(() => ({ iocs: [] })),
                threatIntelService.getBlockedIPs().catch(() => []),
                threatIntelService.getStats().catch(() => ({}))
            ]);
            
            setThreatFeeds(feedsData);
            setRecentIOCs(iocsData.iocs || []);
            setBlockedIPs(blockedData);
            setStats(statsData);
        } catch (error) {
            console.error('Error loading threat intel data:', error);
        }
        setLoading(false);
    };

    const loadProviders = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_BACK}/threat-intel/providers`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setProviders(data);
            }
        } catch (error) {
            console.error('Error loading providers:', error);
        }
    };

    // Real IP lookup with multi-provider
    const handleIPLookup = async () => {
        if (!searchIP.trim()) return;
        
        // Basic IP validation
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(searchIP)) {
            toast.error('Please enter a valid IP address');
            return;
        }
        
        setSearching(true);
        setSearchResult(null);
        
        try {
            const result = await threatIntelService.lookupIP(searchIP);
            setSearchResult(result);
            
            // Show toast based on result
            if (result.reputation === 'malicious') {
                toast.error(`Malicious IP detected! Score: ${result.aggregatedScore}/100`);
            } else if (result.reputation === 'suspicious') {
                toast.warning(`Suspicious IP. Score: ${result.aggregatedScore}/100`);
            } else {
                toast.success(`IP appears clean. Score: ${result.aggregatedScore}/100`);
            }
        } catch (error) {
            console.error('IP lookup error:', error);
            toast.error('Failed to lookup IP. Make sure the backend is running.');
        }
        
        setSearching(false);
    };

    // Block IP from lookup result
    const handleBlockFromLookup = async () => {
        if (!searchResult?.ip) return;
        
        try {
            await threatIntelService.blockIP(searchResult.ip, `Blocked from lookup - Score: ${searchResult.aggregatedScore}`);
            toast.success(`IP ${searchResult.ip} has been blocked`);
            setSearchResult({ ...searchResult, isBlocked: true });
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to block IP');
        }
    };

    // Unblock IP
    const handleUnblockIP = async (ip) => {
        try {
            await threatIntelService.unblockIP(ip);
            toast.success(`IP ${ip} has been unblocked`);
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to unblock IP');
        }
    };

    // Sync feed
    const handleSyncFeed = async (feedId) => {
        try {
            await threatIntelService.syncFeed(feedId);
            toast.success('Feed sync initiated');
            loadData();
        } catch (error) {
            toast.error('Failed to sync feed');
        }
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/30';
            case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
            case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
            case 'low': return 'text-green-400 bg-green-500/10 border-green-500/30';
            default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
        }
    };

    const getReputationColor = (reputation) => {
        switch (reputation) {
            case 'malicious': return 'text-red-400 bg-red-500/20 border-red-500';
            case 'suspicious': return 'text-orange-400 bg-orange-500/20 border-orange-500';
            case 'low_risk': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
            case 'clean': return 'text-green-400 bg-green-500/20 border-green-500';
            default: return 'text-gray-400 bg-gray-500/20 border-gray-500';
        }
    };

    const getScoreColor = (score) => {
        if (score >= 70) return 'text-red-400';
        if (score >= 40) return 'text-orange-400';
        if (score >= 20) return 'text-yellow-400';
        return 'text-green-400';
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Never';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
        return date.toLocaleDateString();
    };

    // Render provider details card
    const renderProviderCard = (providerKey, data) => {
        if (!data?.available) {
            return (
                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div className="flex items-center gap-2 text-gray-500">
                        <XCircle size={16} />
                        <span className="text-sm">{providerKey.toUpperCase()}: {data?.error || 'Not configured'}</span>
                    </div>
                </div>
            );
        }

        const providerConfigs = {
            abuseipdb: { icon: Shield, color: 'text-blue-400' },
            virustotal: { icon: Database, color: 'text-purple-400' },
            otx: { icon: Globe, color: 'text-cyan-400' },
            greynoise: { icon: Wifi, color: 'text-green-400' },
            shodan: { icon: Server, color: 'text-orange-400' },
            ipqualityscore: { icon: AlertCircle, color: 'text-yellow-400' }
        };

        const config = providerConfigs[providerKey] || { icon: Info, color: 'text-gray-400' };
        const Icon = config.icon;

        return (
            <div className="p-4 bg-card-dark rounded-lg border border-gray-700 hover:border-primary/30 transition-all">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Icon className={config.color} size={18} />
                        <span className="font-medium">{data.provider}</span>
                    </div>
                    {data.score !== undefined && (
                        <span className={`text-lg font-bold ${getScoreColor(data.score)}`}>
                            {data.score}/100
                        </span>
                    )}
                </div>
                
                <div className="space-y-2 text-sm">
                    {/* AbuseIPDB specific */}
                    {providerKey === 'abuseipdb' && (
                        <>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Reports:</span>
                                <span>{data.reports}</span>
                            </div>
                            {data.isTor && (
                                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">Tor Exit</span>
                            )}
                        </>
                    )}
                    
                    {/* VirusTotal specific */}
                    {providerKey === 'virustotal' && (
                        <>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Malicious:</span>
                                <span className="text-red-400">{data.malicious}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Suspicious:</span>
                                <span className="text-orange-400">{data.suspicious}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Harmless:</span>
                                <span className="text-green-400">{data.harmless}</span>
                            </div>
                        </>
                    )}
                    
                    {/* OTX specific */}
                    {providerKey === 'otx' && (
                        <>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Pulse Count:</span>
                                <span className={data.pulseCount > 0 ? 'text-red-400' : 'text-green-400'}>
                                    {data.pulseCount}
                                </span>
                            </div>
                            {data.pulses?.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-text-secondary text-xs mb-1">Recent Pulses:</p>
                                    {data.pulses.slice(0, 2).map((pulse, idx) => (
                                        <div key={idx} className="text-xs bg-background-dark p-2 rounded mt-1">
                                            {pulse.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    
                    {/* GreyNoise specific */}
                    {providerKey === 'greynoise' && (
                        <>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Classification:</span>
                                <span className={
                                    data.classification === 'malicious' ? 'text-red-400' :
                                    data.classification === 'benign' ? 'text-green-400' : 'text-gray-400'
                                }>
                                    {data.classification || 'Unknown'}
                                </span>
                            </div>
                            <div className="flex gap-2 mt-2">
                                {data.noise && (
                                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                                        Internet Noise
                                    </span>
                                )}
                                {data.riot && (
                                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                                        Known Benign
                                    </span>
                                )}
                            </div>
                            {data.name && (
                                <div className="flex justify-between">
                                    <span className="text-text-secondary">Actor:</span>
                                    <span>{data.name}</span>
                                </div>
                            )}
                        </>
                    )}
                    
                    {/* Shodan specific */}
                    {providerKey === 'shodan' && (
                        <>
                            {data.ports?.length > 0 && (
                                <div>
                                    <span className="text-text-secondary">Open Ports: </span>
                                    <span className="font-mono">{data.ports.slice(0, 8).join(', ')}</span>
                                    {data.ports.length > 8 && <span className="text-text-secondary"> +{data.ports.length - 8}</span>}
                                </div>
                            )}
                            {data.vulns?.length > 0 && (
                                <div className="mt-2">
                                    <span className="text-red-400">⚠ {data.vulns.length} vulnerabilities found</span>
                                </div>
                            )}
                            {data.org && (
                                <div className="flex justify-between">
                                    <span className="text-text-secondary">Org:</span>
                                    <span>{data.org}</span>
                                </div>
                            )}
                        </>
                    )}
                    
                    {/* IPQualityScore specific */}
                    {providerKey === 'ipqualityscore' && (
                        <>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Fraud Score:</span>
                                <span className={getScoreColor(data.fraudScore)}>{data.fraudScore}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {data.isProxy && (
                                    <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs">Proxy</span>
                                )}
                                {data.isVPN && (
                                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">VPN</span>
                                )}
                                {data.isTor && (
                                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">Tor</span>
                                )}
                                {data.isBot && (
                                    <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">Bot</span>
                                )}
                                {data.recentAbuse && (
                                    <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">Recent Abuse</span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex min-h-screen font-display">
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="flex flex-col gap-8 max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-4xl font-bold tracking-tight text-gradient">Threat Intelligence</h1>
                            <p className="text-text-secondary text-base">
                                Multi-source threat intelligence with {providers.filter(p => p.configured).length} active providers
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={loadData}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-card-dark rounded-lg border border-gray-700 hover:border-primary transition-all disabled:opacity-50"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                <span className="text-sm">Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* IP Lookup */}
                    <div className="p-6 rounded-lg bg-card-dark border border-gray-700">
                        <div className="flex items-center gap-3 mb-4">
                            <Globe className="text-primary" size={24} />
                            <h2 className="text-lg font-medium">Multi-Provider IP Lookup</h2>
                            <span className="text-xs text-text-secondary px-2 py-1 bg-background-dark rounded">
                                {providers.filter(p => p.configured).length}/6 providers active
                            </span>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary h-4 w-4" />
                                <input
                                    type="text"
                                    value={searchIP}
                                    onChange={(e) => setSearchIP(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleIPLookup()}
                                    placeholder="Enter IP address (e.g., 8.8.8.8, 1.1.1.1, 45.155.205.233)"
                                    className="w-full bg-background-dark border border-gray-700 text-text-main text-sm rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-primary transition-all"
                                />
                            </div>
                            <button
                                onClick={handleIPLookup}
                                disabled={searching}
                                className="px-6 py-3 bg-primary text-background-dark font-medium rounded-lg hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {searching ? (
                                    <>
                                        <Loader className="h-4 w-4 animate-spin" />
                                        Querying...
                                    </>
                                ) : (
                                    'Lookup'
                                )}
                            </button>
                        </div>

                        {/* Search Result */}
                        {searchResult && (
                            <div className="mt-6 space-y-4">
                                {/* Summary Card */}
                                <div className={`p-4 rounded-lg border ${getReputationColor(searchResult.reputation)}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {searchResult.reputation === 'malicious' ? (
                                                <XCircle className="text-red-400" size={32} />
                                            ) : searchResult.reputation === 'suspicious' ? (
                                                <AlertTriangle className="text-orange-400" size={32} />
                                            ) : (
                                                <CheckCircle className="text-green-400" size={32} />
                                            )}
                                            <div>
                                                <p className="font-mono text-xl font-bold">{searchResult.ip}</p>
                                                <p className="text-sm capitalize">
                                                    {searchResult.reputation?.replace('_', ' ')} 
                                                    {searchResult.isBlocked && <span className="ml-2 text-yellow-400">(Blocked)</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right flex items-center gap-6">
                                            <div>
                                                <p className={`text-4xl font-bold ${getScoreColor(searchResult.aggregatedScore)}`}>
                                                    {searchResult.aggregatedScore}
                                                </p>
                                                <p className="text-xs text-text-secondary">Aggregated Score</p>
                                            </div>
                                            {!searchResult.isBlocked && searchResult.aggregatedScore > 30 && (
                                                <button
                                                    onClick={handleBlockFromLookup}
                                                    className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors border border-red-500/30"
                                                >
                                                    Block IP
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Quick Info */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                                        <div>
                                            <p className="text-text-secondary">Country</p>
                                            <p className="font-medium">{searchResult.country || 'Unknown'}</p>
                                        </div>
                                        <div>
                                            <p className="text-text-secondary">ISP</p>
                                            <p className="font-medium">{searchResult.isp || 'Unknown'}</p>
                                        </div>
                                        <div>
                                            <p className="text-text-secondary">Providers Queried</p>
                                            <p className="font-medium">{searchResult.summary?.providersQueried || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-text-secondary">Providers Responded</p>
                                            <p className="font-medium text-green-400">{searchResult.summary?.providersResponded || 0}</p>
                                        </div>
                                    </div>

                                    {/* Categories */}
                                    {searchResult.categories?.length > 0 && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {searchResult.categories.map((cat, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded-full border border-red-500/30">
                                                    {cat}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Provider Details Toggle */}
                                <button
                                    onClick={() => setExpandedProviders(!expandedProviders)}
                                    className="flex items-center gap-2 text-primary hover:underline text-sm"
                                >
                                    {expandedProviders ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    {expandedProviders ? 'Hide' : 'Show'} detailed provider results
                                </button>

                                {/* Provider Details Grid */}
                                {expandedProviders && searchResult.providers && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {Object.entries(searchResult.providers).map(([key, data]) => (
                                            <div key={key}>
                                                {renderProviderCard(key, data)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="p-6 rounded-lg bg-card-dark border border-gray-700">
                            <div className="flex justify-between items-start mb-4">
                                <Database className="text-primary" size={24} />
                                <span className="text-xs text-green-400">Active</span>
                            </div>
                            <p className="text-3xl font-bold">{stats.totalIOCs?.toLocaleString() || 0}</p>
                            <p className="text-text-secondary text-sm">Total IOCs</p>
                        </div>
                        <div className="p-6 rounded-lg bg-card-dark border border-gray-700">
                            <div className="flex justify-between items-start mb-4">
                                <Zap className="text-yellow-400" size={24} />
                            </div>
                            <p className="text-3xl font-bold">
                                {stats.configuredProviders || providers.filter(p => p.configured).length}/6
                            </p>
                            <p className="text-text-secondary text-sm">Intel Providers</p>
                        </div>
                        <div className="p-6 rounded-lg bg-card-dark border border-gray-700">
                            <div className="flex justify-between items-start mb-4">
                                <Target className="text-red-400" size={24} />
                            </div>
                            <p className="text-3xl font-bold">{stats.blockedIPs || 0}</p>
                            <p className="text-text-secondary text-sm">Blocked IPs</p>
                        </div>
                        <div className="p-6 rounded-lg bg-card-dark border border-gray-700">
                            <div className="flex justify-between items-start mb-4">
                                <Clock className="text-blue-400" size={24} />
                            </div>
                            <p className="text-3xl font-bold">{formatDate(stats.lastUpdate)}</p>
                            <p className="text-text-secondary text-sm">Last Update</p>
                        </div>
                    </div>

                    {/* Configured Providers */}
                    <div className="rounded-lg bg-card-dark border border-gray-700">
                        <div className="p-4 border-b border-gray-700">
                            <h3 className="font-medium">Threat Intelligence Providers</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-gray-800">
                            {providers.map((provider, idx) => (
                                <div key={idx} className="p-4 flex items-center justify-between border-b border-gray-800 md:border-r">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${provider.configured ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                        <div>
                                            <p className="font-medium text-sm">{provider.name}</p>
                                            <p className="text-xs text-text-secondary">{provider.freeLimit}</p>
                                        </div>
                                    </div>
                                    <a 
                                        href={provider.website} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline text-xs flex items-center gap-1"
                                    >
                                        <ExternalLink size={12} />
                                        Setup
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Two Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Threat Feeds */}
                        <div className="rounded-lg bg-card-dark border border-gray-700">
                            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                                <h3 className="font-medium">Threat Feeds</h3>
                            </div>
                            <div className="divide-y divide-gray-800">
                                {loading ? (
                                    <div className="p-8 text-center text-text-secondary">
                                        <Loader className="h-6 w-6 animate-spin mx-auto mb-2" />
                                        Loading feeds...
                                    </div>
                                ) : threatFeeds.length === 0 ? (
                                    <div className="p-8 text-center text-text-secondary">
                                        No threat feeds configured
                                    </div>
                                ) : (
                                    threatFeeds.map((feed, idx) => (
                                        <div key={feed.id || idx} className="p-4 flex items-center justify-between hover:bg-background-dark/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${feed.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                                <div>
                                                    <p className="font-medium text-sm">{feed.name}</p>
                                                    <p className="text-xs text-text-secondary">{feed.description}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center gap-3">
                                                <div>
                                                    <p className="text-sm font-mono">{(feed.entryCount || 0).toLocaleString()}</p>
                                                    <p className="text-xs text-text-secondary">{formatDate(feed.lastSync)}</p>
                                                </div>
                                                <button 
                                                    onClick={() => handleSyncFeed(feed.id)}
                                                    className="p-1 hover:bg-gray-700 rounded"
                                                    title="Sync feed"
                                                >
                                                    <RefreshCw className="h-3 w-3 text-text-secondary" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Recent IOCs */}
                        <div className="rounded-lg bg-card-dark border border-gray-700">
                            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                                <h3 className="font-medium">Recent IOCs</h3>
                            </div>
                            <div className="divide-y divide-gray-800">
                                {loading ? (
                                    <div className="p-8 text-center text-text-secondary">
                                        <Loader className="h-6 w-6 animate-spin mx-auto mb-2" />
                                        Loading IOCs...
                                    </div>
                                ) : recentIOCs.length === 0 ? (
                                    <div className="p-8 text-center text-text-secondary">
                                        No IOCs recorded yet
                                    </div>
                                ) : (
                                    recentIOCs.map((ioc, idx) => (
                                        <div key={ioc.id || idx} className="p-4 flex items-center justify-between hover:bg-background-dark/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getSeverityColor(ioc.severity)}`}>
                                                    {(ioc.severity || 'medium').toUpperCase()}
                                                </span>
                                                <div>
                                                    <p className="font-mono text-sm">{ioc.value}</p>
                                                    <p className="text-xs text-text-secondary">{ioc.threat} • {ioc.source}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs px-2 py-1 bg-gray-700 rounded">{ioc.type?.toUpperCase()}</span>
                                                <p className="text-xs text-text-secondary mt-1">{formatDate(ioc.createdAt)}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Blocked IPs Table */}
                    <div className="rounded-lg bg-card-dark border border-gray-700 overflow-hidden">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                            <h3 className="font-medium">Blocked IPs</h3>
                            <span className="text-xs text-text-secondary">{blockedIPs.length} active blocks</span>
                        </div>
                        {loading ? (
                            <div className="p-8 text-center text-text-secondary">
                                <Loader className="h-6 w-6 animate-spin mx-auto mb-2" />
                                Loading blocked IPs...
                            </div>
                        ) : blockedIPs.length === 0 ? (
                            <div className="p-8 text-center text-text-secondary">
                                No IPs are currently blocked
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-700 bg-background-dark/30">
                                        <th className="p-4 text-sm font-medium text-text-secondary">IP Address</th>
                                        <th className="p-4 text-sm font-medium text-text-secondary">Reason</th>
                                        <th className="p-4 text-sm font-medium text-text-secondary">Blocked At</th>
                                        <th className="p-4 text-sm font-medium text-text-secondary">Type</th>
                                        <th className="p-4 text-sm font-medium text-text-secondary">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {blockedIPs.map((item, idx) => (
                                        <tr key={item.id || idx} className="border-b border-gray-800 hover:bg-background-dark/30 transition-colors">
                                            <td className="p-4 font-mono text-sm">{item.ip}</td>
                                            <td className="p-4 text-sm">{item.reason}</td>
                                            <td className="p-4 text-sm text-text-secondary">{formatDate(item.createdAt)}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs ${item.autoBlocked ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'}`}>
                                                    {item.autoBlocked ? 'Auto' : 'Manual'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <button 
                                                    onClick={() => handleUnblockIP(item.ip)}
                                                    className="text-red-400 text-sm hover:underline"
                                                >
                                                    Unblock
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ThreatIntelligence;
