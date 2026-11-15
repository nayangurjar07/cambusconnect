// src/pages/admin/Dashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToBuses, getBusesTrackingSummary } from '../../services/transit';
import { subscribeToStaff } from '../../services/workforce';
import FleetMap from '../../components/domain/FleetMap';

export function AdminDashboard() {
  const navigate = useNavigate();
  const [buses, setBuses] = useState([]);
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    const unsubBuses = subscribeToBuses(setBuses);
    const unsubStaff = subscribeToStaff(setStaff);
    return () => {
      unsubBuses();
      unsubStaff();
    };
  }, []);

  const trackingSummary = useMemo(() => getBusesTrackingSummary(buses, 110), [buses]);

  const activeCrewCount = useMemo(
    () => staff.filter((s) => s.status !== 'Terminated' && (s.role === 'driver' || s.role === 'conductor')).length,
    [staff]
  );

  const totalBoarded = useMemo(
    () => buses.reduce((acc, b) => acc + (Number(b.headcount) || 0), 0),
    [buses]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 font-sans text-slate-900">
      {/* Command Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
            Campus Transit Operations Control
          </span>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">
            Fleet Dispatch Overview
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin/staff')}
            className="px-3.5 py-2 text-xs font-mono uppercase border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            Assign Crew
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/track')}
            className="px-4 py-2 text-xs font-mono uppercase bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            Open Live Console →
          </button>
        </div>
      </div>

      {/* Prominent Alert Banner if Any Bus Live Location is Unavailable */}
      {trackingSummary.hasUnavailableBuses && (
        <div className="bg-rose-950 text-white rounded-xl p-4 border border-rose-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-rose-500 text-white font-bold rounded">
                Live Location Unavailable
              </span>
              <span className="text-xs font-mono text-rose-200">
                {trackingSummary.unavailableCount} of {trackingSummary.total} buses offline
              </span>
            </div>
            <p className="text-sm mt-1">
              No active GPS stream received for:{' '}
              <span className="font-mono font-semibold text-amber-300">
                {trackingSummary.unavailableBuses.map((b) => `Bus #${b.number}`).join(', ')}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/track')}
            className="px-3.5 py-2 bg-white text-slate-950 font-mono text-xs font-bold rounded-lg shrink-0 cursor-pointer"
          >
            Inspect Missing Buses →
          </button>
        </div>
      )}

      {/* KPI Strip (Tabular Monospace) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-[11px] font-mono uppercase text-slate-500">Total Fleet</span>
          <p className="text-2xl font-mono font-bold tabular-nums mt-1">{trackingSummary.total}</p>
          <span className="text-xs text-slate-400">Registered vehicles</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-[11px] font-mono uppercase text-emerald-700">Broadcasting Live</span>
          <p className="text-2xl font-mono font-bold tabular-nums text-emerald-600 mt-1">
            {trackingSummary.liveCount}
          </p>
          <span className="text-xs text-slate-400">Active GPS streams</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-[11px] font-mono uppercase text-rose-700">Location Unavailable</span>
          <p className="text-2xl font-mono font-bold tabular-nums text-rose-600 mt-1">
            {trackingSummary.unavailableCount}
          </p>
          <span className="text-xs text-slate-400">Offline / Never started</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-[11px] font-mono uppercase text-slate-500">Onboard / Crew</span>
          <p className="text-2xl font-mono font-bold tabular-nums mt-1">
            {totalBoarded}{' '}
            <span className="text-sm font-normal text-slate-400">pax · {activeCrewCount} crew</span>
          </p>
          <span className="text-xs text-slate-400">Live verified riders</span>
        </div>
      </div>

      {/* Live Map Preview + Fleet Status Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[380px]">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-bold text-slate-700">
              Live Fleet Telemetry Map
            </span>
            <button
              type="button"
              onClick={() => navigate('/admin/track')}
              className="text-xs font-mono text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Full Screen →
            </button>
          </div>
          <div className="flex-1 min-h-[340px]">
            <FleetMap buses={buses} />
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-bold text-slate-700">
              Bus Signal & Broadcaster Status
            </span>
          </div>
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[340px]">
            {[...trackingSummary.unavailableBuses, ...trackingSummary.liveBuses].map((bus) => {
              const health = bus.trackingHealth;
              return (
                <div key={bus.id} className="p-3.5 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-mono font-bold text-sm text-slate-900">
                      Bus #{bus.number}
                    </span>
                    <span className="text-slate-500 ml-2">{bus.route || 'No Route'}</span>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {health.broadcasterLabel} · {health.lastSeenText}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 font-mono text-[10px] uppercase rounded border shrink-0 ${
                      health.isLive
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {health.isLive ? 'LIVE' : 'UNAVAILABLE'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
