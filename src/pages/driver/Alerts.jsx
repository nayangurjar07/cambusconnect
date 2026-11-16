// src/pages/driver/Alerts.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Clock, Send, Bus, ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribeToBuses, updateBusStatus } from '../../services/transit';
import { db, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from '../../config/firebase';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { NotificationItem } from '../../components/domain/NotificationItem';

const QUICK_INCIDENTS = [
  { id: 'delay_10', label: 'Traffic Delay (+10m)', status: 'Delayed', severity: 'warning', icon: Clock },
  { id: 'delay_20', label: 'Heavy Congestion (+20m)', status: 'Delayed', severity: 'warning', icon: Clock },
  { id: 'bus_full', label: 'Bus Full Capacity', status: 'Full', severity: 'neutral', icon: Bus },
  { id: 'breakdown', label: 'Mechanical / Breakdown', status: 'Breakdown', severity: 'danger', icon: AlertTriangle }
];

export function DriverAlerts() {
  const { user, profile, currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [buses, setBuses] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [customNote, setCustomNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsubBuses = subscribeToBuses(setBuses);
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(25));
    const unsubAlerts = onSnapshot(q, (snap) => {
      setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubBuses();
      unsubAlerts();
    };
  }, []);

  const userEmail = (profile?.email || currentUser?.email || user?.email || '').toLowerCase().trim();
  const displayName = profile?.name || currentUser?.displayName || user?.name || 'Driver Staff';
  const assignedBus =
    buses.find(
      (b) =>
        String(b.number) === String(profile?.assignedBusNumber || user?.assignedBus) ||
        b.id === (profile?.assignedBusId || user?.assignedBusId) ||
        b.primaryDriver?.email === userEmail ||
        b.secondaryDriver?.email === userEmail ||
        b.primaryConductor?.email === userEmail ||
        b.secondaryConductor?.email === userEmail
    ) || buses[0];

  const broadcastIncident = async (title, newBusStatus = null) => {
    if (!assignedBus) {
      showError('No assigned bus found to dispatch alert.');
      return;
    }
    setSending(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        title: `Bus #${assignedBus.number}: ${title}`,
        message: `${user?.name || user?.email} reported "${title}" on Route ${assignedBus.route || 'Campus'}.`,
        busNumber: assignedBus.number,
        busId: assignedBus.id,
        senderEmail: user?.email || '',
        senderRole: user?.role || 'driver',
        type: newBusStatus === 'Delayed' ? 'delay' : newBusStatus === 'Breakdown' ? 'alert' : 'info',
        createdAt: serverTimestamp()
      });

      if (newBusStatus) {
        await updateBusStatus(assignedBus.id, newBusStatus);
      }
      showSuccess(`Dispatched advisory: ${title}`);
      setCustomNote('');
    } catch (err) {
      showError('Could not broadcast alert: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-5 font-sans text-slate-900">
      {/* Page Header */}
      <PageHeader
        title="Incident & Delay Broadcaster"
        subtitle="One-tap real-time route advisories for dispatchers, campus administrators, and waiting students"
        badge={
          <Badge variant="warning" dot>
            Live Dispatch
          </Badge>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate('/driver/dashboard')}
          >
            Cockpit
          </Button>
        }
      />

      {/* Vehicle Summary Card */}
      <Card>
        <CardBody className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                <Bus className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Bus #{assignedBus?.number || '—'}
                  </h2>
                  <Badge variant="primary">
                    {assignedBus?.route || 'Campus Route'}
                  </Badge>
                  <Badge variant={assignedBus?.status === 'Breakdown' ? 'danger' : assignedBus?.status === 'Delayed' ? 'warning' : 'success'}>
                    {assignedBus?.status || 'On Time'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Broadcaster: <strong className="text-slate-800">{user?.name || user?.email}</strong> ({user?.role || 'driver'})
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Instant One-Tap Buttons */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-blue-600" />
            <CardTitle>Instant One-Tap Dispatch</CardTitle>
          </div>
          <span className="text-xs text-slate-500">Notifies entire student route</span>
        </CardHeader>
        <CardBody className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUICK_INCIDENTS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={sending}
                  onClick={() => broadcastIncident(item.label, item.status)}
                  className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 bg-white transition-all flex items-center justify-between text-left cursor-pointer group shadow-2xs disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-700 flex items-center justify-center shrink-0 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition-colors">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-slate-500">Status update: {item.status}</p>
                    </div>
                  </div>
                  <Badge variant={item.severity === 'danger' ? 'danger' : item.severity === 'warning' ? 'warning' : 'neutral'}>
                    Send →
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* Custom Dispatch Note */}
          <div className="pt-3 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Custom Dispatch Note
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="e.g., Heavy traffic near Vijay Nagar circle; stopping at Gate 2 in 5 mins..."
                className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 placeholder:text-slate-400"
              />
              <Button
                variant="primary"
                size="sm"
                icon={Send}
                disabled={!customNote.trim() || sending}
                isLoading={sending}
                onClick={() => broadcastIncident(customNote.trim())}
              >
                Broadcast
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Fleet Advisory & Notification Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-500" />
            <CardTitle>Recent Fleet Dispatches & Advisories</CardTitle>
          </div>
          <Badge variant="neutral">
            {alerts.length} dispatches
          </Badge>
        </CardHeader>
        <CardBody className="p-4 sm:p-5">
          {alerts.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No recent dispatches logged.</p>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto">
              {alerts.map((a) => (
                <NotificationItem key={a.id} notification={a} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default DriverAlerts;