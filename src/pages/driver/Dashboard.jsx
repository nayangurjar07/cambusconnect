// src/pages/driver/Dashboard.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio,
  Navigation,
  Users,
  QrCode,
  ShieldCheck,
  AlertCircle,
  Plus,
  Minus,
  CheckCircle2,
  Activity,
  Eye,
  Calendar,
  Bell
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  subscribeToBuses,
  updateBusLiveLocation,
  releaseBusLiveStream,
  incrementBusHeadcount
} from '../../services/transit';
import { getStaffRoleLabel } from '../../services/workforce';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export function DriverDashboard() {
  const { user, profile, currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isStandby, setIsStandby] = useState(false);
  const [standbyOwner, setStandbyOwner] = useState(null);
  const [simulationMode, setSimulationMode] = useState(false);

  // Live Hardware Telemetry State
  const [coords, setCoords] = useState({ lat: null, lng: null, speed: null, accuracy: null });
  const [gpsError, setGpsError] = useState('');
  const [activeWatchers, setActiveWatchers] = useState(0);
  const [syncMode, setSyncMode] = useState('OFFLINE'); // 'HIGH_FREQ_WATCHED' | 'ECO_IDLE' | 'OFFLINE'
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [recommendedIntervalMs, setRecommendedIntervalMs] = useState(25000);

  const watchIdRef = useRef(null);
  const broadcastTimerRef = useRef(null);
  const latestCoordsRef = useRef({ lat: null, lng: null, speed: 0, accuracy: 10 });
  const wakeLockRef = useRef(null);

  const displayName = profile?.name || currentUser?.displayName || user?.name || 'Driver Staff';
  const userEmail = (profile?.email || currentUser?.email || user?.email || '').toLowerCase().trim();

  // Load Fleet & Auto-Select Assigned Bus
  useEffect(() => {
    const unsub = subscribeToBuses((fleet) => {
      setBuses(fleet);
      if (!selectedBusId && fleet.length > 0) {
        const assigned = fleet.find(
          (b) =>
            String(b.number) === String(profile?.assignedBusNumber || user?.assignedBus) ||
            b.id === (profile?.assignedBusId || user?.assignedBusId) ||
            b.primaryDriver?.email === userEmail ||
            b.secondaryDriver?.email === userEmail ||
            b.primaryConductor?.email === userEmail ||
            b.secondaryConductor?.email === userEmail
        );
        if (assigned) {
          setSelectedBusId(assigned.id);
        } else {
          setSelectedBusId(fleet[0].id);
        }
      }
    });
    return () => unsub();
  }, [profile, user, userEmail, selectedBusId]);

  const currentBus = buses.find((b) => b.id === selectedBusId) || null;
  const roleLabel = getStaffRoleLabel(profile?.role || user?.role || 'driver', profile?.roleTier || user?.roleTier || 'primary');

  // Request Screen WakeLock while broadcasting
  const acquireWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (_) {}
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (_) {}
  };

  // Push coordinates to Backend Cache & Throttled Firestore
  const pushTelemetryTick = useCallback(
    async (forceSync = false) => {
      if (!selectedBusId) return;
      const { lat, lng, speed, accuracy } = latestCoordsRef.current;
      if (lat == null || lng == null) return;

      const result = await updateBusLiveLocation({
        busId: selectedBusId,
        busNumber: currentBus?.number || selectedBusId,
        lat,
        lng,
        speed,
        accuracy,
        user,
        streamSource: simulationMode ? 'simulation' : 'gps',
        forceFirestoreSync: forceSync,
        onStandby: (standbyInfo) => {
          setIsStandby(true);
          setStandbyOwner(standbyInfo.activeBroadcaster);
        }
      });

      if (result.isStandby) {
        setIsStandby(true);
        setStandbyOwner(result.activeBroadcaster);
        return;
      }

      if (result.success) {
        setIsStandby(false);
        setStandbyOwner(null);
        setActiveWatchers(result.activeWatchers || 0);
        setSyncMode(result.mode || 'ECO_IDLE');
        setLastSyncedAt(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
        if (result.recommendedIntervalMs && result.recommendedIntervalMs !== recommendedIntervalMs) {
          setRecommendedIntervalMs(result.recommendedIntervalMs);
        }
      }
    },
    [selectedBusId, currentBus?.number, user, simulationMode, recommendedIntervalMs]
  );

  // Start Live Hardware GPS or Test Simulation
  const startLiveTracking = async () => {
    if (!selectedBusId) {
      showError('Please select a bus first.');
      return;
    }
    setGpsError('');

    if (simulationMode) {
      const baseLat = currentBus?.location?.lat || 22.7196;
      const baseLng = currentBus?.location?.lng || 75.8577;
      latestCoordsRef.current = { lat: baseLat, lng: baseLng, speed: 32, accuracy: 5 };
      setCoords(latestCoordsRef.current);
      setIsBroadcasting(true);
      await acquireWakeLock();
      await pushTelemetryTick(true);
      showSuccess(`Simulation broadcast started for Bus #${currentBus?.number || selectedBusId}`);
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by this browser/device.');
      showError('Hardware GPS not supported on this device.');
      return;
    }

    await acquireWakeLock();

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const speedKmh = pos.coords.speed ? Math.max(0, Math.round(pos.coords.speed * 3.6)) : 0;
        const accuracy = Math.round(pos.coords.accuracy || 10);

        const isFirstFix = latestCoordsRef.current.lat === null;
        latestCoordsRef.current = { lat, lng, speed: speedKmh, accuracy };
        setCoords({ lat, lng, speed: speedKmh, accuracy });
        setGpsError('');

        if (isFirstFix) {
          await pushTelemetryTick(true);
        }
      },
      (err) => {
        const msg =
          err.code === 1
            ? 'Location permission denied. Please allow GPS access in browser settings.'
            : err.code === 2
            ? 'GPS signal unavailable. Move outdoors or enable Simulation Mode for desk testing.'
            : 'GPS request timed out. Retrying...';
        setGpsError(msg);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 8000,
        timeout: 20000
      }
    );

    setIsBroadcasting(true);
    showSuccess(`Live GPS broadcasting active for Bus #${currentBus?.number || selectedBusId}`);
  };

  // Stop Live Tracking
  const stopLiveTracking = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (broadcastTimerRef.current) {
      clearInterval(broadcastTimerRef.current);
      broadcastTimerRef.current = null;
    }
    await releaseWakeLock();
    setIsBroadcasting(false);
    setIsStandby(false);
    setSyncMode('OFFLINE');
    setCoords({ lat: null, lng: null, speed: null, accuracy: null });
    latestCoordsRef.current = { lat: null, lng: null, speed: 0, accuracy: null };
    if (selectedBusId) {
      await releaseBusLiveStream(selectedBusId, user?.email);
    }
    showSuccess('Live location broadcast stopped.');
  };

  // Dynamic Interval Loop
  useEffect(() => {
    if (!isBroadcasting) return;

    if (broadcastTimerRef.current) clearInterval(broadcastTimerRef.current);

    broadcastTimerRef.current = setInterval(() => {
      if (simulationMode && latestCoordsRef.current.lat != null) {
        latestCoordsRef.current = {
          ...latestCoordsRef.current,
          lat: Number((latestCoordsRef.current.lat + (Math.random() - 0.45) * 0.0004).toFixed(6)),
          lng: Number((latestCoordsRef.current.lng + (Math.random() - 0.45) * 0.0004).toFixed(6)),
          speed: Math.floor(24 + Math.random() * 14)
        };
        setCoords({ ...latestCoordsRef.current });
      }
      pushTelemetryTick(false);
    }, recommendedIntervalMs);

    return () => {
      if (broadcastTimerRef.current) clearInterval(broadcastTimerRef.current);
    };
  }, [isBroadcasting, recommendedIntervalMs, simulationMode, pushTelemetryTick]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (broadcastTimerRef.current) clearInterval(broadcastTimerRef.current);
      releaseWakeLock();
    };
  }, []);

  const handleHeadcountDelta = async (delta) => {
    if (!currentBus) return;
    try {
      await incrementBusHeadcount(currentBus.id, delta, currentBus.capacity || 45);
    } catch (_) {
      showError('Failed to update headcount');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-5 font-sans text-slate-900">
      {/* Page Header */}
      <PageHeader
        title="Onboard Telemetry Cockpit"
        subtitle={`Logged in as ${displayName} (${roleLabel})`}
        badge={
          <Badge variant="primary" dot>
            Active Crew
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bus:</label>
            <select
              value={selectedBusId}
              disabled={isBroadcasting}
              onChange={(e) => setSelectedBusId(e.target.value)}
              className="px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 disabled:opacity-50"
            >
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  Bus #{b.number} — {b.route || 'Unassigned Route'}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* Standby Priority Banner */}
      {isStandby && standbyOwner && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-amber-950 flex items-start gap-3 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs uppercase tracking-wider font-bold text-amber-800">
              Standby Mode · Stream Priority Lock
            </p>
            <p className="text-sm mt-0.5">
              <strong>{standbyOwner.name || standbyOwner.email}</strong> ({standbyOwner.roleTier || 'primary'}{' '}
              {standbyOwner.role}) is currently broadcasting GPS for Bus #{currentBus?.number}. Your transmitter will
              automatically take over if their connection drops.
            </p>
          </div>
        </div>
      )}

      {/* Hardware Error Banner */}
      {gpsError && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 text-rose-950 text-sm flex items-start gap-3 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-900">GPS Hardware Alert</p>
            <p className="mt-0.5 text-rose-700">{gpsError}</p>
          </div>
        </div>
      )}

      {/* Main Live GPS Transmitter Control */}
      <Card>
        <CardBody className="p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400 block">
                Live Location Transmitter
              </span>
              <div className="flex items-center gap-2.5 mt-1">
                <span
                  className={`h-3 w-3 rounded-full ${
                    isBroadcasting ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                  }`}
                />
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  {isBroadcasting
                    ? syncMode === 'HIGH_FREQ_WATCHED'
                      ? 'Broadcasting Live (High-Freq · Watched)'
                      : 'Broadcasting Live (Eco Standby · 0 Watchers)'
                    : 'Transmitter Offline'}
                </h2>
              </div>
            </div>

            {!isBroadcasting && !import.meta.env.PROD && (
              <label className="flex items-center gap-2 text-xs font-semibold bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl cursor-pointer select-none border border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={simulationMode}
                  onChange={(e) => setSimulationMode(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Simulate GPS (Desk Test)</span>
              </label>
            )}
          </div>

          {/* Telemetry Readout Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Coordinates
              </span>
              <span className="text-sm font-bold text-slate-900 tabular-nums mt-1 block">
                {coords.lat ? `${coords.lat}, ${coords.lng}` : '— / —'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Speed / Accuracy
              </span>
              <span className="text-sm font-bold text-slate-900 tabular-nums mt-1 block">
                {coords.speed || 0} km/h{' '}
                <span className="text-xs text-slate-500 font-normal">
                  ({coords.accuracy ? `±${coords.accuracy}m` : '—'})
                </span>
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Active Watchers
              </span>
              <span className="text-sm font-bold text-blue-600 tabular-nums mt-1 block">
                {activeWatchers} {activeWatchers === 1 ? 'viewer' : 'viewers'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Sync Cadence
              </span>
              <span className="text-sm font-bold text-slate-900 tabular-nums mt-1 block">
                {isBroadcasting ? `${Math.round(recommendedIntervalMs / 1000)}s` : 'Paused'}
                {lastSyncedAt && (
                  <span className="block text-[10px] text-slate-400 font-normal">Last: {lastSyncedAt}</span>
                )}
              </span>
            </div>
          </div>

          {/* Transmitter Control Action */}
          <div>
            {!isBroadcasting ? (
              <Button
                variant="success"
                size="lg"
                fullWidth
                icon={Radio}
                onClick={startLiveTracking}
              >
                <span>Start Live Location Broadcast — Bus #{currentBus?.number || '—'}</span>
              </Button>
            ) : (
              <Button
                variant="danger"
                size="lg"
                fullWidth
                onClick={stopLiveTracking}
              >
                <span>End Trip & Stop Broadcasting</span>
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Pass Scanner Launch */}
        <Card>
          <CardBody className="p-5 flex flex-col justify-between h-full">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Boarding Verification
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-1">
                Student Pass Scanner
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Continuous optical QR validation, cryptographic pass checks, and automatic headcount sync.
              </p>
            </div>
            <div className="mt-4">
              <Button
                variant="primary"
                fullWidth
                icon={QrCode}
                onClick={() => navigate('/driver/scan-pass')}
              >
                Open Pass Scanner →
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Manual Headcount Control */}
        <Card>
          <CardBody className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Onboard Occupancy
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Bus #{currentBus?.number || '—'} Headcount
                </h3>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-slate-900 tabular-nums">
                  {currentBus?.headcount || 0}
                </span>
                <span className="text-xs text-slate-400 tabular-nums"> / {currentBus?.capacity || 45}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button
                variant="secondary"
                icon={Minus}
                onClick={() => handleHeadcountDelta(-1)}
                disabled={(currentBus?.headcount || 0) <= 0}
              >
                Alighted (-1)
              </Button>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => handleHeadcountDelta(1)}
                disabled={(currentBus?.headcount || 0) >= (currentBus?.capacity || 45)}
              >
                Boarded (+1)
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Bottom Nav Helper Strip */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          icon={Calendar}
          onClick={() => navigate('/driver/schedule')}
        >
          View Route Schedule & Stops
        </Button>
        <Button
          variant="outline"
          icon={Bell}
          onClick={() => navigate('/driver/alerts')}
        >
          Dispatch Delay / Incident Alert
        </Button>
      </div>
    </div>
  );
}

export default DriverDashboard;