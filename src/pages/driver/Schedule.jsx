// src/pages/driver/Schedule.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToBuses, subscribeToRoutes } from '../../services/transit';
import { subscribeToShiftConfig, getStaffRoleLabel } from '../../services/workforce';

export function DriverSchedule() {
  const { user } = useAuth();
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [completedStops, setCompletedStops] = useState({});

  useEffect(() => {
    const unsubBuses = subscribeToBuses(setBuses);
    const unsubRoutes = subscribeToRoutes(setRoutes);
    const unsubShifts = subscribeToShiftConfig(setShifts);
    return () => {
      unsubBuses();
      unsubRoutes();
      unsubShifts();
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

  const assignedRoute =
    routes.find(
      (r) =>
        r.id === assignedBus?.routeId ||
        r.name?.toLowerCase() === assignedBus?.route?.toLowerCase()
    ) || routes[0];

  const stops = Array.isArray(assignedRoute?.stops) && assignedRoute.stops.length > 0
    ? assignedRoute.stops
    : [
        { name: 'Starting Point / Depot', time: '07:45 AM' },
        { name: 'Main Square Pickup', time: '08:00 AM' },
        { name: 'City Center Junction', time: '08:15 AM' },
        { name: 'Campus Main Gate', time: '08:35 AM' }
      ];

  const toggleStop = (idx) => {
    setCompletedStops((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-5 font-sans text-slate-900">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-mono uppercase text-slate-500">
            {getStaffRoleLabel(user?.role || 'driver', user?.roleTier || 'primary')}
          </span>
          <h1 className="text-xl font-bold tracking-tight mt-0.5">
            Shift Roster & Route Timeline
          </h1>
        </div>
        <div className="bg-slate-900 text-white px-3.5 py-2 rounded-lg font-mono text-xs">
          Assigned: Bus #{assignedBus?.number || '—'} · {assignedRoute?.code || 'Route'}
        </div>
      </div>

      {/* Active Shifts Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shifts.map((shift) => (
          <div
            key={shift.id}
            className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <span className="text-xs font-mono uppercase text-slate-400">Shift Window</span>
              <p className="font-semibold text-sm mt-0.5">{shift.name}</p>
            </div>
            <span className="font-mono text-sm font-semibold tabular-nums bg-slate-100 px-3 py-1 rounded border border-slate-200">
              {shift.startTime} – {shift.endTime}
            </span>
          </div>
        ))}
      </div>

      {/* Vertical Stop-by-Stop Checklist */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold">
              {assignedRoute?.name || assignedBus?.route || 'Scheduled Campus Route'}
            </h2>
            <p className="text-xs text-slate-500">Tap a stop as you reach it to log route progress</p>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {Object.values(completedStops).filter(Boolean).length} / {stops.length} Reached
          </span>
        </div>

        <div className="space-y-3">
          {stops.map((stop, idx) => {
            const stopName = typeof stop === 'string' ? stop : stop.name || `Stop #${idx + 1}`;
            const stopTime = typeof stop === 'object' && stop.time ? stop.time : `Stop ${idx + 1}`;
            const isDone = Boolean(completedStops[idx]);

            return (
              <div
                key={idx}
                onClick={() => toggleStop(idx)}
                className={`p-3.5 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                  isDone
                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full font-mono text-xs flex items-center justify-center font-bold ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-600'
                    }`}
                  >
                    {isDone ? '✓' : idx + 1}
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${isDone ? 'line-through opacity-75' : ''}`}>
                      {stopName}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {stopTime}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DriverSchedule;
