import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { formatCurrency, formatDate, formatWeight } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Pencil,
  Gem,
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar,
  MapPin,
  User,
  FileText,
  BookOpen,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react';

const getToday = () => new Date().toISOString().split('T')[0];

export default function AccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Close/Reopen modals
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [closeDate, setCloseDate] = useState(getToday());
  const [closeRemarks, setCloseRemarks] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchAccountData();
  }, [id]);

  const fetchAccountData = async () => {
    try {
      const [accountRes, ledgerRes] = await Promise.all([
        api.get(`/api/accounts/${id}`),
        api.get(`/api/ledger/${id}`)
      ]);
      setAccount(accountRes.data);
      setLedger(ledgerRes.data);
    } catch (error) {
      toast.error('Failed to fetch account details');
      navigate('/accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAccount = async () => {
    if (!closeDate) {
      toast.error('Please select a close date');
      return;
    }
    setProcessing(true);
    try {
      await api.post(`/api/accounts/${id}/close`, {
        close_date: closeDate,
        remarks: closeRemarks
      });
      toast.success('Account closed successfully');
      setShowCloseModal(false);
      fetchAccountData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to close account');
    } finally {
      setProcessing(false);
    }
  };

  const handleReopenAccount = async () => {
    if (!reopenReason.trim()) {
      toast.error('Reason for reopening is mandatory');
      return;
    }
    setProcessing(true);
    try {
      await api.post(`/api/accounts/${id}/reopen`, {
        reason: reopenReason
      });
      toast.success('Account reopened successfully');
      setShowReopenModal(false);
      setReopenReason('');
      fetchAccountData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reopen account');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!account) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'jewellery', label: 'Jewellery', icon: Gem },
    { id: 'landed', label: 'Landed Entries', icon: TrendingUp },
    { id: 'received', label: 'Received Entries', icon: TrendingDown },
    { id: 'ledger', label: 'Ledger', icon: BookOpen },
  ];

  const isClosed = account.status === 'closed';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Closed Account Banner */}
      {isClosed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800">Account Closed</p>
            <p className="text-sm text-amber-600">
              Closed on {formatDate(account.closed_at)} by {account.closed_by_name}
              {account.close_remarks && ` - ${account.close_remarks}`}
            </p>
          </div>
          {account.user_can_unlock && (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setShowReopenModal(true)}
              data-testid="reopen-account-btn"
            >
              <Unlock className="h-4 w-4 mr-2" />
              Reopen Account
            </Button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/accounts')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-display text-slate-900">
                {account.name}
              </h1>
              <StatusBadge status={account.status} />
            </div>
            <p className="text-slate-500 mt-1 font-mono">{account.account_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Close Account Button - only if not closed and user has permission */}
          {!isClosed && account.user_can_close && (
            <Button 
              variant="outline" 
              onClick={() => setShowCloseModal(true)}
              data-testid="close-account-btn"
            >
              <Lock className="h-4 w-4 mr-2" />
              Close Account
            </Button>
          )}
          {/* Edit Button - only if not closed or user can unlock */}
          {account.user_can_edit && (
            <Link to={`/accounts/${id}/edit`}>
              <Button data-testid="edit-account-btn">
                <Pencil className="h-4 w-4 mr-2" />
                Edit Account
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Landed</p>
                <p className="text-lg font-bold font-mono text-emerald-700">
                  {formatCurrency(account.total_landed_amount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingDown className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Received</p>
                <p className="text-lg font-bold font-mono text-blue-700">
                  {formatCurrency(account.total_received_amount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Wallet className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Pending Amount</p>
                <p className="text-lg font-bold font-mono text-amber-700">
                  {formatCurrency(account.total_pending_amount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Gem className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Pending Interest</p>
                <p className="text-lg font-bold font-mono text-red-600">
                  {formatCurrency(account.total_pending_interest)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                    <Calendar className="h-5 w-5 text-slate-500" />
                    <div>
                      <p className="text-xs text-slate-500">Opening Date</p>
                      <p className="font-medium">{formatDate(account.opening_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                    <MapPin className="h-5 w-5 text-slate-500" />
                    <div>
                      <p className="text-xs text-slate-500">Village</p>
                      <p className="font-medium">{account.village}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                    <User className="h-5 w-5 text-slate-500" />
                    <div>
                      <p className="text-xs text-slate-500">Created By</p>
                      <p className="font-medium">{account.created_by_name || '-'}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                    <Gem className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-xs text-slate-500">Total Jewellery Weight</p>
                      <p className="font-medium font-mono">{formatWeight(account.total_jewellery_weight)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                    <Wallet className="h-5 w-5 text-slate-500" />
                    <div>
                      <p className="text-xs text-slate-500">Principal Paid</p>
                      <p className="font-medium font-mono">{formatCurrency(account.received_principal)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                    <TrendingDown className="h-5 w-5 text-slate-500" />
                    <div>
                      <p className="text-xs text-slate-500">Interest Paid</p>
                      <p className="font-medium font-mono">{formatCurrency(account.received_interest)}</p>
                    </div>
                  </div>
                </div>
              </div>
              {account.details && (
                <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-2">Notes</p>
                  <p className="text-slate-700">{account.details}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'jewellery' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gem className="h-5 w-5 text-amber-500" />
                Jewellery Items ({account.jewellery_items?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {account.jewellery_items?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">#</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Item Name</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {account.jewellery_items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.name}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-amber-700">
                            {formatWeight(item.weight)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50">
                        <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-slate-900">Total</td>
                        <td className="px-4 py-3 text-sm font-mono font-bold text-right text-amber-700">
                          {formatWeight(account.total_jewellery_weight)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">No jewellery items added</p>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'landed' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Landed Entries ({account.landed_entries?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {account.landed_entries?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">#</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Date</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Amount</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Interest Start From</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Days</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Rate</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Calculated Interest</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Carried Forward</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Total Interest</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Remaining Principal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {account.landed_entries.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{formatDate(entry.date)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-emerald-700">
                            {formatCurrency(entry.amount)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {formatDate(entry.interest_start_date || entry.date)}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-slate-600">
                            {entry.days || 0}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-slate-600">
                            {entry.interest_rate}%
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-blue-600">
                            {formatCurrency(entry.calculated_interest || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-orange-600">
                            {formatCurrency(entry.carried_forward_interest || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right font-medium text-red-600">
                            {formatCurrency(entry.total_interest || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-amber-700">
                            {formatCurrency(entry.remaining_principal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50">
                        <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-slate-900">Total</td>
                        <td className="px-4 py-3 text-sm font-mono font-bold text-right text-emerald-700">
                          {formatCurrency(account.total_landed_amount)}
                        </td>
                        <td colSpan={5}></td>
                        <td className="px-4 py-3 text-sm font-mono font-bold text-right text-red-600">
                          {formatCurrency(account.total_pending_interest)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono font-bold text-right text-amber-700">
                          {formatCurrency(account.total_pending_amount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">No landed entries added</p>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'received' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-blue-600" />
                Received Entries ({account.received_entries?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {account.received_entries?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">#</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Date</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Amount</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Principal Paid</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Interest Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {account.received_entries.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{formatDate(entry.date)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-blue-700">
                            {formatCurrency(entry.amount)}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-emerald-600">
                            {formatCurrency(entry.principal_paid)}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-amber-600">
                            {formatCurrency(entry.interest_paid)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50">
                        <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-slate-900">Total</td>
                        <td className="px-4 py-3 text-sm font-mono font-bold text-right text-blue-700">
                          {formatCurrency(account.total_received_amount)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono font-bold text-right text-emerald-600">
                          {formatCurrency(account.received_principal)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono font-bold text-right text-amber-600">
                          {formatCurrency(account.received_interest)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">No received entries added</p>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'ledger' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-slate-600" />
                Account Ledger ({ledger.length} entries)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ledger.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">#</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Type</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Amount</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Interest Paid</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Principal Paid</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Remaining Interest</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Remaining Principal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledger.map((entry, idx) => (
                        <tr key={idx} className={`hover:bg-slate-50 ${
                          entry.transaction_type === 'CLOSED' ? 'bg-red-50' :
                          entry.transaction_type === 'REOPENED' ? 'bg-green-50' : ''
                        }`}>
                          <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {formatDate(entry.transaction_date)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                              entry.transaction_type === 'LANDED' 
                                ? 'bg-emerald-100 text-emerald-700'
                                : entry.transaction_type === 'PAYMENT'
                                ? 'bg-blue-100 text-blue-700'
                                : entry.transaction_type === 'CLOSED'
                                ? 'bg-red-100 text-red-700'
                                : entry.transaction_type === 'REOPENED'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {entry.transaction_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right">
                            {entry.transaction_type === 'CLOSED' || entry.transaction_type === 'REOPENED' 
                              ? '-' 
                              : formatCurrency(entry.amount)}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-amber-600">
                            {formatCurrency(entry.interest_amount)}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-emerald-600">
                            {formatCurrency(entry.principal_amount)}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-red-600">
                            {entry.transaction_type === 'CLOSED' ? '₹0.00' : formatCurrency(entry.remaining_interest || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right font-medium">
                            {formatCurrency(entry.remaining_principal || entry.balance_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">No ledger entries found</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Close Account Modal */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title="Close Account"
        size="default"
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-lg">
            <p className="text-sm text-amber-800">
              Closing this account will prevent any further modifications. 
              Only users with special permissions can reopen it.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Close Date *
            </label>
            <Input
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              max={getToday()}
              data-testid="close-date-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Remarks (Optional)
            </label>
            <textarea
              value={closeRemarks}
              onChange={(e) => setCloseRemarks(e.target.value)}
              rows={3}
              className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              placeholder="Any remarks about account closure..."
              data-testid="close-remarks-input"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowCloseModal(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCloseAccount}
              disabled={processing}
              data-testid="confirm-close-btn"
            >
              {processing ? <Spinner size="sm" className="text-white" /> : <Lock className="h-4 w-4 mr-2" />}
              Close Account
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reopen Account Modal */}
      <Modal
        isOpen={showReopenModal}
        onClose={() => setShowReopenModal(false)}
        title="Reopen Account"
        size="default"
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              You are about to reopen this closed account. Please provide a reason for reopening.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Reason for Reopening *
            </label>
            <textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              rows={3}
              className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              placeholder="Please provide a reason for reopening this account..."
              required
              data-testid="reopen-reason-input"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowReopenModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReopenAccount}
              disabled={processing || !reopenReason.trim()}
              data-testid="confirm-reopen-btn"
            >
              {processing ? <Spinner size="sm" className="text-white" /> : <Unlock className="h-4 w-4 mr-2" />}
              Reopen Account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
