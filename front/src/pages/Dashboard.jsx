import React from 'react';
const Dashboard = () => {
    return (
        <div className="flex min-h-screen font-display">
            {/* Main Content */}
            <main className="flex-1 p-8">
                <div className="flex flex-col gap-8 max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-4xl font-bold tracking-tight">Dashboard Overview</h1>
                            <p className="text-gray-400 text-base">
                                Real-time monitoring of network security.
                            </p>
                        </div>
                        <button className="flex items-center justify-center rounded-lg h-10 px-4 bg-card-dark text-sm font-medium border border-border-dark hover:bg-primary/10 hover:border-primary transition-all duration-300">
                            <span>Last 24 hours</span>
                            {/* <ChevronDown className="ml-2 text-gray-400" size={18} /> */}
                        </button>
                    </div>
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                title: 'Anomalies Detected',
                                value: '1,234',
                                change: '+12%',
                                color: 'text-primary',
                            },
                            {
                                title: 'Active Threats',
                                value: '56',
                                change: '-5%',
                                color: 'text-red-400',
                            },
                            {
                                title: 'Blocked Connections',
                                value: '789',
                                change: '+20%',
                                color: 'text-primary',
                            },
                        ].map((stat, idx) => (
                            <div
                                key={idx}
                                className="flex flex-col gap-2 rounded-lg p-6 bg-card-dark border border-border-dark hover:border-primary/50 transition-all duration-300"
                            >
                                <p className="text-gray-300 text-base font-medium">{stat.title}</p>
                                <p className="text-white text-4xl font-bold">{stat.value}</p>
                                <p className={`${stat.color} text-base font-medium`}>{stat.change}</p>
                            </div>
                        ))}
                    </div>
                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Chart 1 */}
                        <div className="flex flex-col gap-4 rounded-lg p-6 bg-card-dark border border-border-dark">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-lg font-medium">Event Correlation</p>
                                    <p className="text-gray-400 text-sm">
                                        Trends over the last 24 hours
                                    </p>
                                </div>
                                <p className="text-primary text-lg font-bold">+15%</p>
                            </div>
                            <div className="flex-1 flex flex-col justify-end">
                                <svg
                                    fill="none"
                                    height="200"
                                    preserveAspectRatio="none"
                                    viewBox="0 0 472 150"
                                    width="100%"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M0 109C18.1538 109 18.1538 21 36.3077 21C54.4615 21 54.4615 41 72.6154 41C90.7692 41 90.7692 93 108.923 93C127.077 93 127.077 33 145.231 33C163.385 33 163.385 101 181.538 101C199.692 101 199.692 61 217.846 61C236 61 236 45 254.154 45C272.308 45 272.308 121 290.462 121C308.615 121 308.615 149 326.769 149C344.923 149 344.923 1 363.077 1C381.231 1 381.231 81 399.385 81C417.538 81 417.538 129 435.692 129C453.846 129 453.846 25 472 25V149H0V109Z"
                                        fill="url(#paint0_linear)"
                                    ></path>
                                    <path
                                        d="M0 109C18.1538 109 18.1538 21 36.3077 21C54.4615 21 54.4615 41 72.6154 41C90.7692 41 90.7692 93 108.923 93C127.077 93 127.077 33 145.231 33C163.385 33 163.385 101 181.538 101C199.692 101 199.692 61 217.846 61C236 61 236 45 254.154 45C272.308 45 272.308 121 290.462 121C308.615 121 308.615 149 326.769 149C344.923 149 344.923 1 363.077 1C381.231 1 381.231 81 399.385 81C417.538 81 417.538 129 435.692 129C453.846 129 453.846 25 472 25"
                                        stroke="#64FFDA"
                                        strokeLinecap="round"
                                        strokeWidth="3"
                                    ></path>
                                    <defs>
                                        <linearGradient
                                            id="paint0_linear"
                                            x1="236"
                                            x2="236"
                                            y1="1"
                                            y2="149"
                                            gradientUnits="userSpaceOnUse"
                                        >
                                            <stop stopColor="#64FFDA" stopOpacity="0.3" />
                                            <stop offset="1" stopColor="#64FFDA" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>
                        {/* Chart 2 */}
                        <div className="flex flex-col gap-4 rounded-lg p-6 bg-card-dark border border-border-dark">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-lg font-medium">Top Threats</p>
                                    <p className="text-gray-400 text-sm">Categorized by type</p>
                                </div>
                                <p className="text-primary text-lg font-bold">+8%</p>
                            </div>
                            <div className="grid grid-flow-col gap-6 grid-rows-[1fr_auto] items-end justify-items-center px-3">
                                {[
                                    { label: 'Malware', height: '70%' },
                                    { label: 'Phishing', height: '60%' },
                                    { label: 'DDoS', height: '100%' },
                                    { label: 'SQLi', height: '85%' },
                                    { label: 'XSS', height: '40%' },
                                ].map((bar, i) => (
                                    <React.Fragment key={i}>
                                        <div
                                            className={`w-full rounded-t ${
                                                bar.label === 'DDoS'
                                                    ? 'bg-primary'
                                                    : 'bg-primary/20'
                                            }`}
                                            style={{ height: bar.height }}
                                        ></div>
                                        <p
                                            className={`text-xs font-bold ${
                                                bar.label === 'DDoS'
                                                    ? 'text-primary'
                                                    : 'text-gray-400'
                                            }`}
                                        >
                                            {bar.label}
                                        </p>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                    {/* Reports Table */}
                    <div className="rounded-lg bg-card-dark border border-border-dark overflow-hidden">
                        <div className="p-6">
                            <h2 className="text-lg font-medium">Automated Incident Reports</h2>
                            <p className="text-gray-400 text-sm">Recently generated reports</p>
                        </div>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-border-dark">
                                    {['Incident ID', 'Type', 'Severity', 'Timestamp', 'Actions'].map(
                                        (h, i) => (
                                            <th
                                                key={i}
                                                className="p-4 text-sm font-medium text-gray-400"
                                            >
                                                {h}
                                            </th>
                                        )
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    {
                                        id: '#INC-00123',
                                        type: 'DDoS Attack',
                                        severity: 'Critical',
                                        color: 'text-red-400',
                                        time: '2023-10-27 14:30 UTC',
                                    },
                                    {
                                        id: '#INC-00122',
                                        type: 'Malware Detected',
                                        severity: 'High',
                                        color: 'text-orange-400',
                                        time: '2023-10-27 11:15 UTC',
                                    },
                                    {
                                        id: '#INC-00121',
                                        type: 'Phishing Attempt',
                                        severity: 'Medium',
                                        color: 'text-yellow-400',
                                        time: '2023-10-27 09:45 UTC',
                                    },
                                ].map((r, idx) => (
                                    <tr
                                        key={idx}
                                        className="border-b border-border-dark hover:bg-primary/5"
                                    >
                                        <td className="p-4 text-sm">{r.id}</td>
                                        <td className="p-4 text-sm">{r.type}</td>
                                        <td
                                            className={`p-4 text-sm font-medium ${r.color}`}
                                        >
                                            {r.severity}
                                        </td>
                                        <td className="p-4 text-sm">{r.time}</td>
                                        <td className="p-4 text-sm">
                                            <button className="text-primary hover:underline">
                                                View Report
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
