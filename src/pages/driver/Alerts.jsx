// src/pages/driver/Alerts.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribeToBuses, updateBusStatus } from '../../services/transit';
import { db, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from '../../config/firebase';

const QUICK_INCIDENTS = [
  { id: 'delay_10', label: 'Traffic Delay (+10m)', status: 'Delayed', severity: 'amber' },
  { id: 'delay_20', label: 'Heavy Congestion (+20m)', status: 'Delayed', severity: 'amber' },
  { id: 'bus_full', label: 'Bus Full Capacity', status: 'Full', severity: 'slate' },
  { id: 'breakdown', label: 'Mechanical / Breakdown', status: 'Breakdown', severity: 'rose' }
];

export function DriverAlerts() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [buses, setBuses] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [customNote, setCustomNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsubBuses = subscribeToBuses(setBuses);
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(20));
    const unsubAlerts = onSnapshot(q, (snap) => {
      setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubBuses();
      unsubAlerts();
    };
  }, []);

  const userEmail = user?.email?.toLowerCase().trim();
  const assignedBus =
    buses.find(
      (b) =>
        String(b.number) === String(user?.assignedBus) ||
        b.primaryDriver?.email === userEmail ||
        b.secondaryDriver?.email === userEmail ||
        b.primaryConductor?.email === userEmail ||
        b.secondaryConductor?.email === userEmail
    ) || buses[0];

  const broadcastIncident = async (title, newBusStatus = null) => {
    if (!assignedBus) {
      showError('No assigned bus found.');
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
        type: 'incident',
        createdAt: serverTimestamp()
      });

      if (newBusStatus) {
        await updateBusStatus(assignedBus.id, newBusStatus);
      }
      showSuccess(`Dispatched alert: ${title}`);
      setCustomNote('');
    } catch (err) {
      showError('Could not broadcast alert.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-5 font-sans text-slate-900">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-mono uppercase text-slate-500">Dispatch & Advisories</span>
          <h1 className="text-xl font-bold tracking-tight mt-0.5">
            One-Tap Incident Broadcaster
          </h1>
        </div>
        <span className="font-mono text-xs bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
          Bus #{assignedBus?.number || '—'}
        </span>
      </div>

      {/* Quick One-Tap Dispatch Buttons */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-wider text-slate-500">
          Instant Status Dispatch (Notifies Admin & Students)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {QUICK_INCIDENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={sending}
              onClick={() => broadcastIncident(item.label, item.status)}
              className="p-3.5 text-left rounded-lg border border-slate-200 hover:border-slate-900 bg-slate-50 hover:bg-white transition flex items-center justify-between cursor-pointer disabled:opacity-50"
            >
              <span className="font-semibold text-sm">{item.label}</span>
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                Send →
              </span>
            </button>
          ))}
        </div>

        {/* Custom Dispatch Message */}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <input
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="Custom dispatch note (e.g., Waiting 5m at Gate 2)..."
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
          />
          <button
            type="button"
            disabled={!customNote.trim() || sending}
            onClick={() => broadcastIncident(customNote.trim())}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            Broadcast
          </button>
        </div>
      </div>

      {/* Recent Dispatch Feed */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-slate-500">
          Recent Fleet Dispatch Log
        </h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No recent dispatch alerts.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map((a) => (
              <div key={a.id} className="py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{a.title || 'Fleet Advisory'}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{a.message}</p>
                </div>
                {a.busNumber && (
                  <span className="text-[11px] font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                    Bus #{a.busNumber}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverAlerts;
