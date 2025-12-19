import axios from 'axios';

const API_URL = import.meta.env.VITE_BACK;

export const threatIntelService = {
    // IP Lookup
    lookupIP: async (ip) => {
        const response = await axios.get(`${API_URL}/threat-intel/lookup/${ip}`, {
            withCredentials: true
        });
        return response.data;
    },

    // IOCs
    getIOCs: async (params = {}) => {
        const response = await axios.get(`${API_URL}/threat-intel/iocs`, {
            params,
            withCredentials: true
        });
        return response.data;
    },

    addIOC: async (ioc) => {
        const response = await axios.post(`${API_URL}/threat-intel/iocs`, ioc, {
            withCredentials: true
        });
        return response.data;
    },

    deleteIOC: async (id) => {
        const response = await axios.delete(`${API_URL}/threat-intel/iocs/${id}`, {
            withCredentials: true
        });
        return response.data;
    },

    // Blocked IPs
    getBlockedIPs: async () => {
        const response = await axios.get(`${API_URL}/threat-intel/blocked`, {
            withCredentials: true
        });
        return response.data;
    },

    blockIP: async (ip, reason) => {
        const response = await axios.post(`${API_URL}/threat-intel/block`, 
            { ip, reason },
            { withCredentials: true }
        );
        return response.data;
    },

    unblockIP: async (ip) => {
        const response = await axios.delete(`${API_URL}/threat-intel/block/${ip}`, {
            withCredentials: true
        });
        return response.data;
    },

    // Threat Feeds
    getFeeds: async () => {
        const response = await axios.get(`${API_URL}/threat-intel/feeds`, {
            withCredentials: true
        });
        return response.data;
    },

    syncFeed: async (feedId) => {
        const response = await axios.post(`${API_URL}/threat-intel/feeds/${feedId}/sync`, {}, {
            withCredentials: true
        });
        return response.data;
    },

    // Stats
    getStats: async () => {
        const response = await axios.get(`${API_URL}/threat-intel/stats`, {
            withCredentials: true
        });
        return response.data;
    }
};

export default threatIntelService;
