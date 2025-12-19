import React from 'react';
import { Users, UserPlus, Shield, Key, MoreVertical, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';

const UserManagement = () => {
  // Mock User Data
  const users = [
    { id: 1, name: 'Admin User', email: 'admin@deepguard.sec', role: 'Super Admin', status: 'Active', lastActive: 'Now' },
    { id: 2, name: 'SecAnalyst01', email: 'analyst1@deepguard.sec', role: 'Analyst', status: 'Active', lastActive: '2m ago' },
    { id: 3, name: 'NetOp_Lead', email: 'netops@deepguard.sec', role: 'Viewer', status: 'Inactive', lastActive: '2d ago' },
    { id: 4, name: 'Auditor_External', email: 'auditor@external.com', role: 'Auditor', status: 'Active', lastActive: '1h ago' },
  ];

  return (
    <div className="flex-1 bg-background-dark p-8 overflow-y-auto">
       {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-main">User Management</h1>
          <p className="text-text-secondary mt-1">Manage access control and RBAC policies</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-background-dark font-bold rounded-lg transition-colors shadow-glow-primary">
            <UserPlus size={18} />
            Add New User
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Summary Cards */}
          <div className="bg-card-dark p-6 rounded-xl border border-gray-800 flex items-center justify-between">
              <div>
                  <p className="text-text-secondary text-sm font-medium">Total Users</p>
                  <p className="text-2xl font-bold text-text-main mt-1">12</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Users className="text-blue-500" size={24} />
              </div>
          </div>
          <div className="bg-card-dark p-6 rounded-xl border border-gray-800 flex items-center justify-between">
              <div>
                  <p className="text-text-secondary text-sm font-medium">Active Sessions</p>
                  <p className="text-2xl font-bold text-text-main mt-1">3</p>
              </div>
               <div className="p-3 bg-green-500/10 rounded-lg">
                  <CheckCircle className="text-green-500" size={24} />
              </div>
          </div>
           <div className="bg-card-dark p-6 rounded-xl border border-gray-800 flex items-center justify-between">
              <div>
                  <p className="text-text-secondary text-sm font-medium">Security Roles</p>
                  <p className="text-2xl font-bold text-text-main mt-1">4</p>
              </div>
               <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Shield className="text-purple-500" size={24} />
              </div>
          </div>
      </div>

      {/* Users Table */}
      <div className="bg-card-dark rounded-xl border border-gray-800 overflow-hidden shadow-lg">
          <div className="p-6 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-text-main">Authorized Personnel</h3>
              <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search users..." 
                    className="bg-background-dark border border-gray-700 text-sm rounded-lg px-4 py-2 pl-4 focus:outline-none focus:border-primary text-text-main w-64"
                  />
              </div>
          </div>
          <table className="w-full text-left border-collapse">
              <thead>
                  <tr className="bg-background-dark/50 text-text-secondary text-sm">
                      <th className="px-6 py-4 font-medium">User</th>
                      <th className="px-6 py-4 font-medium">Role</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Last Active</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                  {users.map(user => (
                      <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center text-white font-bold text-sm">
                                      {user.name.charAt(0)}
                                  </div>
                                  <div>
                                      <p className="text-text-main font-medium text-sm">{user.name}</p>
                                      <p className="text-text-secondary text-xs">{user.email}</p>
                                  </div>
                              </div>
                          </td>
                          <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border
                                ${user.role === 'Super Admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                                  user.role === 'Analyst' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                                  'bg-gray-700/30 text-gray-400 border-gray-600'}`}>
                                  {user.role === 'Super Admin' && <Key size={10} />}
                                  {user.role}
                              </span>
                          </td>
                          <td className="px-6 py-4">
                               <span className={`inline-flex items-center gap-1.5 text-xs font-medium
                                ${user.status === 'Active' ? 'text-green-400' : 'text-gray-500'}`}>
                                  <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
                                  {user.status}
                              </span>
                          </td>
                          <td className="px-6 py-4 text-text-secondary text-sm font-mono">
                              {user.lastActive}
                          </td>
                          <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button className="p-2 text-text-secondary hover:text-primary hover:bg-background-dark rounded-lg transition-colors" title="Edit">
                                      <Edit2 size={16} />
                                  </button>
                                  <button className="p-2 text-text-secondary hover:text-red-500 hover:bg-background-dark rounded-lg transition-colors" title="Delete">
                                      <Trash2 size={16} />
                                  </button>
                              </div>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
    </div>
  );
};

export default UserManagement;
