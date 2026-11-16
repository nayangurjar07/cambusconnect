// src/components/layout/AppShell.jsx
import React, { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';

export function AppShell({ allowedRole }) {
  const { isAuthenticated, role, tenantId, loading } = useAuth();
  const { tenantKey, changeTenant } = useTenant();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Tenant Boundary Guard: Non-owners cannot operate in another tenant's partition
  React.useEffect(() => {
    if (isAuthenticated && role && role !== 'owner' && tenantId && tenantKey !== tenantId) {
      console.warn(`[AppShell Guard] Enforcing canonical tenant "${tenantId}" (attempted "${tenantKey}").`);
      changeTenant(tenantId).catch(err => console.error("Tenant guard redirection error:", err));
    }
  }, [isAuthenticated, role, tenantId, tenantKey, changeTenant]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isRoleAllowed = (expected, actual) => {
    if (!expected) return true;
    if (Array.isArray(expected)) return expected.includes(actual);
    if (expected === 'driver') return actual === 'driver' || actual === 'conductor';
    return actual === expected;
  };

  if (allowedRole && role && !isRoleAllowed(allowedRole, role)) {
    const homePaths = {
      student: '/student/home',
      driver: '/driver/dashboard',
      conductor: '/driver/dashboard',
      admin: '/admin/dashboard',
      owner: '/owner/dashboard'
    };
    return <Navigate to={homePaths[role] || '/login'} replace />;
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-[240px]">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 pb-20 lg:pb-6">
          <Outlet />
        </main>

        <MobileNav />
      </div>
    </div>
  );
}
