// src/pages/student/Track.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  subscribeToBuses,
  getBusTrackingHealth,
  pollCachedBusLocation
} from '../../services/transit';
import FleetMap from '../../components/domain/FleetMap';

export function StudentTrack() {
  const { user } = useAuth();
  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [cachedTelemetry, setCachedTelemetry] = useState(null);

  useEffect(() => {
    const unsub = subscribeToBuses((list) => {
      setBuses(list);
      if (!selectedBusId && list.length > 0) {
        const studentBus = list.find(
          (b) =>
            String(b.number) === String(user?.busNumber || user?.assignedBus) ||
            b.id === user?.busId
        );
        setSelectedBusId(studentBus ? studentBus.id : list[0].id);
      }
    });
    return () => unsub();
  }, [user, selectedBusId]);

  // Register Student as Active Watcher in Backend Cache & Pull Fresh Coordinates
  useEffect(() => {
    if (!selectedBusId) return;
    let active = true;

    const pollCache = async () => {
      const cached = await pollCachedBusLocation(selectedBusId, true);
      if (active && cached && cached.lat != null && cached.lng != null) {
        setCachedTelemetry(cached);
      }
    };

    pollCache();
    const interval = setInterval(pollCache, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedBusId]);

  const currentBus = useMemo(() => {
    const base = buses.find((b) => b.id === selectedBusId) || null;
    if (!base) return null;
    if (
      cachedTelemetry &&
      cachedTelemetry.busId === selectedBusId &&
      cachedTelemetry.timestamp > (base.lastUpdated || 0)
    ) {
      return {
        ...base,
        location: { lat: cachedTelemetry.lat, lng: cachedTelemetry.lng },
        speed: cachedTelemetry.speed ?? base.speed,
        isTracking: cachedTelemetry.isTracking ?? base.isTracking,
        lastUpdated: cachedTelemetry.timestamp,
        activeWatchers: cachedTelemetry.activeWatchers ?? base.activeWatchers,
        activeBroadcaster: cachedTelemetry.activeBroadcaster || base.activeBroadcaster
      };
    }
    return base;
  }, [buses, selectedBusId, cachedTelemetry]);

  const health = useMemo(() => getBusTrackingHealth(currentBus, 110), [currentBus]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-4 font-sans text-slate-900">
      {/* Header & Bus Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-mono uppercase text-slate-500">
            Student Live Transit Tracker
          </span>
          <h1 className="text-xl font-bold tracking-tight mt-0.5">
            Track Your Campus Bus
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-mono uppercase text-slate-500">Select Bus:</label>
          <select
            value={selectedBusId}
            onChange={(e) => {
              setCachedTelemetry(null);
              setSelectedBusId(e.target.value);
            }}
            className="px-3 py-2 bg-slate-900 text-white font-mono text-sm rounded-lg border border-slate-800"
          >
            {buses.map((b) => (
              <option key={b.id} value={b.id}>
                Bus #{b.number} — {b.route || 'Campus Route'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Unavailable / Offline Notice for Student */}
      {!health.isLive && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-amber-950 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase font-bold text-amber-800">
              Live Location Not Active Yet
            </p>
            <p className="text-sm mt-0.5">
              Bus #{currentBus?.number || '—'} is not currently broadcasting live GPS coordinates ({health.lastSeenText}). As soon as the driver or conductor starts the trip, the map will update automatically.
            </p>
          </div>
        </div>
      )}

      {/* Live Map Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                health.isLive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="font-bold">
              Bus #{currentBus?.number || '—'} · {health.label}
            </span>
          </div>
          <div className="text-slate-600 tabular-nums">
            Speed: {currentBus?.speed || 0} km/h · Updated: {health.lastSeenText}
          </div>
        </div>

        <div className="h-[420px] relative">
          <FleetMap
            buses={currentBus ? [currentBus] : []}
            selectedBusId={currentBus?.id}
          />
        </div>
      </div>
    </div>
  );
}

export default StudentTrack;
