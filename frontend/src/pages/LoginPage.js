import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { toast } from 'sonner';
import { Lock, User, Gem } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please enter username and password');
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      toast.success('Login successful');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1618044733300-9472054094ee?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwyfHxmaW5hbmNlJTIwbGVkZ2VyJTIwcGFwZXIlMjBhYnN0cmFjdHxlbnwwfHx8fDE3NzM1MjIyNjl8MA&ixlib=rb-4.1.0&q=85"
          alt="Finance Background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/90 to-slate-900/90" />
        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl">
              <Gem className="h-8 w-8 text-amber-400" />
            </div>
            <span className="text-3xl font-bold font-display">LendLedger</span>
          </div>
          <h1 className="text-4xl font-bold font-display leading-tight mb-4">
            Jewellery & Money<br />Lending Management
          </h1>
          <p className="text-lg text-slate-300 max-w-md">
            Streamline your lending operations with precise interest calculations, 
            comprehensive ledger tracking, and powerful account management.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-6">
            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
              <div className="text-2xl font-bold text-amber-400 font-mono">100%</div>
              <div className="text-sm text-slate-400">Accurate Calculations</div>
            </div>
            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
              <div className="text-2xl font-bold text-emerald-400 font-mono">24/7</div>
              <div className="text-sm text-slate-400">Access Anywhere</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div className="p-3 bg-emerald-700 rounded-xl">
              <Gem className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold font-display text-slate-900">LendLedger</span>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold font-display text-slate-900">Welcome Back</h2>
              <p className="text-slate-500 mt-2">Sign in to access your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Username or Mobile
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    data-testid="login-username"
                    type="text"
                    placeholder="Enter username or mobile"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    data-testid="login-password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Button
                data-testid="login-submit"
                type="submit"
                className="w-full h-12 text-base"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" className="text-white" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <p className="text-center text-sm text-slate-500">
                Contact your administrator if you need access
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
