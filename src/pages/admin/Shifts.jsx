// src/pages/admin/Shifts.jsx
import React, { useState, useEffect } from 'react';
import { 
  Clock, Bus, Users, Search, Calendar, Save, CheckCircle2, 
  AlertCircle, Radio, User, Phone, Plus, Trash2 
} from 'lucide-react';
import { 
  db, collection, doc, query, where, orderBy, limit, onSnapshot, serverTimestamp 
} from '../../config/firebase';
import { 
  subscribeToShiftConfig, 
  saveShiftConfig, 
  format24to12, 
  DEFAULT_SHIFTS 
} from '../../services/workforce';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { MetricCard } from '../../components/ui/MetricCard';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../contexts/ToastContext';

export function AdminShifts() {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState('live');

  // Live Runs State
  const [activeSessions, setActiveSessions] = useState([]);
  const [busesMap, setBusesMap] = useState({});

  // History State
  const [historySessions, setHistorySessions] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyDate, setHistoryDate] = useState('');

  // Structured Shifts State (§5)
  const [shiftsList, setShiftsList] = useState(DEFAULT_SHIFTS);
  const [savingSettings, setSavingSettings] = useState(false);

  // Submitted Boardings State
  const [submittedRecords, setSubmittedRecords] = useState([]);
  const [submittedSearch, setSubmittedSearch] = useState('');

  // 1. Subscribe to buses (for headcounts and route info)
  useEffect(() => {
    const unsubBuses = onSnapshot(collection(db, 'buses'), (snapshot) => {
      const map = {};
      snapshot.forEach(d => {
        map[d.id] = { id: d.id, ...d.data() };
      });
      setBusesMap(map);
    });
    return () => unsubBuses();
  }, []);

  // 2. Subscribe to Active driver sessions
  useEffect(() => {
    const q = query(collection(db, 'driverSessions'), where('status', '==', 'Active'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setActiveSessions(list);
    }, (err) => {
      console.error("Error loading active sessions:", err);
    });
    return () => unsub();
  }, []);

  // 3. Subscribe to Stopped driver sessions (history)
  useEffect(() => {
    const q = query(
      collection(db, 'driverSessions'), 
      where('status', '==', 'Stopped'), 
      orderBy('startTime', 'desc'), 
      limit(50)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setHistorySessions(list);
    }, (err) => {
      console.error("Error loading shift history:", err);
    });
    return () => unsub();
  }, []);

  // 4. Subscribe to Structured Shift Configuration (§5)
  useEffect(() => {
    const unsub = subscribeToShiftConfig((loadedShifts) => {
      setShiftsList(loadedShifts);
    });
    return () => unsub();
  }, []);

  // 5. Subscribe to Submitted Boardings
  useEffect(() => {
    const q = query(
      collection(db, 'submitted-boardings'),
      orderBy('submittedAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setSubmittedRecords(list);
    }, (err) => {
      console.error("Error loading submitted boardings:", err);
    });
    return () => unsub();
  }, []);

  // Save Shift Config
  const handleSaveSettings = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSavingSettings(true);
    try {
      await saveShiftConfig(shiftsList);
      showSuccess("Shift configuration saved successfully");
    } catch (err) {
      showError("Failed to save shift config: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateShift = (index, field, value) => {
    setShiftsList(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleToggleDay = (index, day) => {
    setShiftsList(prev => {
      const next = [...prev];
      const currentDays = next[index].activeDays || [];
      const updatedDays = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day];
      next[index] = { ...next[index], activeDays: updatedDays };
      return next;
    });
  };

  const handleAddShift = () => {
    const newId = `shift_${Date.now()}`;
    setShiftsList(prev => [
      ...prev,
      {
        id: newId,
        name: `Shift ${prev.length + 1}`,
        enabled: true,
        startTime: '09:00',
        endTime: '17:00',
        activeDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
      }
    ]);
  };

  const handleRemoveShift = (index) => {
    if (shiftsList.length <= 1) {
      showError("At least one shift configuration must be kept.");
      return;
    }
    setShiftsList(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations for Live tab
  let totalLiveHeadcount = 0;
  activeSessions.forEach(session => {
    const bus = busesMap[session.busId] || {};
    const headcount = typeof bus.headcount !== 'undefined' ? bus.headcount : (session.headcount || 0);
    totalLiveHeadcount += headcount;
  });

  // Filtered history
  const filteredHistory = historySessions.filter(session => {
    const search = historySearch.toLowerCase();
    const busNum = (session.busNumber || '').toString().toLowerCase();
    const route = (session.route || '').toLowerCase();
    const driver = (session.driverName || '').toLowerCase();
    const email = (session.driverEmail || '').toLowerCase();

    const matchesSearch = !search || 
      busNum.includes(search) || 
      route.includes(search) || 
      driver.includes(search) || 
      email.includes(search);

    let matchesDate = true;
    if (historyDate && session.startTime) {
      const sessionDate = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
      const filterDateObj = new Date(historyDate);
      matchesDate = 
        sessionDate.getFullYear() === filterDateObj.getFullYear() &&
        sessionDate.getMonth() === filterDateObj.getMonth() &&
        sessionDate.getDate() === filterDateObj.getDate();
    }

    return matchesSearch && matchesDate;
  });

  // Filtered submitted boardings
  const filteredSubmitted = submittedRecords.filter(rec => {
    const search = submittedSearch.toLowerCase();
    const name = (rec.studentName || '').toLowerCase();
    const sId = (rec.studentId || '').toLowerCase();
    const busNum = (rec.busNumber || '').toString().toLowerCase();
    const route = (rec.routeName || '').toLowerCase();
    const email = (rec.driverEmail || '').toLowerCase();

    return !search ||
      name.includes(search) ||
      sId.includes(search) ||
      busNum.includes(search) ||
      route.includes(search) ||
      email.includes(search);
  });

  const tabs = [
    { id: 'live', label: 'Live Runs', count: activeSessions.length },
    { id: 'history', label: 'Shift History' },
    { id: 'settings', label: 'Configuration' },
    { id: 'submitted', label: 'Submitted Boardings' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Shifts"
        subtitle="Manage daily driver shifts, active runs, and dispatch logs"
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ---------------- LIVE RUNS TAB ---------------- */}
      {activeTab === 'live' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              title="Active Runs"
              value={activeSessions.length}
              subtitle="Vehicles currently running"
              icon={Bus}
            />
            <MetricCard
              title="Total Riders Onboard"
              value={totalLiveHeadcount}
              subtitle="Real-time passenger count"
              icon={Users}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeSessions.map((session) => {
              const bus = busesMap[session.busId] || {};
              const headcount = typeof bus.headcount !== 'undefined' ? bus.headcount : (session.headcount || 0);
              const driver = session.driverName || bus.driver || 'No Driver';
              const driverPhone = session.driverPhone || bus.phone || '—';
              const conductor = session.conductorName || bus.conductor || 'No Conductor';
              const route = session.route || bus.route || 'No Route';
              const busNumber = session.busNumber || bus.number || '--';
              const startStr = session.startTime?.toDate 
                ? session.startTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '--:--';

              return (
                <Card key={session.id} className="p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-md bg-gray-900 text-white font-semibold text-sm flex items-center justify-center">
                          {busNumber}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 text-sm">Bus {busNumber}</h4>
                          <span className="text-[11px] text-gray-400">Started {startStr}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-xs font-medium border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Live
                      </div>
                    </div>

                    <div className="p-2.5 bg-gray-50 rounded-md mb-2.5">
                      <div className="text-[11px] text-gray-400">Route</div>
                      <div className="text-xs font-medium text-gray-800 truncate" title={route}>
                        {route}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Driver:</span>
                        <span className="font-medium text-gray-800">{driver} ({driverPhone})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Conductor:</span>
                        <span className="font-medium text-gray-800">{conductor}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 mt-2.5 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 truncate max-w-[150px]">
                      {session.driverEmail || 'driver'}
                    </span>
                    <span className="text-xs font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md">
                      {headcount} riders
                    </span>
                  </div>
                </Card>
              );
            })}

            {activeSessions.length === 0 && (
              <div className="col-span-full py-12 text-center text-xs text-gray-400">
                No active runs currently in progress. When drivers start their shift, they will appear here.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- SHIFT HISTORY TAB ---------------- */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="max-w-xs w-full">
              <Input
                icon={Search}
                placeholder="Search by bus, route, or crew..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
            <div className="w-44">
              <Input
                type="date"
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
              />
            </div>
            {(historySearch || historyDate) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setHistorySearch(''); setHistoryDate(''); }}
              >
                Clear
              </Button>
            )}
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Vehicle & Route</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Crew Details</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Timing & Duration</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Riders</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredHistory.map((session) => {
                    const start = session.startTime?.toDate ? session.startTime.toDate() : (session.startTime ? new Date(session.startTime) : null);
                    const end = session.endTime?.toDate ? session.endTime.toDate() : (session.endTime ? new Date(session.endTime) : null);

                    const startStr = start 
                      ? start.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                      : '--';
                    const endStr = end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';

                    let durationStr = '--';
                    if (start && end) {
                      const diffMins = Math.round((end - start) / 60000);
                      if (diffMins >= 60) {
                        const hrs = Math.floor(diffMins / 60);
                        const mins = diffMins % 60;
                        durationStr = `${hrs}h ${mins}m`;
                      } else {
                        durationStr = `${diffMins}m`;
                      }
                    }

                    return (
                      <tr key={session.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <div className="text-sm font-semibold text-gray-900">Bus {session.busNumber || '--'}</div>
                          <div className="text-xs text-gray-400 max-w-[200px] truncate">{session.route || '—'}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">
                          <div><span className="text-gray-400">Driver:</span> {session.driverName || '—'}</div>
                          <div><span className="text-gray-400">Conductor:</span> {session.conductorName || '—'}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">
                          <div>{startStr} – {endStr}</div>
                          <div className="text-[11px] text-gray-400">Duration: {durationStr}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-gray-900">
                          {session.headcount || 0}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {session.driverEmail || '—'}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-gray-400">
                        No shift history records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ---------------- CONFIGURATION TAB ---------------- */}
      {activeTab === 'settings' && (
        <div className="space-y-4 max-w-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Campus Shift Configuration</h2>
              <p className="text-xs text-gray-500">Configure standard operating shift slots, operating hours, and active days for buses and routes.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Plus}
              onClick={handleAddShift}
            >
              Add Shift
            </Button>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            {shiftsList.map((shift, idx) => (
              <Card key={shift.id || idx} className="p-4 border border-gray-200">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={shift.enabled}
                        onChange={(e) => handleUpdateShift(idx, 'enabled', e.target.checked)}
                      />
                      <span className="text-xs font-bold text-gray-900">
                        {shift.name || `Shift ${idx + 1}`}
                      </span>
                    </label>
                    <Badge variant={shift.enabled ? 'success' : 'neutral'}>
                      {shift.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-mono">
                      {format24to12(shift.startTime)} – {format24to12(shift.endTime)}
                    </span>
                    {shiftsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveShift(idx)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                        title="Delete Shift"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <Input
                    label="Shift Name"
                    value={shift.name || ''}
                    onChange={(e) => handleUpdateShift(idx, 'name', e.target.value)}
                    required
                  />
                  <Input
                    type="time"
                    label="Start Time (24h)"
                    value={shift.startTime || '08:30'}
                    onChange={(e) => handleUpdateShift(idx, 'startTime', e.target.value)}
                    required
                  />
                  <Input
                    type="time"
                    label="End Time (24h)"
                    value={shift.endTime || '16:30'}
                    onChange={(e) => handleUpdateShift(idx, 'endTime', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Operating Days
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'mon', label: 'Mon' },
                      { key: 'tue', label: 'Tue' },
                      { key: 'wed', label: 'Wed' },
                      { key: 'thu', label: 'Thu' },
                      { key: 'fri', label: 'Fri' },
                      { key: 'sat', label: 'Sat' },
                      { key: 'sun', label: 'Sun' }
                    ].map(day => {
                      const isActive = (shift.activeDays || []).includes(day.key);
                      return (
                        <button
                          key={day.key}
                          type="button"
                          onClick={() => handleToggleDay(idx, day.key)}
                          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>
            ))}

            <div className="pt-2 flex items-center gap-3">
              <Button type="submit" variant="primary" size="sm" icon={Save} isLoading={savingSettings}>
                Save Shift Configuration
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------- SUBMITTED BOARDINGS TAB ---------------- */}
      {activeTab === 'submitted' && (
        <div className="space-y-3">
          <div className="max-w-xs w-full">
            <Input
              icon={Search}
              placeholder="Search by student, ID, or bus..."
              value={submittedSearch}
              onChange={(e) => setSubmittedSearch(e.target.value)}
            />
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Student</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Bus & Route</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Scanned At</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Submitted At</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Driver Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSubmitted.map((rec) => {
                    const scannedDate = rec.scannedAt ? new Date(rec.scannedAt) : null;
                    const scannedStr = scannedDate ? scannedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

                    const subTime = rec.submittedAt?.toDate ? rec.submittedAt.toDate() : (rec.submittedAt ? new Date(rec.submittedAt) : null);
                    const subStr = subTime ? subTime.toLocaleDateString() + ' ' + subTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

                    return (
                      <tr key={rec.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <div className="text-sm font-semibold text-gray-900">{rec.studentName || 'Unknown'}</div>
                          <div className="text-xs text-gray-400">ID: {rec.studentId || '—'}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">
                          <div className="font-medium text-gray-900">Bus {rec.busNumber || '—'}</div>
                          <div className="text-gray-400 truncate max-w-[180px]">{rec.routeName || '—'}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">
                          {scannedStr}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">
                          {subStr}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {rec.driverEmail || '—'}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredSubmitted.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-gray-400">
                        No submitted boardings found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
