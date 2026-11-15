// src/pages/admin/Tracking.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Radio, AlertTriangle, CheckCircle2, Navigation, Eye, Bus, ArrowRight } from 'lucide-react';
import {
  subscribeToBuses,
  getBusesTrackingSummary,
  pollCachedBusLocation
} from '../../services/transit';
import FleetMap from '../../components/domain/FleetMap';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

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
      {/* Page Header */}
      <PageHeader
        title="Fleet Live Map & Signal Monitor"
        subtitle="Real-time GPS telemetry, low-latency RAM cache synchronization, and tracking availability detector"
        badge={
          <Badge variant="primary" dot>
            Dispatch Console
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="success" dot className="px-3 py-1 text-xs">
              {summary.liveCount} Broadcasting
            </Badge>
            <Badge variant={summary.unavailableCount > 0 ? 'danger' : 'neutral'} dot className="px-3 py-1 text-xs">
              {summary.unavailableCount} Offline / Unavailable
            </Badge>
          </div>
        }
      />

      {/* Admin Alert Banner when any bus live location is unavailable */}
      {summary.hasUnavailableBuses && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 bg-amber-200 text-amber-900 rounded-md mr-2">
                Signal Alert
              </span>
              <strong>
                {summary.unavailableCount} {summary.unavailableCount === 1 ? 'vehicle is' : 'vehicles are'} not sharing live location:
              </strong>{' '}
              <span className="font-semibold text-slate-800">
                {summary.unavailableBuses.map((b) => `Bus #${b.number}`).join(', ')}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setStatusFilter(statusFilter === 'UNAVAILABLE' ? 'ALL' : 'UNAVAILABLE')}
          >
            {statusFilter === 'UNAVAILABLE' ? 'Show All Buses' : 'Filter Unavailable'}
          </Button>
        </div>
      )}

      {/* Split-Pane Console: Map + Fleet Status Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left/Main Map Canvas */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col min-h-[500px] shadow-xs">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {selectedBus ? `Focused: Bus #${selectedBus.number}` : 'All Fleet Vehicles'}
              </span>
              {selectedBus?.trackingHealth && (
                <Badge variant={selectedBus.trackingHealth.isLive ? 'success' : 'danger'} dot>
                  {selectedBus.trackingHealth.label} · {selectedBus.trackingHealth.lastSeenText}
                </Badge>
              )}
            </div>
            {selectedBus && (
              <span className="text-xs font-medium text-slate-500">
                {selectedBus.trackingHealth?.broadcasterLabel}
              </span>
            )}
          </div>

          <div className="flex-1 relative min-h-[440px]">
            <FleetMap
              buses={mergedBuses}
              selectedBusId={selectedBus?.id}
              onSelectBus={(id) => setSelectedBusId(id)}
            />
          </div>
        </div>

        {/* Right Fleet Roster & Health Sidebar */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl flex flex-col max-h-[550px] shadow-xs overflow-hidden">
          <div className="p-3 border-b border-slate-200 flex items-center justify-between gap-1.5 bg-slate-50/70">
            {['ALL', 'LIVE', 'UNAVAILABLE'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-blue-600 text-white shadow-2xs'
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
                  className={`p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50/80 border-l-4 border-l-blue-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-sm ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                      Bus #{bus.number}
                    </span>
                    <Badge variant={health.isLive ? 'success' : 'danger'} dot className="text-[10px]">
                      {health.isLive ? 'LIVE' : 'UNAVAILABLE'}
                    </Badge>
                  </div>

                  <p className={`text-xs mt-1 truncate ${isSelected ? 'text-blue-700' : 'text-slate-500'}`}>
                    {bus.route || 'Unassigned Route'} · {bus.primaryDriver?.name || bus.driver || 'No Driver'}
                  </p>

                  <div className="flex items-center justify-between text-[11px] mt-2 text-slate-400 tabular-nums">
                    <span>Speed: {bus.speed || 0} km/h</span>
                    <span>{health.lastSeenText}</span>
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