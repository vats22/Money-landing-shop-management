import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Shield,
  UserCheck,
  UserX,
  Users
} from 'lucide-react';

export default function UsersPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    mobile: '',
    email: '',
    password: '',
    status: 'active',
    is_admin: false
  });

  // Permissions state
  const [permissions, setPermissions] = useState({
    accounts: { view: false, add: false, update: false, delete: false },
    users: { view: false, add: false, update: false, delete: false },
    unlock_closed_account: false
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        mobile: user.mobile,
        email: user.email || '',
        password: '',
        status: user.status,
        is_admin: user.is_admin
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        first_name: '',
        last_name: '',
        mobile: '',
        email: '',
        password: '',
        status: 'active',
        is_admin: false
      });
    }
    setShowModal(true);
  };

  const handleOpenPermissions = (user) => {
    setEditingUser(user);
    setPermissions(user.permissions || {
      accounts: { view: false, add: false, update: false, delete: false },
      users: { view: false, add: false, update: false, delete: false },
      unlock_closed_account: false
    });
    setShowPermissionsModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.first_name || !formData.mobile) {
      toast.error('Please fill all required fields');
      return;
    }

    // Mobile number validation: 10 digits starting with 6-9
    if (!/^[6-9]\d{9}$/.test(formData.mobile)) {
      toast.error('Invalid mobile number. Must be 10 digits starting with 6, 7, 8 or 9.');
      return;
    }
    
    if (!editingUser && !formData.password) {
      toast.error('Password is required for new users');
      return;
    }

    try {
      const payload = { ...formData };
      if (!payload.password) delete payload.password;
      
      if (editingUser) {
        await api.put(`/api/users/${editingUser.id}`, payload);
        toast.success('User updated successfully');
      } else {
        await api.post('/api/users', payload);
        toast.success('User created successfully');
      }
      
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save user');
    }
  };

  const handleSavePermissions = async () => {
    try {
      await api.put(`/api/users/${editingUser.id}/permissions`, permissions);
      toast.success('Permissions updated successfully');
      setShowPermissionsModal(false);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update permissions');
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      await api.put(`/api/users/${user.id}/status`);
      toast.success(`User ${user.status === 'active' ? 'deactivated' : 'activated'} successfully`);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/api/users/${deleteId}`);
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
    setDeleteId(null);
  };

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(search.toLowerCase()) ||
    user.first_name.toLowerCase().includes(search.toLowerCase()) ||
    user.last_name.toLowerCase().includes(search.toLowerCase()) ||
    user.mobile.includes(search)
  );

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Shield className="h-16 w-16 text-slate-300 mb-4" />
        <p className="text-xl font-medium text-slate-500">Admin Access Required</p>
        <p className="text-slate-400 mt-2">You don't have permission to access this page</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">User Management</h1>
          <p className="text-slate-500 mt-1">Manage system users and permissions</p>
        </div>
        <Button onClick={() => handleOpenModal()} data-testid="add-user-btn">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                data-testid="user-search"
                placeholder="Search by name, username or mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Users className="h-16 w-16 text-slate-300 mb-4" />
              <p className="text-slate-500 mb-4">No users found</p>
              <Button onClick={() => handleOpenModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Create First User
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="sticky-header">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-4 text-left text-sm font-semibold text-slate-900 bg-slate-50">Actions</th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-slate-900 bg-slate-50">Username</th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-slate-900 bg-slate-50">Name</th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-slate-900 bg-slate-50">Mobile</th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-slate-900 bg-slate-50">Email</th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-slate-900 bg-slate-50">Role</th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-slate-900 bg-slate-50">Status</th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-slate-900 bg-slate-50">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            data-testid={`edit-user-${user.id}`}
                            onClick={() => handleOpenModal(user)}
                            className="p-2 hover:bg-amber-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4 text-amber-600" />
                          </button>
                          <button
                            data-testid={`permissions-user-${user.id}`}
                            onClick={() => handleOpenPermissions(user)}
                            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Permissions"
                          >
                            <Shield className="h-4 w-4 text-blue-600" />
                          </button>
                          <button
                            data-testid={`toggle-status-${user.id}`}
                            onClick={() => handleToggleStatus(user)}
                            className={`p-2 rounded-lg transition-colors ${
                              user.status === 'active' 
                                ? 'hover:bg-red-100' 
                                : 'hover:bg-emerald-100'
                            }`}
                            title={user.status === 'active' ? 'Deactivate' : 'Activate'}
                          >
                            {user.status === 'active' ? (
                              <UserX className="h-4 w-4 text-red-600" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-emerald-600" />
                            )}
                          </button>
                          {user.id !== currentUser?.id && (
                            <button
                              data-testid={`delete-user-${user.id}`}
                              onClick={() => setDeleteId(user.id)}
                              className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{user.username}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {user.first_name} {user.last_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-600">{user.mobile}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{user.email || '-'}</td>
                      <td className="px-4 py-3">
                        {user.is_admin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                            <Shield className="h-3 w-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">User</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={user.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {formatDate(user.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Form Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? 'Edit User' : 'Create User'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Username *
              </label>
              <Input
                data-testid="user-username"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="johndoe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mobile Number *
              </label>
              <Input
                data-testid="user-mobile"
                value={formData.mobile}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setFormData(prev => ({ ...prev, mobile: val }));
                }}
                placeholder="9876543210"
                required
                maxLength={10}
                pattern="[6-9][0-9]{9}"
                title="10 digit mobile number starting with 6, 7, 8 or 9"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                First Name *
              </label>
              <Input
                data-testid="user-firstname"
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                placeholder="John"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Last Name
              </label>
              <Input
                data-testid="user-lastname"
                value={formData.last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                placeholder="Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <Input
                data-testid="user-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password {!editingUser && '*'}
              </label>
              <Input
                data-testid="user-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder={editingUser ? 'Leave blank to keep current' : 'Enter password'}
                required={!editingUser}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Status
              </label>
              <Select
                data-testid="user-status"
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                data-testid="user-is-admin"
                type="checkbox"
                id="is_admin"
                checked={formData.is_admin}
                onChange={(e) => setFormData(prev => ({ ...prev, is_admin: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="is_admin" className="text-sm font-medium text-slate-700">
                Grant Admin Access
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" data-testid="save-user-btn">
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Permissions Modal */}
      <Modal
        isOpen={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
        title={`Permissions - ${editingUser?.username}`}
        size="lg"
      >
        <div className="space-y-6">
          {/* Accounts Module */}
          <div>
            <h4 className="font-medium text-slate-900 mb-3">Accounts Module</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {['view', 'add', 'update', 'delete', 'close'].map((perm) => (
                <label key={perm} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={permissions.accounts?.[perm] || false}
                    onChange={(e) => setPermissions(prev => ({
                      ...prev,
                      accounts: { ...prev.accounts, [perm]: e.target.checked }
                    }))}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm capitalize">{perm}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Users Module */}
          <div>
            <h4 className="font-medium text-slate-900 mb-3">Users Module</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['view', 'add', 'update', 'delete'].map((perm) => (
                <label key={perm} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={permissions.users?.[perm] || false}
                    onChange={(e) => setPermissions(prev => ({
                      ...prev,
                      users: { ...prev.users, [perm]: e.target.checked }
                    }))}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm capitalize">{perm}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Special Permissions */}
          <div>
            <h4 className="font-medium text-slate-900 mb-3">Special Permissions</h4>
            <label className="flex items-center gap-2 p-4 bg-amber-50 rounded-lg">
              <input
                type="checkbox"
                checked={permissions.unlock_closed_account || false}
                onChange={(e) => setPermissions(prev => ({
                  ...prev,
                  unlock_closed_account: e.target.checked
                }))}
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-amber-800">Unlock Closed Accounts</span>
                <p className="text-xs text-amber-600">Allow user to reopen and modify closed accounts</p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowPermissionsModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} data-testid="save-permissions-btn">
              Save Permissions
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
