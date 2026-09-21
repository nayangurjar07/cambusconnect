// src/components/layout/Topbar.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Menu, Bell, Building2, ChevronDown, Check, User, 
  Settings, LogOut, QrCode, Bus, Shield, ExternalLink, Clock, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribeToNotifications } from '../../services/communications';

export function Topbar({ onOpenSidebar }) {
  const navigate = useNavigate();
  const { role, profile, logout } = useAuth();
  const { tenant, tenantKey, changeTenant, allTenants } = useTenant();
  const { showSuccess } = useToast();

  // Dropdown states
  const [showTenantDropdown, setShowTenantDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Refs for outside click closing
  const tenantDropdownRef = useRef(null);
  const notificationDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);

  // Subscribe to notifications
  useEffect(() => {
    const unsub = subscribeToNotifications((list) => {
      setNotifications(list.slice(0, 6));
    });
    return () => unsub();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (tenantDropdownRef.current && !tenantDropdownRef.current.contains(e.target)) {
        setShowTenantDropdown(false);
      }
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(e.target)) {
        setShowNotificationDropdown(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    setShowProfileDropdown(false);
    await logout();
    showSuccess("Signed out successfully");
    navigate('/login');
  };

  const getNotificationLink = () => {
    if (role === 'admin') return '/admin/notifications';
    if (role === 'student') return '/student/notifications';
    if (role === 'driver') return '/driver/alerts';
    return '/admin/notifications';
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'student': return 'Student';
      case 'driver': return 'Driver Staff';
      case 'admin': return 'Campus Admin';
      case 'owner': return 'Platform Owner';
      default: return 'User';
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 glass-nav px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-sm shadow-blue-900/5">
      {/* Left: Mobile Sidebar Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSidebar}
          className="w-10 h-10 -ml-2 rounded-2xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors lg:hidden active:scale-95 cursor-pointer"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Campus Context Display */}
        {role === 'owner' ? (
          <div className="relative" ref={tenantDropdownRef}>
            <button
              onClick={() => {
                setShowTenantDropdown(!showTenantDropdown);
                setShowNotificationDropdown(false);
                setShowProfileDropdown(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 transition-colors text-xs font-bold text-indigo-700 active:scale-95 cursor-pointer"
              title="Platform Owner: Switch active campus partition"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>{tenant.branding?.shortName || "Campus"}</span>
              <ChevronDown className="w-3 h-3 text-indigo-500" />
            </button>

            {showTenantDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 overflow-hidden">
                <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Switch Campus Context
                </div>
                {Object.entries(allTenants)
                  .filter(([key]) => !profile?.tenantAccess || profile.tenantAccess.includes(key) || key === 'owner')
                  .map(([key, item]) => {
                    const isSelected = key === tenantKey;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          changeTenant(key);
                          setShowTenantDropdown(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="font-bold">{item.branding?.shortName}</div>
                          <div className="text-[11px] text-slate-400">{item.branding?.name}</div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/60 bg-white/50 backdrop-blur-sm text-xs font-semibold text-slate-700 shadow-sm">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{tenant.branding?.shortName || "Campus"}</span>
          </div>
        )}

        {/* ─── NOTIFICATION BELL & DROPDOWN ─── */}
        <div className="relative" ref={notificationDropdownRef}>
          <button
            onClick={() => {
              setShowNotificationDropdown(!showNotificationDropdown);
              setShowProfileDropdown(false);
              setShowTenantDropdown(false);
            }}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer relative"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>

          {showNotificationDropdown && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 glass-card rounded-3xl shadow-[0_16px_64px_rgba(0,0,0,0.1)] z-50 overflow-hidden animate-slide-up border border-white/60">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Notifications &amp; Alerts</h4>
                  <span className="text-[11px] text-slate-400 font-medium">Real-time route advisories</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {notifications.length} New
                </span>
              </div>

              <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100 p-1">
                {notifications.map((n) => (
                  <div key={n.id} className="p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-xs text-slate-900 leading-snug">{n.title}</div>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">{n.dateFormatted}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
                  </div>
                ))}

                {notifications.length === 0 && (
                  <div className="py-10 text-center text-xs text-slate-400 font-medium">
                    <Bell className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                    No active notifications or alerts.
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                <Link
                  to={getNotificationLink()}
                  onClick={() => setShowNotificationDropdown(false)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                >
                  <span>View All Alerts</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ─── USER PROFILE AVATAR & DROPDOWN ─── */}
        <div className="relative" ref={profileDropdownRef}>
          <button
            onClick={() => {
              setShowProfileDropdown(!showProfileDropdown);
              setShowNotificationDropdown(false);
              setShowTenantDropdown(false);
            }}
            className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 border-2 border-blue-200 font-bold text-xs flex items-center justify-center shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
            aria-label="User profile menu"
          >
            {profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}
          </button>

          {showProfileDropdown && (
            <div className="absolute right-0 mt-2 w-72 glass-card rounded-3xl shadow-[0_16px_64px_rgba(0,0,0,0.1)] p-4 z-50 space-y-3 animate-slide-up border border-white/60">
              {/* User Identity Banner */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white font-bold text-base flex items-center justify-center shadow-xs shrink-0">
                  {profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate leading-tight">
                    {profile?.name || "Campus User"}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">
                    {profile?.email || "user@campus.edu"}
                  </p>
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    {getRoleLabel()}
                  </span>
                </div>
              </div>

              {/* Campus Affiliation Info */}
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Institution</span>
                <span className="font-bold text-slate-800 block mt-0.5 truncate">
                  {tenant.branding?.name || "Campus Network"}
                </span>
              </div>

              {/* Navigation Actions */}
              <div className="space-y-1 text-xs font-semibold text-slate-700">
                {role === 'admin' && (
                  <Link
                    to="/admin/settings"
                    onClick={() => setShowProfileDropdown(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-700 no-underline cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span>Campus System Settings</span>
                  </Link>
                )}

                {role === 'student' && (
                  <>
                    <Link
                      to="/student/bus-pass"
                      onClick={() => setShowProfileDropdown(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-700 no-underline cursor-pointer"
                    >
                      <QrCode className="w-4 h-4 text-blue-600" />
                      <span>My Digital Bus Pass</span>
                    </Link>
                    <Link
                      to="/student/profile"
                      onClick={() => setShowProfileDropdown(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-700 no-underline cursor-pointer"
                    >
                      <User className="w-4 h-4 text-slate-500" />
                      <span>Student Profile</span>
                    </Link>
                  </>
                )}

                {role === 'driver' && (
                  <Link
                    to="/driver/dashboard"
                    onClick={() => setShowProfileDropdown(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-700 no-underline cursor-pointer"
                  >
                    <Bus className="w-4 h-4 text-emerald-600" />
                    <span>Driver Duty Console</span>
                  </Link>
                )}

                {role === 'owner' && (
                  <Link
                    to="/owner/dashboard"
                    onClick={() => setShowProfileDropdown(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-700 no-underline cursor-pointer"
                  >
                    <Shield className="w-4 h-4 text-indigo-600" />
                    <span>Platform Admin Console</span>
                  </Link>
                )}
              </div>

              {/* Sign Out Button */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors cursor-pointer active:scale-95"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
