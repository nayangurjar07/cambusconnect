// src/components/ui/Input.jsx
import React from 'react';
import { cn } from '../../utils/cn';

export function Input({
  label,
  error,
  className,
  inputClassName,
  pill = false,
  icon: Icon,
  type = 'text',
  ...props
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <Icon className="absolute left-4 w-4 h-4 text-slate-400 pointer-events-none" />
        )}
        <input
          type={type}
          className={cn(
            "w-full text-sm bg-white/70 border border-slate-200 text-slate-900 shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all duration-200",
            "placeholder:text-slate-400 placeholder:font-normal",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white",
            "disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
            pill ? "rounded-full py-3 px-5" : "rounded-xl py-2.5 px-4",
            Icon && "pl-11",
            error && "border-red-300 focus:ring-red-500/20 focus:border-red-500 text-red-900",
            inputClassName
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
}
