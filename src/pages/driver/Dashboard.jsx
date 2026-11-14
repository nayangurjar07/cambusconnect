// src/pages/driver/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bus, Users, Radio, Clock, QrCode, Send, Play, Square, MapPin
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  subscribeToBuses,
  updateBusStatus,
  updateBusHeadcount,
  updateBusLocation
} from '../../services/transit';
import { createNotification } from '../../services/communications';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusIndicator } from '../../components/ui/StatusIndicator';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';

export function DriverDashboard() {
  const { profile } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const [buses, setBuses] = useState([]);
  const [assignedBus, setAssignedBus] = useState(null);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [shiftDuration, setShiftDuration] = useState(0);
  const [watchId, setWatchId] = useState(null);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [headcount, setHeadcount] = useState(0);
  const [alertType, setAlertType] = useState('delay');
  const [alertMessage, setAlertMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    const unsub = subscribeToBuses((list) => {
      setBuses(list);
      const myEmail = profile?.email?.toLowerCase();
      const myBus = list.find(b =>
        (b.driverEmails && b.driverEmails.includes(myEmail)) ||
        (b.driver && b.driver.toLowerCase() === profile?.name?.toLowerCase()) ||
        (profile?.assignedBus && b.number === profile.assignedBus)
      ) || list[0];
      if (myBus) {
        setAssignedBus(myBus);
        setHeadcount(myBus.headcount || 0);
      }
    });
    return () => unsub();
  }, [profile]);

  useEffect(() => {
    let interval = null;
    if (isShiftActive) {
      interval = setInterval(() => setShiftDuration(prev => prev + 1), 1000);
    } else {
      setShiftDuration(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isShiftActive]);

  useEffect(() => {
    return () => {
      if (watchId && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const formatTime = (secs) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleShift = () => {
    if (!assignedBus) { showError("No vehicle assigned."); return; }
    if (!isShiftActive) {
      if ('geolocation' in navigator) {
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, speed } = pos.coords;
            setGpsCoords({ lat: latitude, lng: longitude });
            updateBusLocation(assignedBus.id, latitude, longitude, speed ? Math.round(speed * 3.6) : 25);
          },
          () => showWarning("GPS unavailable."),
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
        setWatchId(id);
      }
      setIsShiftActive(true);
      showSuccess(`Shift started — Bus ${assignedBus.number}`);
    } else {
      if (watchId) { navigator.geolocation.clearWatch(watchId); setWatchId(null); }
      setIsShiftActive(false);
      showSuccess("Shift ended.");
    }
  };

  const adjustHeadcount = async (delta) => {
    if (!assignedBus) return;
    const newCount = Math.max(0, headcount + delta);
    setHeadcount(newCount);
    try { await updateBusHeadcount(assignedBus.id, newCount); } catch (e) { /* silent */ }
  };

  const handleStatusChange = async (newStatus) => {
    if (!assignedBus) return;
    try {
      await updateBusStatus(assignedBus.id, newStatus);
      showSuccess(`Status: ${newStatus}`);
    } catch (e) { showError("Failed: " + e.message); }
  };

  const handleSendAlert = async (e) => {
    e.preventDefault();
    if (!alertMessage) return;
    setBroadcasting(true);
    try {
      await createNotification({
        title: `Bus ${assignedBus?.number || ''} — ${alertType}`,
        message: alertMessage,
        type: alertType,
        targetRouteId: assignedBus?.route || 'all'
      });
      showSuccess("Alert sent to riders.");
      setAlertMessage('');
    } catch (err) { showError("Failed: " + err.message); }
    finally { setBroadcasting(false); }
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-10">
      <PageHeader
        title="Driver Command Dashboard"
        subtitle={assignedBus ? `Bus ${assignedBus.number} — ${assignedBus.route || 'Campus Line'}` : 'No vehicle assigned'}
        actions={
          <Link to="/driver/scan-pass">
            <Button variant="primary" size="md" icon={QrCode} className="rounded-2xl px-4 py-2.5 shadow-sm shadow-blue-500/20">
              Scan Pass
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Controls */}
        <div className="lg:col-span-2 space-y-5">
          {/* Shift Control Card */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3.5">
                <span className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-700 font-bold text-base flex items-center justify-center shadow-2xs">
                  {assignedBus?.number || '—'}
                </span>
                <div>
                  <div className="text-base font-bold text-slate-900 tracking-tight">Bus {assignedBus?.number || 'Unassigned'}</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">Assigned Route: <strong className="text-slate-800">{assignedBus?.route || '—'}</strong></div>
                </div>
              </div>
              <Button
                variant={isShiftActive ? 'danger' : 'success'}
                size="md"
                icon={isShiftActive ? Square : Play}
                onClick={toggleShift}
                className="rounded-2xl px-5 py-2.5 font-bold shadow-sm"
              >
                {isShiftActive ? 'End Shift' : 'Start Shift'}
              </Button>
            </div>

            {/* Telemetry Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-150/70">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shift Time</div>
                <div className="text-lg font-bold text-slate-900 mt-1 font-mono tracking-tight">{formatTime(shiftDuration)}</div>
                <div className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${isShiftActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isShiftActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                  {isShiftActive ? 'Active Shift' : 'Off-duty'}
                </div>
              </div>

              <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-150/70">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live GPS</div>
                <div className="text-xs font-semibold text-slate-800 mt-1 truncate">
                  {gpsCoords ? `${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}` : 'Standby'}
                </div>
                <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
                  <Radio className="w-3 h-3" />
                  <span>{isShiftActive ? 'Transmitting' : 'Idle'}</span>
                </div>
              </div>

              <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-150/70">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bus Status</div>
                <div className="mt-1.5"><StatusIndicator status={assignedBus?.status} /></div>
              </div>

              <div className="bg-blue-50/70 rounded-2xl p-3.5 border border-blue-100/70">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Live Riders</div>
                <div className="text-xl font-bold text-blue-700 mt-0.5">{headcount}</div>
                <div className="text-[10px] text-blue-500 font-medium mt-0.5">onboard</div>
              </div>
            </div>

            {/* Status Buttons */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-600 mb-2.5">Broadcast Transit Condition:</div>
              <div className="grid grid-cols-3 gap-2.5">
                {['On Time', 'Delayed', 'Breakdown'].map(status => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer active:scale-95 ${
                      assignedBus?.status === status
                        ? status === 'On Time' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-500/20'
                          : status === 'Delayed' ? 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-500/20'
                          : 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Headcount Counter Card */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Riders Onboard</div>
            <div className="text-5xl font-extrabold text-slate-900 my-4 font-mono tracking-tight">{headcount}</div>
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="secondary" size="md" onClick={() => adjustHeadcount(-1)} className="text-lg font-bold py-3 rounded-2xl">
                − 1
              </Button>
              <Button variant="primary" size="md" onClick={() => adjustHeadcount(1)} className="text-lg font-bold py-3 rounded-2xl">
                + 1
              </Button>
            </div>
            <button
              onClick={() => { if (window.confirm("Reset headcount to 0?")) adjustHeadcount(-headcount); }}
              className="mt-3 text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
            >
              Reset Counter
            </button>
          </div>

          {/* Alert Form Card */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Send Rider Notice</div>
            <form onSubmit={handleSendAlert} className="space-y-3">
              <select
                className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                value={alertType}
                onChange={(e) => setAlertType(e.target.value)}
              >
                <option value="delay">Traffic Congestion Delay</option>
                <option value="alert">Vehicle Breakdown</option>
                <option value="crowd">Bus at Max Capacity</option>
                <option value="info">General Route Notice</option>
              </select>
              <textarea
                rows={2}
                className="w-full text-xs border border-slate-200 rounded-xl p-3 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 placeholder:text-slate-400 font-medium"
                placeholder="Type notification for waiting students..."
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                required
              />
              <Button type="submit" variant="primary" size="md" className="w-full rounded-2xl py-2.5 font-bold shadow-sm shadow-blue-500/20" icon={Send} isLoading={broadcasting}>
                Broadcast to Riders
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
