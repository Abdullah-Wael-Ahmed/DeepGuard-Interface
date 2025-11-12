    import React from "react";
    import { ChevronDown } from "lucide-react";

    const Settings = () => {
    return (
        <div className="flex min-h-screen text-white font-display max-w-full grow">
        {/* Main content */}
        <main className="flex-1 p-8">
            <div className="flex flex-col gap-8 max-w-7xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black tracking-tight">Settings</h1>
            </div>
            {/* Tabs */}
            <div className="flex gap-8 border-b border-[#8892B0]/20 pb-3">
                {["Application", "Notifications", "Security Preferences"].map(
                (tab, idx) => (
                    <button
                    key={idx}
                    className={`text-sm font-bold tracking-wider pb-3 border-b-2 ${
                        idx === 0
                        ? "border-[#64FFDA] text-white"
                        : "border-transparent text-[#8892B0] hover:text-white"
                    }`}
                    >
                    {tab}
                    </button>
                )
                )}
            </div>
            {/* Settings grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {/* Appearance */}
                <div className="p-6 rounded-lg border border-[#8892B0]/20 bg-[#0A192F] hover:border-[#64FFDA]/50 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(100,255,218,0.1)] flex flex-col gap-4">
                <h3 className="text-lg font-bold">Appearance</h3>
                <div className="flex justify-between items-center">
                    <p className="text-[#8892B0]">Theme</p>
                    <div className="flex gap-2 bg-[#8892B0]/10 rounded-lg p-1">
                    <button className="px-3 py-1 text-sm rounded-md text-white bg-[#64FFDA]/20">
                        Dark
                    </button>
                    <button className="px-3 py-1 text-sm rounded-md text-[#8892B0] hover:bg-[#8892B0]/10">
                        Light
                    </button>
                    </div>
                </div>

                <div className="flex justify-between items-center">
                    <p className="text-[#8892B0]">Language</p>
                    <select className="bg-[#0A192F] text-white border border-[#8892B0]/20 rounded-md p-2 text-sm focus:ring-[#64FFDA] focus:border-[#64FFDA]">
                    <option>English (US)</option>
                    <option>Spanish</option>
                    <option>French</option>
                    </select>
                </div>
                </div>

                {/* Updates */}
                <div className="p-6 rounded-lg border border-[#8892B0]/20 bg-[#0A192F] hover:border-[#64FFDA]/50 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(100,255,218,0.1)] flex flex-col gap-4">
                <h3 className="text-lg font-bold">Updates</h3>
                <div className="flex justify-between items-center">
                    <p className="text-[#8892B0]">Automatic Updates</p>
                    <label className="relative w-[46px] h-[26px] bg-[#8892B0]/20 rounded-full flex items-center cursor-pointer has-[:checked]:justify-end has-[:checked]:bg-[#64FFDA] p-0.5">
                    <div className="h-[22px] w-[22px] bg-white rounded-full transition-transform shadow-md"></div>
                    <input
                        type="checkbox"
                        defaultChecked
                        className="absolute invisible"
                    />
                    </label>
                </div>
                <p className="text-xs text-[#8892B0]">
                    Last checked: 2 hours ago
                </p>
                </div>
            </div>

            {/* User Management */}
            <details className="p-6 rounded-lg border border-[#8892B0]/20 bg-[#0A192F] hover:border-[#64FFDA]/50 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(100,255,218,0.1)] group">
                <summary className="flex justify-between items-center cursor-pointer">
                <p className="text-lg font-bold">User Management</p>
                <ChevronDown className="transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 flex flex-col gap-4">
                {[
                    { name: "John Doe", role: "Administrator" },
                    { name: "Jane Smith", role: "Analyst" },
                ].map((user, idx) => (
                    <div
                    key={idx}
                    className="flex justify-between items-center p-3 bg-[#8892B0]/10 rounded-md"
                    >
                    <p className="text-sm">{user.name}</p>
                    <p className="text-sm text-[#8892B0]">{user.role}</p>
                    <button className="text-[#64FFDA] text-sm font-bold hover:underline">
                        Edit
                    </button>
                    </div>
                ))}
                <button className="self-start mt-2 bg-[#64FFDA]/20 hover:bg-[#64FFDA]/40 font-bold py-2 px-4 rounded-lg text-sm transition-colors">
                    Add User
                </button>
                </div>
            </details>

            {/* Footer buttons */}
            <div className="flex justify-end gap-4 mt-8">
                <button className="text-[#8892B0] hover:text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors">
                Reset to Default
                </button>
                <button className="bg-[#64FFDA] text-[#0A192F] font-bold py-2 px-4 rounded-lg text-sm hover:bg-white transition-colors shadow-[0_0_15px_rgba(100,255,218,0.5)]">
                Save Changes
                </button>
            </div>
            </div>
        </main>
        </div>
    );
    };

    export default Settings;
