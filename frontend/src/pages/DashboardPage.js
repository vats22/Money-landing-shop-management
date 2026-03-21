import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatNumber } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { 
  TrendingUp, TrendingDown, Wallet, Clock, Users, FileText,
  ArrowRight, Gem, Lock
} from 'lucide-react';

export default function DashboardPage() {
  const { hasPermission, isAdmin } = useAuth();
  const [summary, setSummary] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [summaryRes, statsRes] = await Promise.all([
        api.get('/api/dashboard/summary'),
        api.get('/api/dashboard/stats')
      ]);
      setSummary(summaryRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  const canAdd = isAdmin || hasPermission('accounts', 'add');

  const summaryCards = [
    { title: 'Total Landed Amount', value: formatCurrency(summary?.total_landed_amount),
      icon: TrendingUp, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', description: 'Active accounts - money lent' },
    { title: 'Total Received Amount', value: formatCurrency(summary?.total_received_amount),
      icon: TrendingDown, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', description: 'Active accounts - money received' },
    { title: 'Pending Principal', value: formatCurrency(summary?.total_pending_amount),
      icon: Wallet, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', description: 'Active accounts - principal remaining' },
    { title: 'Pending Interest', value: formatCurrency(summary?.total_pending_interest),
      icon: Clock, iconBg: 'bg-red-100', iconColor: 'text-red-600', description: 'Active accounts - interest to collect' }
  ];

  const hasClosedData = summary?.closed_total_landed_amount > 0 || summary?.closed_total_pending_amount > 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of your lending operations</p>
        </div>
        {canAdd && (
          <Link
            to="/accounts/new"
            data-testid="new-account-btn"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors font-medium"
          >
            <span>New Account</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Active Accounts Summary Cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Active Accounts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="dashboard-summary-cards">
          {summaryCards.map((card, index) => (
            <Card key={index} className="card-hover">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{card.title}</p>
                    <p className="text-2xl font-bold font-mono text-slate-900 mt-2 tabular-nums">{card.value}</p>
                    <p className="text-xs text-slate-400 mt-1">{card.description}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${card.iconBg}`}>
                    <card.icon className={`h-6 w-6 ${card.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Closed Accounts Section */}
      {hasClosedData && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Closed Accounts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="closed-accounts-summary">
            <Card className="border-l-4 border-l-slate-400">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-slate-400">Closed - Landed</p>
                <p className="text-xl font-bold font-mono text-slate-500 mt-2 tabular-nums">
                  {formatCurrency(summary?.closed_total_landed_amount)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-slate-400">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-slate-400">Closed - Received</p>
                <p className="text-xl font-bold font-mono text-slate-500 mt-2 tabular-nums">
                  {formatCurrency(summary?.closed_total_received_amount)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-slate-400">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-slate-400">Closed - Pending</p>
                <p className="text-xl font-bold font-mono text-slate-500 mt-2 tabular-nums">
                  {formatCurrency(summary?.closed_total_pending_amount)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-slate-400">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-slate-400">Closed - Interest</p>
                <p className="text-xl font-bold font-mono text-slate-500 mt-2 tabular-nums">
                  {formatCurrency(summary?.closed_total_pending_interest)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Stats Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              Account Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-slate-500">Total Accounts</p>
                  <p className="text-2xl font-bold font-mono text-slate-900">{formatNumber(stats?.total_accounts)}</p>
                </div>
                <div className="p-3 bg-slate-200 rounded-full">
                  <FileText className="h-5 w-5 text-slate-600" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
                <div>
                  <p className="text-sm text-emerald-600">Active Accounts</p>
                  <p className="text-2xl font-bold font-mono text-emerald-700">{formatNumber(stats?.active_accounts)}</p>
                </div>
                <div className="p-3 bg-emerald-200 rounded-full">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-slate-500">Closed Accounts</p>
                  <p className="text-2xl font-bold font-mono text-slate-700">{formatNumber(stats?.closed_accounts)}</p>
                </div>
                <div className="p-3 bg-slate-200 rounded-full">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden">
          <div className="relative h-full min-h-[300px]">
            <img
              src="https://images.unsplash.com/photo-1727784635912-6f6e95d2f66a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDB8MHwxfHNlYXJjaHwyfHxnb2xkJTIwamV3ZWxsZXJ5JTIwbmVja2xhY2UlMjByaW5nJTIwbHV4dXJ5fGVufDB8fHx8MTc3MzUyMjI2OHww&ixlib=rb-4.1.0&q=85"
              alt="Gold Jewellery"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-transparent" />
            <div className="relative z-10 p-8 flex flex-col justify-center h-full">
              <div className="flex items-center gap-2 mb-4">
                <Gem className="h-8 w-8 text-amber-400" />
                <span className="text-amber-400 font-medium">Jewellery Secured</span>
              </div>
              <h3 className="text-2xl font-bold font-display text-white mb-2">Secure Lending Operations</h3>
              <p className="text-slate-300 max-w-md">
                Track all your jewellery-backed loans with precise interest calculations and comprehensive ledger management.
              </p>
              <Link
                to="/accounts"
                className="inline-flex items-center gap-2 mt-6 text-amber-400 font-medium hover:text-amber-300 transition-colors"
              >
                View All Accounts
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {canAdd && (
              <Link to="/accounts/new" className="flex flex-col items-center gap-3 p-6 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors group">
                <div className="p-4 bg-emerald-200 rounded-full group-hover:scale-110 transition-transform">
                  <FileText className="h-6 w-6 text-emerald-700" />
                </div>
                <span className="text-sm font-medium text-emerald-700">New Account</span>
              </Link>
            )}
            <Link to="/accounts" className="flex flex-col items-center gap-3 p-6 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors group">
              <div className="p-4 bg-blue-200 rounded-full group-hover:scale-110 transition-transform">
                <Wallet className="h-6 w-6 text-blue-700" />
              </div>
              <span className="text-sm font-medium text-blue-700">View Accounts</span>
            </Link>
            <Link to="/reports" className="flex flex-col items-center gap-3 p-6 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors group">
              <div className="p-4 bg-slate-200 rounded-full group-hover:scale-110 transition-transform">
                <TrendingUp className="h-6 w-6 text-slate-700" />
              </div>
              <span className="text-sm font-medium text-slate-700">Reports</span>
            </Link>
            {isAdmin && (
              <Link to="/users" className="flex flex-col items-center gap-3 p-6 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors group">
                <div className="p-4 bg-amber-200 rounded-full group-hover:scale-110 transition-transform">
                  <Users className="h-6 w-6 text-amber-700" />
                </div>
                <span className="text-sm font-medium text-amber-700">Manage Users</span>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
