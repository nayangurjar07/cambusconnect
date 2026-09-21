// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Bus, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Building2, 
  User, 
  Briefcase, 
  Shield, 
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useToast } from '../contexts/ToastContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { tenant } = useTenant();
  const { showError, showSuccess } = useToast();

  const [selectedRole, setSelectedRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const roles = [
    { id: 'student', label: 'Student', icon: User, path: '/student/home' },
    { id: 'driver', label: 'Driver', icon: Bus, path: '/driver/dashboard' },
    { id: 'admin', label: 'Admin', icon: Briefcase, path: '/admin/dashboard' },
    { id: 'owner', label: 'Owner', icon: Shield, path: '/owner/dashboard' },
  ];

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please enter both ID/Email and password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      await login(email, password, selectedRole);
      showSuccess(`Signed in successfully as ${selectedRole}`);

      const destination = roles.find(r => r.id === selectedRole)?.path || '/';
      const from = location.state?.from?.pathname || destination;
      navigate(from, { replace: true });
    } catch (err) {
      let msg = "Invalid credentials or unauthorized access.";
      setErrorMessage(msg);
      showError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 flex flex-col justify-between font-sans">
      {/* Top Simple Nav */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-200/70 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/25">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-sm text-slate-900 block leading-tight">Cambus Connect</span>
            <span className="text-[10px] text-slate-400 font-medium">Smart Transit</span>
          </div>
        </Link>
        <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200/60 text-xs font-medium text-slate-700">
          Campus: <strong className="text-slate-900 font-semibold">{tenant.branding?.shortName || "IIST"}</strong>
        </span>
      </header>

      {/* Main Login Card */}
      <div className="flex-1 flex items-center justify-center p-4 my-8">
        <div className="w-full max-w-md space-y-5">
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="text-xs text-slate-500">
              Authenticate with your institutional account to access your transit portal.
            </p>
          </div>

          {/* Role Tab Selector */}
          <div className="grid grid-cols-4 gap-1 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/60">
            {roles.map((r) => {
              const Icon = r.icon;
              const isSelected = selectedRole === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedRole(r.id);
                    setErrorMessage('');
                  }}
                  className={`py-2 px-1 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                    isSelected
                      ? 'bg-white text-blue-600 shadow-sm shadow-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[11px]">{r.label}</span>
                </button>
              );
            })}
          </div>

          {/* Login Form Container */}
          <div className="p-6 bg-white border border-slate-200/80 rounded-3xl shadow-[0_4px_25px_rgba(0,0,0,0.04)]">
            {errorMessage && (
              <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200/80 text-red-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  {selectedRole === 'student' ? 'Student ID or Email' : 'Institutional Email'}
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder={selectedRole === 'student' ? 'e.g. 0827CS211001 or student email' : 'staff@institution.edu'}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrorMessage(''); }}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your account password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrorMessage(''); }}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full py-3 rounded-2xl font-semibold shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all"
                  icon={ArrowRight}
                  isLoading={isLoading}
                >
                  Sign In as {roles.find(r => r.id === selectedRole)?.label}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <footer className="py-4 px-4 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white">
        <div className="flex justify-center items-center gap-4 mb-2">
          <a href="/privacy.html" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
          <span>•</span>
          <a href="/terms.html" className="hover:text-slate-600 transition-colors">Terms of Service</a>
        </div>
        Cambus Connect Transit Platform • Protected Enterprise Access
      </footer>
    </div>
  );
}
