// src/components/ui/LoadingSkeleton.jsx
import React from 'react';
import { cn } from '../../utils/cn';

export function Skeleton({ className }) {
  return (
    <div className={cn("bg-gray-100 rounded-md animate-pulse", className)} />
  );
}

export function CardSkeleton({ className }) {
  return (
    <div className={cn("bg-white border border-gray-200 rounded-lg p-4 space-y-3", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
