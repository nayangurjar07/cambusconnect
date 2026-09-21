// src/components/ui/StatusIndicator.jsx
import React from 'react';
import { cn } from '../../utils/cn';

const statusConfig = {
  'On Time':    { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  'Delayed':    { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  'Breakdown':  { dot: 'bg-red-500',   text: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200' },
  'Off Duty':   { dot: 'bg-gray-400',  text: 'text-gray-600',  bg: 'bg-gray-50',  border: 'border-gray-200' },
  'In Transit': { dot: 'bg-blue-500',  text: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-200' },
};

export function StatusIndicator({ status, className }) {
  const config = statusConfig[status] || statusConfig['Off Duty'];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md border",
      config.bg, config.text, config.border,
      className
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      {status || 'Unknown'}
    </span>
  );
}
