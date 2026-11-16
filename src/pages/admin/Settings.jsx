// src/pages/admin/Settings.jsx
import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, Save, Building2, Radio,
  RefreshCw
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useToast } from '../../contexts/ToastContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/layout/PageHeader';
import { StudentSchemaEditor } from '../../components/domain/StudentSchemaEditor';

export function AdminSettings() {
  const { tenant, tenantKey, updateTenantBranding } = useTenant();
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);

  // Form State
  const [instituteName, setInstituteName] = useState(tenant?.branding?.name || 'Indore Institute of Science & Technology');
  const [shortName, setShortName] = useState(tenant?.branding?.shortName || 'IIST');
  const [primaryColor, setPrimaryColor] = useState(tenant?.branding?.colors?.primary || '#2563eb');
  const [telemetryInterval, setTelemetryInterval] = useState(() => localStorage.getItem('gps_interval') || '5');
  const [lockoutMinutes, setLockoutMinutes] = useState(() => localStorage.getItem('default_lockout') || '240');
  const [autoVerify, setAutoVerify] = useState(() => localStorage.getItem('auto_verify_boardings') !== 'false');

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // 1. Update branding in context & storage
      if (updateTenantBranding) {
        updateTenantBranding({
          name: instituteName.trim(),
          shortName: shortName.trim(),
          colors: {
            ...tenant?.branding?.colors,
            primary: primaryColor
          }
        });
      }

      // 2. Persist tracking & policy settings
      localStorage.setItem('gps_interval', telemetryInterval);
      localStorage.setItem('default_lockout', lockoutMinutes);
      localStorage.setItem('auto_verify_boardings', String(autoVerify));

      await new Promise(r => setTimeout(r, 400));
      showSuccess("Settings updated and saved successfully!");
    } catch (err) {
      console.error("Save error:", err);
      showError("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClearCache = () => {
    const keysToKeep = ['userRole', 'userTenantId', 'isLoggedIn', 'activeTenantKey'];
    Object.keys(localStorage).forEach(key => {
      if (!keysToKeep.includes(key)) localStorage.removeItem(key);
    });
    showSuccess("Cache cleared. Reloading...");
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-sans">
      <PageHeader
        title="Campus System Settings"
        subtitle="Manage institute branding, fleet tracking intervals, security policies, and student import schemas"
      />

      <Tabs
        tabs={[
          { id: 'general', label: 'General & Branding' },
          { id: 'fleet', label: 'Fleet & Policy Parameters' },
          { id: 'schema', label: 'Student CSV Schema' }
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="underline"
      />

      {/* ─── TAB 1: General & Branding ─── */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-200/80 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">
                  Campus Institutional Branding
                </h3>
              </div>
              <Badge variant="primary" dot>
                Partition: {tenantKey?.toUpperCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Institute Name"
                placeholder="e.g. Indore Institute of Science & Technology"
                value={instituteName}
                onChange={(e) => setInstituteName(e.target.value)}
                required
              />

              <Input
                label="Short Code / Acronym"
                placeholder="e.g. IIST"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Brand Accent Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-12 h-11 p-1 rounded-xl border border-slate-200 cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Active Domain Subdomain
                </label>
                <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center justify-between">
                  <span>{tenantKey}.cambusconnect.in</span>
                  <Badge variant="success">Active</Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={Save}
              isLoading={saving}
              className="rounded-2xl px-6 py-3 font-bold shadow-md shadow-blue-500/20"
            >
              Save Branding Changes
            </Button>
          </div>
        </form>
      )}

      {/* ─── TAB 2: Fleet & Policy Parameters ─── */}
      {activeTab === 'fleet' && (
        <form onSubmit={handleSaveGeneral} className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-200/80 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">
                  Live Tracking & Fleet Telemetry
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-semibold">Real-Time Settings</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  GPS Broadcast Frequency
                </label>
                <select
                  value={telemetryInterval}
                  onChange={(e) => setTelemetryInterval(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                >
                  <option value="3">Every 3 seconds (High Accuracy / Fleet Live)</option>
                  <option value="5">Every 5 seconds (Recommended Default)</option>
                  <option value="10">Every 10 seconds (Bandwidth Saver)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-0.5">Defines how frequently driver GPS pings are pushed to students.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Anti-Loop Pass Lockout Duration
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={lockoutMinutes}
                    onChange={(e) => setLockoutMinutes(e.target.value)}
                    min="1"
                    max="1440"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                  <span className="text-xs font-bold text-slate-500 shrink-0">minutes</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Prevents identical passes from being re-scanned on the same run.</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Auto-increment Passenger Headcount</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Automatically increment vehicle headcount by +1 on approved QR verification.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoVerify(!autoVerify)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${autoVerify ? 'bg-blue-600' : 'bg-slate-200'}`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${autoVerify ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* API keys & infrastructure credentials are managed in Owner → Settings */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
                <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-blue-800">
                  <strong>API keys</strong> (Google Maps, Telematics, Firebase) are managed in the <strong>Owner → Infrastructure Settings</strong> panel.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800">Clear Local Application Cache</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Resets cached routes, stops, and localized storage tokens without affecting cloud records.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={handleClearCache}
              className="rounded-2xl"
            >
              Clear Cache
            </Button>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={Save}
              isLoading={saving}
              className="rounded-2xl px-6 py-3 font-bold shadow-md shadow-blue-500/20"
            >
              Save Policy Parameters
            </Button>
          </div>
        </form>
      )}

      {/* ─── TAB 3: Student CSV Schema ─── */}
      {activeTab === 'schema' && (
        <StudentSchemaEditor />
      )}
    </div>
  );
}
