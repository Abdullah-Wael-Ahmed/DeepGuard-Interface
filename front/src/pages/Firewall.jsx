import axios from 'axios';
import React, { useState } from 'react';
import { useEffect } from 'react';
import { toast } from 'react-toastify';

const Firewall = () => {


    const chain = ["INPUT", "OUTPUT"];
    const protocol = ["TCP", "UDP", "ICMP", "ALL"];
    const action = ["ACCEPT", "DROP", "REJECT", "LOG"];

    const [formData, setFormData] = useState({
        chain: chain[0],
        protocol: protocol[0],
        srcIp: "",
        destIp: "",
        srcPort: "",
        destPort: "",
        action: action[0]
    });

    const [rules, setRules] = useState([]);
    const [loader, setLoader] = useState(true);

    // const verifyIp = (val) => {

    // }


    const verifyPort = (val) => {
        if (!(/^\d*$/.test(val))) return false
        if (val === "") return true;
        val = +val;
        if (val >= 1 && val <= 65536) return true;
        return false;
    }

    const changePort = (e) => {
        if (!verifyPort(e.target.value)) return;
        setFormData(prev => {
            return {
                ...prev,
                [`${e.target.name}`]: e.target.value
            }
        })
    }

    const addRule = async () => {
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACK}/firewall/add-rule`, {
                ...formData
            }, {
                withCredentials: true
            })
            toast.info(res.message)
        } catch (error) {
            console.log(error);
        }
    }


    const list = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACK}/firewall/list`)
            console.log(res.data.output)
            setRules(res.data.output)
            setLoader(false)
        } catch (error) {
            console.log(error);
        }
    }

    useEffect( () => {
        list()
    } ,[])

    // const verifyIp = (val) => {
    //     if (val === "") return true; // allow empty input

    //     // basic pattern for IPv4
    //     const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    //     if (!ipv4Regex.test(val)) return false;


    //     // check each segment is 0-255
    //     const parts = val.split('.').map(Number);
    //     for (let part of parts) {
    //         if (part < 0 || part > 255) return false;
    //     }
    //     return true;
    // }

    const changeIp = (e) => {
        // if(!verifyIp(e.target.value)) return;
        setFormData((prev) => {
            return {
                ...prev,
                [e.target.name]: e.target.value
            }
        })
    }

    return (
        <main className="flex-1 p-8 overflow-y-auto">

            {/* title and desc */}

            <div className="flex flex-wrap justify-between gap-3 mb-8">
                <div className="flex min-w-72 flex-col gap-3">
                    <p className="text-white text-4xl font-black leading-tight tracking-[-0.033em]">Firewall Management</p>
                    <p className="text-gray-400 text-base font-normal leading-normal">
                        Create and manage firewall rules,
                        monitor traffic, and control network access.</p>
                </div>
            </div>

            {/* firewall form */}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-3">
                    <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-4">
                        Interactive Rule Builder</h2>
                    <div className="p-4 ">
                        <div className="flex flex-col items-stretch justify-start rounded-lg bg-card-dark shadow-[0_0_15px_rgba(100,255,218,0.1)] border border-primary/80">
                            <div className="flex w-full min-w-72 grow flex-col items-stretch justify-center gap-4 p-6">
                                <p className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">New Firewall
                                    Rule</p>
                                <p className="text-gray-400 text-base font-normal leading-normal">Define a new rule to
                                    control network traffic. Specify the action, source/destination IPs, protocol, and
                                    port.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-gray-300 text-sm" htmlFor="action">Chain</label>
                                        <select value={formData.chain} onChange={(e) => {
                                            if (chain.includes(e.target.value)) {
                                                setFormData((prev) => {
                                                    return {
                                                        ...prev,
                                                        chain: e.target.value
                                                    }
                                                })
                                            }
                                        }} className="bg-[#2a3b4c] text-white border border-gray-600 rounded-md p-2 focus:ring-cyan-accent focus:border-cyan-accent" id="action">
                                            {chain.map((obj) => {
                                                return <option value={obj}>{obj}</option>
                                            })}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-gray-300 text-sm" htmlFor="protocol">Protocol</label>
                                        <select value={formData.protocol} onChange={(e) => {
                                            if (protocol.includes(e.target.value)) {
                                                setFormData((prev) => {
                                                    return {
                                                        ...prev,
                                                        protocol: e.target.value
                                                    }
                                                })
                                            }
                                        }} className="bg-[#2a3b4c] text-white border border-gray-600 rounded-md p-2 focus:ring-cyan-accent focus:border-cyan-accent" id="protocol">
                                            {protocol.map((obj) => {
                                                return <option value={obj}>{obj}</option>
                                            })}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-gray-300 text-sm" htmlFor="source-ip">Source IP</label>
                                        <input value={formData.srcIp} onChange={changeIp} name='srcIp' className="bg-[#2a3b4c] text-white border border-gray-600 rounded-md p-2 focus:ring-cyan-accent focus:border-cyan-accent" id="source-ip" placeholder="e.g., 192.168.1.1" type="text" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-gray-300 text-sm" htmlFor="dest-ip">Destination IP</label>
                                        <input value={formData.destIp} onChange={changeIp} name='destIp' className="bg-[#2a3b4c] text-white border border-gray-600 rounded-md p-2 focus:ring-cyan-accent focus:border-cyan-accent" id="dest-ip" placeholder="e.g., 8.8.8.8" type="text" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-gray-300 text-sm" htmlFor="port">Source Port</label>
                                        <input value={formData.srcPort} onChange={changePort} className="bg-[#2a3b4c] text-white border border-gray-600 rounded-md p-2 focus:ring-cyan-accent focus:border-cyan-accent" id="port" name='srcPort' placeholder="e.g., 443" type="text" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-gray-300 text-sm" htmlFor="port">Destination Port</label>
                                        <input value={formData.destPort} onChange={changePort} className="bg-[#2a3b4c] text-white border border-gray-600 rounded-md p-2 focus:ring-cyan-accent focus:border-cyan-accent" id="port" name='destPort' placeholder="e.g., 443" type="text" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-gray-300 text-sm" htmlFor="action">Action</label>
                                        <select value={formData.action} onChange={(e) => {
                                            if (action.includes(e.target.value)) {
                                                setFormData((prev) => {
                                                    return {
                                                        ...prev,
                                                        action: e.target.value
                                                    }
                                                })
                                            }
                                        }} className="bg-[#2a3b4c] text-white border border-gray-600 rounded-md p-2 focus:ring-cyan-accent focus:border-cyan-accent" id="action">
                                            {action.map((obj) => {
                                                return <option value={obj}>{obj}</option>
                                            })}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end mt-4">
                                    <button onClick={addRule} className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-6 bg-[#111828] text-deep-blue text-sm font-bold leading-normal tracking-wider hover:bg-cyan-accent/80 transition-all duration-300">
                                        <span className="truncate">Create Rule</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] my-4">Traffic Filter
                        Visualization</h2>
                    <div className="bg-graphite p-6 rounded-lg shadow-[0_0_15px_rgba(100,255,218,0.1)] border border-cyan-accent/30">
                        <img className="w-full h-auto rounded-lg" data-alt="A line chart showing network traffic over time with a cyan line on a dark background." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAxapMKlgc_epzZzEEGp47ZAcRrWRXSPnu_crsYuNV_ICI1kErUO4qjgFwLco_6rfAQZt5NYOWtI2HSjnpqyct2dWR2dUxeJcDpXPNW1T9k9qsFSPfhQIXg6nEUdPVV1OgXGj86qhFDPoyUf44luLt4PxFuHNnYB_AES_uJmE9iuknLBhkh9aloUC4VzC2pQ0WTU7gnwK9yWl5XPaexOde5yhkFkOU7xcGX2n_c-uVlJ1PRDye4_rDRdGqWa8PG_SacfCR9U5kGEZEx" />
                    </div> */}
                </div>
                {/* <div className="lg:col-span-1">
                    <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-4">Port &amp;
                        Protocol Controls</h2>
                    <div className="bg-graphite p-6 rounded-lg shadow-[0_0_15px_rgba(100,255,218,0.1)] border border-cyan-accent/30 space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-white">HTTP (80)</p>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input defaultChecked className="sr-only peer" type="checkbox" defaultValue />
                                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-accent">
                                </div>
                            </label>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-white">HTTPS (443)</p>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input defaultChecked className="sr-only peer" type="checkbox" defaultValue />
                                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-accent">
                                </div>
                            </label>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-white">FTP (21)</p>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input className="sr-only peer" type="checkbox" defaultValue />
                                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-accent">
                                </div>
                            </label>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-white">SSH (22)</p>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input defaultChecked className="sr-only peer" type="checkbox" defaultValue />
                                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-accent">
                                </div>
                            </label>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-white">DNS (53)</p>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input defaultChecked className="sr-only peer" type="checkbox" defaultValue />
                                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-accent">
                                </div>
                            </label>
                        </div>
                    </div>
                </div> */}
            </div>
            {loader ? "" :
                <div className="mt-8">
                    <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-4">Current rules</h2>
                    <div className="bg-graphite rounded-lg shadow-[0_0_15px_rgba(100,255,218,0.1)] border border-cyan-accent/30 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-300">
                                <thead className="bg-[#2a3b4c] text-xs text-gray-200 uppercase">
                                    <tr>
                                        <th className="px-6 py-3" scope="col">Number</th>
                                        <th className="px-6 py-3" scope="col">CHAIN</th>
                                        <th className="px-6 py-3" scope="col">PROTOCOL</th>
                                        <th className="px-6 py-3" scope="col">SOURCE</th>
                                        <th className="px-6 py-3" scope="col">DESTINATION</th>
                                        <th className="px-6 py-3" scope="col">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rules.map(obj => {
                                        return <tr className="border-b border-gray-700 hover:bg-[#2a3b4c]/50">
                                            <td className="px-6 py-4">{obj.num}</td>
                                            <td className="px-6 py-4">{obj.chain}</td>
                                            <td className="px-6 py-4">{obj.prot}</td>
                                            <td className="px-6 py-4">{obj.source}</td>
                                            <td className="px-6 py-4">{obj.destination}</td>
                                            <td className="px-6 py-4">{obj.target}</td>
                                        </tr>
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            }

            {/* <div className="mt-8">
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-4">Activity Log</h2>
                <div className="bg-graphite rounded-lg shadow-[0_0_15px_rgba(100,255,218,0.1)] border border-cyan-accent/30 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-300">
                            <thead className="bg-[#2a3b4c] text-xs text-gray-200 uppercase">
                                <tr>
                                    <th className="px-6 py-3" scope="col">Timestamp</th>
                                    <th className="px-6 py-3" scope="col">Source IP</th>
                                    <th className="px-6 py-3" scope="col">Destination IP</th>
                                    <th className="px-6 py-3" scope="col">Protocol</th>
                                    <th className="px-6 py-3" scope="col">Port</th>
                                    <th className="px-6 py-3" scope="col">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-gray-700 hover:bg-[#2a3b4c]/50">
                                    <td className="px-6 py-4">2023-10-27 14:30:15</td>
                                    <td className="px-6 py-4">192.168.1.101</td>
                                    <td className="px-6 py-4">8.8.8.8</td>
                                    <td className="px-6 py-4">TCP</td>
                                    <td className="px-6 py-4">443</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 text-xs font-medium rounded-full bg-green-900 text-green-300">Allowed</span>
                                    </td>
                                </tr>
                                <tr className="border-b border-gray-700 hover:bg-[#2a3b4c]/50">
                                    <td className="px-6 py-4">2023-10-27 14:29:55</td>
                                    <td className="px-6 py-4">10.0.0.52</td>
                                    <td className="px-6 py-4">192.168.1.200</td>
                                    <td className="px-6 py-4">UDP</td>
                                    <td className="px-6 py-4">53</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 text-xs font-medium rounded-full bg-green-900 text-green-300">Allowed</span>
                                    </td>
                                </tr>
                                <tr className="border-b border-gray-700 hover:bg-[#2a3b4c]/50">
                                    <td className="px-6 py-4">2023-10-27 14:28:40</td>
                                    <td className="px-6 py-4">172.16.31.5</td>
                                    <td className="px-6 py-4">203.0.113.10</td>
                                    <td className="px-6 py-4">TCP</td>
                                    <td className="px-6 py-4">8080</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 text-xs font-medium rounded-full bg-red-900 text-red-300">Blocked</span>
                                    </td>
                                </tr>
                                <tr className="border-b border-gray-700 hover:bg-[#2a3b4c]/50">
                                    <td className="px-6 py-4">2023-10-27 14:25:11</td>
                                    <td className="px-6 py-4">192.168.1.105</td>
                                    <td className="px-6 py-4">1.1.1.1</td>
                                    <td className="px-6 py-4">ICMP</td>
                                    <td className="px-6 py-4">N/A</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-900 text-yellow-300">Logged</span>
                                    </td>
                                </tr>
                                <tr className="hover:bg-[#2a3b4c]/50">
                                    <td className="px-6 py-4">2023-10-27 14:24:02</td>
                                    <td className="px-6 py-4">198.51.100.12</td>
                                    <td className="px-6 py-4">192.168.1.50</td>
                                    <td className="px-6 py-4">TCP</td>
                                    <td className="px-6 py-4">22</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 text-xs font-medium rounded-full bg-red-900 text-red-300">Blocked</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div> */}
        </main>

    );
}

export default Firewall;
