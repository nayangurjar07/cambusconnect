// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { AppShell } from './components/layout/AppShell';

// Public pages
import { LandingPage } from './pages/Landing';
import { LoginPage } from './pages/Login';
import { NotFoundPage } from './pages/NotFound';

// Student pages
import { StudentDashboard } from './pages/student/Dashboard';
import { StudentTrack } from './pages/student/Track';
import { StudentBusPass } from './pages/student/BusPass';
import { StudentSearch } from './pages/student/Search';
import { StudentNotifications } from './pages/student/Notifications';
import { StudentLostFound } from './pages/student/LostFound';
import { StudentSupport } from './pages/student/Support';
import { StudentProfile } from './pages/student/Profile';

// Driver pages (Distinct Views)
import { DriverDashboard } from './pages/driver/Dashboard';
import { DriverScanPass } from './pages/driver/ScanPass';
import { DriverSchedule } from './pages/driver/Schedule';
import { DriverAlerts } from './pages/driver/Alerts';
import { DriverSupport } from './pages/driver/Support';

// Admin pages
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminTracking } from './pages/admin/Tracking';
import { AdminBuses } from './pages/admin/Buses';
import { AdminRoutes } from './pages/admin/Routes';
import { AdminStudents } from './pages/admin/Students';
import { AdminStaff } from './pages/admin/Staff';
import { AdminShifts } from './pages/admin/Shifts';
import { AdminScanPass } from './pages/admin/AdminScanPass';
import { AdminNotifications } from './pages/admin/Notifications';
import { AdminHelpDesk } from './pages/admin/HelpDesk';
import { AdminSettings } from './pages/admin/Settings';

// Owner pages
import { OwnerDashboard } from './pages/owner/Dashboard';
import { OwnerSettings } from './pages/owner/Settings';

function NetworkStatusListener() {
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    const handleOffline = () => showError("You are offline. Some features may be unavailable.");
    const handleOnline = () => showSuccess("Back online! Connection restored.");

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [showError, showSuccess]);

  return null;
}

export function App() {
  return (
    <TenantProvider>
      <AuthProvider>
        <ToastProvider>
          <NetworkStatusListener />
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />

              {/* Student Portal */}
              <Route path="/student" element={<AppShell allowedRole="student" />}>
                <Route index element={<Navigate to="/student/home" replace />} />
                <Route path="home" element={<StudentDashboard />} />
                <Route path="track" element={<StudentTrack />} />
                <Route path="bus-pass" element={<StudentBusPass />} />
                <Route path="search" element={<StudentSearch />} />
                <Route path="notifications" element={<StudentNotifications />} />
                <Route path="lost-found" element={<StudentLostFound />} />
                <Route path="support" element={<StudentSupport />} />
                <Route path="profile" element={<StudentProfile />} />
              </Route>

              {/* Driver & Conductor Portal (Distinct Pages) */}
              <Route path="/driver" element={<AppShell allowedRole="driver" />}>
                <Route index element={<Navigate to="/driver/dashboard" replace />} />
                <Route path="dashboard" element={<DriverDashboard />} />
                <Route path="scan-pass" element={<DriverScanPass />} />
                <Route path="schedule" element={<DriverSchedule />} />
                <Route path="alerts" element={<DriverAlerts />} />
                <Route path="support" element={<DriverSupport />} />
              </Route>

              {/* Conductor Portal Aliases */}
              <Route path="/conductor" element={<Navigate to="/driver/dashboard" replace />} />
              <Route path="/conductor/dashboard" element={<Navigate to="/driver/dashboard" replace />} />
              <Route path="/conductor/scan-pass" element={<Navigate to="/driver/scan-pass" replace />} />
              <Route path="/conductor/schedule" element={<Navigate to="/driver/schedule" replace />} />
              <Route path="/conductor/alerts" element={<Navigate to="/driver/alerts" replace />} />
              <Route path="/conductor/*" element={<Navigate to="/driver/dashboard" replace />} />

              {/* Admin Portal */}
              <Route path="/admin" element={<AppShell allowedRole="admin" />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="track" element={<AdminTracking />} />
                <Route path="buses" element={<AdminBuses />} />
                <Route path="routes" element={<AdminRoutes />} />
                <Route path="students" element={<AdminStudents />} />
                <Route path="staff" element={<AdminStaff />} />
                <Route path="shifts" element={<AdminShifts />} />
                <Route path="scan-pass" element={<AdminScanPass />} />
                <Route path="notifications" element={<AdminNotifications />} />
                <Route path="helpdesk" element={<AdminHelpDesk />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>

              {/* Owner Portal */}
              <Route path="/owner" element={<AppShell allowedRole="owner" />}>
                <Route index element={<Navigate to="/owner/dashboard" replace />} />
                <Route path="dashboard" element={<OwnerDashboard />} />
                <Route path="tenants" element={<OwnerDashboard />} />
                <Route path="settings" element={<OwnerSettings />} />
              </Route>

              {/* 404 Catch-All */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </TenantProvider>
  );
}

export default App;
