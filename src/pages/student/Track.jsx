// src/pages/student/Track.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bus, 
  MapPin, 
  Phone, 
  Users, 
  Clock, 
  AlertTriangle, 
  Radio, 
  Search, 
  CheckCircle2, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToBuses, getBusTrackingHealth } from '../../services/transit';
import { PageHeader } from '../../components/layout/PageHeader';
import { FleetMap } from '../../components/domain/FleetMap';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export function StudentTrack() {
  const { profile } = useAuth();
  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // 1. Subscribe to fleet buses in real-time
  useEffect(() => {
    const unsub = subscribeToBuses((list) => {
      setBuses(list);
      // Auto-select student's assigned bus on first load
      if (list.length > 0 && !selectedBusId) {
        const myBus = list.find(b => 
          (profile?.assignedBusId && b.id === profile.assignedBusId) || 
          (profile?.assignedBusNumber && String(b.number) === String(profile.assignedBusNumber)) ||
          (profile?.busRoute && b.route && b.route.toLowerCase() === profile.busRoute.toLowerCase())
        ) || list[0];
        setSelectedBusId(myBus.id);
      }
    });
    return () => unsub();
  }, [profile, selectedBusId]);

  // Maintain active selected bus object with live coordinates
  const selectedBus = useMemo(() => {
    return buses.find(b => b.id === selectedBusId) || buses[0] || null;
  }, [buses, selectedBusId]);

  const assignedBus = useMemo(() => {
    return buses.find(b => 
      (profile?.assignedBusId && b.id === profile.assignedBusId) || 
      (profile?.assignedBusNumber && String(b.number) === String(profile.assignedBusNumber))
    ) || null;
  }, [buses, profile]);

  const trackingHealth = useMemo(() => {
    return getBusTrackingHealth(selectedBus, 60);
  }, [selectedBus]);

  // Search filter for vehicles list
  const filteredBuses = useMemo(() => {
    if (!searchFilter.trim()) return buses;
    const term = searchFilter.toLowerCase();
    return buses.filter(b => 
      String(b.number || '').toLowerCase().includes(term) ||
      String(b.route || '').toLowerCase().includes(term) ||
      String(b.driver || '').toLowerCase().includes(term)
    );
  }, [buses, searchFilter]);

  const capacity = Number(selectedBus?.capacity) || 45;
  const currentCount = Number(selectedBus?.headcount) || 0;
  const occupancyPercent = Math.min(100, Math.round((currentCount / capacity) * 100));

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      <PageHeader 
        title="Live Bus Tracking" 
        subtitle="Real-time vehicle GPS telemetry, route location, and transit arrival estimates" 
      />

      {/* ─── Vehicle Switcher & Quick Navigation ────────────────────────── */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Bus className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
              Select Fleet Bus to Track
            </label>
            <select
              value={selectedBusId}
              onChange={(e) => setSelectedBusId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-600 transition-all cursor-pointer truncate"
            >
              {buses.map(b => {
                const isMyAssigned = assignedBus && assignedBus.id === b.id;
                const health = getBusTrackingHealth(b, 60);
                return (
                  <option key={b.id} value={b.id}>
                    Bus {b.number} {b.route ? `— ${b.route}` : ''} {isMyAssigned ? '★ (My Bus)' : ''} [{health.label}]
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Quick shortcut to assigned bus */}
        {assignedBus && assignedBus.id !== selectedBusId && (
          <button
            type="button"
            onClick={() => setSelectedBusId(assignedBus.id)}
            className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Switch to My Assigned Bus ({assignedBus.number})</span>
          </button>
        )}
      </div>

      {/* ─── Tracking Availability Banner: Live Stream vs Unavailable Fallback ─── */}
      {selectedBus && (
        trackingHealth.isLive ? (
          <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs uppercase tracking-wide text-emerald-950">
                    Live GPS Stream Active — Bus {selectedBus.number}
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                    Synchronized
                  </span>
                </div>
                <p className="text-xs text-emerald-800/90 mt-0.5">
                  Broadcaster: <strong className="font-semibold">{trackingHealth.broadcasterLabel}</strong> • Speed: <strong className="font-semibold">{selectedBus.speed || 0} km/h</strong> • Updated {trackingHealth.lastSeenText}
                </p>
              </div>
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5 self-end sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Real-Time Telematics</span>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 shadow-xs flex items-start gap-3 animate-fadeIn">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200 mt-0.5">
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-xs uppercase tracking-wider text-amber-950">
                  Live tracking for Bus {selectedBus.number} has not started yet
                </h4>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
                  {trackingHealth.status === 'STALE' ? 'Heartbeat Stale' : 'Awaiting Driver Broadcast'}
                </span>
              </div>
              <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                The driver or conductor has not initiated their live GPS broadcast for this vehicle run yet.
                {trackingHealth.lastSeenText !== 'Never started' 
                  ? ` Last recorded stream activity was ${trackingHealth.lastSeenText}.` 
                  : ' Real-time map coordinates will update automatically as soon as the crew begins their route shift.'}
              </p>
            </div>
          </div>
        )
      )}

      {/* ─── Main Cockpit: Radar Map (Left) & Live Diagnostics (Right) ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Interactive Map View */}
        <div className="lg:col-span-8">
          <FleetMap 
            buses={buses} 
            selectedBus={selectedBus} 
            onSelectBus={(b) => setSelectedBusId(b.id)} 
            singleBusMode={true}
            className="h-[440px] sm:h-[520px] rounded-3xl" 
          />
        </div>

        {/* Selected Bus Diagnostics & Fleet Roster */}
        <div className="lg:col-span-4 space-y-4">
          {/* Selected Vehicle Diagnostics Card */}
          {selectedBus ? (
            <Card className="p-4 sm:p-5 rounded-3xl space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900">
                      Bus {selectedBus.number}
                    </h3>
                    {assignedBus?.id === selectedBus.id && (
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200">
                        My Bus
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedBus.route || 'Campus Route'}</span>
                  </p>
                </div>

                <Badge 
                  variant={trackingHealth.isLive ? 'success' : (trackingHealth.status === 'STALE' ? 'warning' : 'neutral')}
                  className="font-bold text-[10px] uppercase tracking-wider"
                >
                  {trackingHealth.label}
                </Badge>
              </div>

              {/* Occupancy Progress */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Passenger Occupancy</span>
                  <span className="font-bold text-slate-800">
                    {currentCount} / {capacity} seats ({occupancyPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      occupancyPercent >= 90 ? 'bg-rose-500' : (occupancyPercent >= 70 ? 'bg-amber-500' : 'bg-blue-600')
                    }`}
                    style={{ width: `${occupancyPercent}%` }}
                  />
                </div>
              </div>

              {/* Telemetry Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Speed</span>
                  <span className="text-sm font-extrabold text-slate-800 mt-0.5 block">
                    {trackingHealth.isLive ? `${selectedBus.speed || 0} km/h` : '0 km/h'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">ETA Campus</span>
                  <span className="text-sm font-extrabold text-blue-600 mt-0.5 block">
                    {selectedBus.eta || '12 min'}
                  </span>
                </div>
              </div>

              {/* Crew Details & Direct Contacts */}
              <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Driver:</span>
                  <span className="font-bold text-slate-800">{selectedBus.driver || 'Unassigned'}</span>
                </div>

                {selectedBus.phone && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                    <span className="text-slate-500 font-medium">Call Driver:</span>
                    <a 
                      href={`tel:${selectedBus.phone}`} 
                      className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 hover:underline"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{selectedBus.phone}</span>
                    </a>
                  </div>
                )}

                {selectedBus.conductor && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                    <span className="text-slate-500 font-medium">Conductor:</span>
                    <span className="font-bold text-slate-800">{selectedBus.conductor}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                  <span className="text-slate-500 font-medium">Active Stream:</span>
                  <span className="font-semibold text-slate-700">{trackingHealth.broadcasterLabel}</span>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center text-xs text-slate-400">
              Select a bus to inspect vehicle diagnostics.
            </Card>
          )}

          {/* Quick Fleet Browser */}
          <Card className="p-4 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                All Fleet Buses ({buses.length})
              </h4>
              <span className="text-[11px] font-semibold text-emerald-600">
                {buses.filter(b => getBusTrackingHealth(b, 60).isLive).length} Live
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search bus number or route..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-blue-600 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Scrollable list */}
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {filteredBuses.map(b => {
                const health = getBusTrackingHealth(b, 60);
                const isSelected = selectedBusId === b.id;

                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBusId(b.id)}
                    className={`w-full p-2.5 rounded-2xl border text-xs text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-blue-50/80 border-blue-300 text-blue-950 font-bold shadow-xs' 
                        : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold">Bus {b.number}</span>
                        {assignedBus?.id === b.id && (
                          <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">
                            My Bus
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{b.route || 'Campus Route'}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`w-2 h-2 rounded-full ${health.isLive ? 'bg-emerald-500 animate-pulse' : (health.status === 'STALE' ? 'bg-amber-500' : 'bg-slate-300')}`} />
                      <span className={`text-[10px] font-bold ${health.isLive ? 'text-emerald-700' : (health.status === 'STALE' ? 'text-amber-700' : 'text-slate-400')}`}>
                        {health.label}
                      </span>
                    </div>
                  </button>
                );
              })}

              {filteredBuses.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400">
                  No matching vehicles found.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
