import axios from "axios";
import React, { useState, useEffect } from "react"; // Combined React imports
import { toast } from "react-toastify";
import { LoaderCircle, X } from "lucide-react"; // Added 'X' icon for the close button

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
        action: action[0],
    });

    const [rules, setRules] = useState([]);
    const [loader, setLoader] = useState(true);

    // --- NEW STATE FOR MODAL ---
    const [selectedRule, setSelectedRule] = useState(null);

    const verifyPort = (val) => {
        if (!/^\d*$/.test(val)) return false;
        if (val === "") return true;
        val = +val;
        if (val >= 1 && val <= 65536) return true;
        return false;
    };

    const changePort = (e) => {
        if (!verifyPort(e.target.value)) return;
        setFormData((prev) => {
            return {
                ...prev,
                [`${e.target.name}`]: e.target.value,
            };
        });
    };

    const validateIp = (ip) => {
        if (ip == "") return true
        
        // 1. Check if input is empty or not a string
        if (typeof ip !== 'string') return false;

        // 2. Trim whitespace
        ip = ip.trim();

        // 3. Basic Format Check: Must have 4 segments
        const segments = ip.split('.');
        if (segments.length !== 4) return false;

        // 4. Validate each segment
        for (const segment of segments) {
            // A. Check for empty segments (e.g., "192..1.1")
            if (segment.length === 0) return false;

            // B. Check for non-numeric characters
            if (!/^\d+$/.test(segment)) return false;

            // C. Check for leading zeros (e.g., "192.168.01.1" is invalid)
            // Exception: "0" by itself is valid, but "01" is not.
            if (segment.length > 1 && segment.startsWith('0')) return false;

            // D. Check numeric range (0-255)
            const num = parseInt(segment, 10);
            if (num < 0 || num > 255) return false;
        }

        return true;
    };

    const addRule = async () => {
        try {
            if (!validateIp(formData.srcIp) || !validateIp(formData.destIp)){
                toast.error("Invalid IP address")
                return;
            }
            const res = await axios.post(
                `${import.meta.env.VITE_BACK}/firewall/add-rule`,
                { ...formData },
                { withCredentials: true }
            );
            toast.info(res.data.message);
            list();
        } catch (error) {
            console.log(error);
        }
    };

    const list = async () => {
        try {
            setLoader(true);
            const res = await axios.get(`${import.meta.env.VITE_BACK}/firewall/list`);
            setRules(res.data.output);
            setLoader(false);
        } catch (error) {
            console.log(error);
        }
    };

    const deleteRule = async (index, chain) => {
        try {
            await axios.delete(
                `${import.meta.env.VITE_BACK}/firewall/delete-rule`,
                {
                    withCredentials: true, params: {
                        chain: chain,
                        ruleNum: index
                    }
                }
            )
            closeModal()
            list()
        } catch (error) {
            console.log(error)
        }
    }

    useEffect(() => {
        list();
    }, []);

    const changeIp = (e) => {
        setFormData((prev) => {
            return {
                ...prev,
                [e.target.name]: e.target.value,
            };
        });
    };

    // --- MODAL CLOSE HANDLER ---
    const closeModal = () => {
        setSelectedRule(null);
    };

    return (
        <main className="flex-1 p-8 overflow-y-auto relative">
            {/* title and desc */}
            <div className="flex flex-wrap justify-between gap-3 mb-8">
                <div className="flex min-w-72 flex-col gap-3">
                    <p className="text-white text-4xl font-black leading-tight tracking-[-0.033em]">
                        Firewall Management
                    </p>
                    <p className="text-gray-400 text-base font-normal leading-normal">
                        Create and manage firewall rules, monitor traffic, and control network access.
                    </p>
                </div>
            </div>

            {/* firewall form */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-3">
                    <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-4">
                        Interactive Rule Builder
                    </h2>
                    <div className="p-4 ">
                        <div className="flex flex-col items-stretch justify-start rounded-lg bg-card-dark shadow-[0_0_15px_rgba(100,255,218,0.1)] border border-primary/80">
                            <div className="flex w-full min-w-72 grow flex-col items-stretch justify-center gap-4 p-6">
                                <p className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">
                                    New Firewall Rule
                                </p>
                                <p className="text-gray-400 text-base font-normal leading-normal">
                                    Define a new rule to control network traffic. Specify the action, source/destination IPs, protocol, and port.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Chain */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-gray-300 text-sm" htmlFor="chain">Chain</label>
                                        <select
                                            value={formData.chain}
                                            onChange={(e) => {
                                                if (chain.includes(e.target.value)) {
                                                    setFormData((prev) => ({ ...prev, chain: e.target.value }));
                                                }
                                            }}
                                            className="bg-[#2a3b4c] text-white border border-gray-600 rounded-md p-2 focus:ring-cyan-accent focus:border-cyan-accent"
                                            id="chain"
                                        >
                                            {chain.map((obj) => <option key={obj} value={obj}>{obj}</option>)}
                                        </select>
                                    </div>
                                    {/* Protocol */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-gray-300 text-sm" htmlFor="protocol">Protocol</label>
                                        <select
                                            value={formData.protocol}
                                            onChange={(e) => {
                                                if (protocol.includes(e.target.value)) {
                                                    setFormData((prev) => ({ ...prev, protocol: e.target.value }));
                                                }
                                            }}
                                            className="bg-[#2a3b4c] text-white border border-gray-600 rounded-md p-2 focus:ring-cyan-accent focus:border-cyan-accent"
                                            id="protocol"
                                        >
                                            {protocol.map((obj) => <option key={obj} value={obj}>{obj}</option>)}
                                        </select>
                                    </div>
                                    {/* Source IP */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-gray-300 text-sm" htmlFor="source-ip">Source IP</label>
                                        <input
                                            value={formData.srcIp}
                                            onChange={changeIp}
                                            name="srcIp"
                                            className="bg-[#2a3b4c] text-white border border-gray-600 rounded-md p-2 focus:ring-cyan-accent focus:border-cyan-accent"
                                            id="source-ip"
                                            placeholder="e.g., 192.168.1.1"
                                            type="text"
                                        />
                                    </div>
                                    {/* Destination IP */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-gray-300 text-sm" htmlFor="dest-ip">Destination IP</label>
                                        <input
                                            value={formData.destIp}
                                            onChange={changeIp}
                                            name="destIp"
                                            className="bg-[#2a3b4c] text-white border border-gray-600 rounded-md p-2 focus:ring-cyan-accent focus:border-cyan-accent"
                                            id="dest-ip"
                                            placeholder="e.g., 8.8.8.8"
                                            type="text"
                                        />
                                    </div>
                                    {/* Source Port */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-gray-300 text-sm" htmlFor="srcPort">Source Port</label>
                                        <input
                                            value={formData.srcPort}
                                            onChange={changePort}
                                            className="bg-[#2a3b4c] text-white border border-gray-600 rounded-md p-2 focus:ring-cyan-accent focus:border-cyan-accent"
                                            id="srcPort"
                                            name="srcPort"
                                            placeholder="e.g., 443"
                                            type="text"
                                        />
                                    </div>
                                    {/* Dest Port */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-gray-300 text-sm" htmlFor="destPort">Destination Port</label>
                                        <input
                                            value={formData.destPort}
                                            onChange={changePort}
                                            className="bg-[#2a3b4c] text-white border border-gray-600 rounded-md p-2 focus:ring-cyan-accent focus:border-cyan-accent"
                                            id="destPort"
                                            name="destPort"
                                            placeholder="e.g., 443"
                                            type="text"
                                        />
                                    </div>
                                    {/* Action */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-gray-300 text-sm" htmlFor="action">Action</label>
                                        <select
                                            value={formData.action}
                                            onChange={(e) => {
                                                if (action.includes(e.target.value)) {
                                                    setFormData((prev) => ({ ...prev, action: e.target.value }));
                                                }
                                            }}
                                            className="bg-[#2a3b4c] text-white border border-gray-600 rounded-md p-2 focus:ring-cyan-accent focus:border-cyan-accent"
                                            id="action"
                                        >
                                            {action.map((obj) => <option key={obj} value={obj}>{obj}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end mt-4">
                                    <button
                                        onClick={addRule}
                                        className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-6 bg-[#111828] text-deep-blue text-sm font-bold leading-normal tracking-wider hover:bg-cyan-accent/80 transition-all duration-300"
                                    >
                                        <span className="truncate">Create Rule</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8">
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-4">
                    Current rules
                </h2>
                <div className="bg-graphite rounded-lg shadow-[0_0_15px_rgba(100,255,218,0.1)] border border-cyan-accent/30 overflow-hidden">
                    <div className="overflow-x-auto overflow-y-auto relative max-h-[350px]">
                        <table className="w-full text-left text-sm text-gray-300">
                            <thead className="bg-[#2a3b4c] text-xs text-gray-200 uppercase sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3" scope="col">Number</th>
                                    <th className="px-6 py-3" scope="col">CHAIN</th>
                                    <th className="px-6 py-3" scope="col">PROTOCOL</th>
                                    <th className="px-6 py-3" scope="col">SOURCE</th>
                                    <th className="px-6 py-3" scope="col">DESTINATION</th>
                                    <th className="px-6 py-3" scope="col">Action</th>
                                </tr>
                            </thead>
                            {loader ? (
                                <tbody>
                                    <tr>
                                        <td colSpan={6} className="align-center h-40">
                                            <LoaderCircle className="animate-spin m-auto" size={64} />
                                        </td>
                                    </tr>
                                </tbody>
                            ) : (
                                <tbody>
                                    {rules.map((obj, index) => {
                                        return (
                                            <tr
                                                key={obj.id || index}
                                                // --- CLICK HANDLER ---
                                                onClick={() => setSelectedRule(obj)}
                                                className="border-b border-gray-700 hover:bg-[#2a3b4c]/50 cursor-pointer transition-colors duration-200"
                                            >
                                                <td className="px-6 py-4">{obj.num}</td>
                                                <td className="px-6 py-4">{obj.chain}</td>
                                                <td className="px-6 py-4">{obj.prot}</td>
                                                <td className="px-6 py-4">{obj.source}</td>
                                                <td className="px-6 py-4">{obj.destination}</td>
                                                <td className="px-6 py-4">{obj.target}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            )}
                        </table>
                    </div>
                </div>
            </div>

            {/* --- RULE DETAILS MODAL --- */}
            {selectedRule && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[#1e293b] rounded-lg shadow-2xl border border-gray-600 w-full max-w-lg transform transition-all scale-100">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-700">
                            <h3 className="text-xl font-bold text-white">Rule Details</h3>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 grid grid-cols-2 gap-y-4 gap-x-6">
                            <div className="col-span-2 sm:col-span-1">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Number</p>
                                <p className="text-white font-mono text-lg">{selectedRule.num || "-"}</p>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Chain</p>
                                <p className="text-cyan-400 font-semibold">{selectedRule.chain || "-"}</p>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Protocol</p>
                                <p className="text-white">{selectedRule.prot || "-"}</p>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Action</p>
                                <span className={`inline-block px-2 py-1 rounded text-xs font-bold 
                                    ${selectedRule.target === 'ACCEPT' ? 'bg-green-900/50 text-green-400' :
                                        selectedRule.target === 'DROP' ? 'bg-red-900/50 text-red-400' :
                                            'bg-yellow-900/50 text-yellow-400'}`}>
                                    {selectedRule.target || "-"}
                                </span>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Source</p>
                                <div className="bg-[#111828] p-2 rounded border border-gray-700 text-sm text-gray-200 font-mono break-all">
                                    {selectedRule.source || "Any"}
                                </div>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Destination</p>
                                <div className="bg-[#111828] p-2 rounded border border-gray-700 text-sm text-gray-200 font-mono break-all">
                                    {selectedRule.destination || "Any"}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-700 flex justify-end gap-x-1">
                            <button onClick={() => deleteRule(selectedRule.num, selectedRule.chain)} className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors">Delete</button>
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-medium transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default Firewall;