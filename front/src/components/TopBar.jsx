import React, { useState, useEffect } from 'react';
import { Search, Bell, User, X, LogOut } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import useWebSocket from 'react-use-websocket';

const TopBar = () => {
    const { auth, setAuth } = useAuth();
    const user = auth?.user;
    const [searchValue, setSearchValue] = useState('');
    const [showNotifications, setShowNotifications] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const query = searchParams.get('search') || '';
        setSearchValue(query);
    }, [searchParams]);

    const handleLogout = async () => {
        try {
            await axios.post(`${import.meta.env.VITE_BACK}/auth/logout`, {}, {
                withCredentials: true 
            });
        } catch (error) {
            console.error("Logout failed on server:", error);
        } finally {
            setAuth({});
            navigate('/login');
        }
    };

    const getWsUrl = () => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}/ws`;
    };

    const [notifications, setNotifications] = useState([
        { id: 1, text: "System initialized and monitoring active.", time: "Just now", type: "system", unread: true }
    ]);

    const { lastMessage } = useWebSocket(getWsUrl(), {
        shouldReconnect: () => true,
        reconnectAttempts: 10,
        reconnectInterval: 3000
    });

    useEffect(() => {
        try {
            if (!lastMessage?.data) return;
            const message = JSON.parse(lastMessage.data);
            let text = '';
            let type = 'system';
            
            if (message.type === 'new_alert') {
                text = `New Alert: ${message.data.signature || 'Signature unknown'}`;
                type = 'alert';
            } else if (message.type === 'new_incident') {
                text = `New Incident: ${message.data.title || 'Untitled Incident'}`;
                type = 'incident';
            } else if (message.type === 'new_correlation' || message.type === 'correlation_alert') {
                text = `Correlation: ${message.data.name || 'Rule triggered'}`;
                type = 'correlation';
            } else if (message.type === 'soar_notification') {
                text = `SOAR Action: ${message.data.message || 'Action executed'}`;
                type = 'soar';
            } else if (message.type === 'ip_blocked') {
                text = `IP Blocked: ${message.data.ip} (${message.data.reason || 'No reason specified'})`;
                type = 'alert';
            } else if (message.type === 'ip_unblocked') {
                text = `IP Unblocked: ${message.data.ip || message.data.ip_address || ''}`;
                type = 'system';
            } else {
                return;
            }

            const newNotif = {
                id: Date.now(),
                text,
                time: "Just now",
                type,
                unread: true,
                link: type === 'incident' && message.data?.id ? `/incidents/${message.data.id}` :
                      type === 'incident' ? '/incidents' :
                      type === 'alert' ? '/traffic' :
                      type === 'correlation' ? '/correlation' :
                      type === 'soar' ? '/playbooks/history' :
                      message.type === 'ip_blocked' || message.type === 'ip_unblocked' ? '/firewall' : null
            };
            setNotifications(prev => [newNotif, ...prev].slice(0, 30));
        } catch (error) {
            console.error('Error parsing notification WebSocket message:', error);
        }
    }, [lastMessage]);

    const toggleNotifications = () => {
        setShowNotifications(!showNotifications);
        if (!showNotifications) {
            setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        const query = searchValue.trim();
        if (!query) return;

        const currentPath = window.location.pathname.split("/")[1] || "";
        const searchablePages = ["traffic", "incidents", "playbooks", "users", "correlation", "mitre-attack"];
        
        if (searchablePages.includes(currentPath)) {
            navigate(`/${currentPath}?search=${encodeURIComponent(query)}`);
        } else {
            navigate(`/traffic?search=${encodeURIComponent(query)}`);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch(e);
        }
    };

    const clearSearch = () => {
        setSearchValue('');
    };

    return (
        <div className="bg-background-dark/50 backdrop-blur-md border-b border-gray-800 h-16 px-8 flex items-center justify-between sticky top-0 z-50">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary h-4 w-4" />
                <input 
                    type="text" 
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search IPs, protocols... (Enter to search)" 
                    className="w-full bg-card-dark border border-gray-700 text-text-main text-sm rounded-lg pl-10 pr-10 py-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
                {searchValue && (
                    <button 
                        type="button"
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-main"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </form>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
                
                 {/* Notifications */}
                 <div className="relative">
                     <button 
                         onClick={toggleNotifications}
                         className="relative p-2 rounded-lg bg-card-dark border border-gray-700 hover:border-primary/50 transition-all"
                     >
                         <Bell className="h-5 w-5 text-text-secondary" />
                         {notifications.filter(n => n.unread).length > 0 && (
                             <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                         )}
                     </button>
                     
                     {/* Notifications Dropdown */}
                     {showNotifications && (
                         <div className="absolute right-0 mt-2 w-80 bg-card-dark border border-gray-700 rounded-lg shadow-xl z-50 animate-scale-in">
                             <div className="p-4 border-b border-gray-700">
                                 <h3 className="font-medium text-text-main">Notifications</h3>
                             </div>
                              <div className="max-h-64 overflow-y-auto">
                                  {notifications.map((notif) => (
                                      <div 
                                          key={notif.id} 
                                          onClick={() => {
                                              if (notif.link) {
                                                  navigate(notif.link);
                                                  setShowNotifications(false);
                                              }
                                          }}
                                          className="p-4 hover:bg-background-dark/50 cursor-pointer border-b border-gray-800 transition-colors"
                                      >
                                          <div className="flex items-start gap-3">
                                              <div className={`w-2 h-2 rounded-full mt-2 ${
                                                  notif.type === 'alert' ? 'bg-red-500' :
                                                  notif.type === 'incident' ? 'bg-purple-500' :
                                                  notif.type === 'correlation' ? 'bg-yellow-500' :
                                                  notif.type === 'soar' ? 'bg-blue-500' : 'bg-green-500'
                                              } ${notif.unread ? 'animate-pulse' : ''}`}></div>
                                              <div className="flex-1 min-w-0">
                                                  <p className={`text-sm ${notif.unread ? 'text-text-main font-semibold' : 'text-text-secondary'}`}>{notif.text}</p>
                                                  <p className="text-xs text-text-secondary mt-1">{notif.time}</p>
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                                  {notifications.length === 0 && (
                                      <div className="p-6 text-center text-text-secondary text-sm">
                                          No notifications
                                      </div>
                                  )}
                              </div>
                              <div className="p-3 border-t border-gray-700">
                                  <button className="w-full text-center text-sm text-primary hover:text-primary/80 transition-colors">
                                      View all notifications
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>

                {/* User Profile */}
                <div className="flex items-center gap-3 pl-4 border-l border-gray-700">
                    <div className="text-right hidden md:block">
                        <p className="text-sm font-medium text-text-main">{user?.name} </p>
                        <p className="text-xs text-text-secondary capitalize">{user?.role}</p>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-primary to-purple-600 p-[2px] status-online mr-1">
                         <div className="h-full w-full rounded-full bg-background-dark flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-300" />
                         </div>
                    </div>
                    <button 
                        onClick={handleLogout} 
                        className="p-2 rounded-lg bg-card-dark border border-gray-700 hover:border-red-500/50 hover:text-red-500 transition-all cursor-pointer"
                        title="Logout"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Click outside to close notifications */}
            {showNotifications && (
                <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowNotifications(false)}
                ></div>
            )}
        </div>
    );
};

export default TopBar;

