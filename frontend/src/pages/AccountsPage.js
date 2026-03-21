import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, formatWeight } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { ConfirmDialog } from '../components/ui/Modal';
import { DateRangePicker } from '../components/ui/DateRangePicker';
import { SearchableDropdown } from '../components/ui/SearchableDropdown';
import { toast } from 'sonner';
import {
  Plus, Search, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Eye, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, X, Download
} from 'lucide-react';

const getDefaultStartDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
};
const getToday = () => new Date().toISOString().split('T')[0];

export default function AccountsPage() {
  const navigate = useNavigate();
  const { hasPermission, isAdmin } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [villages, setVillages] = useState([]);

  const [search, setSearch] = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getToday());

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [sortBy, setSortBy] = useState('account_number');
  const [sortOrder, setSortOrder] = useState('desc');
  const [deleteId, setDeleteId] = useState(null);

  const canView = isAdmin || hasPermission('accounts', 'view');
  const canAdd = isAdmin || hasPermission('accounts', 'add');
  const canEdit = isAdmin || hasPermission('accounts', 'update');
  const canDelete = isAdmin || hasPermission('accounts', 'delete');

  useEffect(() => {
    fetchAccounts();
    fetchVillages();
  }, [page, sortBy, sortOrder]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(), limit: limit.toString(),
        sort_by: sortBy, sort_order: sortOrder,
      });
      if (search) params.append('search', search);
      if (villageFilter) params.append('village', villageFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      const response = await api.get(`/api/accounts?${params}`);
      setAccounts(response.data.accounts);
      setTotalPages(response.data.total_pages);
      setTotal(response.data.total);
    } catch (error) {
      toast.error('Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchVillages = async () => {
    try {
      const response = await api.get('/api/villages');
      setVillages(response.data);
    } catch (error) {
      console.error('Failed to fetch villages');
    }
  };

  const handleSearch = () => { setPage(1); fetchAccounts(); };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/api/accounts/${deleteId}`);
      toast.success('Account deleted successfully');
      fetchAccounts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete account');
    }
    setDeleteId(null);
  };

  const clearFilters = () => {
    setSearch(''); setVillageFilter(''); setStatusFilter('');
    setStartDate(getDefaultStartDate()); setEndDate(getToday());
    setPage(1);
    setTimeout(() => fetchAccounts(), 0);
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const columns = [
    { key: 'account_number', label: 'Account #', sortable: true },
    { key: 'opening_date', label: 'Opening Date', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'village', label: 'Village', sortable: true },
    { key: 'jewellery_items', label: 'Jewellery Items' },
    { key: 'total_jewellery_weight', label: 'Total Weight' },
    { key: 'total_landed_amount', label: 'Landed Amt', sortable: true },
    { key: 'total_received_amount', label: 'Received Amt' },
    { key: 'received_principal', label: 'Principal Paid' },
    { key: 'received_interest', label: 'Interest Paid' },
    { key: 'total_pending_amount', label: 'Pending Amt' },
    { key: 'total_pending_interest', label: 'Pending Interest' },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'created_by_name', label: 'Created By' },
    { key: 'updated_at', label: 'Updated On' },
  ];

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-xl font-medium text-slate-500">Access Denied</p>
        <p className="text-slate-400 mt-2">You don't have permission to view accounts</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Accounts</h1>
          <p className="text-slate-500 mt-1">Manage lending accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                const response = await api.get('/api/export/accounts/excel', { responseType: 'blob' });
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'accounts_export.xlsx');
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                toast.success('Export downloaded');
              } catch { toast.error('Export failed'); }
            }}
            data-testid="export-accounts-btn"
            className="flex items-center gap-2 px-3 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            title="Export to Excel"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          {canAdd && (
            <Link to="/accounts/new">
              <Button data-testid="add-account-btn">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-slate-500" />
              Filters
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Input
                data-testid="search-input"
                placeholder="Search name / account #"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            {/* Searchable village dropdown */}
            <SearchableDropdown
              options={villages}
              value={villageFilter}
              onChange={setVillageFilter}
              placeholder="All Villages"
              searchPlaceholder="Search village..."
              testId="village-filter"
            />
            <Select
              data-testid="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="continue">Continue</option>
              <option value="closed">Closed</option>
            </Select>
            {/* Date range picker */}
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={({ startDate: s, endDate: e }) => {
                setStartDate(s);
                setEndDate(e);
              }}
              maxDate={getToday()}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSearch} data-testid="apply-filters-btn">
              <Search className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-slate-500 mb-4">No accounts found</p>
              {canAdd && (
                <Link to="/accounts/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Account
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="table-container">
                <table className="w-full min-w-[1800px]">
                  <thead className="sticky-header">
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-900 bg-slate-50">Actions</th>
                      {columns.map((col) => (
                        <th key={col.key} className="px-4 py-4 text-left text-sm font-semibold text-slate-900 bg-slate-50 whitespace-nowrap">
                          {col.sortable ? (
                            <button onClick={() => handleSort(col.key)} className="flex items-center gap-1 hover:text-emerald-600 transition-colors">
                              {col.label}
                              <SortIcon column={col.key} />
                            </button>
                          ) : col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accounts.map((account, idx) => (
                      <tr key={account.id} className="hover:bg-slate-50 transition-colors" style={{ animationDelay: `${idx * 50}ms` }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              data-testid={`view-account-${account.id}`}
                              onClick={() => navigate(`/accounts/${account.id}`)}
                              className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                              title="View"
                            >
                              <Eye className="h-4 w-4 text-blue-600" />
                            </button>
                            {canEdit && account.status !== 'closed' && (
                              <button
                                data-testid={`edit-account-${account.id}`}
                                onClick={() => navigate(`/accounts/${account.id}/edit`)}
                                className="p-2 hover:bg-amber-100 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4 text-amber-600" />
                              </button>
                            )}
                            {canDelete && account.status !== 'closed' && (
                              <button
                                data-testid={`delete-account-${account.id}`}
                                onClick={() => setDeleteId(account.id)}
                                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm font-medium text-emerald-700">{account.account_number}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(account.opening_date)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{account.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{account.village}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{account.jewellery_items?.length || 0} items</td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-700">{formatWeight(account.total_jewellery_weight)}</td>
                        <td className="px-4 py-3 font-mono text-sm text-emerald-700 font-medium">{formatCurrency(account.total_landed_amount)}</td>
                        <td className="px-4 py-3 font-mono text-sm text-blue-700">{formatCurrency(account.total_received_amount)}</td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-600">{formatCurrency(account.received_principal)}</td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-600">{formatCurrency(account.received_interest)}</td>
                        <td className="px-4 py-3 font-mono text-sm text-amber-700 font-medium">{formatCurrency(account.total_pending_amount)}</td>
                        <td className="px-4 py-3 font-mono text-sm text-red-600 font-medium">{formatCurrency(account.total_pending_interest)}</td>
                        <td className="px-4 py-3"><StatusBadge status={account.status} /></td>
                        <td className="px-4 py-3 text-sm text-slate-600">{account.created_by_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDate(account.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} accounts
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={page === 1}>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-4 py-2 text-sm font-medium">Page {page} of {totalPages}</span>
                    <Button variant="outline" size="icon" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Account"
        message="Are you sure you want to delete this account? This action cannot be undone and will also delete all ledger entries."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
