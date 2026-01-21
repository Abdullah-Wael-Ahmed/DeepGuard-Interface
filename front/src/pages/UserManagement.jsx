import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Edit2,
  Trash2,
  CheckCircle,
  X,
  Lock,
  AlertCircle,
  AlertTriangle
} from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteModal, setDeleteModal] = useState({ 
        open: false, 
        userId: null, 
        userName: '' 
    });
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "operator",
    });

    // fetch users
    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
        const response = await axios.get(
            `${import.meta.env.VITE_BACK}/auth/users`,
            {
            withCredentials: true,
            }
        );
        setUsers(response.data);
        } catch (error) {
        console.error("Failed to fetch users", error);
        toast.error("Failed to load user list");
        } finally {
        setLoading(false);
        }
    };
    const promptDelete = (user) => {
        setDeleteModal({ open: true, userId: user.id, userName: user.name });
    };

    const confirmDelete = async () => {
        try {
            await axios.delete(`${import.meta.env.VITE_BACK}/auth/users/${deleteModal.userId}`, {
                withCredentials: true
            });
            toast.success("User deleted successfully");
            setDeleteModal({ open: false, userId: null, userName: '' });
            fetchUsers();
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete user");
        }
    };
    const validateForm = () => {
        const newErrors = {};
        if (!formData.name.trim()) {
        newErrors.name = "Full Name is required";
        } else if (formData.name.length < 3) {
        newErrors.name = "Name must be at least 3 characters";
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email) {
        newErrors.email = "Email is required";
        } else if (!emailRegex.test(formData.email)) {
        newErrors.email = "Please enter a valid email address";
        }
        if (!formData.password) {
        newErrors.password = "Password is required";
        } else if (formData.password.length < 8) {
        newErrors.password = "Password must be at least 8 characters";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });

        if (errors[name]) {
        setErrors({ ...errors, [name]: null });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Run Validation
        if (!validateForm()) {
        toast.error("Please fix the errors in the form");
        return;
        }

        try {
        await axios.post(`${import.meta.env.VITE_BACK}/auth/register`, formData, {
            withCredentials: true,
        });

        toast.success("User registered successfully");
        setIsModalOpen(false);
        setFormData({ name: "", email: "", password: "", role: "analyst" });
        setErrors({}); // Clear errors
        fetchUsers();
        } catch (error) {
        toast.error(error.response?.data?.message || "Failed to register user");
        }
    };

    // Helper Component for Error Messages
    const InputError = ({ message }) => {
        if (!message) return null;
        return (
        <div className="flex items-center gap-1 mt-1.5 text-red-400 text-xs animate-fade-in">
            <AlertCircle size={12} />
            <span>{message}</span>
        </div>
        );
    };

    return (
        <div className="flex-1 bg-background-dark p-8 overflow-y-auto relative">
        {/* --- HEADER --- */}
        <div className="flex justify-between items-center mb-8">
            <div>
            <h1 className="text-4xl font-bold tracking-tight text-gradient">User Management</h1>
            <p className="text-text-secondary mt-1">
                Manage access control and RBAC policies
            </p>
            </div>
            <button
            onClick={() => {
                setIsModalOpen(true);
                setErrors({});
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-background-dark font-bold rounded-lg transition-colors shadow-glow-primary"
            >
            <UserPlus size={18} />
            Add New User
            </button>
        </div>

        {/* --- STATS CARDS --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-card-dark p-6 rounded-xl border border-gray-800 flex items-center justify-between">
            <div>
                <p className="text-text-secondary text-sm font-medium">
                Total Users
                </p>
                <p className="text-2xl font-bold text-text-main mt-1">
                {users.length}
                </p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg">
                <Users className="text-blue-500" size={24} />
            </div>
            </div>
            <div className="bg-card-dark p-6 rounded-xl border border-gray-800 flex items-center justify-between">
            <div>
                <p className="text-text-secondary text-sm font-medium">
                Active Sessions
                </p>
                <p className="text-2xl font-bold text-text-main mt-1">--</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle className="text-green-500" size={24} />
            </div>
            </div>
            <div className="bg-card-dark p-6 rounded-xl border border-gray-800 flex items-center justify-between">
            <div>
                <p className="text-text-secondary text-sm font-medium">
                Security Roles
                </p>
                <p className="text-2xl font-bold text-text-main mt-1">3</p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-lg">
                <Shield className="text-purple-500" size={24} />
            </div>
            </div>
        </div>

        {/* --- TABLE --- */}
        <div className="bg-card-dark rounded-xl border border-gray-800 overflow-hidden shadow-lg">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-lg font-bold text-text-main">
                Authorized Personnel
            </h3>
            </div>

            {loading ? (
            <div className="p-10 text-center text-text-secondary">
                Loading users...
            </div>
            ) : (
            <table className="w-full text-left border-collapse">
                <thead>
                <tr className="bg-background-dark/50 text-text-secondary text-sm">
                    <th className="px-6 py-4 font-medium">User</th>
                    <th className="px-6 py-4 font-medium">Role</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                {users.map((user) => (
                    <tr
                    key={user.id}
                    className="hover:bg-white/5 transition-colors group"
                    >
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center text-white font-bold text-sm">
                            {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-text-main font-medium text-sm">
                            {user.name}
                            </p>
                            <p className="text-text-secondary text-xs">
                            {user.email}
                            </p>
                        </div>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border
                                    ${
                                    user.role === "admin"
                                        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                        : user.role === "operator"
                                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                        : "bg-gray-700/30 text-gray-400 border-gray-600"
                                    }`}
                        >
                        {user.email === 'admin@deepguard.sec' && <Key size={10} />}
                        {user.role}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                        Active
                        </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {user.email !== 'admin@deepguard.sec' && (
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    promptDelete(user);
                                }}
                                className="p-2 text-text-secondary hover:text-red-500 hover:bg-background-dark rounded-lg transition-colors"
                                title="Delete User"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                        </div>
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
            )}
        </div>
{/* --- DELETE CONFIRMATION MODAL --- */}
        {deleteModal.open && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-card-dark border border-gray-700 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-in">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500">
                            <AlertTriangle size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-text-main mb-2">Delete User?</h2>
                        <p className="text-text-secondary text-sm mb-6">
                            Are you sure you want to delete <span className="text-white font-medium">{deleteModal.userName}</span>? 
                            This action cannot be undone.
                        </p>
                        
                        <div className="flex gap-3 w-full">
                            <button 
                                onClick={() => setDeleteModal({ open: false, userId: null, userName: '' })}
                                className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                            onClick={confirmDelete}
                            className="flex-1 px-4 py-2.5 bg-red-500/10 border border-red-500/50 hover:bg-red-500 hover:text-white text-red-500 rounded-lg font-bold transition-all shadow-glow-red"
                            >
                                Delete User
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        {/* add user modal*/}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all">
            <div className="bg-card-dark border border-gray-700 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-in">
                <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-text-main">
                    Register New Operator
                    </h2>
                    <p className="text-xs text-text-secondary mt-1">
                    Enter credentials for new personnel.
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-text-secondary hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Name Field */}
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                    Full Name
                    </label>
                    <input
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    type="text"
                    className={`w-full bg-background-dark border rounded-lg px-4 py-2 text-text-main outline-none transition-all duration-200
                        ${
                        errors.name
                            ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                            : "border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary/50"
                        }`}
                    placeholder="e.g. John Doe"
                    />
                    <InputError message={errors.name} />
                </div>

                {/* Email Field */}
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                    Email Address
                    </label>
                    <input
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    type="email"
                    className={`w-full bg-background-dark border rounded-lg px-4 py-2 text-text-main outline-none transition-all duration-200
                        ${
                        errors.email
                            ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                            : "border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary/50"
                        }`}
                    placeholder="name@deepguard.sec"
                    />
                    <InputError message={errors.email} />
                </div>

                {/* Password Field */}
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                    Password
                    </label>
                    <div className="relative">
                    <input
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        type="password"
                        className={`w-full bg-background-dark border rounded-lg px-4 py-2 text-text-main outline-none transition-all duration-200 pr-10
                        ${
                            errors.password
                            ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                            : "border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary/50"
                        }`}
                        placeholder="••••••••"
                    />
                    <Lock
                        className="absolute right-3 top-2.5 text-gray-500"
                        size={16}
                    />
                    </div>
                    <InputError message={errors.password} />
                </div>

                {/* Role Field */}
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                    Role Assignment
                    </label>
                    <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full bg-background-dark border border-gray-700 rounded-lg px-4 py-2 text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none cursor-pointer"
                    >
                    <option value="analyst">Analyst</option>
                    <option value="operator">Operator</option>
                    <option value="admin">Admin</option>
                    </select>
                    <p className="text-xs text-text-secondary mt-1.5 ml-1">
                    * Admins have full system access. Analysts are read-only.
                    </p>
                </div>

                <div className="pt-4 flex gap-3">
                    <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-text-secondary hover:text-white rounded-lg font-medium transition-colors border border-gray-600 hover:border-gray-500"
                    >
                    Cancel
                    </button>
                    <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-dark text-background-dark rounded-lg font-bold transition-all shadow-glow-primary active:scale-[0.98]"
                    >
                    Create Account
                    </button>
                </div>
                </form>
            </div>
            </div>
        )}
        </div>
    );
};

export default UserManagement;
