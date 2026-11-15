// src/pages/student/Track.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Bus, MapPin, Radio, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  subscribeToBuses,
  getBusTrackingHealth,
  pollCachedBusLocation
} from '../../services/transit';
import FleetMap from '../../components/domain/FleetMap';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

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
      {/* Page Header */}
      <PageHeader
        title="Track Your Campus Bus"
        subtitle="Real-time vehicle GPS coordinates, estimated transit timeline, and route updates"
        badge={
          <Badge variant="primary" dot>
            Student Transit
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bus:</label>
            <select
              value={selectedBusId}
              onChange={(e) => {
                setCachedTelemetry(null);
                setSelectedBusId(e.target.value);
              }}
              className="px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
            >
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  Bus #{b.number} — {b.route || 'Campus Route'}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* Unavailable / Offline Notice for Student */}
      {!health.isLive && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-amber-950 flex items-start gap-3 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs uppercase font-bold tracking-wider text-amber-800">
              Live Location Not Active Yet
            </p>
            <p className="text-xs sm:text-sm mt-0.5 text-slate-700">
              Bus #{currentBus?.number || '—'} is not currently broadcasting live GPS coordinates ({health.lastSeenText}). As soon as the driver or conductor starts the trip, the map will update automatically.
            </p>
          </div>
        </div>
      )}

      {/* Live Map Card */}
      <Card>
        <CardHeader className="bg-slate-50/70 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                health.isLive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <CardTitle>
              Bus #{currentBus?.number || '—'} · {health.label}
            </CardTitle>
            <Badge variant={health.isLive ? 'success' : 'neutral'}>
              {currentBus?.route || 'Campus Route'}
            </Badge>
          </div>
          <div className="text-slate-500 font-medium text-xs tabular-nums">
            Speed: {currentBus?.speed || 0} km/h · Updated: {health.lastSeenText}
          </div>
        </CardHeader>

        <div className="h-[440px] relative">
          <FleetMap
            buses={currentBus ? [currentBus] : []}
            selectedBusId={currentBus?.id}
          />
        </div>
      </Card>
    </div>
  );
}

export default StudentTrack;