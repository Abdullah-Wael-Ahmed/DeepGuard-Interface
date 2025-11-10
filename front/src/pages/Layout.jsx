import {Gauge, Shield, BrickWallFire, HatGlasses, Settings, ChartLine, LogOut} from 'lucide-react'
import {Link, Outlet, useLocation} from 'react-router-dom';

const Layout = () => {
    const location = useLocation();
    const currentTab = location.pathname.split("/")[1];

    const activeTab = (tab) => {
        if (currentTab == tab) return "flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/20 text-primary shadow-glow-primary border border-primary/50"
        else return "flex items-center gap-3 px-3 py-2 text-text-secondary hover:text-text-main hover:bg-card-dark rounded-lg transition-colors"
    }
    
    return (
        <div className="bg-background-dark font-display text-text-main">
            <div className="flex min-h-screen">
                {/* SideNavBar */}
                <aside className="w-64 bg-background-dark p-4 flex flex-col justify-between border-r border-gray-800 h-screen sticky top-0">
                    <div className="flex flex-col gap-8">
                        <div className="flex gap-3 items-center px-2">
                            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" data-alt="DeepGuard logo" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAQYjvsapVrGE1y_TE90ydrIYDmyrBZhqe-ewPAO_jCKPiJYv_gW-tK7Szzsh18atz6Yy9Lw0zsNJ15Rb0kgscL1xxDg1legR-gEMw1ThowGU4r1SV3pKgVDOxLsZI72iQnTI7gbnEeJaSV9g4Zao8U-N237iWjWYhmZ4bA8mROxtowqmVFRxy_3stjzckcUTEsmWWB_ghZbyIWoT2ijztoFPRlNKsXnmQ58_13xHLwiu_YWDwSedXxmPPNvMbtD9ikenQOkzjVeZvx")' }}>
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-text-main text-lg font-bold">DeepGuard</h1>
                                <p className="text-text-secondary text-xs">Integrated Network Defense</p>
                            </div>
                        </div>
                        <nav className="flex flex-col gap-2">
                            <a className={activeTab("")} href="#">
                                <Gauge/>
                                <p className="text-sm font-medium">Dashboard</p>
                            </a>
                            <a className={activeTab("detection")} href="#">
                                <Shield />
                                <p className="text-sm font-medium">Detection</p>
                            </a>
                            <a className={activeTab("firewall")} href="#">
                                <BrickWallFire />
                                <p className="text-sm font-medium">Firewall</p>
                            </a>
                            <Link className={activeTab("traffic")} to={"/traffic"}>
                                <HatGlasses />
                                <p className="text-sm font-medium">Inspection</p>
                            </Link>
                            <Link className={activeTab("reports")} to={"/reports"}>
                                <ChartLine />
                                <p className="text-sm font-bold">Reports</p>
                            </Link>
                            <a className={activeTab("settings")} href="#">
                                <Settings/>
                                <p className="text-sm font-medium">Settings</p>
                            </a>
                        </nav>
                    </div>
                    <div className="p-2">
                        <button className="w-full flex items-center gap-3 px-3 py-2 text-text-secondary hover:text-text-main hover:bg-card-dark rounded-lg transition-colors">
                            <LogOut/>
                            <p className="text-sm font-medium">Logout</p>
                        </button>
                    </div>
                </aside>
                <Outlet/>
            </div>
        </div>

    );
}

export default Layout;
