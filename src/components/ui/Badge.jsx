// src/components/ui/Badge.jsx
import React from 'react';
import { cn } from '../../utils/cn';

const variantStyles = {
  primary:  "bg-blue-50 text-blue-700 border-blue-200/80",
  success:  "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  warning:  "bg-amber-50 text-amber-700 border-amber-200/80",
  danger:   "bg-rose-50 text-rose-700 border-rose-200/80",
  info:     "bg-sky-50 text-sky-700 border-sky-200/80",
  neutral:  "bg-slate-100 text-slate-700 border-slate-200/70",
  dark:     "bg-slate-900 text-white border-transparent",
};

export function Badge({ children, variant = 'neutral', className, dot = false, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shadow-2xs",
        variantStyles[variant] || variantStyles.neutral,
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          variant === 'success' ? "bg-emerald-500" :
          variant === 'danger'  ? "bg-rose-500" :
          variant === 'warning' ? "bg-amber-500" :
          variant === 'primary' ? "bg-blue-500" :
          variant === 'dark'    ? "bg-white" :
          "bg-slate-400"
        )} />
      )}
      {children}
    </span>
  );
}
