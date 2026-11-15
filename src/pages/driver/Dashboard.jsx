// src/pages/driver/Dashboard.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  subscribeToBuses,
  updateBusLiveLocation,
  releaseBusLiveStream,
  incrementBusHeadcount
} from '../../services/transit';
import { getStaffRoleLabel } from '../../services/workforce';

export function DriverDashboard() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isStandby, setIsStandby] = useState(false);
  const [standbyOwner, setStandbyOwner] = useState(null);
  const [simulationMode, setSimulationMode] = useState(false);

  // Live Hardware Telemetry State
  const [coords, setCoords] = useState({ lat: null, lng: null, speed: 0, accuracy: null });
  const [gpsError, setGpsError] = useState('');
  const [activeWatchers, setActiveWatchers] = useState(0);
  const [syncMode, setSyncMode] = useState('OFFLINE'); // 'HIGH_FREQ_WATCHED' | 'ECO_IDLE' | 'OFFLINE'
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [recommendedIntervalMs, setRecommendedIntervalMs] = useState(25000);

  const watchIdRef = useRef(null);
  const broadcastTimerRef = useRef(null);
  const latestCoordsRef = useRef({ lat: null, lng: null, speed: 0, accuracy: 10 });
  const wakeLockRef = useRef(null);

  // Load Fleet & Auto-Select Assigned Bus
  useEffect(() => {
    const unsub = subscribeToBuses((fleet) => {
      setBuses(fleet);
      if (!selectedBusId && fleet.length > 0) {
        const userEmail = user?.email?.toLowerCase().trim();
        const assigned = fleet.find(
          (b) =>
            String(b.number) === String(user?.assignedBus) ||
            b.id === user?.assignedBusId ||
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
  }, [user, selectedBusId]);

  const currentBus = buses.find((b) => b.id === selectedBusId) || null;
  const roleLabel = getStaffRoleLabel(user?.role || 'driver', user?.roleTier || 'primary');

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
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
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
      // Simulation mode for indoor desk testing
      const baseLat = currentBus?.location?.lat || 22.7196;
      const baseLng = currentBus?.location?.lng || 75.8577;
      latestCoordsRef.current = { lat: baseLat, lng: baseLng, speed: 32, accuracy: 5 };
      setCoords(latestCoordsRef.current);
      setIsBroadcasting(true);
      await acquireWakeLock();
      await pushTelemetryTick(true);
      showSuccess(`Simulation broadcast started for Bus ${currentBus?.number || selectedBusId}`);
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
            ? 'GPS signal unavailable. Move outdoors or enable Simulation Mode for testing.'
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
    showSuccess(`Live GPS broadcasting active for Bus ${currentBus?.number || selectedBusId}`);
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
    latestCoordsRef.current = { lat: null, lng: null, speed: 0, accuracy: null };
    if (selectedBusId) {
      await releaseBusLiveStream(selectedBusId, user?.email);
    }
    showSuccess('Live location broadcast stopped.');
  };

  // Dynamic Interval Loop (Adjusts between 15s when watched and 60s when idle)
  useEffect(() => {
    if (!isBroadcasting) return;

    if (broadcastTimerRef.current) clearInterval(broadcastTimerRef.current);

    broadcastTimerRef.current = setInterval(() => {
      if (simulationMode && latestCoordsRef.current.lat != null) {
        // Slightly jitter coordinates in simulation mode to verify live map movement
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

  // Cleanup on unmount
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
    } catch (err) {
      showError('Failed to update headcount');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-5 font-sans text-slate-900">
      {/* Top Crew & Vehicle Bar */}
      <div className="bg-slate-950 text-white rounded-xl p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
              {roleLabel}
            </span>
            <span className="text-xs text-slate-400 font-medium">{user?.email}</span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight mt-1">
            Onboard Telemetry Cockpit
          </h1>
        </div>

        {/* Dynamic Bus Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Bus:</label>
          <select
            value={selectedBusId}
            disabled={isBroadcasting}
            onChange={(e) => setSelectedBusId(e.target.value)}
            className="bg-slate-900 text-white font-medium text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-amber-400 disabled:opacity-50"
          >
            {buses.map((b) => (
              <option key={b.id} value={b.id}>
                Bus #{b.number} — {b.route || 'Unassigned Route'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Single Active Stream Guard Standby Banner */}
      {isStandby && standbyOwner && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-amber-900 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider font-bold text-amber-700">
              Standby Mode · Stream Priority Lock
            </p>
            <p className="text-sm mt-1">
              <strong>{standbyOwner.name || standbyOwner.email}</strong> ({standbyOwner.roleTier || 'primary'}{' '}
              {standbyOwner.role}) is currently broadcasting GPS for Bus #{currentBus?.number}. Your portal will
              automatically take over if their stream drops.
            </p>
          </div>
        </div>
      )}

      {/* GPS Hardware Error Banner */}
      {gpsError && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 text-rose-900 text-sm">
          <p className="font-semibold">GPS Hardware Alert</p>
          <p className="mt-0.5 text-rose-700">{gpsError}</p>
        </div>
      )}

      {/* Main Live GPS Transmitter Control */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Live Location Transmitter
            </span>
            <div className="flex items-center gap-2.5 mt-1">
              <span
                className={`h-3 w-3 rounded-full ${
                  isBroadcasting
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-slate-300'
                }`}
              />
              <h2 className="text-xl font-bold tracking-tight">
                {isBroadcasting
                  ? syncMode === 'HIGH_FREQ_WATCHED'
                    ? 'Broadcasting Live (High-Freq · Watched)'
                    : 'Broadcasting Live (Eco Standby · 0 Watchers)'
                  : 'Transmitter Offline'}
              </h2>
            </div>
          </div>

          {/* Indoor Desk Testing Toggle */}
          {!isBroadcasting && (
            <label className="flex items-center gap-2 text-xs font-medium bg-slate-100 px-3 py-1.5 rounded-lg cursor-pointer select-none border border-slate-200">
              <input
                type="checkbox"
                checked={simulationMode}
                onChange={(e) => setSimulationMode(e.target.checked)}
                className="rounded border-slate-300"
              />
              Simulate GPS (Desk Test)
            </label>
          )}
        </div>

        {/* Telemetry Readout Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">Coordinates</span>
            <span className="text-sm font-semibold tabular-nums mt-1 block">
              {coords.lat ? `${coords.lat}, ${coords.lng}` : '— / —'}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">Speed / Accuracy</span>
            <span className="text-sm font-semibold tabular-nums mt-1 block">
              {coords.speed || 0} km/h{' '}
              <span className="text-xs text-slate-500 font-normal">
                ({coords.accuracy ? `±${coords.accuracy}m` : '—'})
              </span>
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">Active Watchers</span>
            <span className="text-sm font-semibold tabular-nums mt-1 block">
              {activeWatchers} {activeWatchers === 1 ? 'viewer' : 'viewers'}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">Sync Cadence</span>
            <span className="text-sm font-semibold tabular-nums mt-1 block">
              {isBroadcasting ? `${Math.round(recommendedIntervalMs / 1000)}s` : 'Paused'}
              {lastSyncedAt && (
                <span className="block text-[10px] text-slate-400 font-normal">Last: {lastSyncedAt}</span>
              )}
            </span>
          </div>
        </div>

        {/* Start / Stop Hero Button */}
        <div className="pt-1">
          {!isBroadcasting ? (
            <button
              type="button"
              onClick={startLiveTracking}
              className="w-full py-4 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-base tracking-tight transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Start Live Location Broadcast</span>
              <span className="text-xs font-semibold bg-emerald-800/60 px-2 py-0.5 rounded">
                Bus #{currentBus?.number || '—'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopLiveTracking}
              className="w-full py-4 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-base tracking-tight transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>End Trip & Stop Broadcasting</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Operations Row: Pass Scanner & Live Occupancy Counter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Pass Scanner Quick Launch */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Boarding Verification</span>
            <h3 className="text-base font-semibold mt-0.5">QR / Digital Pass Scanner</h3>
            <p className="text-xs text-slate-500 mt-1">
              Verify student bus passes and automatically increment live occupancy.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/driver/scan-pass')}
            className="mt-4 w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition cursor-pointer"
          >
            Open Pass Scanner →
          </button>
        </div>

        {/* Manual Occupancy Counter */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Onboard Headcount</span>
              <h3 className="text-base font-semibold mt-0.5">
                Bus #{currentBus?.number || '—'} Occupancy
              </h3>
            </div>
            <div className="text-right tabular-nums">
              <span className="text-2xl font-bold">{currentBus?.headcount || 0}</span>
              <span className="text-sm text-slate-400"> / {currentBus?.capacity || 45}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              type="button"
              onClick={() => handleHeadcountDelta(-1)}
              className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono font-semibold rounded-lg text-sm cursor-pointer"
            >
              −1 Alighted
            </button>
            <button
              type="button"
              onClick={() => handleHeadcountDelta(1)}
              className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-mono font-semibold rounded-lg text-sm cursor-pointer"
            >
              +1 Boarded
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DriverDashboard;
