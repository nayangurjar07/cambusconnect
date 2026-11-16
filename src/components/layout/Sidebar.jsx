// src/components/layout/Sidebar.jsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Bus,
  Map,
  QrCode,
  Users,
  Bell,
  LifeBuoy,
  Search,
  Settings,
  LogOut,
  LayoutDashboard,
  Clock,
  Building2,
  Briefcase,
  MapPin,
  Package,
  Radio,
  Route as RouteIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';

export function Sidebar({ isOpen, onClose }) {
  const { role, profile, logout } = useAuth();
  const { branding } = useTenant();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (window.confirm("Sign out of Cambus Connect?")) {
      if (typeof window !== 'undefined' && window.CambusCache && typeof window.CambusCache.clearAll === 'function') {
        window.CambusCache.clearAll();
      }
      await logout();
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace('/login');
    }
  };

  const getNavGroups = () => {
    switch (role) {
      case 'student':
        return [
          {
            label: 'Main',
            items: [
              { label: 'Dashboard', path: '/student/home', icon: LayoutDashboard },
              { label: 'Live Tracking', path: '/student/track', icon: Map },
              { label: 'Bus Pass', path: '/student/bus-pass', icon: QrCode },
              { label: 'Search Routes', path: '/student/search', icon: Search },
            ]
          },
          {
            label: 'Services',
            items: [
              { label: 'Notifications', path: '/student/notifications', icon: Bell },
              { label: 'Lost & Found', path: '/student/lost-found', icon: Package },
              { label: 'Support', path: '/student/support', icon: LifeBuoy },
              { label: 'Profile', path: '/student/profile', icon: Settings },
            ]
          }
        ];
      case 'driver':
      case 'conductor':
        return [
          {
            label: 'Operations',
            items: [
              { label: 'Dashboard', path: '/driver/dashboard', icon: LayoutDashboard },
              { label: 'Scan Pass', path: '/driver/scan-pass', icon: QrCode },
              { label: 'Schedule', path: '/driver/schedule', icon: Clock },
            ]
          },
          {
            label: 'Communication',
            items: [
              { label: 'Alerts', path: '/driver/alerts', icon: Bell },
              { label: 'Support', path: '/driver/support', icon: LifeBuoy },
            ]
          }
        ];
      case 'admin':
        return [
          {
            label: 'Overview',
            items: [
              { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
              { label: 'Fleet Tracking', path: '/admin/track', icon: Map },
            ]
          },
          {
            label: 'Management',
            items: [
              { label: 'Buses', path: '/admin/buses', icon: Bus },
              { label: 'Routes', path: '/admin/routes', icon: RouteIcon },
              { label: 'Students', path: '/admin/students', icon: Users },
              { label: 'Staff', path: '/admin/staff', icon: Briefcase },
              { label: 'Shifts', path: '/admin/shifts', icon: Clock },
            ]
          },
          {
            label: 'Operations',
            items: [
              { label: 'Scan Pass', path: '/admin/scan-pass', icon: QrCode },
              { label: 'Notifications', path: '/admin/notifications', icon: Bell },
              { label: 'Help Desk', path: '/admin/helpdesk', icon: LifeBuoy },
            ]
          },
          {
            label: 'System',
            items: [
              { label: 'Settings', path: '/admin/settings', icon: Settings },
            ]
          }
        ];
      case 'owner':
        return [
          {
            label: 'Platform',
            items: [
              { label: 'Dashboard', path: '/owner/dashboard', icon: LayoutDashboard },
              { label: 'Tenants', path: '/owner/tenants', icon: Building2 },
              { label: 'Fleet Overview', path: '/admin/track', icon: Map },
              { label: 'Settings', path: '/owner/settings', icon: Settings },
            ]
          }
        ];
      default:
        return [];
    }
  };

  const navGroups = getNavGroups();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 bottom-0 w-60 bg-white border-r border-slate-200 z-50
        flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        lg:translate-x-0
        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        {/* Brand */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-100 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-600/30">
            <Bus className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold text-slate-800 block leading-tight">Cambus Connect</span>
            <span className="text-[11px] font-medium text-slate-500 block leading-tight truncate">Campus Mobility</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={true}
                      onClick={onClose}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 relative
                        ${isActive
                          ? 'bg-blue-600/10 text-blue-700 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}
                      `}
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="px-4 py-4 border-t border-white/40 shrink-0 bg-white/30 rounded-b-2xl">
          <div className="flex items-center gap-3 px-1 mb-3">
            <div className="w-8 h-8 rounded-xl bg-slate-200/80 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0 border border-white">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">
                {profile?.name || 'User'}
              </p>
              <p className="text-[11px] font-medium text-slate-500 truncate">
                {profile?.email || `${role}@cambus`}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
