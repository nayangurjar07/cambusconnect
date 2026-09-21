// src/components/domain/VehicleCard.jsx
import React from 'react';
import { Bus, MapPin, Users, Clock } from 'lucide-react';
import { StatusIndicator } from '../ui/StatusIndicator';

export function VehicleCard({ bus, onClick, compact = false }) {
  if (!bus) return null;

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-blue-600 group-hover:text-white transition-colors">
            {bus.number}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">Bus {bus.number}</div>
            <div className="text-xs text-slate-500 truncate font-medium">{bus.route || 'No route'}</div>
          </div>
        </div>
        <div className="text-right shrink-0 ml-2">
          <StatusIndicator status={bus.status} />
          <span className="block text-[11px] text-slate-400 font-medium mt-0.5">{bus.headcount || 0} onboard</span>
        </div>
      </button>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all ${
        onClick ? 'cursor-pointer hover:border-slate-300 hover:shadow-md' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs">
            {bus.number}
          </span>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Bus {bus.number}</h4>
            <p className="text-xs text-slate-500 font-medium">{bus.route || 'Campus Express'}</p>
          </div>
        </div>
        <StatusIndicator status={bus.status} />
      </div>

      <div className="grid grid-cols-3 gap-2.5 text-xs">
        <div className="bg-slate-50/70 rounded-xl p-2.5 border border-slate-150/60">
          <span className="text-[10px] uppercase font-bold text-slate-400">Driver</span>
          <div className="font-semibold text-slate-800 truncate mt-0.5">{bus.driver || '—'}</div>
        </div>
        <div className="bg-slate-50/70 rounded-xl p-2.5 border border-slate-150/60">
          <span className="text-[10px] uppercase font-bold text-slate-400">Capacity</span>
          <div className="font-semibold text-slate-800 truncate mt-0.5">{bus.headcount || 0} riders</div>
        </div>
        <div className="bg-blue-50/60 rounded-xl p-2.5 border border-blue-100/60">
          <span className="text-[10px] uppercase font-bold text-blue-500">ETA</span>
          <div className="font-bold text-blue-700 truncate mt-0.5">{bus.eta || '8-12 min'}</div>
        </div>
      </div>
    </div>
  );
}
