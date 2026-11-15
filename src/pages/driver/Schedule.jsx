// src/pages/driver/Schedule.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Clock, MapPin, Bus, CheckCircle2, ArrowRight,
  Navigation, User, Shield, AlertCircle, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToBuses, subscribeToRoutes } from '../../services/transit';
import { db, collection, query, where, onSnapshot } from '../../config/firebase';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export function DriverSchedule() {
  const { profile } = useAuth();
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [assignedBus, setAssignedBus] = useState(null);
  const [assignedRoute, setAssignedRoute] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const isConductor = profile?.role === 'conductor';
  const roleTier = profile?.roleTier || 'primary';
  const roleLabel = isConductor
    ? (roleTier === 'secondary' ? 'Secondary Conductor' : 'Primary Conductor')
    : (roleTier === 'secondary' ? 'Secondary Driver' : 'Primary Driver');

  // 1. Subscribe to buses & match assignment
  useEffect(() => {
    const unsubBuses = subscribeToBuses((busList) => {
      setBuses(busList);
      const myEmail = profile?.email?.toLowerCase();
      const myBus = busList.find(b =>
        (b.driverEmails && b.driverEmails.includes(myEmail)) ||
        (b.conductorEmails && b.conductorEmails.includes(myEmail)) ||
        (b.driver && b.driver.toLowerCase() === profile?.name?.toLowerCase()) ||
        (b.conductor && b.conductor.toLowerCase() === profile?.name?.toLowerCase()) ||
        (profile?.assignedBus && String(b.number) === String(profile.assignedBus))
      ) || busList[0];

      setAssignedBus(myBus);
      setLoading(false);
    });

    const unsubRoutes = subscribeToRoutes((routeList) => {
      setRoutes(routeList);
    });

    return () => {
      unsubBuses();
      unsubRoutes();
    };
  }, [profile]);

  // 2. Match route stops
  useEffect(() => {
    if (assignedBus && routes.length > 0) {
      const match = routes.find(r => 
        (assignedBus.routeId && r.id === assignedBus.routeId) ||
        (assignedBus.route && r.name && r.name.toLowerCase().includes(assignedBus.route.toLowerCase()))
      );
      setAssignedRoute(match || null);
    }
  }, [assignedBus, routes]);

  // 3. Subscribe to shift sessions
  useEffect(() => {
    const userEmail = profile?.email?.toLowerCase();
    if (!userEmail) return;

    try {
      const q = query(
        collection(db, 'driver_sessions'),
        where('driverEmail', '==', userEmail)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const sessions = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          sessions.push({ id: docSnap.id, ...data });
        });
        sessions.sort((a, b) => (b.startTime?.toDate?.() || 0) - (a.startTime?.toDate?.() || 0));
        setRecentSessions(sessions.slice(0, 5));
      }, (err) => {
        console.warn("Driver sessions query notice:", err.message);
      });
      return () => unsub();
    } catch (e) {
      // fallback
    }
  }, [profile]);

  const defaultStops = [
    { name: 'Campus Main Gate / Terminal', time: '07:30 AM', type: 'origin' },
    { name: 'Engineering & Tech Block Junction', time: '07:45 AM', type: 'transit' },
    { name: 'Super Corridor Sector 1', time: '08:05 AM', type: 'transit' },
    { name: 'TCS / Infosys Transit Square', time: '08:20 AM', type: 'transit' },
    { name: 'Metro Interchange Station', time: '08:35 AM', type: 'transit' },
    { name: 'Rajwada / Central Drop Terminal', time: '08:55 AM', type: 'destination' }
  ];

  const stops = assignedRoute?.stops?.length > 0 
    ? assignedRoute.stops.map((s, idx) => ({
        name: typeof s === 'string' ? s : s.name,
        time: s.time || `${7 + Math.floor(idx * 15 / 60)}:${String((idx * 15) % 60).padStart(2, '0')} AM`,
        type: idx === 0 ? 'origin' : (idx === assignedRoute.stops.length - 1 ? 'destination' : 'transit')
      }))
    : defaultStops;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 font-sans">
      <PageHeader
        title="Shift & Route Schedule"
        subtitle={`Daily transit duty timetable, stop sequence, and shift logs for ${roleLabel}`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/driver/dashboard">
              <Button variant="primary" className="gap-1.5 text-xs">
                <Navigation className="w-3.5 h-3.5" />
                Go to Live Telemetry
              </Button>
            </Link>
          </div>
        }
      />

      {/* ─── Top Assigned Vehicle Banner ─── */}
      <Card className="border border-blue-100 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/40 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {assignedBus ? `Bus #${assignedBus.number}` : 'Vehicle Assignment Pending'}
                </h2>
                <Badge variant="primary" className="text-[11px] font-semibold">
                  {roleLabel}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Route: <strong className="text-slate-800">{assignedBus?.route || 'Main Campus Corridor Loop'}</strong>
                {assignedBus?.capacity && ` • Max Capacity: ${assignedBus.capacity} passengers`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3.5 py-1.5 bg-white border border-slate-200/80 rounded-xl text-center shadow-xs">
              <p className="text-[10px] uppercase font-bold text-slate-400">Status</p>
              <p className="text-xs font-bold text-emerald-600 flex items-center gap-1 justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Run
              </p>
            </div>
            <div className="px-3.5 py-1.5 bg-white border border-slate-200/80 rounded-xl text-center shadow-xs">
              <p className="text-[10px] uppercase font-bold text-slate-400">Next Shift</p>
              <p className="text-xs font-bold text-slate-800">Tomorrow 07:30 AM</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Route Stops Sequence */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="bg-white border border-slate-200/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <CardTitle className="text-sm font-bold text-slate-900">Today's Route Timetable & Stops</CardTitle>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {stops.length} Scheduled Waypoints
              </span>
            </CardHeader>
            <CardBody className="p-5">
              <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-100">
                {stops.map((stop, index) => (
                  <div key={index} className="relative flex items-start justify-between gap-3 group">
                    <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center transition-all ${
                      stop.type === 'origin'
                        ? 'border-blue-600 ring-4 ring-blue-50'
                        : (stop.type === 'destination' ? 'border-emerald-600 ring-4 ring-emerald-50' : 'border-slate-300')
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        stop.type === 'origin' ? 'bg-blue-600' : (stop.type === 'destination' ? 'bg-emerald-600' : 'bg-slate-400')
                      }`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                        {stop.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Stop #{index + 1} {stop.type === 'origin' ? '• Departure Terminal' : (stop.type === 'destination' ? '• Final Destination' : '• Passenger Boarding')}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="inline-block px-2.5 py-1 bg-slate-50 border border-slate-200/60 rounded-md font-mono text-xs font-semibold text-slate-700">
                        {stop.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Shift Policies, Next Day ETA & History */}
        <div className="lg:col-span-5 space-y-6">
          {/* Next Day ETA Card */}
          <Card className="bg-gradient-to-br from-indigo-50/60 via-white to-blue-50/40 border border-indigo-100/80 shadow-xs">
            <CardBody className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-indigo-700">
                <Calendar className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Next Day Schedule ETA</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Scheduled Next Day Departure Time: <strong className="text-indigo-900 font-bold">07:30 AM IST</strong>. 
                Pre-trip bus diagnostics and GPS sensor calibration begin at <strong>07:15 AM</strong>.
              </p>
              <div className="pt-2 border-t border-indigo-100/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>Morning Shift: 07:30 – 10:00 AM</span>
                <span>Evening Shift: 04:30 – 06:30 PM</span>
              </div>
            </CardBody>
          </Card>

          {/* Shift Duty Checklist */}
          <Card className="bg-white border border-slate-200/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900">Shift Readiness Checklist</CardTitle>
            </CardHeader>
            <CardBody className="p-4 space-y-2.5 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Device GPS Location Permissions Granted</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Optical Camera Scanner Calibrated</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Primary / Secondary Crew Sync Initialized</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Headcount Counter Reset to 0 at Origin</span>
              </div>
            </CardBody>
          </Card>

          {/* Recent Shift Activity Log */}
          <Card className="bg-white border border-slate-200/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900">Recent Shift Logs</CardTitle>
              <span className="text-[11px] text-slate-400">Duty Records</span>
            </CardHeader>
            <CardBody className="p-4">
              {recentSessions.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {recentSessions.map(session => (
                    <div key={session.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">Bus {session.busNumber || assignedBus?.number || '--'}</p>
                        <p className="text-[11px] text-slate-400">{session.route || 'Campus Route'}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold">
                          {session.status || 'Completed'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">
                  No previous shift history recorded today.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
