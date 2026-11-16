// src/pages/student/Search.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search as SearchIcon, Bus, MapPin, ChevronRight, Users } from 'lucide-react';
import { subscribeToBuses, getBusTrackingHealth } from '../../services/transit';
import { PageHeader } from '../../components/layout/PageHeader';
import { Input } from '../../components/ui/Input';
import { StatusIndicator } from '../../components/ui/StatusIndicator';

export function StudentSearch() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [buses, setBuses] = useState([]);
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    const unsub = subscribeToBuses(setBuses);
    return () => unsub();
  }, []);

  const filtered = buses.filter(b =>
    !query ||
    b.route?.toLowerCase().includes(query.toLowerCase()) ||
    String(b.number).includes(query) ||
    b.driver?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <PageHeader title="Search Routes & Buses" subtitle="Find real-time schedules, assigned drivers, and stops" />

      {/* Pill Search Input */}
      <Input
        pill
        icon={SearchIcon}
        placeholder="Search by route name, bus number, or driver..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full"
      />

      <div className="space-y-3">
        {filtered.map(bus => (
          <Link
            key={bus.id}
            to="/student/track"
            className="block bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:border-slate-300 hover:shadow-md transition-all no-underline text-slate-900 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                  {bus.number}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Bus {bus.number}</h3>
                    {(() => {
                      const health = getBusTrackingHealth(bus);
                      const effectiveStatus = bus.status === 'Breakdown'
                        ? 'Breakdown'
                        : (bus.status === 'Delayed' ? 'Delayed' : (health.isLive ? 'On Time' : 'Off Duty'));
                      return <StatusIndicator status={effectiveStatus} />;
                    })()}
                  </div>
                  <div className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{bus.route || 'Campus Express Line'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-700">{bus.driver || 'Assigned Driver'}</div>
                  <div className="text-[11px] text-slate-400 font-medium">
                    {bus.headcount || 0} {(bus.headcount || 0) === 1 ? 'rider' : 'riders'} onboard
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 flex items-center justify-center transition-colors">
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                </div>
              </div>
            </div>
          </Link>
        ))}

        {filtered.length === 0 && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center text-slate-400 text-xs font-medium">
            {query ? `No campus routes match "${query}"` : 'No active buses currently available'}
          </div>
        )}
      </div>
    </div>
  );
}
