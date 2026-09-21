// src/components/domain/TransitTimelineCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Bus, MapPin, MoreHorizontal, ArrowRight, Radio, ShieldCheck, Navigation } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export function TransitTimelineCard({
  bus,
  fromStop = "Main Pickup Stop",
  toStop = "Campus Academic Block",
  eta = "8-12 min",
  status = "Bus on the way",
  trackUrl = "/student/track",
  className
}) {
  const busNumber = bus?.number || "14";
  const busRoute = bus?.route || "Campus Express";
  const trackingId = bus?.id ? `CC-${bus.id.slice(0, 6).toUpperCase()}` : `BUS-${busNumber}`;
  const isBreakdown = bus?.status === 'Breakdown';
  const isDelayed = bus?.status === 'Delayed';

  return (
    <div className={cn(
      "bg-white border border-slate-200/80 rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] space-y-4 transition-all hover:border-slate-300",
      className
    )}>
      {/* Top Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100/80 flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Bus {busNumber}
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                {busRoute}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Tracking ID: <span className="text-slate-600 font-semibold">{trackingId}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <div className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Transit Timeline */}
      <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-150/70 space-y-3">
        <div className="relative pl-6 space-y-4">
          {/* Connecting dashed line */}
          <div className="absolute left-[7px] top-2.5 bottom-2.5 w-[2px] border-l-2 border-dashed border-slate-300" />

          {/* From Stop */}
          <div className="relative flex items-start justify-between">
            <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-blue-600 bg-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">From:</span>
              <span className="text-xs font-semibold text-slate-800 block mt-0.5">{fromStop}</span>
            </div>
            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Pickup Point
            </span>
          </div>

          {/* To Stop */}
          <div className="relative flex items-start justify-between">
            <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-slate-400 bg-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Destination:</span>
              <span className="text-xs font-semibold text-slate-800 block mt-0.5">{toStop}</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
              Drop-off
            </span>
          </div>
        </div>

        {/* Real-time Status Badge */}
        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              isBreakdown ? "bg-rose-500" : isDelayed ? "bg-amber-500" : "bg-emerald-500"
            )} />
            <span className="font-semibold text-slate-700">
              Status: <span className="font-bold text-slate-900">{status}</span>
            </span>
          </div>
          <span className="font-bold text-blue-600 bg-white px-2.5 py-1 rounded-xl shadow-2xs border border-slate-200/60">
            ETA: {eta}
          </span>
        </div>
      </div>

      {/* Action CTA */}
      <Link to={trackUrl} className="block no-underline">
        <Button
          variant="primary"
          size="md"
          fullWidth
          icon={Navigation}
          className="py-3 rounded-2xl text-sm font-bold shadow-md shadow-blue-500/20"
        >
          Track Live Bus
        </Button>
      </Link>
    </div>
  );
}
