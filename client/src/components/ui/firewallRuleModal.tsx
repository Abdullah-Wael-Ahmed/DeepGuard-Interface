import { useEffect, useState } from "react";
import { X, ChevronDown, Network } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function FirewallRuleModal({ isOpen, onClose, onSave }) {
    const [rule, setRule] = useState({
        protocol: "TCP",
        sourceIP: "",
        destinationIP: "",
        srcPort: "",
        destPort: "",
        action: true,
        enabled: true,
    });

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }

        // Cleanup on unmount just in case
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name == "srcPort" || name == "destPort") {
            if (!(/^$|^[1-9][0-9]{0,4}$/.test(value))) return;
            if (+value > 65535) return;
            setRule({ ...rule, [name]: value });
        } else {
            setRule({ ...rule, [name]: type === "checkbox" ? checked : value });
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(rule);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Background overlay */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal content */}
            <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-6 w-full max-w-md z-10">
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Add Firewall Rule
                    </h2>
                    <button onClick={onClose}>
                        <X className="w-5 h-5 text-gray-500 hover:text-gray-700" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4 ">
                    {/* Protocol */}

                    <div className="">
                        <label className="block text-sm font-medium mb-1">Protocol</label>
                        <Select value={rule.protocol} onValueChange={(val) => setRule({ ...rule, protocol: val })}>
                            <SelectTrigger className="w-full border font-bold border-gray-300 rounded-lg px-3 py-2 ">
                                <div className="flex items-center justify-content-center gap-2">
                                    <Network className="w-4 h-4 text-blue-400" />
                                    <SelectValue placeholder="Select Protocol" />
                                </div>
                            </SelectTrigger>


                            <SelectContent className="bg-[#0A2342] text-white border border-gray-700">
                                <SelectItem value="TCP">TCP</SelectItem>
                                <SelectItem value="UDP">UDP</SelectItem>
                                <SelectItem value="ICMP">ICMP</SelectItem>
                                <SelectItem value="ANY">ANY</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Source IP */}
                    <div className="grid grid-cols-2 ">
                        <div>
                            <label className="block text-sm font-medium mb-1">Source IP</label>
                            <input
                                type="text"
                                name="sourceIP"
                                value={rule.sourceIP}
                                onChange={handleChange}
                                placeholder="e.g. 192.168.1.10"
                                className="w-full border rounded-l-lg px-3 py-2 dark:bg-zinc-800"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Port</label>
                            <input
                                type="text"
                                name="srcPort"
                                value={rule.srcPort}
                                onChange={handleChange}
                                placeholder="1 - 65535"
                                className="w-full border rounded-r-lg px-3 py-2 dark:bg-zinc-800"
                                required
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Destination IP
                            </label>
                            <input
                                type="text"
                                name="destinationIP"
                                value={rule.destinationIP}
                                onChange={handleChange}
                                placeholder="e.g. 10.0.0.5"
                                className="w-full border rounded-l-lg px-3 py-2 dark:bg-zinc-800"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Port</label>
                            <input
                                type="text"
                                name="destPort"
                                value={rule.destPort}
                                onChange={handleChange}
                                placeholder="1 - 65535"
                                className="w-full border rounded-r-lg px-3 py-2 dark:bg-zinc-800"
                                required
                            />
                        </div>
                    </div>

                    {/* Destination IP */}

                    <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                name="enabled"
                                checked={rule.enabled}
                                id="enabled"
                                onChange={handleChange}
                                className="h-4 w-4"
                            />
                            <label htmlFor="enabled" className="text-sm font-medium select-none">Allow</label>
                        </div>

                        {/* Enabled */}
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                name="enabled"
                                checked={rule.enabled}
                                id="enabled"
                                onChange={handleChange}
                                className="h-4 w-4"
                            />
                            <label htmlFor="enabled" className="text-sm font-medium select-none">Enabled</label>
                        </div>
                    </div>
                    {/* Enabled */}

                    {/* Submit */}
                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700"
                    >
                        Save Rule
                    </button>
                </form>
            </div>
        </div>
    );
}
