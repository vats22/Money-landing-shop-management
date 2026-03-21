import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
  MapPin, TrendingUp, Users, Percent, Download
} from 'lucide-react';

const COLORS = ['#059669', '#0284c7', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#e11d48', '#4f46e5'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="tabular-nums">
          {entry.name}: {typeof entry.value === 'number' ? formatCurrency(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const [villageSummary, setVillageSummary] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [rateDistribution, setRateDistribution] = useState([]);
  const [topBorrowers, setTopBorrowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAllReports();
  }, []);

  const fetchAllReports = async () => {
    try {
      const [villageRes, trendRes, rateRes, borrowerRes] = await Promise.all([
        api.get('/api/reports/village-summary'),
        api.get('/api/reports/monthly-trend'),
        api.get('/api/reports/interest-rate-distribution'),
        api.get('/api/reports/top-borrowers')
      ]);
      setVillageSummary(villageRes.data);
      setMonthlyTrend(trendRes.data.map(d => ({
        ...d,
        month: d.month.length >= 7 ? new Date(d.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : d.month
      })));
      setRateDistribution(rateRes.data);
      setTopBorrowers(borrowerRes.data);
    } catch (error) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleExportAll = async () => {
    setExporting(true);
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
      toast.success('Export downloaded successfully');
    } catch (error) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const totalPending = villageSummary.reduce((s, v) => s + v.total_pending, 0);
  const totalLanded = villageSummary.reduce((s, v) => s + v.total_landed, 0);
  const totalAccounts = villageSummary.reduce((s, v) => s + v.total_accounts, 0);
  const totalInterest = villageSummary.reduce((s, v) => s + v.total_interest, 0);

  return (
    <div className="space-y-6" data-testid="reports-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Business insights and financial overview</p>
        </div>
        <button
          onClick={handleExportAll}
          disabled={exporting}
          data-testid="export-all-excel-btn"
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 transition-colors disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export All (Excel)'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Total Landed</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{formatCurrency(totalLanded)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-sky-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-50 rounded-lg">
                <MapPin className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Pending Principal</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{formatCurrency(totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Percent className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Pending Interest</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{formatCurrency(totalInterest)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-50 rounded-lg">
                <Users className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Total Accounts</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{totalAccounts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">Monthly Lending vs Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72" data-testid="monthly-trend-chart">
              {monthlyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrend} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#64748b" tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="landed" name="Landed" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="received" name="Received" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Village Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">Village-wise Pending Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72" data-testid="village-chart">
              {villageSummary.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={villageSummary}
                      dataKey="total_pending"
                      nameKey="village"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ village, percent }) => `${village} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: '#94a3b8' }}
                    >
                      {villageSummary.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interest Rate Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">Interest Rate Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72" data-testid="rate-distribution-chart">
              {rateDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rateDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="rate" tick={{ fontSize: 12 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#64748b" tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total_amount" name="Total Amount" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Borrowers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">Top Borrowers by Pending Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 overflow-auto" data-testid="top-borrowers-table">
              {topBorrowers.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium text-xs">#</th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium text-xs">Name</th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium text-xs">Village</th>
                      <th className="text-right py-2 px-3 text-slate-600 font-medium text-xs">Pending</th>
                      <th className="text-right py-2 px-3 text-slate-600 font-medium text-xs">Interest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topBorrowers.map((b, i) => (
                      <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                        <td className="py-2 px-3 font-medium text-slate-800">{b.name}</td>
                        <td className="py-2 px-3 text-slate-500">{b.village}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-slate-800">{formatCurrency(b.total_pending)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-600">{formatCurrency(b.total_interest)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Village Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-800">Village-wise Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="table-container" data-testid="village-summary-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-slate-600 font-medium text-xs uppercase tracking-wide">Village</th>
                  <th className="text-center py-3 px-4 text-slate-600 font-medium text-xs uppercase tracking-wide">Total</th>
                  <th className="text-center py-3 px-4 text-slate-600 font-medium text-xs uppercase tracking-wide">Active</th>
                  <th className="text-right py-3 px-4 text-slate-600 font-medium text-xs uppercase tracking-wide">Landed</th>
                  <th className="text-right py-3 px-4 text-slate-600 font-medium text-xs uppercase tracking-wide">Received</th>
                  <th className="text-right py-3 px-4 text-slate-600 font-medium text-xs uppercase tracking-wide">Pending</th>
                  <th className="text-right py-3 px-4 text-slate-600 font-medium text-xs uppercase tracking-wide">Interest</th>
                </tr>
              </thead>
              <tbody>
                {villageSummary.map((v, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-800">{v.village}</td>
                    <td className="py-3 px-4 text-center text-slate-600">{v.total_accounts}</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-medium">{v.active_accounts}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(v.total_landed)}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(v.total_received)}</td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-800">{formatCurrency(v.total_pending)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-amber-600">{formatCurrency(v.total_interest)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200">
                  <td className="py-3 px-4 text-slate-900">Total</td>
                  <td className="py-3 px-4 text-center">{totalAccounts}</td>
                  <td className="py-3 px-4 text-center text-emerald-600">{villageSummary.reduce((s, v) => s + v.active_accounts, 0)}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(totalLanded)}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(villageSummary.reduce((s, v) => s + v.total_received, 0))}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(totalPending)}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-amber-600">{formatCurrency(totalInterest)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
