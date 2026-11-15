// src/pages/admin/Tracking.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  subscribeToBuses,
  getBusesTrackingSummary,
  pollCachedBusLocation
} from '../../services/transit';
import FleetMap from '../../components/domain/FleetMap';

export function AdminTracking() {
  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [cachedOverlay, setCachedOverlay] = useState({});
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'LIVE' | 'UNAVAILABLE'

  useEffect(() => {
    const unsub = subscribeToBuses((list) => {
      setBuses(list);
      if (!selectedBusId && list.length > 0) {
        setSelectedBusId(list[0].id);
      }
    });
    return () => unsub();
  }, [selectedBusId]);

  // Poll Backend RAM Cache for the actively inspected bus (registers Admin as activeWatcher)
  useEffect(() => {
    if (!selectedBusId) return;
    let isMounted = true;

    const fetchFromCache = async () => {
      const data = await pollCachedBusLocation(selectedBusId, true);
      if (isMounted && data && data.lat != null && data.lng != null) {
        setCachedOverlay((prev) => ({
          ...prev,
          [selectedBusId]: data
        }));
      }
    };

    fetchFromCache();
    const timer = setInterval(fetchFromCache, 15000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [selectedBusId]);

  // Merge Firestore bus state with latest RAM-cached telemetry
  const mergedBuses = useMemo(() => {
    return buses.map((b) => {
      const cached = cachedOverlay[b.id] || cachedOverlay[b.number];
      if (cached && cached.timestamp && cached.timestamp > (b.lastUpdated || 0)) {
        return {
          ...b,
          location: { lat: cached.lat, lng: cached.lng },
          speed: cached.speed ?? b.speed,
          isTracking: cached.isTracking ?? b.isTracking,
          lastUpdated: cached.timestamp,
          activeWatchers: cached.activeWatchers ?? b.activeWatchers,
          activeBroadcaster: cached.activeBroadcaster || b.activeBroadcaster
        };
      }
      return b;
    });
  }, [buses, cachedOverlay]);

  const summary = useMemo(() => getBusesTrackingSummary(mergedBuses, 110), [mergedBuses]);

  const displayedBuses = useMemo(() => {
    const all = [...summary.liveBuses, ...summary.unavailableBuses];
    if (statusFilter === 'LIVE') return summary.liveBuses;
    if (statusFilter === 'UNAVAILABLE') return summary.unavailableBuses;
    return all;
  }, [summary, statusFilter]);

  const selectedBus = displayedBuses.find((b) => b.id === selectedBusId) || displayedBuses[0] || null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-5 space-y-4 font-sans text-slate-900">
      {/* Top Fleet Telemetry Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
            Real-Time Dispatch & Telemetry
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Fleet Live Map & Signal Monitor</h1>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
            ● {summary.liveCount} Live
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-semibold">
            ▲ {summary.unavailableCount} Location Unavailable
          </span>
        </div>
      </div>

      {/* Admin Alert Banner when any bus live location is unavailable */}
      {summary.hasUnavailableBuses && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
          <div className="text-xs sm:text-sm">
            <span className="font-bold uppercase tracking-wider text-[11px] px-2 py-0.5 bg-amber-200/80 rounded mr-2">
              Telemetry Alert
            </span>
            <strong>
              {summary.unavailableCount} {summary.unavailableCount === 1 ? 'bus is' : 'buses are'} not sharing live location:
            </strong>{' '}
            <span className="font-semibold">
              {summary.unavailableBuses.map((b) => `Bus #${b.number}`).join(', ')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'UNAVAILABLE' ? 'ALL' : 'UNAVAILABLE')}
            className="px-3 py-1.5 bg-amber-900 text-white text-xs font-semibold uppercase tracking-wider rounded-lg shrink-0 cursor-pointer"
          >
            {statusFilter === 'UNAVAILABLE' ? 'Show All Buses' : 'Filter Unavailable'}
          </button>
        </div>
      )}

      {/* Split-Pane Console: Map + Fleet Status Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left/Main Map Canvas */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[480px]">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {selectedBus ? `Focused: Bus #${selectedBus.number}` : 'All Fleet Vehicles'}
              </span>
              {selectedBus?.trackingHealth && (
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                    selectedBus.trackingHealth.isLive
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}
                >
                  {selectedBus.trackingHealth.label} · {selectedBus.trackingHealth.lastSeenText}
                </span>
              )}
            </div>
            {selectedBus && (
              <span className="text-xs font-medium text-slate-500">
                {selectedBus.trackingHealth?.broadcasterLabel}
              </span>
            )}
          </div>

          <div className="flex-1 relative min-h-[420px]">
            <FleetMap
              buses={mergedBuses}
              selectedBusId={selectedBus?.id}
              onSelectBus={(id) => setSelectedBusId(id)}
            />
          </div>
        </div>

        {/* Right Fleet Roster & Health Sidebar */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl flex flex-col max-h-[540px]">
          <div className="p-3 border-b border-slate-200 flex items-center justify-between gap-1 bg-slate-50">
            {['ALL', 'LIVE', 'UNAVAILABLE'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`flex-1 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-md cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {displayedBuses.map((bus) => {
              const health = bus.trackingHealth;
              const isSelected = bus.id === selectedBus?.id;

              return (
                <div
                  key={bus.id}
                  onClick={() => setSelectedBusId(bus.id)}
                  className={`p-3.5 cursor-pointer transition ${
                    isSelected ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">
                      Bus #{bus.number}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        health.isLive
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      }`}
                    >
                      {health.isLive ? 'LIVE' : 'UNAVAILABLE'}
                    </span>
                  </div>

                  <p
                    className={`text-xs mt-1 truncate ${
                      isSelected ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    Route: {bus.route || 'Unassigned'}
                  </p>

                  <div
                    className={`mt-2 pt-2 border-t flex items-center justify-between text-[11px] ${
                      isSelected
                        ? 'border-slate-800 text-slate-400'
                        : 'border-slate-100 text-slate-500'
                    }`}
                  >
                    <span>{health.broadcasterLabel}</span>
                    <span className="tabular-nums">{health.lastSeenText}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminTracking;
