import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';
import { Spinner } from './components/ui/Spinner';
import {
  LayoutDashboard,
  FileText,
  Users,
  LogOut,
  Menu,
  X,
  Gem,
  ChevronRight,
  ChevronLeft,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AccountsPage from './pages/AccountsPage';
import AccountDetailPage from './pages/AccountDetailPage';
import AccountFormPage from './pages/AccountFormPage';
import UsersPage from './pages/UsersPage';
import ReportsPage from './pages/ReportsPage';

// Protected Route Wrapper
const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <DashboardLayout />;
};

// Dashboard Layout with Sidebar
const DashboardLayout = () => {
  const { user, logout, hasPermission, isAdmin, refreshUser } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  // Refresh user permissions on route change
  React.useEffect(() => {
    refreshUser();
  }, [location.pathname]);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Accounts', href: '/accounts', icon: FileText, requiredPermission: ['accounts', 'view'] },
    { name: 'Reports', href: '/reports', icon: BarChart3, requiredPermission: ['accounts', 'view'] },
    { name: 'Users', href: '/users', icon: Users, adminOnly: true },
  ];

  const filteredNav = navigation.filter(item => {
    if (item.adminOnly) return isAdmin;
    if (item.requiredPermission) {
      return isAdmin || hasPermission(item.requiredPermission[0], item.requiredPermission[1]);
    }
    return true;
  });

  const isActive = (href) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background-app">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 transform transition-all duration-200 lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } ${sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-64'} w-64`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-200">
            <div className="p-2 bg-emerald-700 rounded-xl flex-shrink-0">
              <Gem className="h-6 w-6 text-white" />
            </div>
            {!sidebarCollapsed && (
              <span className="text-xl font-bold font-display text-slate-900 lg:block hidden">LendLedger</span>
            )}
            <span className="text-xl font-bold font-display text-slate-900 lg:hidden">LendLedger</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
            {filteredNav.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                data-testid={`nav-${item.name.toLowerCase()}`}
                title={sidebarCollapsed ? item.name : undefined}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  sidebarCollapsed ? 'lg:justify-center' : ''
                } ${
                  isActive(item.href)
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="hidden lg:inline">{item.name}</span>}
                <span className="lg:hidden">{item.name}</span>
                {!sidebarCollapsed && isActive(item.href) && (
                  <ChevronRight className="h-4 w-4 ml-auto hidden lg:block" />
                )}
              </Link>
            ))}
          </nav>

          {/* Toggle Button (desktop only) */}
          <div className="hidden lg:flex px-3 py-2 border-t border-slate-100">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              data-testid="sidebar-toggle-btn"
              className={`flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <>
                  <PanelLeftClose className="h-5 w-5" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>

          {/* User Info */}
          <div className="px-3 py-4 border-t border-slate-200">
            <div className={`flex items-center gap-3 px-3 py-3 bg-slate-50 rounded-xl mb-3 ${sidebarCollapsed ? 'lg:justify-center lg:px-1' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-700 font-semibold text-sm">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </span>
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0 hidden lg:block">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {user?.is_admin ? 'Administrator' : 'User'}
                  </p>
                </div>
              )}
              <div className="flex-1 min-w-0 lg:hidden">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {user?.is_admin ? 'Administrator' : 'User'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              data-testid="logout-btn"
              className={`flex items-center gap-3 w-full px-3 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors ${
                sidebarCollapsed ? 'lg:justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Sign Out' : undefined}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span className="hidden lg:inline">Sign Out</span>}
              <span className="lg:hidden">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-200 ${sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}>
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="h-6 w-6 text-slate-600" />
            </button>
            <div className="flex items-center gap-2">
              <Gem className="h-6 w-6 text-emerald-700" />
              <span className="font-bold font-display text-slate-900">LendLedger</span>
            </div>
            <div className="w-10" />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

// App Component
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster 
          position="top-right" 
          richColors 
          toastOptions={{
            style: {
              fontFamily: 'Inter, system-ui, sans-serif',
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/accounts/new" element={<AccountFormPage />} />
            <Route path="/accounts/:id" element={<AccountDetailPage />} />
            <Route path="/accounts/:id/edit" element={<AccountFormPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/users" element={<UsersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
