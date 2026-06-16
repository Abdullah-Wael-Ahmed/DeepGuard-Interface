import React, { useState, useEffect } from "react";
import { ChevronDown, Palette, Check } from "lucide-react";
import { useTheme, ACCENT_COLORS } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

const Settings = () => {
  const { accentColor, setAccentColor } = useTheme();
  const { sessionTimeout, setSessionTimeout } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedTimeout, setSelectedTimeout] = useState(sessionTimeout);

  useEffect(() => {
    setSelectedTimeout(sessionTimeout);
  }, [sessionTimeout]);

  const handleSaveChanges = () => {
    localStorage.setItem('deepguard-session-timeout', selectedTimeout);
    setSessionTimeout(selectedTimeout);
    toast.success("Settings saved successfully!");
  };

  const handleResetToDefault = () => {
    setSelectedTimeout('15 minutes');
    setAccentColor('cyan');
    localStorage.setItem('deepguard-session-timeout', '15 minutes');
    setSessionTimeout('15 minutes');
    toast.info("Settings reset to defaults.");
  };

  const tabs = ["Appearance", "Security Preferences"];

  return (
    <div className="flex min-h-screen text-text-main font-display max-w-full grow">
      {/* Main content */}
      <main className="flex-1 p-8">
        <div className="flex flex-col gap-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="animate-fade-in">
            <h1 className="text-4xl font-bold tracking-tight text-gradient">Settings</h1>
            <p className="text-text-secondary mt-2">Customize your DeepGuard experience</p>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-8 border-b border-gray-700 pb-3">
            {tabs.map((tab, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                className={`text-sm font-bold tracking-wider pb-3 border-b-2 transition-all ${
                  idx === activeTab
                    ? "border-primary text-text-main"
                    : "border-transparent text-text-secondary hover:text-text-main"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Settings Content */}
          {activeTab === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full stagger-children">
              
              {/* Accent Color */}
              <div className="p-6 rounded-xl border border-gray-700 bg-card-dark hover:border-primary/50 transition-all duration-300 shadow-lg card-lift flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Palette className="text-primary" size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Accent Color</h3>
                </div>
                
                <p className="text-text-secondary text-sm">Personalize the interface with your favorite color</p>
                
                <div className="grid grid-cols-6 gap-3 mt-2">
                  {Object.entries(ACCENT_COLORS).map(([key, color]) => (
                    <button
                      key={key}
                      onClick={() => setAccentColor(key)}
                      className={`group relative w-10 h-10 rounded-full transition-all duration-300 hover:scale-110 ${
                        accentColor === key 
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-card-dark scale-110' 
                          : ''
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    >
                      {accentColor === key && (
                        <Check className="absolute inset-0 m-auto text-black" size={16} />
                      )}
                    </button>
                  ))}
                </div>
                
                <p className="text-xs text-text-secondary mt-2">
                  Selected: <span className="text-primary font-medium">{ACCENT_COLORS[accentColor]?.name}</span>
                </p>
              </div>


              {/* Language
              <div className="p-6 rounded-xl border border-gray-700 bg-card-dark hover:border-primary/50 transition-all duration-300 shadow-lg card-lift flex flex-col gap-4">
                <h3 className="text-lg font-bold">Language</h3>
                <div className="flex justify-between items-center">
                  <p className="text-text-secondary">Display Language</p>
                  <select className="bg-background-dark text-text-main border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none">
                    <option>English (US)</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>German</option>
                    <option>Japanese</option>
                  </select>
                </div>
              </div> */}

              {/* Updates */}
              {/* <div className="p-6 rounded-xl border border-gray-700 bg-card-dark hover:border-primary/50 transition-all duration-300 shadow-lg card-lift flex flex-col gap-4">
                <h3 className="text-lg font-bold">Updates</h3>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-text-main">Automatic Updates</p>
                    <p className="text-xs text-text-secondary mt-1">Last checked: 2 hours ago</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div> */}
            </div>
          )}

          {/* notifications tab */}

          {activeTab === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full stagger-children">
              {/* Email Notifications */}
              <div className="p-6 rounded-xl border border-gray-700 bg-card-dark card-lift flex flex-col gap-4">
                <h3 className="text-lg font-bold">Email Notifications</h3>
                {[
                  { label: 'Critical Alerts', desc: 'Get notified for severity 1 threats', checked: true },
                  { label: 'Daily Summary', desc: 'Receive daily security digest', checked: true },
                  { label: 'Weekly Reports', desc: 'Get weekly analytics reports', checked: false },
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                    <div>
                      <p className="text-text-main">{item.label}</p>
                      <p className="text-xs text-text-secondary">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked={item.checked} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                ))}
              </div>

              {/* Push Notifications */}
              <div className="p-6 rounded-xl border border-gray-700 bg-card-dark card-lift flex flex-col gap-4">
                <h3 className="text-lg font-bold">Push Notifications</h3>
                {[
                  { label: 'Real-time Alerts', desc: 'Browser push for live threats', checked: true },
                  { label: 'System Status', desc: 'Notify when system goes offline', checked: true },
                  { label: 'Firewall Changes', desc: 'Alert on rule modifications', checked: false },
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                    <div>
                      <p className="text-text-main">{item.label}</p>
                      <p className="text-xs text-text-secondary">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked={item.checked} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 1 && (
            <div className="grid grid-cols-1 gap-6 w-full stagger-children">
              {/* Security Settings */}
              <div className="p-6 rounded-xl border border-gray-700 bg-card-dark card-lift flex flex-col gap-4">
                <h3 className="text-lg font-bold">Security Preferences</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex justify-between items-center p-4 bg-background-dark rounded-lg">
                    <div>
                      <p className="text-text-main font-medium">Session Timeout</p>
                      <p className="text-xs text-text-secondary mt-1">Auto-logout after inactivity</p>
                    </div>
                    <select 
                      value={selectedTimeout}
                      onChange={(e) => setSelectedTimeout(e.target.value)}
                      className="bg-card-dark border border-gray-700 rounded-lg px-3 py-2 text-sm text-text-main focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                    >
                      <option value="5 minutes">5 minutes</option>
                      <option value="15 minutes">15 minutes</option>
                      <option value="30 minutes">30 minutes</option>
                      <option value="1 hour">1 hour</option>
                      <option value="Never">Never</option>
                    </select>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-background-dark rounded-lg">
                    <div>
                      <p className="text-text-main font-medium">Two-Factor Auth</p>
                      <p className="text-xs text-text-secondary mt-1">Extra security layer</p>
                    </div>
                    <button className="px-4 py-2 bg-primary/20 text-primary rounded-lg text-sm font-medium hover:bg-primary/30 transition-colors">
                      Enable
                    </button>
                  </div>
                </div>
              </div>
              
              {/* User Management Link */}
              {/* <details className="p-6 rounded-xl border border-gray-700 bg-card-dark card-lift group">
                <summary className="flex justify-between items-center cursor-pointer">
                  <p className="text-lg font-bold">User Management</p>
                  <ChevronDown className="transition-transform group-open:rotate-180 text-text-secondary" />
                </summary>
                <div className="mt-4 flex flex-col gap-4">
                  {[
                    { name: "John Doe", role: "Administrator" },
                    { name: "Jane Smith", role: "Analyst" },
                  ].map((user, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-3 bg-background-dark rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-text-secondary">{user.role}</p>
                        </div>
                      </div>
                      <button className="text-primary text-sm font-bold hover:underline">
                        Edit
                      </button>
                    </div>
                  ))}
                  <button className="self-start mt-2 bg-primary/20 hover:bg-primary/30 font-bold py-2 px-4 rounded-lg text-sm transition-colors text-primary">
                    Add User
                  </button>
                </div>
              </details> */}
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex justify-end gap-4 mt-8">
            <button 
              onClick={handleResetToDefault}
              className="text-text-secondary hover:text-text-main font-bold py-2 px-4 rounded-lg text-sm transition-colors"
            >
              Reset to Default
            </button>
            <button 
              onClick={handleSaveChanges}
              className="bg-primary text-background-dark font-bold py-2 px-4 rounded-lg text-sm hover:brightness-110 transition-all shadow-glow-primary glow-pulse"
            >
              Save Changes
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
