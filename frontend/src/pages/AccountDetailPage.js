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
import { RecordPaymentModal } from '../components/ui/RecordPaymentModal';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import {
  ArrowLeft, Pencil, Gem, Wallet, TrendingUp, TrendingDown,
  Calendar, MapPin, User, FileText, BookOpen, Lock, Unlock,
  AlertCircle, Download, FileSpreadsheet, Image as ImageIcon,
  X, ChevronLeft, ChevronRight, Clock, ZoomIn, ZoomOut,
  StickyNote
} from 'lucide-react';
import NotePreview from '../components/ui/NotePreview';
import LedgerCard from '../components/ui/LedgerCard';

const getToday = () => new Date().toISOString().split('T')[0];
const MAX_IMAGES = 5;

// Tiny stat tile used in mobile entry cards
const Stat = ({ label, value, valueClass = 'text-primary-ink', mono = false }) => (
  <div className="bg-slate-50 rounded-md px-2.5 py-1.5">
    <p className="text-[10px] uppercase tracking-wider text-muted-ink font-medium">{label}</p>
    <p className={`text-xs ${mono ? 'font-mono tabular-nums' : ''} mt-0.5 ${valueClass}`}>{value}</p>
  </div>
);

export default function AccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [ledgerSummary, setLedgerSummary] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [closeRemarks, setCloseRemarks] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Image viewing
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedItemImages, setSelectedItemImages] = useState([]);
  const [selectedItemName, setSelectedItemName] = useState('');
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);

  // Image zoom state
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => { fetchAccountData(); }, [id]);

  const fetchAccountData = async () => {
    try {
      const [accountRes, ledgerRes] = await Promise.all([
        api.get(`/api/accounts/${id}`),
        api.get(`/api/ledger-enhanced/${id}`)
      ]);
      setAccount(accountRes.data);
      setLedger(ledgerRes.data.entries || []);
      setLedgerSummary(ledgerRes.data.summary || null);
    } catch (error) {
      toast.error('Failed to load account details');
      navigate('/accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    setProcessing(true);
    try {
      await api.post(`/api/accounts/${id}/close`, { close_date: getToday(), remarks: closeRemarks });
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

  // Build history events by interleaving close_history and reopen_history by index
  // Chronological order: close[0] → reopen[0] → close[1] → reopen[1] → ...
  const historyEvents = [];
  const closes = account.close_history || [];
  const reopens = account.reopen_history || [];
  const maxLen = Math.max(closes.length, reopens.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < closes.length) {
      const h = closes[i];
      historyEvents.push({ type: 'CLOSED', date: h.closed_at, by: h.closed_by_name, remarks: h.remarks, pending: h.final_pending_amount, interest: h.final_pending_interest });
    }
    if (i < reopens.length) {
      const h = reopens[i];
      historyEvents.push({ type: 'REOPENED', date: h.reopened_at, by: h.reopened_by_name, reason: h.reason });
    }
  }
  // If no close_history but account was closed before (legacy data)
  if (historyEvents.length === 0 && account.closed_at) {
    historyEvents.push({ type: 'CLOSED', date: account.closed_at, by: account.closed_by_name, remarks: account.close_remarks, pending: account.final_pending_amount, interest: account.final_pending_interest });
  }
  // Reverse for descending order (newest first)
  historyEvents.reverse();

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="account-detail-page">
      {/* Header */}
      <div className="space-y-3">
        {/* Top row: Back + Account number + Status */}
        <div className="flex items-start gap-3">
          <button onClick={() => navigate('/accounts')} className="p-2 -ml-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0" data-testid="back-btn">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 leading-tight" data-testid="account-number">{account.account_number}</h1>
              <StatusBadge status={account.status} />
            </div>
            <p className="text-sm text-secondary-ink mt-0.5 truncate">{account.name} · {account.village}</p>
          </div>
        </div>

        {/* Action bar — two zones: secondary (icon-only) + primary (labeled) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Secondary actions (icon buttons) */}
          <div className="flex items-center gap-1 mr-auto">
            <button onClick={() => handleExport('excel')} data-testid="export-excel-btn" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 tap-target" title="Export to Excel" aria-label="Export to Excel">
              <FileSpreadsheet className="h-5 w-5" />
            </button>
            <button onClick={() => handleExport('pdf')} data-testid="export-pdf-btn" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 tap-target" title="Export to PDF" aria-label="Export to PDF">
              <Download className="h-5 w-5" />
            </button>
          </div>

          {/* Primary actions (labeled, wraps to full width on mobile) */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Add Receive Amount (primary CTA) */}
            {account.status !== 'closed' && account.user_can_add && (
              <Button
                onClick={() => setShowRecordPaymentModal(true)}
                data-testid="record-payment-btn"
                className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none whitespace-nowrap"
              >
                <TrendingDown className="h-4 w-4 mr-1.5" />
                Add Receive Amount
              </Button>
            )}
            {/* Close Account */}
            {account.status !== 'closed' && account.user_can_close && (
              <Button onClick={() => setShowCloseModal(true)} variant="outline" className="text-red-600 border-red-300 hover:bg-red-50 flex-1 sm:flex-none whitespace-nowrap" data-testid="close-account-btn">
                <Lock className="h-4 w-4 mr-1.5" />
                Close
              </Button>
            )}
            {/* Reopen Account */}
            {account.status === 'closed' && account.user_can_unlock && (
              <Button onClick={() => setShowReopenModal(true)} variant="outline" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 flex-1 sm:flex-none whitespace-nowrap" data-testid="reopen-account-btn">
                <Unlock className="h-4 w-4 mr-1.5" />
                Reopen
              </Button>
            )}
            {/* Edit button */}
            {account.user_can_edit && (
              <Link to={`/accounts/${id}/edit`} className="flex-1 sm:flex-none">
                <Button data-testid="edit-account-btn" className="w-full whitespace-nowrap">
                  <Pencil className="h-4 w-4 mr-1.5" />Edit
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-ink uppercase tracking-wide">Total Landed</p>
            <p className="text-base sm:text-lg font-bold font-mono text-success-ink mt-1 tabular-nums">{formatCurrency(account.total_landed_amount)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-ink uppercase tracking-wide">Total Received</p>
            <p className="text-base sm:text-lg font-bold font-mono text-info-ink mt-1 tabular-nums">{formatCurrency(account.total_received_amount)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-ink uppercase tracking-wide">Pending Principal</p>
            <p className="text-base sm:text-lg font-bold font-mono text-warning-ink mt-1 tabular-nums">{formatCurrency(account.total_pending_amount)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-ink uppercase tracking-wide">Pending Interest</p>
            <p className="text-base sm:text-lg font-bold font-mono text-danger-ink mt-1 tabular-nums">{formatCurrency(account.total_pending_interest)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500 col-span-2 md:col-span-1" data-testid="total-pending-card">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-ink uppercase tracking-wide">Total Pending</p>
            <p className="text-base sm:text-lg font-bold font-mono text-purple-700 mt-1 tabular-nums">{formatCurrency((account.total_pending_amount || 0) + (account.total_pending_interest || 0))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs - sticky on mobile */}
      <div className="sticky top-0 z-20 -mx-4 sm:mx-0 bg-slate-50/95 backdrop-blur-sm">
        <div className="flex gap-1 border-b border-slate-200 overflow-x-auto px-4 sm:px-0 no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors tap-target ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-secondary-ink hover:text-primary-ink'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
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
                <div className="mt-6 p-4 bg-slate-50 rounded-lg overflow-hidden">
                  <p className="text-xs text-secondary-ink uppercase tracking-wide mb-1 font-semibold">Details / Notes</p>
                  <div
                    className="safe-rich-text text-sm text-primary-ink prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                    data-testid="account-details-richtext"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(account.details) }}
                  />
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
                <p className="text-center py-12 text-secondary-ink">No jewellery items</p>
              ) : (
                <>
                  {/* Mobile: card grid */}
                  <div className="lg:hidden p-3 space-y-3" data-testid="jewellery-mobile-list">
                    {account.jewellery_items.map((item, i) => {
                      const imgs = item.images || [];
                      return (
                        <div key={i} className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
                          <div className="bg-amber-50/70 px-3 py-2 flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">#{i + 1}</span>
                            <button
                              onClick={() => openImageViewer(item, i)}
                              data-testid={`view-images-mobile-${i}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              <ImageIcon className="h-3.5 w-3.5" />
                              {imgs.length} / {MAX_IMAGES}
                            </button>
                          </div>
                          <div className="px-3 pt-3 pb-2 border-b border-slate-100">
                            <p className="text-sm font-semibold text-primary-ink">{item.name}</p>
                            <p className="text-xs text-secondary-ink mt-0.5">Weight: <span className="font-mono tabular-nums text-primary-ink">{formatWeight(item.weight)}</span></p>
                          </div>
                          {imgs.length > 0 ? (
                            <div className="px-3 py-2.5 flex gap-2 overflow-x-auto" data-testid={`jewellery-thumbs-mobile-${i}`}>
                              {imgs.slice(0, 5).map((img, j) => (
                                <button
                                  key={img.id || j}
                                  onClick={() => { openImageViewer(item, i); setCurrentImageIdx(j); }}
                                  className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 hover:ring-2 hover:ring-emerald-400 transition-all"
                                  data-testid={`jewellery-thumb-mobile-${i}-${j}`}
                                  title={`Image ${j + 1}`}
                                >
                                  <img
                                    src={getImageUrl(img)}
                                    alt={`${item.name} ${j + 1}`}
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('img-fallback'); }}
                                  />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="px-3 py-3 flex items-center gap-2 text-xs text-muted-ink">
                              <ImageIcon className="h-3.5 w-3.5" />
                              No images uploaded
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden lg:block">
                  <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-ink uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-ink uppercase">Item Name</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-secondary-ink uppercase">Weight (g)</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-ink uppercase">Images</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {account.jewellery_items.map((item, i) => {
                      const imgs = item.images || [];
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-secondary-ink align-top">{i + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium text-primary-ink align-top">{item.name}</td>
                          <td className="px-4 py-3 text-sm text-right font-mono text-primary-ink align-top tabular-nums">{formatWeight(item.weight)}</td>
                          <td className="px-4 py-3 align-top">
                            {imgs.length === 0 ? (
                              <button
                                onClick={() => openImageViewer(item, i)}
                                data-testid={`view-images-${i}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-secondary-ink hover:bg-slate-200 transition-colors"
                              >
                                <ImageIcon className="h-3.5 w-3.5" />
                                No images
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap" data-testid={`jewellery-thumbs-${i}`}>
                                {imgs.slice(0, 5).map((img, j) => (
                                  <button
                                    key={img.id || j}
                                    onClick={() => { openImageViewer(item, i); setCurrentImageIdx(j); }}
                                    className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 hover:ring-2 hover:ring-emerald-400 transition-all flex items-center justify-center"
                                    data-testid={`jewellery-thumb-${i}-${j}`}
                                    title={`View image ${j + 1}`}
                                  >
                                    <img
                                      src={getImageUrl(img)}
                                      alt={`${item.name} ${j + 1}`}
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.onerror = null;
                                        e.currentTarget.style.display = 'none';
                                        const ph = e.currentTarget.parentElement?.querySelector('.thumb-fallback');
                                        if (ph) ph.style.display = 'flex';
                                      }}
                                    />
                                    <span
                                      className="thumb-fallback absolute inset-0 hidden items-center justify-center text-muted-ink"
                                      aria-hidden="true"
                                    >
                                      <ImageIcon className="h-5 w-5" />
                                    </span>
                                  </button>
                                ))}
                                <button
                                  onClick={() => openImageViewer(item, i)}
                                  data-testid={`view-images-${i}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                  title="Open gallery"
                                >
                                  {imgs.length} / {MAX_IMAGES}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Landed Entries Tab */}
        {activeTab === 'landed' && (
          <Card>
            <CardContent className="p-0">
              {(!account.landed_entries?.length) ? (
                <p className="text-center py-12 text-muted-ink">No landed entries</p>
              ) : (
                <>
                  {/* Mobile card list */}
                  <div className="lg:hidden p-3 space-y-3">
                    {account.landed_entries.map((entry, i) => (
                      <div key={i} className="rounded-xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
                        {/* Header band */}
                        <div className="bg-emerald-50/80 px-3 py-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex-shrink-0">#{i+1}</span>
                            <span className="text-xs text-secondary-ink truncate">{formatDate(entry.date)}</span>
                          </div>
                          <NotePreview html={entry.note} testId={`landed-note-mobile-${i}`} />
                        </div>

                        {/* Hero: Amount + Rate */}
                        <div className="px-3 pt-3 pb-2 flex items-baseline justify-between border-b border-slate-100">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-ink font-medium">Amount</p>
                            <p className="text-lg font-bold tabular-nums text-success-ink">{formatCurrency(entry.amount)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-muted-ink font-medium">Rate</p>
                            <p className="text-lg font-bold tabular-nums text-primary-ink">{entry.interest_rate}%<span className="text-[10px] font-normal text-muted-ink"> /mo</span></p>
                          </div>
                        </div>

                        {/* Pending — most important after hero */}
                        <div className="px-3 py-2 bg-amber-50/40 border-b border-slate-100 flex items-baseline justify-between">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-ink font-medium">Pending Principal</p>
                            <p className="text-base font-bold tabular-nums text-warning-ink">{formatCurrency(entry.remaining_principal)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-muted-ink font-medium">Total Interest</p>
                            <p className="text-base font-bold tabular-nums text-danger-ink">{formatCurrency(entry.total_interest)}</p>
                          </div>
                        </div>

                        {/* Interest period & breakdown */}
                        <div className="px-3 py-2.5 grid grid-cols-2 gap-2 text-xs">
                          <Stat label="Int. Start" value={formatDate(entry.interest_start_date)} />
                          <Stat label="Days" value={entry.days ?? 0} mono />
                          <Stat label="New Interest" value={formatCurrency(entry.calculated_interest)} valueClass="text-warning-ink" mono />
                          <Stat label="Carry Fwd" value={formatCurrency(entry.carried_forward_interest)} valueClass="text-orange-600" mono />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden lg:block table-container">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-secondary-ink uppercase whitespace-nowrap">#</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-secondary-ink uppercase whitespace-nowrap">Date</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-secondary-ink uppercase whitespace-nowrap">Amount</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-secondary-ink uppercase whitespace-nowrap">Rate</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-secondary-ink uppercase whitespace-nowrap">Remaining Principal</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-secondary-ink uppercase whitespace-nowrap">Interest Start</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-secondary-ink uppercase whitespace-nowrap">Days</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-secondary-ink uppercase whitespace-nowrap">Calculated Interest</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-secondary-ink uppercase whitespace-nowrap">Carried Forward</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-secondary-ink uppercase whitespace-nowrap">Total Interest</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-secondary-ink uppercase whitespace-nowrap">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {account.landed_entries.map((entry, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-muted-ink">{i + 1}</td>
                          <td className="px-4 py-3 text-sm text-primary-ink">{formatDate(entry.date)}</td>
                          <td className="px-4 py-3 text-sm font-mono font-semibold text-success-ink text-right tabular-nums">{formatCurrency(entry.amount)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-primary-ink text-right tabular-nums">{entry.interest_rate}%</td>
                          <td className="px-4 py-3 text-sm font-mono text-warning-ink text-right tabular-nums">{formatCurrency(entry.remaining_principal)}</td>
                          <td className="px-4 py-3 text-sm text-primary-ink">{formatDate(entry.interest_start_date)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-primary-ink text-right tabular-nums">{entry.days}</td>
                          <td className="px-4 py-3 text-sm font-mono text-primary-ink text-right tabular-nums">{formatCurrency(entry.calculated_interest)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-primary-ink text-right tabular-nums">{formatCurrency(entry.carried_forward_interest)}</td>
                          <td className="px-4 py-3 text-sm font-mono font-semibold text-danger-ink text-right tabular-nums">{formatCurrency(entry.total_interest)}</td>
                          <td className="px-4 py-3"><NotePreview html={entry.note} testId={`landed-note-${i}`} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Received Entries Tab */}
        {activeTab === 'received' && (
          <Card>
            <CardContent className="p-0">
              {(!account.received_entries?.length) ? (
                <p className="text-center py-12 text-muted-ink">No received entries</p>
              ) : (
                <>
                  {/* Mobile card list */}
                  <div className="lg:hidden p-3 space-y-3">
                    {account.received_entries.map((entry, i) => {
                      const allocs = entry.allocations || [];
                      const method = (entry.allocation_method || 'fifo').toLowerCase();
                      return (
                      <div key={i} className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden">
                        {/* Header band */}
                        <div className="bg-blue-50/80 px-3 py-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 flex-shrink-0">#{i+1}</span>
                            <span className="text-xs text-secondary-ink truncate">{formatDate(entry.date)}</span>
                            <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full ${method === 'manual' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {method}
                            </span>
                          </div>
                          <NotePreview html={entry.note} testId={`received-note-mobile-${i}`} />
                        </div>

                        {/* Hero: Amount */}
                        <div className="px-3 pt-3 pb-2 border-b border-slate-100">
                          <p className="text-[10px] uppercase tracking-wider text-muted-ink font-medium">Amount Received</p>
                          <p className="text-lg font-bold tabular-nums text-info-ink">{formatCurrency(entry.amount)}</p>
                        </div>

                        {/* Allocation breakdown */}
                        <div className="px-3 py-2.5 grid grid-cols-2 gap-2 text-xs">
                          <Stat label="Principal Paid" value={formatCurrency(entry.principal_paid)} valueClass="text-success-ink" mono />
                          <Stat label="Interest Paid" value={formatCurrency(entry.interest_paid)} valueClass="text-warning-ink" mono />
                        </div>

                        {/* Per-landed-entry allocation breakdown */}
                        {allocs.length > 0 && (
                          <div className="px-3 pb-3" data-testid={`received-alloc-mobile-${i}`}>
                            <p className="text-[10px] uppercase tracking-wider text-muted-ink font-semibold mb-1.5">Applied To</p>
                            <div className="space-y-1.5">
                              {allocs.map((a, j) => (
                                <div key={j} className="flex items-center justify-between text-[11px] bg-slate-50 rounded px-2 py-1.5">
                                  <span className="text-secondary-ink">Landed #{a.landed_index + 1} · {a.landed_date}</span>
                                  <span className="font-mono tabular-nums text-primary-ink">
                                    I {formatCurrency(a.interest_paid)} · P {formatCurrency(a.principal_paid)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );})}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden lg:block table-container">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-secondary-ink uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-secondary-ink uppercase">Date</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-secondary-ink uppercase">Amount</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-secondary-ink uppercase">Principal</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-secondary-ink uppercase">Interest</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-secondary-ink uppercase">Method</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-secondary-ink uppercase">Applied To Landed Entries</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-secondary-ink uppercase">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {account.received_entries.map((entry, i) => {
                        const allocs = entry.allocations || [];
                        const method = (entry.allocation_method || 'fifo').toLowerCase();
                        return (
                        <tr key={i} className="hover:bg-slate-50 align-top">
                          <td className="px-4 py-3 text-sm text-muted-ink">{i + 1}</td>
                          <td className="px-4 py-3 text-sm text-primary-ink whitespace-nowrap">{formatDate(entry.date)}</td>
                          <td className="px-4 py-3 text-sm font-mono font-semibold text-info-ink text-right tabular-nums whitespace-nowrap">{formatCurrency(entry.amount)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-primary-ink text-right tabular-nums whitespace-nowrap">{formatCurrency(entry.principal_paid)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-primary-ink text-right tabular-nums whitespace-nowrap">{formatCurrency(entry.interest_paid)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${method === 'manual' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {method}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs" data-testid={`received-alloc-desktop-${i}`}>
                            {allocs.length === 0 ? (
                              <span className="text-muted-ink italic">—</span>
                            ) : (
                              <div className="space-y-1">
                                {allocs.map((a, j) => (
                                  <div key={j} className="flex items-center gap-2 whitespace-nowrap">
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">{a.landed_index + 1}</span>
                                    <span className="text-secondary-ink">{a.landed_date}</span>
                                    <span className="font-mono tabular-nums text-primary-ink">I {formatCurrency(a.interest_paid)}</span>
                                    <span className="text-muted-ink">+</span>
                                    <span className="font-mono tabular-nums text-primary-ink">P {formatCurrency(a.principal_paid)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3"><NotePreview html={entry.note} testId={`received-note-${i}`} /></td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ledger Tab */}
        {activeTab === 'ledger' && (
          <Card>
            {/* Ledger Summary Strip */}
            {ledgerSummary && (
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2" data-testid="ledger-total-interest-charged">
                    <span className="text-xs font-medium text-slate-500 uppercase">Interest Charged:</span>
                    <span className="text-sm font-bold font-mono text-amber-700">{formatCurrency(ledgerSummary.total_interest_charged)}</span>
                  </div>
                  <div className="flex items-center gap-2" data-testid="ledger-total-interest-paid">
                    <span className="text-xs font-medium text-slate-500 uppercase">Interest Paid:</span>
                    <span className="text-sm font-bold font-mono text-emerald-700">{formatCurrency(ledgerSummary.total_interest_paid)}</span>
                  </div>
                  <div className="flex items-center gap-2" data-testid="ledger-pending-interest">
                    <span className="text-xs font-medium text-slate-500 uppercase">Pending Interest:</span>
                    <span className="text-sm font-bold font-mono text-red-600">{formatCurrency(ledgerSummary.pending_interest)}</span>
                  </div>
                </div>
              </div>
            )}
            <CardContent className="p-0">
              {ledger.length === 0 ? (
                <p className="text-center py-12 text-muted-ink">No ledger entries</p>
              ) : (
                <>
                  {/* Mobile card list */}
                  <div className="lg:hidden p-3 space-y-3" data-testid="ledger-mobile-list">
                    {ledger.map((entry, i) => (
                      <LedgerCard key={i} entry={entry} index={i} />
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden lg:block table-container">
                    <table className="w-full min-w-[1200px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Entry Amount</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Interest Charged</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Interest Paid</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Rem. Interest</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Principal Paid</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Rem. Principal</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Balance</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledger.map((entry, i) => {
                        const isLanded = entry.transaction_type === 'LANDED';
                        const isPayment = entry.transaction_type === 'PAYMENT';
                        const isClosed = entry.transaction_type === 'CLOSED';
                        const isReopened = entry.transaction_type === 'REOPENED';
                        const rowBg = isClosed ? 'bg-red-50/50' : isReopened ? 'bg-green-50/50' : isLanded ? 'bg-emerald-50/30' : isPayment ? 'bg-blue-50/30' : '';
                        const principalPaidVal = parseFloat(entry.principal_amount || 0);
                        return (
                          <React.Fragment key={i}>
                            <tr className={`${rowBg} hover:bg-slate-100/50 cursor-pointer transition-colors`} onClick={() => setExpandedRow(expandedRow === i ? null : i)} data-testid={`ledger-row-${i}`}>
                              <td className="px-3 py-3 text-sm text-slate-600">{formatDate(entry.transaction_date)}</td>
                              <td className="px-3 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  isLanded ? 'bg-emerald-100 text-emerald-700' :
                                  isPayment ? 'bg-blue-100 text-blue-700' :
                                  isClosed ? 'bg-red-100 text-red-700' :
                                  isReopened ? 'bg-green-100 text-green-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {entry.transaction_type}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-sm font-mono text-right font-medium tabular-nums">{(isClosed || isReopened) ? '-' : formatCurrency(entry.amount)}</td>
                              <td className="px-3 py-3 text-sm font-mono text-right text-amber-700 tabular-nums">{entry.interest_charged > 0 ? formatCurrency(entry.interest_charged) : '-'}</td>
                              <td className="px-3 py-3 text-sm font-mono text-right text-emerald-700 tabular-nums">{parseFloat(entry.interest_amount || 0) > 0 ? formatCurrency(entry.interest_amount) : '-'}</td>
                              <td className="px-3 py-3 text-sm font-mono text-right text-red-600 tabular-nums">{parseFloat(entry.remaining_interest || 0) > 0 ? formatCurrency(entry.remaining_interest) : '-'}</td>
                              <td className="px-3 py-3 text-sm font-mono text-right text-blue-700 tabular-nums">{isLanded ? '-' : (principalPaidVal > 0 ? formatCurrency(principalPaidVal) : '-')}</td>
                              <td className="px-3 py-3 text-sm font-mono text-right tabular-nums">{formatCurrency(entry.remaining_principal)}</td>
                              <td className="px-3 py-3 text-sm font-mono text-right font-bold tabular-nums">{formatCurrency(entry.computed_balance)}</td>
                              <td className="px-3 py-3 text-xs text-secondary-ink max-w-[260px]">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate" title={entry.notes}>{entry.notes}</span>
                                  <NotePreview html={entry.user_note} label="User note" testId={`ledger-user-note-${i}`} />
                                </div>
                              </td>
                            </tr>
                            {expandedRow === i && (
                              <tr className="bg-gradient-to-br from-slate-50 to-slate-100/50">
                                <td colSpan={10} className="p-0">
                                  <div className="m-3 rounded-xl bg-white shadow-[0_4px_20px_-4px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/70 overflow-hidden">
                                    {/* Header strip */}
                                    <div className={`px-5 py-3 border-b border-slate-200 flex items-center justify-between ${
                                      isPayment ? 'bg-blue-50/60' : isLanded ? 'bg-emerald-50/60' : isClosed ? 'bg-red-50/60' : 'bg-slate-50'
                                    }`}>
                                      <div className="flex items-center gap-2">
                                        <span className={`w-1.5 h-6 rounded-full ${
                                          isPayment ? 'bg-blue-500' : isLanded ? 'bg-emerald-500' : isClosed ? 'bg-red-500' : 'bg-slate-400'
                                        }`} />
                                        <h4 className="text-sm font-semibold text-primary-ink tracking-wide">Transaction Details</h4>
                                        <span className="text-xs text-muted-ink">· {formatDate(entry.transaction_date)}</span>
                                      </div>
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                        isLanded ? 'bg-emerald-100 text-emerald-700' :
                                        isPayment ? 'bg-blue-100 text-blue-700' :
                                        isClosed ? 'bg-red-100 text-red-700' :
                                        isReopened ? 'bg-green-100 text-green-700' :
                                        'bg-slate-100 text-secondary-ink'
                                      }`}>{entry.transaction_type}</span>
                                    </div>

                                    {/* Per-entry breakdown for PAYMENT rows */}
                                    {isPayment && Array.isArray(entry.breakdown) && entry.breakdown.length > 0 && (
                                      <div className="px-5 py-4">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                          <p className="font-semibold text-primary-ink text-xs uppercase tracking-wider">Interest Breakdown</p>
                                          {entry.allocation_method && (
                                            <span
                                              className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                                                entry.allocation_method === 'manual'
                                                  ? 'bg-blue-100 text-blue-800'
                                                  : 'bg-emerald-100 text-emerald-800'
                                              }`}
                                              title={entry.allocation_method === 'manual' ? 'User-selected per-entry allocation' : 'Automatic FIFO — oldest landed entry first'}
                                            >
                                              {entry.allocation_method === 'manual' ? 'Manual' : 'FIFO'}
                                            </span>
                                          )}
                                          <span className="inline-flex items-center gap-1 text-[10px] text-secondary-ink bg-slate-100 px-2 py-0.5 rounded-full" title="Total Interest = New Interest + Previous Pending (Carry Forward) Interest">
                                            <span className="text-muted-ink">ⓘ</span>
                                            Total = New + Carry Forward
                                          </span>
                                        </div>
                                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                                          <table className="w-full text-xs">
                                            <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                                              <tr>
                                                <th className="px-3 py-2.5 text-left text-slate-600 font-semibold uppercase tracking-wider text-[10px]">Landed Date</th>
                                                <th className="px-3 py-2.5 text-left text-slate-600 font-semibold uppercase tracking-wider text-[10px]" title="Date from which this period's interest starts (resets after a full-interest payment)">Interest Start</th>
                                                <th className="px-3 py-2.5 text-right text-slate-600 font-semibold uppercase tracking-wider text-[10px]">Principal</th>
                                                <th className="px-3 py-2.5 text-right text-slate-600 font-semibold uppercase tracking-wider text-[10px]">Rate</th>
                                                <th className="px-3 py-2.5 text-right text-slate-600 font-semibold uppercase tracking-wider text-[10px]">Days</th>
                                                <th className="px-3 py-2.5 text-right text-slate-600 font-semibold uppercase tracking-wider text-[10px]" title="Interest = (Principal × Rate × Days) / (100 × 30)">New Interest</th>
                                                <th className="px-3 py-2.5 text-right text-slate-600 font-semibold uppercase tracking-wider text-[10px]" title="Previous unpaid interest brought forward">Carry Forward</th>
                                                <th className="px-3 py-2.5 text-right text-slate-600 font-semibold uppercase tracking-wider text-[10px] bg-amber-50/50">Total Interest</th>
                                                <th className="px-3 py-2.5 text-right text-slate-600 font-semibold uppercase tracking-wider text-[10px]">Interest Paid</th>
                                                <th className="px-3 py-2.5 text-right text-slate-600 font-semibold uppercase tracking-wider text-[10px]">Principal Paid</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                              {entry.breakdown.map((b, bi) => (
                                                <tr key={bi} className="hover:bg-slate-50/70 transition-colors">
                                                  <td className="px-3 py-2.5 text-slate-700 font-medium">{formatDate(b.landed_date)}</td>
                                                  <td className="px-3 py-2.5 text-slate-700">{formatDate(b.interest_start_date || b.landed_date)}</td>
                                                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">{formatCurrency(b.principal)}</td>
                                                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">{b.rate}%</td>
                                                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">{b.days}</td>
                                                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-amber-700">{formatCurrency(b.calculated_interest || 0)}</td>
                                                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-orange-600">{(b.carried_forward || 0) > 0 ? formatCurrency(b.carried_forward) : '-'}</td>
                                                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-amber-900 bg-amber-50/40">{formatCurrency(b.interest_due)}</td>
                                                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-700">{b.interest_paid > 0 ? formatCurrency(b.interest_paid) : '-'}</td>
                                                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-blue-700">{b.principal_paid > 0 ? formatCurrency(b.principal_paid) : '-'}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                    {/* Per-entry context for LANDED rows */}
                                    {isLanded && Array.isArray(entry.breakdown) && entry.breakdown.length > 0 && (
                                      <div className="px-5 pb-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="rounded-lg bg-emerald-50/60 ring-1 ring-emerald-200/60 px-3 py-2">
                                          <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-medium">Principal</p>
                                          <p className="text-sm font-mono font-semibold tabular-nums text-emerald-800 mt-0.5">{formatCurrency(entry.breakdown[0].principal)}</p>
                                        </div>
                                        <div className="rounded-lg bg-emerald-50/60 ring-1 ring-emerald-200/60 px-3 py-2">
                                          <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-medium">Interest Rate</p>
                                          <p className="text-sm font-mono font-semibold tabular-nums text-emerald-800 mt-0.5">{entry.breakdown[0].rate}% per month</p>
                                        </div>
                                      </div>
                                    )}

                                    {/* User-provided note (rich text) */}
                                    {entry.user_note && (
                                      <div className="px-5 pb-4">
                                        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 overflow-hidden">
                                          <div className="flex items-center gap-2 mb-1.5">
                                            <StickyNote className="h-3.5 w-3.5 text-amber-700" />
                                            <span className="text-[10px] uppercase tracking-wider text-amber-800 font-semibold">User Note</span>
                                          </div>
                                          <div
                                            className="safe-rich-text prose prose-sm max-w-none text-amber-900 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(entry.user_note) }}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* Notes footer */}
                                    {entry.notes && (
                                      <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-200">
                                        <p className="text-xs leading-relaxed">
                                          <span className="text-[10px] uppercase tracking-wider text-muted-ink font-semibold mr-2">Computed</span>
                                          <span className="text-secondary-ink">{entry.notes}</span>
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </>
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
                            <span className="text-xs text-secondary-ink">{formatDate(event.date)}</span>
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
            <label className="block text-sm font-medium text-slate-700 mb-2">Close Date</label>
            <Input type="text" value={new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} disabled className="bg-slate-100 cursor-not-allowed" data-testid="close-date-input" />
            <p className="text-xs text-secondary-ink mt-1">Close date is automatically set to today</p>
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

      {/* Record Payment Modal */}
      <RecordPaymentModal
        open={showRecordPaymentModal}
        onClose={() => setShowRecordPaymentModal(false)}
        accountId={id}
        openingDate={account?.opening_date}
        onPaymentRecorded={() => fetchAccountData()}
      />

      {/* Image Viewer Modal (View Only) with Zoom */}
      <Modal isOpen={showImageModal} onClose={() => { setShowImageModal(false); setZoomLevel(1); }} title={`Images - ${selectedItemName}`} size="lg">
        <div className="space-y-4">
          {selectedItemImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-secondary-ink">
              <ImageIcon className="h-12 w-12 mb-3 text-muted-ink" />
              <p className="text-sm font-medium">No images uploaded yet</p>
              <p className="text-xs mt-1">Use the Edit form to upload images for this jewellery item</p>
            </div>
          ) : (
            <div>
              {/* Main image display with zoom (NO click-to-fullscreen — single viewer only) */}
              <div className="relative bg-slate-100 rounded-xl overflow-hidden" style={{ minHeight: '350px' }}>
                <img
                  src={getImageUrl(selectedItemImages[currentImageIdx])}
                  alt={`${selectedItemName} - ${currentImageIdx + 1}`}
                  className="w-full h-[350px] object-contain transition-transform duration-200 select-none"
                  style={{ transform: `scale(${zoomLevel})` }}
                  data-testid="main-image"
                  draggable={false}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><rect width=%22200%22 height=%22200%22 fill=%22%23F1F5F9%22/><text x=%22100%22 y=%22100%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2364748B%22 font-family=%22sans-serif%22 font-size=%2214%22>Image not available</text></svg>';
                  }}
                />
                {selectedItemImages.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCurrentImageIdx(i => (i - 1 + selectedItemImages.length) % selectedItemImages.length); setZoomLevel(1); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCurrentImageIdx(i => (i + 1) % selectedItemImages.length); setZoomLevel(1); }}
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
              {/* Zoom Controls */}
              <div className="flex items-center justify-center gap-2 mt-2">
                <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" data-testid="zoom-out-btn" title="Zoom Out">
                  <ZoomOut className="h-4 w-4 text-slate-600" />
                </button>
                <span className="text-xs text-secondary-ink w-12 text-center tabular-nums">{Math.round(zoomLevel * 100)}%</span>
                <button onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" data-testid="zoom-in-btn" title="Zoom In">
                  <ZoomIn className="h-4 w-4 text-slate-600" />
                </button>
                <button onClick={() => setZoomLevel(1)} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-xs text-secondary-ink" data-testid="zoom-reset-btn" title="Reset Zoom">
                  Reset
                </button>
              </div>
              {/* Thumbnails */}
              <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                {selectedItemImages.map((img, i) => (
                  <button key={img.id} onClick={() => { setCurrentImageIdx(i); setZoomLevel(1); }}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === currentImageIdx ? 'border-emerald-500' : 'border-transparent hover:border-slate-300'
                    }`}
                  >
                    <img
                      src={getImageUrl(img)}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22><rect width=%2264%22 height=%2264%22 fill=%22%23E2E8F0%22/><text x=%2232%22 y=%2236%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2364748B%22 font-family=%22sans-serif%22 font-size=%2210%22>n/a</text></svg>';
                      }}
                    />
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
