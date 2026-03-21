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
  ArrowLeft, Pencil, Gem, Wallet, TrendingUp, TrendingDown,
  Calendar, MapPin, User, FileText, BookOpen, Lock, Unlock,
  AlertCircle, Download, FileSpreadsheet, Image as ImageIcon,
  X, ChevronLeft, ChevronRight, Clock
} from 'lucide-react';

const getToday = () => new Date().toISOString().split('T')[0];
const MAX_IMAGES = 5;

export default function AccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [closeDate, setCloseDate] = useState(getToday());
  const [closeRemarks, setCloseRemarks] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Image viewing
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedItemImages, setSelectedItemImages] = useState([]);
  const [selectedItemName, setSelectedItemName] = useState('');
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);

  useEffect(() => { fetchAccountData(); }, [id]);

  const fetchAccountData = async () => {
    try {
      const [accountRes, ledgerRes] = await Promise.all([
        api.get(`/api/accounts/${id}`),
        api.get(`/api/ledger/${id}`)
      ]);
      setAccount(accountRes.data);
      setLedger(ledgerRes.data);
    } catch (error) {
      toast.error('Failed to load account details');
      navigate('/accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!closeDate) { toast.error('Please select a close date'); return; }
    setProcessing(true);
    try {
      await api.post(`/api/accounts/${id}/close`, { close_date: closeDate, remarks: closeRemarks });
      toast.success('Account closed successfully');
      setShowCloseModal(false);
      fetchAccountData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to close account');
    } finally { setProcessing(false); }
  };

  const handleReopen = async () => {
    if (!reopenReason.trim()) { toast.error('Reason is mandatory'); return; }
    setProcessing(true);
    try {
      await api.post(`/api/accounts/${id}/reopen`, { reason: reopenReason });
      toast.success('Account reopened successfully');
      setShowReopenModal(false);
      setReopenReason('');
      fetchAccountData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reopen account');
    } finally { setProcessing(false); }
  };

  const handleExport = async (format) => {
    try {
      const endpoint = format === 'pdf' ? `/api/export/accounts/${id}/pdf` : `/api/export/accounts/${id}/excel`;
      const response = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${account.account_number}_details.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} exported`);
    } catch { toast.error('Export failed'); }
  };

  // Image functions
  const openImageViewer = (item, index) => {
    setSelectedItemImages(item.images || []);
    setSelectedItemName(item.name);
    setSelectedItemIndex(index);
    setCurrentImageIdx(0);
    setShowImageModal(true);
  };

  const getImageUrl = (image) => {
    const token = localStorage.getItem('token');
    return `${process.env.REACT_APP_BACKEND_URL}/api/files/${image.storage_path}?auth=${token}`;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (!account) return <div className="text-center py-20 text-slate-500">Account not found</div>;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'jewellery', label: 'Jewellery', icon: Gem },
    { id: 'landed', label: 'Landed Entries', icon: TrendingUp },
    { id: 'received', label: 'Received Entries', icon: TrendingDown },
    { id: 'ledger', label: 'Ledger', icon: BookOpen },
    { id: 'history', label: 'History', icon: Clock },
  ];

  // Build history events from close_history + reopen_history
  const historyEvents = [];
  (account.close_history || []).forEach(h => {
    historyEvents.push({ type: 'CLOSED', date: h.closed_at, by: h.closed_by_name, remarks: h.remarks, pending: h.final_pending_amount, interest: h.final_pending_interest });
  });
  (account.reopen_history || []).forEach(h => {
    historyEvents.push({ type: 'REOPENED', date: h.reopened_at, by: h.reopened_by_name, reason: h.reason });
  });
  // If no close_history but account was closed before (legacy data)
  if (historyEvents.length === 0 && account.closed_at) {
    historyEvents.push({ type: 'CLOSED', date: account.closed_at, by: account.closed_by_name, remarks: account.close_remarks, pending: account.final_pending_amount, interest: account.final_pending_interest });
  }
  historyEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="account-detail-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/accounts')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" data-testid="back-btn">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-display text-slate-900" data-testid="account-number">{account.account_number}</h1>
              <StatusBadge status={account.status} />
            </div>
            <p className="text-slate-500 mt-1">{account.name} - {account.village}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('excel')} data-testid="export-excel-btn" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600" title="Export to Excel">
            <FileSpreadsheet className="h-5 w-5" />
          </button>
          <button onClick={() => handleExport('pdf')} data-testid="export-pdf-btn" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600" title="Export to PDF">
            <Download className="h-5 w-5" />
          </button>
          {/* Close Account */}
          {account.status !== 'closed' && account.user_can_close && (
            <Button onClick={() => setShowCloseModal(true)} variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" data-testid="close-account-btn">
              <Lock className="h-4 w-4 mr-2" />
              Close Account
            </Button>
          )}
          {/* Reopen Account */}
          {account.status === 'closed' && account.user_can_unlock && (
            <Button onClick={() => setShowReopenModal(true)} variant="outline" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50" data-testid="reopen-account-btn">
              <Unlock className="h-4 w-4 mr-2" />
              Reopen Account
            </Button>
          )}
          {/* Edit button */}
          {account.user_can_edit && (
            <Link to={`/accounts/${id}/edit`}>
              <Button data-testid="edit-account-btn"><Pencil className="h-4 w-4 mr-2" />Edit</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total Landed</p>
            <p className="text-lg font-bold font-mono text-emerald-700 mt-1 tabular-nums">{formatCurrency(account.total_landed_amount)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total Received</p>
            <p className="text-lg font-bold font-mono text-blue-700 mt-1 tabular-nums">{formatCurrency(account.total_received_amount)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Pending Principal</p>
            <p className="text-lg font-bold font-mono text-amber-700 mt-1 tabular-nums">{formatCurrency(account.total_pending_amount)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Pending Interest</p>
            <p className="text-lg font-bold font-mono text-red-600 mt-1 tabular-nums">{formatCurrency(account.total_pending_interest)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`tab-${tab.id}`}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { icon: User, label: 'Name', value: account.name },
                  { icon: MapPin, label: 'Village', value: account.village },
                  { icon: Calendar, label: 'Opening Date', value: formatDate(account.opening_date) },
                  { icon: FileText, label: 'Account Number', value: account.account_number },
                  { icon: AlertCircle, label: 'Status', value: account.status?.toUpperCase() },
                  { icon: Gem, label: 'Total Jewellery', value: formatWeight(account.total_jewellery_weight) },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg"><item.icon className="h-5 w-5 text-slate-500" /></div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">{item.label}</p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              {account.details && (
                <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Details / Notes</p>
                  <p className="text-sm text-slate-700">{account.details}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Jewellery Tab */}
        {activeTab === 'jewellery' && (
          <Card>
            <CardContent className="p-0">
              {(!account.jewellery_items?.length) ? (
                <p className="text-center py-12 text-slate-500">No jewellery items</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Item Name</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Weight (g)</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Images</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {account.jewellery_items.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.name}</td>
                        <td className="px-4 py-3 text-sm text-right font-mono text-slate-700">{formatWeight(item.weight)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openImageViewer(item, i)}
                            data-testid={`view-images-${i}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                            {item.images?.length || 0} / {MAX_IMAGES}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Landed Entries Tab */}
        {activeTab === 'landed' && (
          <Card>
            <CardContent className="p-0">
              {(!account.landed_entries?.length) ? (
                <p className="text-center py-12 text-slate-500">No landed entries</p>
              ) : (
                <div className="table-container">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        {['#','Date','Amount','Rate (%)','Remaining Principal','Interest Start','Days','Calculated Interest','Carried Forward','Total Interest'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {account.landed_entries.map((entry, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                          <td className="px-4 py-3 text-sm">{formatDate(entry.date)}</td>
                          <td className="px-4 py-3 text-sm font-mono font-medium text-emerald-700">{formatCurrency(entry.amount)}</td>
                          <td className="px-4 py-3 text-sm font-mono">{entry.interest_rate}%</td>
                          <td className="px-4 py-3 text-sm font-mono text-amber-700">{formatCurrency(entry.remaining_principal)}</td>
                          <td className="px-4 py-3 text-sm">{formatDate(entry.interest_start_date)}</td>
                          <td className="px-4 py-3 text-sm font-mono">{entry.days}</td>
                          <td className="px-4 py-3 text-sm font-mono">{formatCurrency(entry.calculated_interest)}</td>
                          <td className="px-4 py-3 text-sm font-mono">{formatCurrency(entry.carried_forward_interest)}</td>
                          <td className="px-4 py-3 text-sm font-mono font-medium text-red-600">{formatCurrency(entry.total_interest)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Received Entries Tab */}
        {activeTab === 'received' && (
          <Card>
            <CardContent className="p-0">
              {(!account.received_entries?.length) ? (
                <p className="text-center py-12 text-slate-500">No received entries</p>
              ) : (
                <div className="table-container">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        {['#','Date','Amount','Principal Paid','Interest Paid'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {account.received_entries.map((entry, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                          <td className="px-4 py-3 text-sm">{formatDate(entry.date)}</td>
                          <td className="px-4 py-3 text-sm font-mono font-medium text-blue-700">{formatCurrency(entry.amount)}</td>
                          <td className="px-4 py-3 text-sm font-mono">{formatCurrency(entry.principal_paid)}</td>
                          <td className="px-4 py-3 text-sm font-mono">{formatCurrency(entry.interest_paid)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ledger Tab */}
        {activeTab === 'ledger' && (
          <Card>
            <CardContent className="p-0">
              {ledger.length === 0 ? (
                <p className="text-center py-12 text-slate-500">No ledger entries</p>
              ) : (
                <div className="table-container">
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        {['Date','Type','Amount','Principal','Interest','Balance','Rem. Principal','Rem. Interest'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledger.map((entry, i) => (
                        <tr key={i} className={`hover:bg-slate-50 ${entry.transaction_type === 'CLOSED' ? 'bg-red-50' : entry.transaction_type === 'REOPENED' ? 'bg-green-50' : ''}`}>
                          <td className="px-4 py-3 text-sm">{formatDate(entry.transaction_date)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              entry.transaction_type === 'LANDED' ? 'bg-emerald-100 text-emerald-700' :
                              entry.transaction_type === 'PAYMENT' ? 'bg-blue-100 text-blue-700' :
                              entry.transaction_type === 'CLOSED' ? 'bg-red-100 text-red-700' :
                              entry.transaction_type === 'REOPENED' ? 'bg-green-100 text-green-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {entry.transaction_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-mono">{formatCurrency(entry.amount)}</td>
                          <td className="px-4 py-3 text-sm font-mono">{formatCurrency(entry.principal_amount)}</td>
                          <td className="px-4 py-3 text-sm font-mono">{formatCurrency(entry.interest_amount)}</td>
                          <td className="px-4 py-3 text-sm font-mono font-medium">{formatCurrency(entry.balance_amount)}</td>
                          <td className="px-4 py-3 text-sm font-mono">{formatCurrency(entry.remaining_principal)}</td>
                          <td className="px-4 py-3 text-sm font-mono">{formatCurrency(entry.remaining_interest)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <Card>
            <CardContent className="p-6">
              {historyEvents.length === 0 ? (
                <p className="text-center py-12 text-slate-500">No close/reopen history for this account</p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
                  <div className="space-y-8">
                    {historyEvents.map((event, i) => (
                      <div key={i} className="relative flex gap-4" data-testid={`history-event-${i}`}>
                        <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 ${
                          event.type === 'CLOSED' ? 'bg-red-50 border-red-300' : 'bg-emerald-50 border-emerald-300'
                        }`}>
                          {event.type === 'CLOSED' ? (
                            <Lock className="h-5 w-5 text-red-600" />
                          ) : (
                            <Unlock className="h-5 w-5 text-emerald-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              event.type === 'CLOSED' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {event.type === 'CLOSED' ? 'Account Closed' : 'Account Reopened'}
                            </span>
                            <span className="text-xs text-slate-400">{formatDate(event.date)}</span>
                          </div>
                          <p className="text-sm text-slate-600">
                            <span className="font-medium">By:</span> {event.by || 'Unknown'}
                          </p>
                          {event.type === 'CLOSED' && (
                            <>
                              {event.remarks && (
                                <p className="text-sm text-slate-600 mt-1">
                                  <span className="font-medium">Remarks:</span> {event.remarks}
                                </p>
                              )}
                              <div className="mt-2 flex gap-4 text-xs">
                                <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded">
                                  Pending: {formatCurrency(event.pending)}
                                </span>
                                <span className="px-2 py-1 bg-red-50 text-red-700 rounded">
                                  Interest: {formatCurrency(event.interest)}
                                </span>
                              </div>
                            </>
                          )}
                          {event.type === 'REOPENED' && event.reason && (
                            <p className="text-sm text-slate-600 mt-1">
                              <span className="font-medium">Reason:</span> {event.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Close Account Modal */}
      <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title="Close Account" size="md">
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                Closing this account will lock it from further modifications. You'll need to reopen it to make changes.
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Close Date *</label>
            <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} max={getToday()} data-testid="close-date-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Remarks (Optional)</label>
            <textarea
              value={closeRemarks} onChange={(e) => setCloseRemarks(e.target.value)} rows={3}
              className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              placeholder="Any remarks about account closure..." data-testid="close-remarks-input"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCloseModal(false)}>Cancel</Button>
            <Button onClick={handleClose} disabled={processing} className="bg-red-600 hover:bg-red-700" data-testid="confirm-close-btn">
              {processing ? 'Closing...' : 'Close Account'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reopen Account Modal */}
      <Modal isOpen={showReopenModal} onClose={() => setShowReopenModal(false)} title="Reopen Account" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Reason for Reopening *</label>
            <textarea
              value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} rows={3}
              className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              placeholder="Please provide a reason..." data-testid="reopen-reason-input"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowReopenModal(false)}>Cancel</Button>
            <Button onClick={handleReopen} disabled={processing} data-testid="confirm-reopen-btn">
              {processing ? 'Reopening...' : 'Reopen Account'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Image Viewer Modal (View Only) */}
      <Modal isOpen={showImageModal} onClose={() => setShowImageModal(false)} title={`Images - ${selectedItemName}`} size="lg">
        <div className="space-y-4">
          {selectedItemImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <ImageIcon className="h-12 w-12 mb-3" />
              <p className="text-sm font-medium">No images uploaded yet</p>
              <p className="text-xs mt-1">Use the Edit form to upload images for this jewellery item</p>
            </div>
          ) : (
            <div>
              {/* Main image display */}
              <div className="relative bg-slate-100 rounded-xl overflow-hidden" style={{ minHeight: '350px' }}>
                <img
                  src={getImageUrl(selectedItemImages[currentImageIdx])}
                  alt={`${selectedItemName} - ${currentImageIdx + 1}`}
                  className="w-full h-[350px] object-contain"
                  data-testid="main-image"
                />
                {selectedItemImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentImageIdx(i => (i - 1 + selectedItemImages.length) % selectedItemImages.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setCurrentImageIdx(i => (i + 1) % selectedItemImages.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-black/60 rounded-full text-white text-xs font-medium">
                  {currentImageIdx + 1} / {selectedItemImages.length}
                </div>
              </div>
              {/* Thumbnails */}
              <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                {selectedItemImages.map((img, i) => (
                  <button key={img.id} onClick={() => setCurrentImageIdx(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === currentImageIdx ? 'border-emerald-500' : 'border-transparent hover:border-slate-300'
                    }`}
                  >
                    <img src={getImageUrl(img)} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
