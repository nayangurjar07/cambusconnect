// src/components/layout/MobileNav.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, QrCode, Bell, User, Bus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function MobileNav() {
  const { role } = useAuth();

  const getNavItems = () => {
    switch (role) {
      case 'student':
        return [
          { label: 'Home', path: '/student/home', icon: LayoutDashboard },
          { label: 'Track', path: '/student/track', icon: Map },
          { label: 'Pass', path: '/student/bus-pass', icon: QrCode },
          { label: 'Alerts', path: '/student/notifications', icon: Bell },
          { label: 'Profile', path: '/student/profile', icon: User },
        ];
      case 'driver':
        return [
          { label: 'Duty', path: '/driver/dashboard', icon: LayoutDashboard },
          { label: 'Scan', path: '/driver/scan-pass', icon: QrCode },
          { label: 'Alerts', path: '/driver/alerts', icon: Bell },
        ];
      case 'admin':
        return [
          { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
          { label: 'Tracking', path: '/admin/track', icon: Map },
          { label: 'Fleet', path: '/admin/buses', icon: Bus },
          { label: 'Students', path: '/admin/students', icon: User },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();
  if (navItems.length === 0) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 px-3 py-1.5 flex items-center justify-around lg:hidden shadow-[0_-4px_25px_rgba(0,0,0,0.04)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl text-[10px] font-semibold transition-all min-w-[54px] active:scale-95
              ${isActive 
                ? 'text-blue-600 bg-blue-50/80 font-bold shadow-2xs' 
                : 'text-slate-400 hover:text-slate-700'
              }
            `}
          >
            <Icon className="w-5 h-5 mb-1" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
