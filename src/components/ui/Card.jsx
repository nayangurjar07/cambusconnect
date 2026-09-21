// src/components/ui/Card.jsx
import React from 'react';
import { cn } from '../../utils/cn';

export function Card({ 
  children, 
  className, 
  variant = 'default',
  hover = false, 
  ...props 
}) {
  const variants = {
    default: "glass-card text-slate-900 border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)]",
    accent:  "bg-gradient-to-br from-blue-500 to-blue-700 text-white border border-blue-400/50 shadow-lg shadow-blue-600/30",
    subtle:  "glass-panel text-slate-800",
    dark:    "bg-slate-900/80 backdrop-blur-xl text-white border border-slate-700 shadow-xl",
  };

  return (
    <div
      className={cn(
        "rounded-2xl transition-all duration-300 overflow-hidden",
        variants[variant] || variants.default,
        hover && "hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(37,99,235,0.08)] cursor-pointer hover:border-white/80",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }) {
  return (
    <div className={cn("px-5 py-3.5 border-b border-white/40 flex items-center justify-between", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }) {
  return (
    <h3 className={cn("text-sm font-bold text-slate-900 tracking-tight", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardBody({ children, className, ...props }) {
  return (
    <div className={cn("p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className, ...props }) {
  return (
    <div className={cn("px-5 py-3 bg-white/40 border-t border-white/40 rounded-b-2xl", className)} {...props}>
      {children}
    </div>
  );
}
