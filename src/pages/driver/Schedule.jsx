// src/pages/driver/Schedule.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, CheckCircle2, Circle, ArrowRight, Bus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToBuses, subscribeToRoutes } from '../../services/transit';
import { subscribeToShiftConfig, getStaffRoleLabel } from '../../services/workforce';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { TransitTimelineCard } from '../../components/domain/TransitTimelineCard';

export function DriverSchedule() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
        b.id === user?.assignedBusId ||
        b.primaryDriver?.email === userEmail ||
        b.secondaryDriver?.email === userEmail ||
        b.primaryConductor?.email === userEmail ||
        b.secondaryConductor?.email === userEmail
    ) || buses[0];

  const assignedRoute =
    routes.find(
      (r) =>
        r.id === assignedBus?.routeId ||
        (assignedBus?.route && r.name?.toLowerCase() === assignedBus.route.toLowerCase())
    ) || null;

  const stops = Array.isArray(assignedRoute?.stops) ? assignedRoute.stops : [];
  const hasStops = stops.length > 0;

  // Reads shifts configured on the driver's assigned route or institutional settings
  const routeShiftIds = assignedRoute?.assignedShiftIds || (Array.isArray(assignedRoute?.shifts) ? assignedRoute.shifts.map(s => s.id || s) : []);

  const displayedShifts = useMemo(() => {
    // 1. If institutional shifts configured in settings/shiftConfig
    if (shifts && shifts.length > 0) {
      if (routeShiftIds.length > 0) {
        const matched = shifts.filter(s => routeShiftIds.includes(s.id));
        if (matched.length > 0) return matched;
      }
      return shifts;
    }

    // 2. Generate from assigned route shift IDs
    if (routeShiftIds.length > 0) {
      return routeShiftIds.map(sId => {
        if (sId === 'shift_1') {
          return {
            id: 'shift_1',
            name: 'Morning Pickup (Shift 1)',
            startTime: assignedRoute?.stops?.[0]?.pickupTime || '08:00 AM',
            endTime: '10:30 AM',
            enabled: true
          };
        }
        if (sId === 'shift_2') {
          return {
            id: 'shift_2',
            name: 'Evening Drop (Shift 2)',
            startTime: '04:30 PM',
            endTime: '06:30 PM',
            enabled: true
          };
        }
        return {
          id: sId,
          name: sId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          startTime: '08:00 AM',
          endTime: '05:00 PM',
          enabled: true
        };
      });
    }

    // 3. Fallback default institutional shift
    return [
      {
        id: 'shift_1',
        name: 'Morning Pickup (Shift 1)',
        startTime: assignedRoute?.stops?.[0]?.pickupTime || '08:00 AM',
        endTime: '10:30 AM',
        enabled: true
      }
    ];
  }, [shifts, routeShiftIds, assignedRoute]);

  const toggleStop = (idx) => {
    setCompletedStops((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const roleLabel = getStaffRoleLabel(user?.role || 'driver', user?.roleTier || 'primary');

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-5 font-sans text-slate-900">
      {/* Page Header */}
      <PageHeader
        title="Shift Roster & Route Schedule"
        subtitle="Dedicated stop sequence, shift windows, and operational progress for your vehicle"
        badge={
          <Badge variant="primary" dot>
            {roleLabel}
          </Badge>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/driver/dashboard')}
          >
            ← Cockpit
          </Button>
        }
      />

      {/* Vehicle & Dedicated Route Overview */}
      <Card>
        <CardBody className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                <Bus className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Bus #{assignedBus?.number || '—'}
                  </h2>
                  <Badge variant={assignedRoute ? 'primary' : 'warning'}>
                    {assignedRoute ? assignedRoute.name : assignedBus?.route || 'No Route Assigned'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vehicle Capacity: <strong className="text-slate-800">{assignedBus?.capacity || 45}</strong> · Headcount: <strong className="text-slate-800">{assignedBus?.headcount || 0}</strong>
                </p>
              </div>
            </div>

            {hasStops && (
              <div className="text-right">
                <span className="text-xs text-slate-400 block font-medium">Progress</span>
                <span className="text-sm font-bold text-blue-600 tabular-nums">
                  {Object.values(completedStops).filter(Boolean).length} / {stops.length} Stops Logged
                </span>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Shift Windows Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Assigned Shift Windows
          </h2>
        </div>

        {displayedShifts.length === 0 ? (
          <Card>
            <CardBody className="py-6 text-center text-xs text-slate-400">
              No institutional shift schedules configured yet.
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayedShifts.map((shift) => (
              <Card key={shift.id} className="hover:border-blue-200 transition-colors">
                <CardBody className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Shift Window
                    </span>
                    <p className="font-bold text-sm text-slate-900 mt-0.5">{shift.name}</p>
                  </div>
                  <Badge variant="primary" className="tabular-nums font-semibold">
                    {shift.startTime} – {shift.endTime}
                  </Badge>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Real Route Stop Timeline or Empty State */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <CardTitle>
              {assignedRoute?.name || assignedBus?.route || 'Dedicated Route Schedule'}
            </CardTitle>
          </div>
          {hasStops && (
            <Badge variant="neutral">
              {stops.length} scheduled stops
            </Badge>
          )}
        </CardHeader>
        <CardBody className="p-4 sm:p-5">
          {!hasStops ? (
            <EmptyState
              icon={MapPin}
              title="No Dedicated Route Assigned"
              description={`No dedicated route or stop schedule has been assigned to Bus #${assignedBus?.number || '—'} yet. Contact dispatch to link a route in the administrative registry.`}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/driver/dashboard')}
                >
                  Return to Cockpit
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-2">
                Tap each stop as you arrive to log route progress in real time.
              </p>

              {stops.map((stop, idx) => {
                const stopName = typeof stop === 'string' ? stop : stop.name || `Stop #${idx + 1}`;
                const stopTime = typeof stop === 'object' && stop.time ? stop.time : null;
                const isDone = Boolean(completedStops[idx]);

                return (
                  <div
                    key={idx}
                    onClick={() => toggleStop(idx)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isDone
                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-2xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-xl text-xs flex items-center justify-center font-bold transition-colors ${
                          isDone
                            ? 'bg-emerald-600 text-white'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {isDone ? '✓' : idx + 1}
                      </span>
                      <div>
                        <p className={`text-sm font-bold ${isDone ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {stopName}
                        </p>
                        {typeof stop === 'object' && (stop.lat || stop.landmark) && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {stop.landmark || `${stop.lat}, ${stop.lng}`}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      {stopTime ? (
                        <span className="text-xs font-semibold text-slate-600 tabular-nums">
                          {stopTime}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          Stop {idx + 1} of {stops.length}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default DriverSchedule;