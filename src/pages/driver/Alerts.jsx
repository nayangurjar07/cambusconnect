// src/pages/driver/Alerts.jsx
import React, { useState, useEffect } from 'react';
import {
  Bell, AlertTriangle, Send, CheckCircle2, AlertCircle, Clock,
  Radio, Bus, ShieldAlert, Sparkles, Filter, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribeToBuses } from '../../services/transit';
import { createNotification, subscribeToNotifications } from '../../services/communications';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export function DriverAlerts() {
  const { profile } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();

  const [buses, setBuses] = useState([]);
  const [assignedBus, setAssignedBus] = useState(null);
  const [alertType, setAlertType] = useState('delay');
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [filterType, setFilterType] = useState('all');

  const isConductor = profile?.role === 'conductor';
  const roleTier = profile?.roleTier || 'primary';
  const roleLabel = isConductor
    ? (roleTier === 'secondary' ? 'Secondary Conductor' : 'Primary Conductor')
    : (roleTier === 'secondary' ? 'Secondary Driver' : 'Primary Driver');

  // 1. Subscribe to fleet buses to match assigned vehicle
  useEffect(() => {
    const unsub = subscribeToBuses((list) => {
      setBuses(list);
      const myEmail = profile?.email?.toLowerCase();
      const myBus = list.find(b =>
        (b.driverEmails && b.driverEmails.includes(myEmail)) ||
        (b.conductorEmails && b.conductorEmails.includes(myEmail)) ||
        (b.driver && b.driver.toLowerCase() === profile?.name?.toLowerCase()) ||
        (b.conductor && b.conductor.toLowerCase() === profile?.name?.toLowerCase()) ||
        (profile?.assignedBus && String(b.number) === String(profile.assignedBus))
      ) || list[0];

      setAssignedBus(myBus);
    });
    return () => unsub();
  }, [profile]);

  // 2. Subscribe to notifications feed
  useEffect(() => {
    const unsub = subscribeToNotifications((list) => {
      setNotifications(list);
    });
    return () => unsub();
  }, []);

  const handleBroadcastAlert = async (e) => {
    e.preventDefault();
    if (!alertMessage.trim()) {
      showWarning("Please enter an alert message before broadcasting.");
      return;
    }

    if (!assignedBus) {
      showError("No vehicle is assigned to your account. Cannot determine target route.");
      return;
    }

    setBroadcasting(true);
    try {
      const typeLabels = {
        delay: 'Traffic Delay Notice',
        merge: 'Route Merge / Consolidation',
        breakdown: 'Vehicle Breakdown Alert',
        emergency: 'Emergency Transit Update',
        general: 'Campus Transit Notice'
      };

      const title = alertTitle.trim() || `${typeLabels[alertType] || 'Transit Notice'} — Bus #${assignedBus.number}`;

      await createNotification({
        title,
        message: alertMessage.trim(),
        type: alertType === 'emergency' ? 'urgent' : (alertType === 'delay' ? 'warning' : 'info'),
        targetRouteId: assignedBus.route || assignedBus.routeId || 'all',
        busNumber: assignedBus.number,
        author: profile?.name || roleLabel,
        authorRole: roleLabel
      });

      showSuccess(`Broadcast successfully dispatched to students on ${assignedBus.route || `Bus #${assignedBus.number}`}`);
      setAlertTitle('');
      setAlertMessage('');
    } catch (err) {
      console.error("Broadcast alert error:", err);
      showError("Failed to broadcast alert: " + err.message);
    } finally {
      setBroadcasting(false);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filterType === 'all') return true;
    return n.type === filterType;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 font-sans">
      <PageHeader
        title="Route Alerts & Dispatch"
        subtitle={`Broadcast emergency, delay, or merge alerts to passengers for ${assignedBus ? `Bus #${assignedBus.number}` : 'your route'}`}
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
              Dispatch Channel Live
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Broadcast Form */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="bg-white border border-slate-200/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600" />
                <CardTitle className="text-sm font-bold text-slate-900">Broadcast Route Notice</CardTitle>
              </div>
              <Badge variant="neutral" className="text-[10px]">
                {assignedBus ? `Target: Bus #${assignedBus.number}` : 'Route Fleet'}
              </Badge>
            </CardHeader>
            <CardBody className="p-5">
              <form onSubmit={handleBroadcastAlert} className="space-y-4">
                {/* Alert Type */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Notice Category
                  </label>
                  <select
                    value={alertType}
                    onChange={(e) => setAlertType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                  >
                    <option value="delay">⏱️ Route Delay / Traffic Jam</option>
                    <option value="merge">🔀 Route Consolidation / Merge</option>
                    <option value="breakdown">⚠️ Mechanical Issue / Breakdown</option>
                    <option value="emergency">🚨 Emergency Transit Alert</option>
                    <option value="general">📢 General Passenger Announcement</option>
                  </select>
                </div>

                {/* Optional Custom Title */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Subject / Headline (Optional)
                  </label>
                  <input
                    type="text"
                    value={alertTitle}
                    onChange={(e) => setAlertTitle(e.target.value)}
                    placeholder={`e.g. 15 Min Delay on ${assignedBus?.route || 'Route'}`}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                  />
                </div>

                {/* Alert Message */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Broadcast Message Details
                  </label>
                  <textarea
                    rows={4}
                    value={alertMessage}
                    onChange={(e) => setAlertMessage(e.target.value)}
                    placeholder="Enter announcement details for students waiting at upcoming stops..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors resize-none leading-relaxed"
                  />
                </div>

                {/* Route Target Info */}
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Bus className="w-3.5 h-3.5 text-blue-600" />
                    <span>Target Audience:</span>
                  </div>
                  <p className="text-[11px] text-blue-700">
                    This notification will instantly ping all students registered on{' '}
                    <strong>{assignedBus?.route || 'your assigned route'}</strong> via the Student Portal.
                  </p>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={broadcasting || !alertMessage.trim()}
                  className="w-full py-2.5 rounded-xl font-bold text-xs gap-2 shadow-xs cursor-pointer"
                  variant="primary"
                >
                  {broadcasting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Broadcasting to Route...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Dispatch Broadcast Alert</span>
                    </>
                  )}
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* Right Column (7 cols): Feed of Dispatched & Campus Alerts */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="bg-white border border-slate-200/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-600" />
                <CardTitle className="text-sm font-bold text-slate-900">Recent Dispatches & Transit Bulletins</CardTitle>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('warning')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${filterType === 'warning' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500'}`}
                >
                  Delays
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('urgent')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${filterType === 'urgent' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500'}`}
                >
                  Urgent
                </button>
              </div>
            </CardHeader>
            <CardBody className="p-4">
              {filteredNotifications.length > 0 ? (
                <div className="divide-y divide-slate-100 space-y-3">
                  {filteredNotifications.map((notif) => (
                    <div key={notif.id} className="pt-3 first:pt-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            notif.type === 'urgent'
                              ? 'bg-rose-50 text-rose-600 border border-rose-100'
                              : (notif.type === 'warning' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100')
                          }`}>
                            {notif.type === 'urgent' ? (
                              <ShieldAlert className="w-4 h-4" />
                            ) : (notif.type === 'warning' ? (
                              <AlertTriangle className="w-4 h-4" />
                            ) : (
                              <Bell className="w-4 h-4" />
                            ))}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-900">{notif.title}</h4>
                              {notif.busNumber && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                  Bus {notif.busNumber}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                              {notif.message}
                            </p>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-2">
                              <span>By: <strong>{notif.author || 'Crew Dispatch'}</strong></span>
                              <span>•</span>
                              <span>{notif.targetRouteId ? `Route: ${notif.targetRouteId}` : 'All Routes'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                  <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="font-semibold text-slate-600">No recent alerts recorded</p>
                  <p className="text-slate-400">Route alerts dispatched by you or transit administration will appear here.</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
