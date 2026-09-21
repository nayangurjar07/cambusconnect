// src/components/ui/MetricCard.jsx
import React from 'react';
import { cn } from '../../utils/cn';

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendPositive = true,
  className
}) {
  return (
    <div className={cn(
      "glass-card border border-white/60 rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(37,99,235,0.07)]",
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
        {trend && (
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            trendPositive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          )}>
            {trend}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 font-medium">{subtitle}</p>
      )}
    </div>
  );
}
