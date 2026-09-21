// src/components/ui/CircularAction.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

export function CircularAction({
  icon: Icon,
  label,
  to,
  onClick,
  variant = 'default',
  badge,
  className
}) {
  const circleStyles = {
    default: "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200/50 shadow-2xs",
    dark:    "bg-slate-900 text-white hover:bg-slate-800 shadow-md shadow-slate-900/10",
    blue:    "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/25",
    orange:  "bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200/60",
  };

  const content = (
    <div className={cn("flex flex-col items-center gap-2 group cursor-pointer select-none", className)}>
      <div className="relative">
        <div
          className={cn(
            "w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-active:scale-95",
            circleStyles[variant] || circleStyles.default
          )}
        >
          {Icon && <Icon className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:scale-110" />}
        </div>
        {badge !== undefined && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
            {badge}
          </span>
        )}
      </div>
      <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900 text-center leading-tight tracking-tight">
        {label}
      </span>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl">
      {content}
    </button>
  );
}
