import React, { useState } from 'react';
import { Search, Bell, User, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TopBar = () => {
    const { auth } = useAuth();
    const user = auth?.user;
    const [searchValue, setSearchValue] = useState('');
    const [showNotifications, setShowNotifications] = useState(false);
    const navigate = useNavigate();

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchValue.trim()) {
            // Navigate to traffic page with search query
            navigate(`/traffic?search=${encodeURIComponent(searchValue.trim())}`);
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
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative p-2 rounded-lg bg-card-dark border border-gray-700 hover:border-primary/50 transition-all"
                    >
                        <Bell className="h-5 w-5 text-text-secondary" />
                        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                    </button>
                    
                    {/* Notifications Dropdown */}
                    {showNotifications && (
                        <div className="absolute right-0 mt-2 w-80 bg-card-dark border border-gray-700 rounded-lg shadow-xl z-50">
                            <div className="p-4 border-b border-gray-700">
                                <h3 className="font-medium text-text-main">Notifications</h3>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                <div className="p-4 hover:bg-background-dark/50 cursor-pointer border-b border-gray-800 transition-colors">
                                    <div className="flex items-start gap-3">
                                        <div className="w-2 h-2 rounded-full bg-red-500 mt-2 animate-pulse"></div>
                                        <div>
                                            <p className="text-sm text-text-main">High severity alert detected</p>
                                            <p className="text-xs text-text-secondary mt-1">2 minutes ago</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 hover:bg-background-dark/50 cursor-pointer border-b border-gray-800 transition-colors">
                                    <div className="flex items-start gap-3">
                                        <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2"></div>
                                        <div>
                                            <p className="text-sm text-text-main">Firewall rule updated</p>
                                            <p className="text-xs text-text-secondary mt-1">15 minutes ago</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 hover:bg-background-dark/50 cursor-pointer transition-colors">
                                    <div className="flex items-start gap-3">
                                        <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                                        <div>
                                            <p className="text-sm text-text-main">System scan completed</p>
                                            <p className="text-xs text-text-secondary mt-1">1 hour ago</p>
                                        </div>
                                    </div>
                                </div>
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
                    <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-primary to-purple-600 p-[2px] status-online">
                         <div className="h-full w-full rounded-full bg-background-dark flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-300" />
                         </div>
                    </div>
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

