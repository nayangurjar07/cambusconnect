// src/pages/student/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bus, MapPin, Clock, QrCode, Map, ShieldCheck, Leaf, Radio,
  ChevronRight, Phone, ArrowRight, Bell, Search, Compass, LifeBuoy,
  Sparkles, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { subscribeToBus } from '../../services/transit';
import { subscribeToNotifications } from '../../services/communications';
import { getStudentTripsCount } from '../../services/transit';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CircularAction } from '../../components/ui/CircularAction';
import { TransitTimelineCard } from '../../components/domain/TransitTimelineCard';
import { NotificationItem } from '../../components/domain/NotificationItem';

export function StudentDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { branding } = useTenant();
  const [assignedBus, setAssignedBus] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [tripsCount, setTripsCount] = useState(0);
  const [loadingBus, setLoadingBus] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.name ? profile.name.split(' ')[0] : 'Student';

  useEffect(() => {
    if (profile?.assignedBusId) {
      const unsub = subscribeToBus(profile.assignedBusId, (busData) => {
        setAssignedBus(busData);
        setLoadingBus(false);
      }, () => setLoadingBus(false));
      return () => unsub();
    } else {
      setLoadingBus(false);
    }
  }, [profile?.assignedBusId]);

  useEffect(() => {
    const unsub = subscribeToNotifications((list) => {
      const studentRoute = profile?.busRoute || '';
      const matching = list.filter(n => !n.targetRouteId || n.targetRouteId === 'all' || n.targetRouteId === studentRoute);
      setNotifications(matching.slice(0, 3));
    });
    return () => unsub();
  }, [profile?.busRoute]);

  useEffect(() => {
    if (profile?.email) {
      getStudentTripsCount(profile.email).then(setTripsCount);
    }
  }, [profile?.email]);

  const co2Saved = Math.round(tripsCount * 2.3);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/student/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/student/search');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">
      {/* Top Welcome Bar (Matching Reference Screen 1) */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 border-2 border-blue-200 text-blue-700 font-bold text-base flex items-center justify-center shadow-xs">
            {profile?.name ? profile.name.charAt(0).toUpperCase() : 'S'}
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              {greeting}
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">
              {profile?.name || "Student"}
            </h1>
          </div>
        </div>

        {/* Circular Notification Bell */}
        <Link
          to="/student/notifications"
          className="relative w-11 h-11 rounded-full bg-white border border-slate-200/80 hover:bg-slate-50 flex items-center justify-center text-slate-700 shadow-2xs transition-all active:scale-95"
        >
          <Bell className="w-5 h-5" />
          {notifications.length > 0 && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
          )}
        </Link>
      </div>

      {/* Pill Search Bar (Matching Reference Screen 1) */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Enter your bus number, stop, or route..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200/90 rounded-full pl-11 pr-24 py-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium"
          />
          <button
            type="submit"
            className="absolute right-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            Find
          </button>
        </div>
      </form>

      {/* Quick Location / Assigned Stop Pill */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Your Designated Stop</span>
            <span className="text-sm font-bold text-slate-800 block mt-0.5">
              {profile?.pickupStop || "Sector 3 Main Stop"}
            </span>
          </div>
        </div>
        <Link
          to="/student/search"
          className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors"
        >
          Change Stop
        </Link>
      </div>

      {/* 4 Circular Quick Action Buttons (Matching Reference Screen 1) */}
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-2 pt-1 pb-2">
          <CircularAction
            icon={Map}
            label="Live Track"
            to="/student/track"
            variant="default"
          />
          <CircularAction
            icon={QrCode}
            label="Bus Pass"
            to="/student/bus-pass"
            variant="default"
          />
          <CircularAction
            icon={Compass}
            label="Routes"
            to="/student/search"
            variant="default"
          />
          <CircularAction
            icon={LifeBuoy}
            label="Support"
            to="/student/support"
            variant="default"
          />
        </div>
      </div>

      {/* Active Delivery / Pass Type Card (Matching Royal Blue Card in Reference Screen 1) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Active Transit Plan</h2>
          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Verified Valid
          </span>
        </div>

        <div className="bg-blue-600 rounded-3xl p-5 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden">
          {/* Subtle decorative background circle */}
          <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-white/10 pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                Institutional Semester Pass
              </span>
              <h3 className="text-lg font-bold tracking-tight">
                {profile?.busRoute || assignedBus?.route || "Campus Express"}
              </h3>
              <p className="text-xs text-blue-100 font-medium">
                Pass ID: <span className="font-mono font-bold text-white">{profile?.enrollment || profile?.collegeId || "STU-2026"}</span>
              </p>
            </div>

            <Link
              to="/student/bus-pass"
              className="px-3.5 py-2 rounded-xl bg-white text-blue-600 font-bold text-xs shadow-sm hover:bg-blue-50 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <QrCode className="w-4 h-4" />
              <span>Show QR</span>
            </Link>
          </div>

          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-blue-100 relative z-10">
            <span>Valid Until: <strong className="text-white font-semibold">{profile?.passValidity || "31 Dec 2026"}</strong></span>
            <span>Bus Assigned: <strong className="text-white font-semibold">Bus {assignedBus?.number || profile?.assignedBusNumber || "14"}</strong></span>
          </div>
        </div>
      </div>

      {/* Ongoing Transit Card (Matching Middle Screen from Reference) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Ongoing Transit Run</h2>
          <Link to="/student/track" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
            Full Map <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <TransitTimelineCard
          bus={assignedBus}
          fromStop={profile?.pickupStop || "Sector 3 Pickup Point"}
          toStop={`${branding?.name || "Campus"} Main Gate`}
          eta={assignedBus?.eta || "8-12 min"}
          status={assignedBus?.status === 'Breakdown' ? 'Service Disrupted' : assignedBus?.status === 'Delayed' ? 'Traffic Delay' : 'Bus On Route'}
          trackUrl="/student/track"
        />
      </div>

      {/* Impact Stats Pills */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Leaf className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Eco Savings</span>
            <span className="text-sm font-bold text-slate-900">{co2Saved} kg CO₂ saved</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Rides</span>
            <span className="text-sm font-bold text-slate-900">{tripsCount} trips this term</span>
          </div>
        </div>
      </div>

      {/* Announcements */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Recent Announcements</h2>
          <Link to="/student/notifications" className="text-xs font-bold text-blue-600 hover:text-blue-700">
            View All
          </Link>
        </div>

        {notifications.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 text-center text-xs text-slate-400 font-medium">
            No route advisories or notices right now. All buses operating normally.
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <NotificationItem key={n.id} notification={n} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
