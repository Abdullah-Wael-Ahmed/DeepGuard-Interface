import { X } from "lucide-react";

export default function Modal({ isOpen, onClose, alert }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Dark background overlay */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose} // close when clicking outside modal
            ></div>

            {/* Modal content */}
            <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b px-6 py-4">
                    <h2 className="text-lg font-semibold text-gray-900">{""}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* Alert Signature */}
                    <div>
                        <p className="text-sm text-gray-500">Signature</p>
                        <p className="font-medium text-gray-900">{alert.signature}</p>
                    </div>

                    {/* Time */}
                    <div>
                        <p className="text-sm text-gray-500">Time</p>
                        <p className="font-medium text-gray-900">{new Date(alert.timestamp).toLocaleString()}</p>
                    </div>

                    {/* Source */}
                    <div>
                        <p className="text-sm text-gray-500">Source</p>
                        <p className="font-medium text-gray-900">
                            {alert.src_ip}:{alert.src_port}
                        </p>
                    </div>

                    {/* Destination */}
                    <div>
                        <p className="text-sm text-gray-500">Destination</p>
                        <p className="font-medium text-gray-900">
                            {alert.dest_ip}:{alert.dest_port}
                        </p>
                    </div>

                    {/* Protocol */}
                    <div>
                        <p className="text-sm text-gray-500">Protocol</p>
                        <p className="font-medium text-gray-900">{alert.protocol}</p>
                    </div>

                    {/* Severity */}
                    <div>
                        <p className="text-sm text-gray-500">Severity</p>
                        <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                alert.severity >= 4
                                    ? "bg-red-100 text-red-700"
                                    : alert.severity === 3
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-green-100 text-green-700"
                            }`}
                        >
                            {alert.severity}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
