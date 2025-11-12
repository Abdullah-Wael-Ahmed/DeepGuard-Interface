import React from 'react';
import { ArrowDown, ArrowUp, Calendar, ChevronDown, Download, Share2 } from 'lucide-react';

const Reports = () => {
    return (
        <main className="flex-1 p-8">
            <div className="max-w-7xl mx-auto">
                {/* PageHeading */}
                <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-text-main text-4xl font-bold tracking-tight">Reports &amp; Analytics</h1>
                        <p className="text-text-secondary text-base">Detailed security reports, event correlation graphs,
                            and automated incident reports.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* <span className="material-symbols-outlined text-text-secondary">calendar_today</span> */}
                        <Calendar className='text-gray-500'/>
                        <p className="text-text-secondary text-sm">Last 24 Hours</p>
                    </div>
                </div>
                {/* Chips */}
                <div className="flex gap-3 mb-8">
                    <button className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-card-dark hover:bg-primary/20 hover:text-primary transition-colors pl-4 pr-3">
                        <p className="text-sm font-medium">Date</p>
                        <ChevronDown/>
                    </button>
                    <button className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-card-dark hover:bg-primary/20 hover:text-primary transition-colors pl-4 pr-3">
                        <p className="text-sm font-medium">Severity</p>
                        <ChevronDown/>
                    </button>
                    <button className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-card-dark hover:bg-primary/20 hover:text-primary transition-colors pl-4 pr-3">
                        <p className="text-sm font-medium">Type</p>
                        <ChevronDown/>
                    </button>
                    <button className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-card-dark hover:bg-primary/20 hover:text-primary transition-colors pl-4 pr-3">
                        <p className="text-sm font-medium">Status</p>
                        <ChevronDown/>
                    </button>
                </div>
                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="flex flex-col gap-2 rounded-lg bg-card-dark p-6 border border-gray-800 hover:border-primary/50 transition-all duration-300">
                        <p className="text-text-main text-base font-medium">Event Correlation - Last 24 Hours</p>
                        <p className="text-text-main text-4xl font-bold">1,234</p>
                        <div className="flex gap-2 items-center">
                            <p className="text-text-secondary text-sm">vs. previous 24 hours</p>
                            <p className="text-green-400 text-sm font-medium flex items-center"><ArrowUp/>+12.5%</p>
                        </div>
                        <div className="flex-1 flex items-end pt-4">
                            <svg fill="none" height={150} preserveAspectRatio="none" viewBox="0 0 472 150" width="100%" xmlns="http://www.w3.org/2000/svg">
                                <path d="M0 109C18.1538 109 18.1538 21 36.3077 21C54.4615 21 54.4615 41 72.6154 41C90.7692 41 90.7692 93 108.923 93C127.077 93 127.077 33 145.231 33C163.385 33 163.385 101 181.538 101C199.692 101 199.692 61 217.846 61C236 61 236 45 254.154 45C272.308 45 272.308 121 290.462 121C308.615 121 308.615 149 326.769 149C344.923 149 344.923 1 363.077 1C381.231 1 381.231 81 399.385 81C417.538 81 417.538 129 435.692 129C453.846 129 453.846 25 472 25V149H0V109Z" fill="url(#paint0_linear_chart)" />
                                <path d="M0 109C18.1538 109 18.1538 21 36.3077 21C54.4615 21 54.4615 41 72.6154 41C90.7692 41 90.7692 93 108.923 93C127.077 93 127.077 33 145.231 33C163.385 33 163.385 101 181.538 101C199.692 101 199.692 61 217.846 61C236 61 236 45 254.154 45C272.308 45 272.308 121 290.462 121C308.615 121 308.615 149 326.769 149C344.923 149 344.923 1 363.077 1C381.231 1 381.231 81 399.385 81C417.538 81 417.538 129 435.692 129C453.846 129 453.846 25 472 25" stroke="#64FFDA" strokeLinecap="round" strokeWidth={3} />
                                <defs>
                                    <linearGradient gradientUnits="userSpaceOnUse" id="paint0_linear_chart" x1={236} x2={236} y1={1} y2={149}>
                                        <stop stopColor="#64FFDA" stopOpacity="0.2" />
                                        <stop offset={1} stopColor="#64FFDA" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 rounded-lg bg-card-dark p-6 border border-gray-800 hover:border-primary/50 transition-all duration-300">
                        <p className="text-text-main text-base font-medium">Top Detected Threats by Category</p>
                        <p className="text-text-main text-4xl font-bold">567</p>
                        <div className="flex gap-2 items-center">
                            <p className="text-text-secondary text-sm">Last 7 Days</p>
                            <p className="text-red-400 text-sm font-medium flex items-center"><ArrowDown/>-3.2%</p>
                        </div>
                        <div className="grid flex-1 grid-flow-col gap-6 grid-rows-[1fr_auto] items-end justify-items-center pt-4 px-3">
                            <div className="bg-primary/20 w-full rounded-t-sm" style={{ height: '100%' }} />
                            <p className="text-text-secondary text-xs font-bold tracking-wider">Malware</p>
                            <div className="bg-primary/20 w-full rounded-t-sm" style={{ height: '75%' }} />
                            <p className="text-text-secondary text-xs font-bold tracking-wider">Phishing</p>
                            <div className="bg-primary/20 w-full rounded-t-sm" style={{ height: '60%' }} />
                            <p className="text-text-secondary text-xs font-bold tracking-wider">DDoS</p>
                            <div className="bg-primary/20 w-full rounded-t-sm" style={{ height: '90%' }} />
                            <p className="text-text-secondary text-xs font-bold tracking-wider">SQL Inj.</p>
                            <div className="bg-primary/20 w-full rounded-t-sm" style={{ height: '40%' }} />
                            <p className="text-text-secondary text-xs font-bold tracking-wider">Brute Force</p>
                        </div>
                    </div>
                </div>
                {/* SectionHeader */}
                <h2 className="text-text-main text-2xl font-bold tracking-tight mb-4">Automated Incident Reports</h2>
                {/* Report Cards */}
                <div className="space-y-4">
                    <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 p-4 rounded-lg bg-card-dark border border-gray-800 hover:border-primary/50 hover:shadow-glow-primary transition-all duration-300">
                        <div className="w-2 h-10 rounded-full bg-red-500" />
                        <div>
                            <p className="font-bold text-text-main">Automated Incident Response #345</p>
                            <p className="text-sm text-text-secondary">Severity: Critical | Source IP: 192.168.1.101 |
                                Detected: 2 mins ago</p>
                        </div>
                        <div className="text-sm text-text-secondary">Firewall Block</div>
                        <div className="text-sm text-text-secondary">Unreviewed</div>
                        <div className="flex gap-2">
                            <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-dark hover:text-primary transition-colors"><Share2/></button>
                            <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-dark hover:text-primary transition-colors"><Download/></button>
                        </div>
                    </div>
                    <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 p-4 rounded-lg bg-card-dark border border-gray-800 hover:border-primary/50 hover:shadow-glow-primary transition-all duration-300">
                        <div className="w-2 h-10 rounded-full bg-orange-400" />
                        <div>
                            <p className="font-bold text-text-main">Daily Threat Summary</p>
                            <p className="text-sm text-text-secondary">Summary for 2024-07-26 | 42 Events Analyzed</p>
                        </div>
                        <div className="text-sm text-text-secondary">Summary</div>
                        <div className="text-sm text-green-400">Reviewed</div>
                        <div className="flex gap-2">
                            <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-dark hover:text-primary transition-colors"><Share2/></button>
                            <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-dark hover:text-primary transition-colors"><Download/></button>
                        </div>
                    </div>
                    <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 p-4 rounded-lg bg-card-dark border border-gray-800 hover:border-primary/50 hover:shadow-glow-primary transition-all duration-300">
                        <div className="w-2 h-10 rounded-full bg-yellow-400" />
                        <div>
                            <p className="font-bold text-text-main">Network Traffic Anomalies</p>
                            <p className="text-sm text-text-secondary">Severity: Medium | Source IP: 10.0.0.5 | Detected: 1
                                hour ago</p>
                        </div>
                        <div className="text-sm text-text-secondary">Anomaly Detection</div>
                        <div className="text-sm text-text-secondary">Unreviewed</div>
                        <div className="flex gap-2">
                            <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-dark hover:text-primary transition-colors"><Share2/></button>
                            <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-dark hover:text-primary transition-colors"><Download/></button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

export default Reports;
