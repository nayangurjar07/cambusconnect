// src/pages/admin/Dashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Users, Bus, AlertTriangle, ArrowRight, ShieldCheck, MapPin } from 'lucide-react';
import { subscribeToBuses, getBusesTrackingSummary } from '../../services/transit';
import { subscribeToStaff } from '../../services/workforce';
import FleetMap from '../../components/domain/FleetMap';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

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
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 text-slate-900 font-sans">
      {/* Command Header */}
      <PageHeader
        title="Fleet Dispatch Overview"
        subtitle="Central transit operations command, real-time telemetry health, and occupancy monitoring"
        badge={
          <Badge variant="primary" dot>
            System Operational
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Users}
              onClick={() => navigate('/admin/staff')}
            >
              Assign Crew
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Radio}
              onClick={() => navigate('/admin/track')}
            >
              Open Live Console →
            </Button>
          </div>
        }
      />

      {/* Prominent Alert Banner if Any Bus Live Location is Unavailable */}
      {trackingSummary.hasUnavailableBuses && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4.5 text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="danger" dot>
                  Live Location Unavailable
                </Badge>
                <span className="text-xs font-semibold text-rose-700">
                  {trackingSummary.unavailableCount} of {trackingSummary.total} buses offline
                </span>
              </div>
              <p className="text-xs sm:text-sm mt-1 text-slate-800">
                No active GPS signal received for:{' '}
                <strong className="text-rose-950 font-bold">
                  {trackingSummary.unavailableBuses.map((b) => `Bus #${b.number}`).join(', ')}
                </strong>
              </p>
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => navigate('/admin/track')}
          >
            Inspect Missing Buses →
          </Button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardBody className="p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Fleet</span>
            <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">{trackingSummary.total}</p>
            <span className="text-xs text-slate-400">Registered vehicles</span>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Broadcasting Live</span>
            <p className="text-2xl font-bold tabular-nums text-emerald-600 mt-1">
              {trackingSummary.liveCount}
            </p>
            <span className="text-xs text-slate-400">Active GPS telemetry fixes</span>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Location Unavailable</span>
            <p className="text-2xl font-bold tabular-nums text-rose-600 mt-1">
              {trackingSummary.unavailableCount}
            </p>
            <span className="text-xs text-slate-400">Offline / Never started</span>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Onboard Riders / Crew</span>
            <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">
              {totalBoarded}{' '}
              <span className="text-sm font-normal text-slate-400">pax · {activeCrewCount} crew</span>
            </p>
            <span className="text-xs text-slate-400">Live verified passengers</span>
          </CardBody>
        </Card>
      </div>

      {/* Live Map Preview + Fleet Status Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col min-h-[400px] shadow-xs">
          <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Live Fleet Telemetry Map
            </span>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => navigate('/admin/track')}
            >
              Full Screen →
            </Button>
          </div>
          <div className="flex-1 min-h-[350px]">
            <FleetMap buses={buses} />
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-xs">
          <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Bus Signal & Broadcaster Status
            </span>
            <Badge variant="neutral">{buses.length} tracked</Badge>
          </div>
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[350px]">
            {[...trackingSummary.unavailableBuses, ...trackingSummary.liveBuses].map((bus) => {
              const health = bus.trackingHealth;
              return (
                <div key={bus.id} className="p-3.5 flex items-center justify-between gap-2 text-xs hover:bg-slate-50/80 transition-colors">
                  <div>
                    <span className="font-bold text-sm text-slate-900">
                      Bus #{bus.number}
                    </span>
                    <span className="text-slate-500 ml-2">{bus.route || 'No Route'}</span>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {health.broadcasterLabel} · {health.lastSeenText}
                    </div>
                  </div>
                  <Badge variant={health.isLive ? 'success' : 'danger'} dot className="text-[10px]">
                    {health.isLive ? 'LIVE' : 'UNAVAILABLE'}
                  </Badge>
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