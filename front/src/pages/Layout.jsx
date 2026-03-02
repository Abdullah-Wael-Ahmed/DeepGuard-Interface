import { Gauge, Shield, BrickWallFire, HatGlasses, Settings, ChartLine, LogOut, Share2, Users, Globe, ChartNetwork, Crosshair } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'; // Added useNavigate
import DeepGuard from '../assets/DeepGaurdDark.svg';
import TopBar from '../components/TopBar';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { setAuth } = useAuth();
    const currentTab = location.pathname.split("/")[1];
    const activeTab = (tab) => {
        if (currentTab == tab) return "flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/20 text-primary shadow-glow-primary border border-primary/50";
        else return "flex items-center gap-3 px-3 py-2 text-text-secondary hover:text-text-main hover:bg-card-dark rounded-lg transition-colors";
    };

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

    return (
        <div className="bg-background-dark font-display text-text-main">
            <div className="flex h-screen overflow-hidden">
                {/* SideNavBar */}
                <aside className="w-64 bg-background-dark p-4 flex flex-col justify-between border-r border-gray-800 h-full flex-shrink-0">
                    <div className="flex flex-col gap-8">
                        <div className="flex gap-3 items-center px-2">
                            <div className="bg-center bg-no-repeat bg-cover size-12" data-alt="DeepGuard logo">
                                <img src={DeepGuard} alt="deepguard" />
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-text-main text-lg font-bold">DeepGuard</h1>
                                <p className="text-text-secondary text-xs">Multi-Layer Threat Defense Gateway</p>
                            </div>
                        </div>
                        <nav className="flex flex-col gap-2">
                            <Link className={activeTab("")} to="/">
                                <Gauge />
                                <p className="text-sm font-medium">Dashboard</p>
                            </Link>
                            <Link className={activeTab("detection")} to="/detection">
                                <Shield />
                                <p className="text-sm font-medium">Detection</p>
                            </Link>
                            <Link className={activeTab("correlation")} to="/correlation">
                                <Share2 />
                                <p className="text-sm font-medium">Correlation</p>
                            </Link>
                            <Link className={activeTab("mitre-attack")} to="/mitre-attack">
                                <Crosshair />
                                <p className="text-sm font-medium">MITRE ATT&CK</p>
                            </Link>
                            <Link className={activeTab("firewall")} to={"/firewall"}>
                                <BrickWallFire />
                                <p className="text-sm font-medium">Firewall</p>
                            </Link>
                            <Link className={activeTab("traffic")} to={"/traffic"}>
                                <HatGlasses />
                                <p className="text-sm font-medium">Inspection</p>
                            </Link>
                            <Link className={activeTab("reports")} to={"/reports"}>
                                <ChartLine />
                                <p className="text-sm font-bold">Reports</p>
                            </Link>
                            <Link className={activeTab("threat-intel")} to="/threat-intel">
                                <Globe />
                                <p className="text-sm font-medium">Threat Intel</p>
                            </Link>
                            <Link className={activeTab("network-analytics")} to="/network-analytics">
                                <ChartNetwork />
                                <p className="text-sm font-medium">Network Analytics</p>
                            </Link>
                            <Link className={activeTab("users")} to="/users">
                                <Users />
                                <p className="text-sm font-medium">User Management</p>
                            </Link>
                            <Link className={activeTab("settings")} to="/settings">
                                <Settings />
                                <p className="text-sm font-medium">Settings</p>
                            </Link>
                        </nav>
                    </div>
                    <div className="p-2">
                        <button 
                            onClick={handleLogout} 
                            className="w-full flex items-center gap-3 px-3 py-2 text-text-secondary hover:text-text-main hover:bg-card-dark rounded-lg transition-colors cursor-pointer"
                        >
                            <LogOut />
                            <p className="text-sm font-medium">Logout</p>
                        </button>
                    </div>
                </aside>

                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <TopBar />
                    <div className="flex-1 overflow-auto">
                    <Outlet />
                    </div>
                </div>
            </div>
        </div>

    );
};

export default Layout;
