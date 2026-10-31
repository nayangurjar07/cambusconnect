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
  const { login, loginGoogle } = useAuth();
  const { tenant } = useTenant();
  const { showError, showSuccess } = useToast();

  const [selectedRole, setSelectedRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      await loginGoogle(selectedRole);
      showSuccess(`Signed in with Google as ${selectedRole}`);
      const destination = roles.find(r => r.id === selectedRole)?.path || '/';
      const from = location.state?.from?.pathname || destination;
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.message || "Google sign-in failed.";
      setErrorMessage(msg);
      showError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const roles = [
    { id: 'student', label: 'Student', icon: User, path: '/student/home' },
    { id: 'driver', label: 'Driver', icon: Bus, path: '/driver/dashboard' },
    { id: 'admin', label: 'Admin', icon: Briefcase, path: '/admin/dashboard' },
    { id: 'owner', label: 'Owner', icon: Shield, path: '/owner/dashboard' },
  ];

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMessage("Please enter both ID/Email and password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      await login(cleanEmail, cleanPassword, selectedRole);
      showSuccess(`Signed in successfully as ${selectedRole}`);

      const destination = roles.find(r => r.id === selectedRole)?.path || '/';
      const from = location.state?.from?.pathname || destination;
      navigate(from, { replace: true });
    } catch (err) {
      let msg = err.message || "Invalid credentials or unauthorized access.";
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = "Incorrect password. Please verify your credentials and try again.";
      } else if (err.code === 'auth/user-not-found') {
        msg = "No account found with this email. Please check your email or contact transport admin.";
      } else if (err.code === 'auth/too-many-requests') {
        msg = "Too many failed attempts. Please wait a few moments before trying again.";
      } else if (err.code === 'auth/network-request-failed') {
        msg = "Network connection error. Please verify your internet connection.";
      }
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

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-slate-400 font-semibold uppercase tracking-wider">or</span>
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-google-sso"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-2xl font-semibold text-xs shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continue with Institutional Google SSO</span>
                </button>
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
