import { Gauge, Shield, BrickWallFire, HatGlasses, Settings, ChartLine, Share2, Users, Globe, ChartNetwork, Crosshair, MonitorSmartphone, ClipboardList, GitPullRequestDraft, History } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'; // Added useNavigate
import DeepGuard from '../assets/DeepGaurdDark.svg';
import TopBar from '../components/TopBar';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import GlobalCopilot from '../components/GlobalCopilot';

const Layout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { auth, setAuth } = useAuth();
    const userRole = auth?.user?.role;
    const currentTab = location.pathname.split("/")[1];
    const activeTab = (tab) => {
        if (currentTab == tab) return "flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-primary/20 text-primary shadow-glow-primary border border-primary/50";
        else return "flex items-center gap-2.5 px-3 py-1.5 text-text-secondary hover:text-text-main hover:bg-card-dark rounded-lg transition-colors";
    };



    return (
        <div className="bg-background-dark font-display text-text-main">
            <div className="flex h-screen overflow-hidden">
                {/* SideNavBar */}
                <aside className="w-64 bg-background-dark p-4 flex flex-col border-r border-gray-800 h-full flex-shrink-0 overflow-hidden">
                    <div className="flex flex-col gap-5 h-full overflow-hidden">
                        <div className="flex gap-3 items-center px-2">
                            <div className="bg-center bg-no-repeat bg-cover size-12" data-alt="DeepGuard logo">
                                <img src={DeepGuard} alt="deepguard" />
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-text-main text-lg font-bold">DeepGuard</h1>
                                <p className="text-text-secondary text-xs">Next-Generation SOC Platform Powered By AI</p>
                            </div>
                        </div>
                        <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1 scrollbar-thin">
                            <Link className={activeTab("")} to="/">
                                <Gauge size={18} />
                                <p className="text-sm font-medium">Dashboard</p>
                            </Link>
                            <Link className={activeTab("detection")} to="/detection">
                                <Shield size={18} />
                                <p className="text-sm font-medium">Detection</p>
                            </Link>
                            
                            {(userRole === "admin" || userRole === "operator") && (
                                <>
                                    <Link className={activeTab("endpoints")} to="/endpoints">
                                        <MonitorSmartphone size={18} />
                                        <p className="text-sm font-medium">Endpoints</p>
                                    </Link>
                                    <Link className={activeTab("correlation")} to="/correlation">
                                        <Share2 size={18} />
                                        <p className="text-sm font-medium">Correlation</p>
                                    </Link>
                                    <Link className={activeTab("mitre-attack")} to="/mitre-attack">
                                        <Crosshair size={18} />
                                        <p className="text-sm font-medium">MITRE ATT&CK</p>
                                    </Link>
                                </>
                            )}

                            <Link className={activeTab("incidents")} to="/incidents">
                                <ClipboardList size={18} />
                                <p className="text-sm font-medium">Incidents</p>
                            </Link>

                            {(userRole === "admin" || userRole === "operator") && (
                                <>
                                    <Link className={activeTab("playbooks")} to="/playbooks">
                                        <GitPullRequestDraft size={18} />
                                        <p className="text-sm font-medium">Playbooks</p>
                                    </Link>
                                    <Link className={activeTab("playbooks/history")} to="/playbooks/history">
                                        <History size={18} />
                                        <p className="text-sm font-medium">Executions</p>
                                    </Link>
                                    <Link className={activeTab("firewall")} to={"/firewall"}>
                                        <BrickWallFire size={18} />
                                        <p className="text-sm font-medium">Firewall</p>
                                    </Link>
                                </>
                            )}

                            <Link className={activeTab("traffic")} to={"/traffic"}>
                                <HatGlasses size={18} />
                                <p className="text-sm font-medium">Inspection</p>
                            </Link>
                            <Link className={activeTab("reports")} to={"/reports"}>
                                <ChartLine size={18} />
                                <p className="text-sm font-bold">Reports</p>
                            </Link>

                            {(userRole === "admin" || userRole === "operator") && (
                                <>
                                    <Link className={activeTab("threat-intel")} to="/threat-intel">
                                        <Globe size={18} />
                                        <p className="text-sm font-medium">Threat Intel</p>
                                    </Link>
                                    <Link className={activeTab("network-analytics")} to="/network-analytics">
                                        <ChartNetwork size={18} />
                                        <p className="text-sm font-medium">Network Analytics</p>
                                    </Link>
                                </>
                            )}

                            {userRole === "admin" && (
                                <Link className={activeTab("users")} to="/users">
                                    <Users size={18} />
                                    <p className="text-sm font-medium">User Management</p>
                                </Link>
                            )}

                            <Link className={activeTab("settings")} to="/settings">
                                <Settings size={18} />
                                <p className="text-sm font-medium">Settings</p>
                            </Link>
                        </nav>
                    </div>
                </aside>

                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <TopBar />
                    <div className="flex-1 overflow-auto">
                    <Outlet />
                    <GlobalCopilot />
                    </div>
                </div>
            </div>
        </div>

    );
};

export default Layout;
