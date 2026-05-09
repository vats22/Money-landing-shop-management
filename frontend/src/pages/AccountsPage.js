import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { MultiSelectDropdown } from '../components/ui/MultiSelectDropdown';
import AccountCard from '../components/ui/AccountCard';
import { toast } from 'sonner';
import {
  Plus, Search, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Eye, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, X, Download,
  SlidersHorizontal, FileBox
} from 'lucide-react';

const FILTER_STORAGE_KEY = 'lendledger_accounts_filters';

const getDefaultStartDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 180);
  return date.toISOString().split('T')[0];
};
const getToday = () => new Date().toISOString().split('T')[0];

const loadFilters = () => {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
};

const saveFilters = (filters) => {
  try { localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters)); } catch {}
};

export default function AccountsPage() {
  const navigate = useNavigate();
  const { hasPermission, isAdmin } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [villages, setVillages] = useState([]);

  const savedFilters = loadFilters();
  const [search, setSearch] = useState(savedFilters?.search || '');
  const [villageFilter, setVillageFilter] = useState(savedFilters?.villageFilter || []);
  const [statusFilter, setStatusFilter] = useState(savedFilters?.statusFilter || '');
  const [startDate, setStartDate] = useState(savedFilters?.startDate || getDefaultStartDate());
  const [endDate, setEndDate] = useState(savedFilters?.endDate || getToday());

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('account_number');
  const [sortOrder, setSortOrder] = useState('desc');
  const [deleteId, setDeleteId] = useState(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [density, setDensity] = useState(() => localStorage.getItem('lendledger_density') || 'comfortable');

  const canView = isAdmin || hasPermission('accounts', 'view');
  const canAdd = isAdmin || hasPermission('accounts', 'add');
  const canEdit = isAdmin || hasPermission('accounts', 'update');
  const canDelete = isAdmin || hasPermission('accounts', 'delete');

  useEffect(() => {
    fetchAccounts();
    fetchVillages();
  }, [page, sortBy, sortOrder, limit]);

  const fetchAccounts = async (overrides = {}) => {
    setLoading(true);
    try {
      const eff = {
        search, villageFilter, statusFilter, startDate, endDate,
        ...overrides,
      };
      const params = new URLSearchParams({
        page: page.toString(), limit: limit.toString(),
        sort_by: sortBy, sort_order: sortOrder,
      });
      if (eff.search) params.append('search', eff.search);
      if (eff.villageFilter && eff.villageFilter.length > 0) params.append('village', eff.villageFilter.join(','));
      if (eff.statusFilter) params.append('status', eff.statusFilter);
      if (eff.startDate) params.append('start_date', eff.startDate);
      if (eff.endDate) params.append('end_date', eff.endDate);
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

  const handleSearch = () => {
    saveFilters({ search, villageFilter, statusFilter, startDate, endDate });
    setPage(1);
    fetchAccounts();
  };

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
    const freshStart = getDefaultStartDate();
    const freshEnd = getToday();
    setSearch(''); setVillageFilter([]); setStatusFilter('');
    setStartDate(freshStart); setEndDate(freshEnd);
    setPage(1);
    localStorage.removeItem(FILTER_STORAGE_KEY);
    // Auto-apply with fresh values directly (don't wait for state propagation)
    fetchAccounts({ search: '', villageFilter: [], statusFilter: '', startDate: freshStart, endDate: freshEnd });
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
    <div className="space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-primary-ink">Accounts</h1>
          <p className="text-sm text-secondary-ink mt-1">Manage lending accounts</p>
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
            className="hidden sm:flex items-center gap-2 px-3 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors tap-target"
            title="Export to Excel"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          {canAdd && (
            <Link to="/accounts/new" className="flex-1 sm:flex-none">
              <Button data-testid="add-account-btn" className="w-full sm:w-auto tap-target">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile filter trigger */}
      <div className="lg:hidden flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowFilterSheet(true)}
          data-testid="open-filter-sheet"
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-slate-300 bg-white text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 active:bg-slate-100 tap-target"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters {(villageFilter.length + (statusFilter ? 1 : 0) + (search ? 1 : 0)) > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
              {villageFilter.length + (statusFilter ? 1 : 0) + (search ? 1 : 0)}
            </span>
          )}
        </button>
        <Input
          data-testid="search-input-mobile"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 tap-target"
        />
        <Button onClick={handleSearch} data-testid="apply-filters-btn-mobile" size="icon" className="tap-target">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Desktop filters - compact single row */}
      <div className="hidden lg:flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-ink pointer-events-none" />
          <Input
            data-testid="search-input"
            placeholder="Search name / account #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9 h-9"
          />
        </div>
        <div className="w-44">
          <MultiSelectDropdown
            options={villages}
            value={villageFilter}
            onChange={setVillageFilter}
            placeholder="All Villages"
            searchPlaceholder="Search village..."
            testId="village-filter"
          />
        </div>
        <div className="w-36">
          <Select
            data-testid="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9"
          >
            <option value="">All Status</option>
            <option value="continue">Continue</option>
            <option value="closed">Closed</option>
            <option value="renewed">Renewed</option>
            <option value="immediate action needed">Action Needed</option>
          </Select>
        </div>
        <div className="w-56">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={({ startDate: s, endDate: e }) => { setStartDate(s); setEndDate(e); }}
            maxDate={getToday()}
          />
        </div>
        <Button onClick={handleSearch} data-testid="apply-filters-btn" size="sm" className="h-9">
          <Search className="h-4 w-4 mr-1.5" /> Apply
        </Button>
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-secondary-ink">
          <X className="h-4 w-4 mr-1" /> Clear
        </Button>
        <div className="ml-auto inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Density">
          <button
            type="button"
            onClick={() => { setDensity('comfortable'); localStorage.setItem('lendledger_density','comfortable'); }}
            className={`px-2.5 py-1 text-[11px] rounded-md ${density==='comfortable' ? 'bg-emerald-600 text-white' : 'text-secondary-ink hover:bg-slate-50'}`}
            data-testid="density-comfortable"
            title="Comfortable rows"
          >Cozy</button>
          <button
            type="button"
            onClick={() => { setDensity('compact'); localStorage.setItem('lendledger_density','compact'); }}
            className={`px-2.5 py-1 text-[11px] rounded-md ${density==='compact' ? 'bg-emerald-600 text-white' : 'text-secondary-ink hover:bg-slate-50'}`}
            data-testid="density-compact"
            title="Compact rows"
          >Compact</button>
        </div>
      </div>

      {/* Mobile filter bottom sheet (portal) */}
      {showFilterSheet && createPortal(
        <div className="fixed inset-0 z-[100] lg:hidden" data-testid="filter-sheet">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fadeIn" onClick={() => setShowFilterSheet(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto safe-bottom animate-slideUp">
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="w-10 h-1 rounded-full bg-slate-300 absolute left-1/2 -translate-x-1/2 -top-2" />
              <h3 className="text-base font-semibold text-primary-ink">Filters</h3>
              <button type="button" onClick={() => { clearFilters(); setShowFilterSheet(false); }} className="text-xs text-secondary-ink hover:text-slate-900 tap-target px-2 py-1">Reset</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">Search</label>
                <Input
                  placeholder="Name / account #"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">Village</label>
                <MultiSelectDropdown
                  options={villages}
                  value={villageFilter}
                  onChange={setVillageFilter}
                  placeholder="All Villages"
                  searchPlaceholder="Search village..."
                  testId="village-filter-mobile"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">Status</label>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  data-testid="status-filter-mobile"
                >
                  <option value="">All Status</option>
                  <option value="continue">Continue</option>
                  <option value="closed">Closed</option>
                  <option value="renewed">Renewed</option>
                  <option value="immediate action needed">Immediate Action Needed</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">Opening Date Range</label>
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onChange={({ startDate: s, endDate: e }) => { setStartDate(s); setEndDate(e); }}
                  maxDate={getToday()}
                />
              </div>
              <div className="pt-2 flex gap-2">
                <Button variant="outline" onClick={() => setShowFilterSheet(false)} className="flex-1 tap-target">Cancel</Button>
                <Button onClick={() => { handleSearch(); setShowFilterSheet(false); }} className="flex-1 tap-target" data-testid="apply-filters-sheet-btn">
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <FileBox className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="text-base font-semibold text-primary-ink mb-1">No accounts found</p>
              <p className="text-sm text-secondary-ink mb-5">Adjust filters or create your first account.</p>
              {canAdd && (
                <Link to="/accounts/new">
                  <Button className="tap-target">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Account
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden" data-testid="accounts-card-list">
            {accounts.map(account => (
              <AccountCard
                key={account.id}
                account={account}
                canEdit={canEdit}
                canDelete={canDelete}
                onView={() => navigate(`/accounts/${account.id}`)}
                onEdit={() => navigate(`/accounts/${account.id}/edit`)}
                onDelete={() => setDeleteId(account.id)}
              />
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden lg:block">
            <CardContent className="p-0">
              <div className="table-container">
                <table className={`w-full min-w-[1800px] ${density === 'compact' ? 'text-xs' : 'text-sm'}`}>
                  <thead className="sticky-header">
                    <tr className="border-b border-slate-200">
                      <th className={`${density === 'compact' ? 'px-3 py-2.5' : 'px-4 py-4'} text-left font-semibold text-primary-ink bg-slate-50 sticky-col`}>Actions</th>
                      {columns.map((col) => (
                        <th key={col.key} className={`${density === 'compact' ? 'px-3 py-2.5' : 'px-4 py-4'} text-left font-semibold text-primary-ink bg-slate-50 whitespace-nowrap`}>
                          {col.sortable ? (
                            <button onClick={() => handleSort(col.key)} className="flex items-center gap-1 hover:text-emerald-700 transition-colors">
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
                        <td className={`${density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'} sticky-col bg-white`}>
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
                        <td className={density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'}>
                          <button onClick={() => navigate(`/accounts/${account.id}`)} className="font-mono text-sm font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer" data-testid={`click-acct-num-${account.id}`}>
                            {account.account_number}
                          </button>
                        </td>
                        <td className={`${density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'} text-secondary-ink`}>{formatDate(account.opening_date)}</td>
                        <td className={density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'}>
                          <button onClick={() => navigate(`/accounts/${account.id}`)} className="font-medium text-primary-ink hover:text-emerald-700 hover:underline cursor-pointer" data-testid={`click-acct-name-${account.id}`}>
                            {account.name}
                          </button>
                        </td>
                        <td className={`${density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'} text-secondary-ink`}>{account.village}</td>
                        <td className={`${density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'} text-secondary-ink`}>{account.jewellery_items?.length || 0} items</td>
                        <td className={`${density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'} font-mono text-secondary-ink text-right tabular-nums`}>{formatWeight(account.total_jewellery_weight)}</td>
                        <td className={`${density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'} font-mono text-success-ink font-semibold text-right tabular-nums`}>{formatCurrency(account.total_landed_amount)}</td>
                        <td className={`${density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'} font-mono text-info-ink text-right tabular-nums`}>{formatCurrency(account.total_received_amount)}</td>
                        <td className={`${density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'} font-mono text-secondary-ink text-right tabular-nums`}>{formatCurrency(account.received_principal)}</td>
                        <td className={`${density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'} font-mono text-secondary-ink text-right tabular-nums`}>{formatCurrency(account.received_interest)}</td>
                        <td className={`${density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'} font-mono text-warning-ink font-semibold text-right tabular-nums`}>{formatCurrency(account.total_pending_amount)}</td>
                        <td className={`${density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'} font-mono text-danger-ink font-semibold text-right tabular-nums`}>{formatCurrency(account.total_pending_interest)}</td>
                        <td className={density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'}><StatusBadge status={account.status} /></td>
                        <td className={`${density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'} text-secondary-ink`}>{account.created_by_name || '-'}</td>
                        <td className={`${density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'} text-muted-ink`}>{formatDate(account.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination - works for both views */}
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <p className="text-xs sm:text-sm text-secondary-ink">
                    {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
                  </p>
                  <select
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                    data-testid="page-size-select"
                    className="px-2 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value={10}>10 / page</option>
                    <option value={30}>30 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={page === 1} className="tap-target"><ChevronsLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="tap-target"><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="px-3 py-2 text-xs sm:text-sm font-medium">Page {page} / {totalPages}</span>
                  <Button variant="outline" size="icon" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="tap-target"><ChevronRight className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="tap-target"><ChevronsRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

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
