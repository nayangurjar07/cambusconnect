// src/components/ui/Button.jsx
import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  fullWidth = false,
  type = 'button',
  icon: Icon,
  ...props
}) {
  const base = "inline-flex items-center justify-center font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer whitespace-nowrap hover:-translate-y-[1px] active:scale-[0.97] active:translate-y-0";

  const variants = {
    primary:   "bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/30 border-t border-blue-400 active:bg-blue-800",
    secondary: "bg-white/70 backdrop-blur-md border border-white hover:bg-white/90 text-slate-800 shadow-sm",
    outline:   "border border-slate-300/50 bg-white/50 backdrop-blur-sm hover:bg-white/80 text-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.02)]",
    ghost:     "bg-transparent hover:bg-white/50 text-slate-700 active:bg-white/70",
    dark:      "bg-gradient-to-b from-slate-800 to-slate-900 border-t border-slate-700 text-white shadow-lg shadow-slate-900/40",
    danger:    "bg-gradient-to-b from-red-500 to-red-600 border-t border-red-400 text-white active:bg-red-800 shadow-lg shadow-red-500/30",
    success:   "bg-gradient-to-b from-emerald-500 to-emerald-600 border-t border-emerald-400 text-white active:bg-emerald-800 shadow-lg shadow-emerald-500/30",
  };

  const sizes = {
    xs: "text-xs px-2.5 py-1 rounded-lg gap-1",
    sm: "text-xs px-3.5 py-2 rounded-xl gap-1.5",
    md: "text-sm px-4 py-2.5 rounded-xl gap-2",
    lg: "text-base px-6 py-3.5 rounded-2xl gap-2.5 font-bold shadow-md",
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={cn(
        base, 
        variants[variant] || variants.primary, 
        sizes[size] || sizes.md, 
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      {children}
    </button>
  );
}
