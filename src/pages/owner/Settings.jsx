// src/pages/owner/Settings.jsx
import React, { useState, useEffect } from 'react';
import {
  Key, MapPin, Shield, Database, Save, RefreshCw,
  Eye, EyeOff, CheckCircle2, AlertTriangle, Lock, Cpu
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { PageHeader } from '../../components/layout/PageHeader';
import { fetchBackendMapsKey, updateBackendMapsKey } from '../../services/googleMaps';
import { auth } from '../../config/firebase';

/** Masked value helper — shows last 4 chars only */
function maskSecret(val = '') {
  if (!val || val.length < 8) return val;
  return '•'.repeat(val.length - 4) + val.slice(-4);
}

export function OwnerSettings() {
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState('maps');
  const [saving, setSaving] = useState(false);

  // ── Google Maps ──────────────────────────────────────────
  const [googleMapsKey, setGoogleMapsKey] = useState('');
  const [showMapsKey, setShowMapsKey] = useState(false);
  const [mapsKeySaved, setMapsKeySaved] = useState(false);

  // ── Telematics ───────────────────────────────────────────
  const [telematicsApiKey, setTelematicsApiKey] = useState('');
  const [telematicsSecret, setTelematicsSecret] = useState('');
  const [showTelematicsKey, setShowTelematicsKey] = useState(false);
  const [showTelematicsSecret, setShowTelematicsSecret] = useState(false);

  // ── Firebase Info (read-only display) ────────────────────
  const firebaseConfig = {
    projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || '—',
    authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || '—',
    storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || '—',
    messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '—',
    appId: import.meta.env?.VITE_FIREBASE_APP_ID || '—',
  };

  // Load live Maps key from backend on mount
  useEffect(() => {
    fetchBackendMapsKey().then(key => {
      if (key) setGoogleMapsKey(key);
    }).catch(() => {});
  }, []);

  // ── Save Google Maps Key ──────────────────────────────────
  const handleSaveMapsKey = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateBackendMapsKey(googleMapsKey.trim());
      setMapsKeySaved(true);
      showSuccess('Google Maps API key updated successfully.');
      setTimeout(() => setMapsKeySaved(false), 3000);
    } catch (err) {
      showError('Failed to update Maps key: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Save Telematics Credentials (Encrypted via API) ──────
  const handleSaveTelematics = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Authentication required (Admin/Owner session)');

      const res = await fetch('/api/save-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          apiKey: telematicsApiKey.trim(),
          clientSecret: telematicsSecret.trim()
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Server rejected telematics update');
      }

      showSuccess('Hardware telematics credentials encrypted and stored securely at rest.');
      setTelematicsSecret('');
    } catch (err) {
      showError('Failed to save telematics credentials: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Shared field row for read-only Firebase config ────────
  const FirebaseRow = ({ label, value }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs font-semibold text-slate-500 w-44 shrink-0">{label}</span>
      <code className="text-xs font-mono text-slate-800 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 truncate max-w-[260px]">
        {value}
      </code>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <PageHeader
        title="Infrastructure Settings"
        subtitle="Manage API keys, cloud credentials, and Firebase configuration — restricted to Owner access only"
        actions={
          <Badge variant="warning" dot>
            Owner Only
          </Badge>
        }
      />

      <Tabs
        tabs={[
          { id: 'maps',      label: 'Google Maps API' },
          { id: 'telematics', label: 'Telematics Hardware' },
          { id: 'firebase',  label: 'Firebase Config' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="underline"
      />

      {/* ── TAB 1: Google Maps API Key ── */}
      {activeTab === 'maps' && (
        <form onSubmit={handleSaveMapsKey} className="space-y-5">
          <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-200/80 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">
                Google Maps JavaScript API Key
              </h3>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                This key is served exclusively from the backend <code className="font-mono bg-amber-100 px-1 rounded">/api/maps-config</code> endpoint.
                It is <strong>never</strong> bundled into the client-side JavaScript or exposed in DevTools Network tab.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Active API Key
              </label>
              <div className="relative">
                <input
                  type={showMapsKey ? 'text' : 'password'}
                  value={googleMapsKey}
                  onChange={(e) => setGoogleMapsKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-2.5 pr-11 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowMapsKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showMapsKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Powers real-time vehicle radar, route overlays, and student tracking map layers across all campus portals.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setGoogleMapsKey('')}
                className="text-xs text-red-500 hover:text-red-600 font-semibold"
              >
                Clear Key
              </button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon={mapsKeySaved ? CheckCircle2 : Save}
                isLoading={saving}
                className="rounded-2xl px-6 font-bold shadow-md shadow-blue-500/20"
              >
                {mapsKeySaved ? 'Saved!' : 'Save Maps Key'}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* ── TAB 2: Hardware Telematics ── */}
      {activeTab === 'telematics' && (
        <form onSubmit={handleSaveTelematics} className="space-y-5">
          <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-200/80 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Cpu className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">
                Hardware Telematics API Credentials
              </h3>
            </div>

            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
              <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 leading-relaxed">
                Credentials are encrypted at rest. They are used exclusively by backend dispatch services
                to poll hardware GPS beacons from connected vehicles. Admins cannot view or modify these.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">API Key</label>
                <div className="relative">
                  <input
                    type={showTelematicsKey ? 'text' : 'password'}
                    value={telematicsApiKey}
                    onChange={(e) => setTelematicsApiKey(e.target.value)}
                    placeholder="Enter telematics API key"
                    className="w-full px-4 py-2.5 pr-11 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTelematicsKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showTelematicsKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Client Secret</label>
                <div className="relative">
                  <input
                    type={showTelematicsSecret ? 'text' : 'password'}
                    value={telematicsSecret}
                    onChange={(e) => setTelematicsSecret(e.target.value)}
                    placeholder="Enter client secret token"
                    className="w-full px-4 py-2.5 pr-11 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTelematicsSecret(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showTelematicsSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon={Save}
                isLoading={saving}
                className="rounded-2xl px-6 font-bold shadow-md shadow-blue-500/20"
              >
                Save Credentials
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* ── TAB 3: Firebase Config (read-only) ── */}
      {activeTab === 'firebase' && (
        <div className="space-y-5">
          <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">
                  Firebase Project Configuration
                </h3>
              </div>
              <Badge variant="success" dot>Live</Badge>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
              <Shield className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 leading-relaxed">
                This is a read-only view of the active Firebase project. The API key is loaded at build time
                from server-side environment variables and is <strong>not editable from the UI</strong>.
                To rotate keys, update them in the Vercel environment settings and redeploy.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              <FirebaseRow label="Project ID"           value={firebaseConfig.projectId} />
              <FirebaseRow label="Auth Domain"          value={firebaseConfig.authDomain} />
              <FirebaseRow label="Storage Bucket"       value={firebaseConfig.storageBucket} />
              <FirebaseRow label="Messaging Sender ID"  value={firebaseConfig.messagingSenderId} />
              <FirebaseRow label="App ID"               value={firebaseConfig.appId} />
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs font-semibold text-slate-500 w-44 shrink-0">API Key</span>
                <code className="text-xs font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  {maskSecret(import.meta.env?.VITE_FIREBASE_API_KEY || '')}
                </code>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 text-center">
                Firebase API key is restricted by domain in the Google Cloud Console.
                Only <code className="font-mono">cambusconnect.in</code> and <code className="font-mono">localhost</code> are authorized origins.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
