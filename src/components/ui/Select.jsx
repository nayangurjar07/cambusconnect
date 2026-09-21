// src/components/ui/Select.jsx
import React from 'react';
import { cn } from '../../utils/cn';

export function Select({ label, error, className, children, ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <select
        className={cn(
          "w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md appearance-none",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
          error && "border-red-300 focus:ring-red-500 focus:border-red-500",
          "bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%236b7280%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')]",
          "bg-[length:20px] bg-[position:right_8px_center] bg-no-repeat pr-9"
        )}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
