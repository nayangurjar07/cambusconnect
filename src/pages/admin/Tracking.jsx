// src/pages/admin/Tracking.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bus, 
  MapPin, 
  Radio, 
  Users, 
  Phone, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  ShieldAlert, 
  Activity,
  ArrowRight
} from 'lucide-react';
import { 
  subscribeToBuses, 
  updateBusStatus, 
  getBusTrackingHealth, 
  getBusesTrackingSummary 
} from '../../services/transit';
import { FleetMap } from '../../components/domain/FleetMap';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatusIndicator } from '../../components/ui/StatusIndicator';
import { PageHeader } from '../../components/layout/PageHeader';
import { useToast } from '../../contexts/ToastContext';

export function AdminTracking() {
  const { showSuccess, showError } = useToast();
  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'live' | 'unavailable'
  const [searchFilter, setSearchFilter] = useState('');
  const [heartbeatTicker, setHeartbeatTicker] = useState(0);

  // 1. Subscribe to fleet buses in real-time
  useEffect(() => {
    const unsub = subscribeToBuses((list) => {
      setBuses(list);
      if (list.length > 0 && !selectedBusId) {
        setSelectedBusId(list[0].id);
      }
    });
    return () => unsub();
  }, [selectedBusId]);

  // Periodic ticker every 10 seconds to refresh relative time labels (e.g. "12s ago" -> "22s ago")
  useEffect(() => {
    const timer = setInterval(() => {
      setHeartbeatTicker(t => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Compute fleet tracking summary with 60-second stale heartbeat threshold
  const summary = useMemo(() => {
    return getBusesTrackingSummary(buses, 60);
  }, [buses, heartbeatTicker]);

  // Active selected bus with real-time updates
  const selectedBus = useMemo(() => {
    return buses.find(b => b.id === selectedBusId) || buses[0] || null;
  }, [buses, selectedBusId]);

  const selectedHealth = useMemo(() => {
    return getBusTrackingHealth(selectedBus, 60);
  }, [selectedBus, heartbeatTicker]);

  // Filter buses by tab and search input
  const filteredBuses = useMemo(() => {
    let list = buses;
    if (activeTab === 'live') {
      list = summary.liveBuses;
    } else if (activeTab === 'unavailable') {
      list = summary.unavailableBuses;
    }

    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      list = list.filter(b => 
        String(b.number || '').toLowerCase().includes(term) ||
        String(b.route || '').toLowerCase().includes(term) ||
        String(b.driver || '').toLowerCase().includes(term)
      );
    }

    return list;
  }, [buses, activeTab, summary, searchFilter]);

  const handleStatusUpdate = async (busId, newStatus) => {
    try {
      await updateBusStatus(busId, newStatus);
      showSuccess(`Status updated to: ${newStatus}`);
    } catch (err) {
      showError("Status change failed: " + err.message);
    }
  };

  const capacity = Number(selectedBus?.capacity) || 45;
  const currentCount = Number(selectedBus?.headcount) || 0;
  const occupancyPercent = Math.min(100, Math.round((currentCount / capacity) * 100));

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 font-sans">
      <PageHeader
        title="Fleet Live Tracking & Telematics"
        subtitle={`Real-time GPS surveillance across ${buses.length} registered campus transit vehicles`}
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Activity className="w-3.5 h-3.5 animate-pulse text-blue-600" />
              <span>{summary.liveCount} of {summary.total} Live</span>
            </span>
          </div>
        }
      />

      {/* ─── Tracking Availability Alert Banner: Warning for Unavailable Locations ─── */}
      {summary.hasUnavailableBuses ? (
        <div className="bg-rose-50/90 border border-rose-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-start md:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200 mt-0.5 md:mt-0">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-xs uppercase tracking-wider text-rose-950">
                  Tracking Alert: {summary.unavailableCount} Fleet Vehicle{summary.unavailableCount > 1 ? 's' : ''} Location Unavailable
                </h4>
                <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md border border-rose-200">
                  Action Required
                </span>
              </div>
              <p className="text-xs text-rose-800/90 mt-1">
                The following scheduled buses are not transmitting live GPS coordinates (stale &gt;60s or never started):{' '}
                <span className="font-semibold text-rose-950">
                  {summary.unavailableBuses.map(b => `Bus ${b.number}`).join(', ')}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <Button
              variant={activeTab === 'unavailable' ? 'danger' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(activeTab === 'unavailable' ? 'all' : 'unavailable')}
              className="text-xs font-bold border-rose-200 text-rose-700 hover:bg-rose-100/80 rounded-xl"
            >
              {activeTab === 'unavailable' ? 'Show All Fleet' : 'Inspect Unavailable Vehicles'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-3.5 shadow-xs flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs font-bold text-emerald-950">
              All {summary.total} Fleet Vehicles Are Broadcasting Live Coordinates
            </span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700">100% Telematics Health</span>
        </div>
      )}

      {/* ─── Main Fleet Cockpit: Map (Left) & Status Panel (Right) ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Radar Map Canvas */}
        <div className="lg:col-span-8">
          <FleetMap
            buses={buses}
            selectedBus={selectedBus}
            onSelectBus={(b) => setSelectedBusId(b.id)}
            className="h-[480px] sm:h-[560px] rounded-3xl"
          />
        </div>

        {/* Fleet Tracking Status Panel & Vehicle Diagnostics */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Selected Vehicle Diagnostics Card */}
          {selectedBus ? (
            <Card className="p-4 sm:p-5 rounded-3xl space-y-4">
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Bus {selectedBus.number}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedBus.route || 'Campus Route'}</span>
                  </p>
                </div>

                <Badge 
                  variant={selectedHealth.isLive ? 'success' : (selectedHealth.status === 'STALE' ? 'warning' : 'danger')}
                  className="font-bold text-[10px] uppercase tracking-wider"
                >
                  {selectedHealth.label}
                </Badge>
              </div>

              {/* Occupancy Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Passenger Count</span>
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

              {/* Telemetry Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Live Speed</span>
                  <span className="text-sm font-extrabold text-slate-800 mt-0.5 block">
                    {selectedHealth.isLive ? `${selectedBus.speed || 0} km/h` : '0 km/h'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">ETA Campus</span>
                  <span className="text-sm font-extrabold text-blue-600 mt-0.5 block">
                    {selectedBus.eta || '12 min'}
                  </span>
                </div>
              </div>

              {/* Live Broadcaster & Contacts Metadata */}
              <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Active Broadcaster:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[170px]">
                    {selectedHealth.broadcasterLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                  <span className="text-slate-500 font-medium">Last Heartbeat:</span>
                  <span className={`font-semibold ${selectedHealth.isLive ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {selectedHealth.lastSeenText}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                  <span className="text-slate-500 font-medium">Driver Contact:</span>
                  {selectedBus.phone ? (
                    <a href={`tel:${selectedBus.phone}`} className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 hover:underline">
                      <Phone className="w-3 h-3" />
                      <span>{selectedBus.phone}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400">Unlisted</span>
                  )}
                </div>

                {selectedBus.conductor && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                    <span className="text-slate-500 font-medium">Conductor:</span>
                    <span className="font-bold text-slate-800">{selectedBus.conductor}</span>
                  </div>
                )}
              </div>

              {/* Status Controls */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Transit Schedule Status Override
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate(selectedBus.id, 'On Time')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      selectedBus.status === 'On Time'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    On Time
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate(selectedBus.id, 'Delayed')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      selectedBus.status === 'Delayed'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Delayed
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate(selectedBus.id, 'Breakdown')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      selectedBus.status === 'Breakdown'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Issue
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center text-xs text-slate-400">
              Select a bus to inspect telemetry.
            </Card>
          )}

          {/* ─── Fleet Tracking Status Panel / List ───────────────────────── */}
          <Card className="p-4 rounded-3xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Fleet Tracking Roster
              </h4>
              <span className="text-[11px] font-semibold text-slate-400">
                {filteredBuses.length} shown
              </span>
            </div>

            {/* Categorized Filter Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-2xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`py-1.5 rounded-xl transition-all cursor-pointer text-center ${
                  activeTab === 'all' 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All ({summary.total})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('live')}
                className={`py-1.5 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                  activeTab === 'live' 
                    ? 'bg-white text-emerald-700 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Live ({summary.liveCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unavailable')}
                className={`py-1.5 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                  activeTab === 'unavailable' 
                    ? 'bg-white text-rose-700 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Offline ({summary.unavailableCount})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search bus #, route, driver..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-blue-600 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Bus List */}
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
                        <span className="text-[10px] text-slate-400 font-normal truncate">
                          {b.route || 'Campus Route'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {health.broadcasterLabel}
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-0.5">
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${
                          health.isLive 
                            ? 'bg-emerald-500 animate-pulse' 
                            : (health.status === 'STALE' ? 'bg-amber-500' : 'bg-rose-500')
                        }`} />
                        <span className={`text-[10px] font-bold ${
                          health.isLive 
                            ? 'text-emerald-700' 
                            : (health.status === 'STALE' ? 'text-amber-700' : 'text-rose-700')
                        }`}>
                          {health.label}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-medium">
                        {health.lastSeenText}
                      </span>
                    </div>
                  </button>
                );
              })}

              {filteredBuses.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400">
                  No vehicles found matching current filter.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
